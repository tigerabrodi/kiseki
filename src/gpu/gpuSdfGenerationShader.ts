import { CHUNK_SIZE } from '../voxel/chunk.ts'
import { GPU_SDF_MAX_DISTANCE } from './sdfStorageCodec.ts'

export const GPU_SDF_GENERATION_WORKGROUP_SIZE = 64

export function createGpuSdfGenerationShader(): string {
  return /* wgsl */ `
const CHUNK_SIZE: u32 = ${CHUNK_SIZE}u;
const CHUNK_SIZE_I32: i32 = ${CHUNK_SIZE};
const CHUNK_LAYER_SIZE: u32 = ${CHUNK_SIZE * CHUNK_SIZE}u;
const CHUNK_VOLUME: u32 = ${CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE}u;
const MAX_DISTANCE: i32 = ${GPU_SDF_MAX_DISTANCE};

@group(0) @binding(0) var<storage, read> voxels: array<u32>;
@group(0) @binding(1) var<storage, read_write> sdf: array<f32>;

fn voxel_index(x: u32, y: u32, z: u32) -> u32 {
  return x + y * CHUNK_SIZE + z * CHUNK_LAYER_SIZE;
}

fn get_material(x: i32, y: i32, z: i32) -> u32 {
  if (x < 0 || x >= CHUNK_SIZE_I32 || y < 0 || y >= CHUNK_SIZE_I32 || z < 0 || z >= CHUNK_SIZE_I32) {
    return 0u;
  }

  return voxels[voxel_index(u32(x), u32(y), u32(z))];
}

fn scan_direction(origin: vec3<i32>, direction: vec3<i32>, origin_is_solid: bool) -> i32 {
  for (var step = 1; step <= MAX_DISTANCE; step += 1) {
    let sample = origin + direction * step;
    let sample_is_solid = get_material(sample.x, sample.y, sample.z) != 0u;

    if (sample_is_solid != origin_is_solid) {
      return step;
    }
  }

  return MAX_DISTANCE + 1;
}

@compute @workgroup_size(${GPU_SDF_GENERATION_WORKGROUP_SIZE}, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;

  if (index >= CHUNK_VOLUME) {
    return;
  }

  let z = index / CHUNK_LAYER_SIZE;
  let layer_index = index % CHUNK_LAYER_SIZE;
  let y = layer_index / CHUNK_SIZE;
  let x = layer_index % CHUNK_SIZE;
  let origin = vec3<i32>(i32(x), i32(y), i32(z));
  let origin_is_solid = get_material(origin.x, origin.y, origin.z) != 0u;
  var nearest_distance = MAX_DISTANCE + 1;

  nearest_distance = min(nearest_distance, scan_direction(origin, vec3<i32>(1, 0, 0), origin_is_solid));
  nearest_distance = min(nearest_distance, scan_direction(origin, vec3<i32>(-1, 0, 0), origin_is_solid));
  nearest_distance = min(nearest_distance, scan_direction(origin, vec3<i32>(0, 1, 0), origin_is_solid));
  nearest_distance = min(nearest_distance, scan_direction(origin, vec3<i32>(0, -1, 0), origin_is_solid));
  nearest_distance = min(nearest_distance, scan_direction(origin, vec3<i32>(0, 0, 1), origin_is_solid));
  nearest_distance = min(nearest_distance, scan_direction(origin, vec3<i32>(0, 0, -1), origin_is_solid));

  let unsigned_distance = f32(min(nearest_distance, MAX_DISTANCE)) - 0.5;

  sdf[index] = select(unsigned_distance, -unsigned_distance, origin_is_solid);
}
`
}
