import { CHUNK_SIZE } from '../voxel/chunk.ts'
import {
  GPU_OCCLUSION_FACE_COUNT,
  GPU_OCCLUSION_FACE_MASK_STRIDE,
  GPU_OCCLUSION_INVALID_SLOT,
  GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE,
  GPU_OCCLUSION_SLOT_METADATA_STRIDE,
} from './chunkOcclusionGraph.ts'

export const GPU_CHUNK_OCCLUSION_BOUNDARY_WORKGROUP_SIZE = 64
export const GPU_CHUNK_OCCLUSION_PARAM_BYTE_LENGTH =
  4 * Uint32Array.BYTES_PER_ELEMENT

export function createGpuChunkOcclusionFaceMaskShader(): string {
  return /* wgsl */ `
const CHUNK_SIZE: u32 = ${CHUNK_SIZE}u;
const CHUNK_LAYER_SIZE: u32 = ${CHUNK_SIZE * CHUNK_SIZE}u;
const FACE_COUNT: u32 = ${GPU_OCCLUSION_FACE_COUNT}u;
const FACE_CELL_COUNT: u32 = ${CHUNK_SIZE * CHUNK_SIZE}u;
const FACE_MASK_STRIDE: u32 = ${GPU_OCCLUSION_FACE_MASK_STRIDE}u;
const SLOT_METADATA_STRIDE: u32 = ${GPU_OCCLUSION_SLOT_METADATA_STRIDE}u;

struct Params {
  slot_count: u32,
  player_slot_index: u32,
  visibility_word_count: u32,
  _pad0: u32,
}

@group(0) @binding(0) var<storage, read> voxels: array<u32>;
@group(0) @binding(1) var<storage, read> slot_metadata: array<u32>;
@group(0) @binding(2) var<storage, read_write> face_masks: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: Params;

fn voxel_index(x: u32, y: u32, z: u32) -> u32 {
  return x + y * CHUNK_SIZE + z * CHUNK_LAYER_SIZE;
}

fn get_boundary_voxel_coordinates(face_index: u32, cell_index: u32) -> vec3<u32> {
  let u = cell_index & 31u;
  let v = cell_index >> 5u;

  switch face_index {
    case 0u: {
      return vec3<u32>(CHUNK_SIZE - 1u, u, v);
    }
    case 1u: {
      return vec3<u32>(0u, u, v);
    }
    case 2u: {
      return vec3<u32>(u, CHUNK_SIZE - 1u, v);
    }
    case 3u: {
      return vec3<u32>(u, 0u, v);
    }
    case 4u: {
      return vec3<u32>(u, v, CHUNK_SIZE - 1u);
    }
    default: {
      return vec3<u32>(u, v, 0u);
    }
  }
}

@compute @workgroup_size(1, ${GPU_CHUNK_OCCLUSION_BOUNDARY_WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let slot_index = global_id.x;
  let boundary_sample_index = global_id.y;

  if (slot_index >= params.slot_count || boundary_sample_index >= FACE_COUNT * FACE_CELL_COUNT) {
    return;
  }

  let metadata_offset = slot_index * SLOT_METADATA_STRIDE;

  if (slot_metadata[metadata_offset] == 0u) {
    return;
  }

  let face_index = boundary_sample_index / FACE_CELL_COUNT;
  let cell_index = boundary_sample_index % FACE_CELL_COUNT;
  let coords = get_boundary_voxel_coordinates(face_index, cell_index);
  let voxel_word_offset = slot_metadata[metadata_offset + 1u];
  let material_id = voxels[voxel_word_offset + voxel_index(coords.x, coords.y, coords.z)];
  let face_bit = 1u << face_index;
  let face_mask_offset = slot_index * FACE_MASK_STRIDE;

  _ = atomicOr(&face_masks[face_mask_offset + 2u], 1u);

  if (material_id == 0u) {
    _ = atomicOr(&face_masks[face_mask_offset], face_bit);
    return;
  }

  _ = atomicOr(&face_masks[face_mask_offset + 1u], face_bit);
}
`
}

export function createGpuChunkOcclusionPropagationShader(): string {
  return /* wgsl */ `
const FACE_MASK_STRIDE: u32 = ${GPU_OCCLUSION_FACE_MASK_STRIDE}u;
const NEIGHBOR_SLOT_STRIDE: u32 = ${GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE}u;
const INVALID_SLOT: u32 = ${GPU_OCCLUSION_INVALID_SLOT}u;

@group(0) @binding(0) var<storage, read_write> face_masks: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read> neighbor_slots: array<u32>;
@group(0) @binding(2) var<storage, read_write> reachability: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> occlusion_words: array<atomic<u32>>;

fn opposite_face_index(face_index: u32) -> u32 {
  switch face_index {
    case 0u: {
      return 1u;
    }
    case 1u: {
      return 0u;
    }
    case 2u: {
      return 3u;
    }
    case 3u: {
      return 2u;
    }
    case 4u: {
      return 5u;
    }
    default: {
      return 4u;
    }
  }
}

fn get_neighbor_slot(slot_index: u32, face_index: u32) -> u32 {
  return neighbor_slots[slot_index * NEIGHBOR_SLOT_STRIDE + face_index];
}

fn mark_slot_visible(slot_index: u32) {
  let word_index = slot_index >> 5u;

  _ = atomicOr(&occlusion_words[word_index], 1u << (slot_index & 31u));
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let slot_index = global_id.x;

  let face_mask_offset = slot_index * FACE_MASK_STRIDE;
  let is_active = atomicLoad(&face_masks[face_mask_offset + 2u]);

  if (is_active == 0u) {
    return;
  }

  var reachable_faces = atomicLoad(&reachability[slot_index]);
  let open_faces = atomicLoad(&face_masks[face_mask_offset]);

  let connected_entry_faces = reachable_faces & open_faces;

  if (connected_entry_faces == 0u) {
    return;
  }

  mark_slot_visible(slot_index);

  for (var exit_face = 0u; exit_face < 6u; exit_face += 1u) {
    let exit_bit = 1u << exit_face;

    if ((open_faces & exit_bit) == 0u) {
      continue;
    }

    let neighbor_slot = get_neighbor_slot(slot_index, exit_face);

    if (neighbor_slot == INVALID_SLOT) {
      continue;
    }

    let neighbor_face = opposite_face_index(exit_face);
    let neighbor_face_bit = 1u << neighbor_face;
    let neighbor_face_mask_offset = neighbor_slot * FACE_MASK_STRIDE;
    let neighbor_open_faces = atomicLoad(&face_masks[neighbor_face_mask_offset]);
    let neighbor_solid_faces = atomicLoad(&face_masks[neighbor_face_mask_offset + 1u]);

    if ((neighbor_solid_faces & neighbor_face_bit) != 0u) {
      mark_slot_visible(neighbor_slot);
    }

    if ((neighbor_open_faces & neighbor_face_bit) == 0u) {
      continue;
    }

    _ = atomicOr(&reachability[neighbor_slot], neighbor_face_bit);
  }
}
`
}
