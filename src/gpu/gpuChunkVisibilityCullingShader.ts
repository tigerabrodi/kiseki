import { CHUNK_SIZE } from '../voxel/chunk.ts'

export const GPU_CHUNK_VISIBILITY_CULL_WORKGROUP_SIZE = 64
export const GPU_CHUNK_VISIBILITY_PARAM_VEC4_COUNT = 7
export const GPU_CHUNK_VISIBILITY_PARAM_BYTE_LENGTH =
  GPU_CHUNK_VISIBILITY_PARAM_VEC4_COUNT * 4 * Float32Array.BYTES_PER_ELEMENT

export function createGpuChunkVisibilityCullingShader(): string {
  return /* wgsl */ `
struct ChunkBounds {
  origin_active: vec4<f32>,
}

struct FrustumParams {
  planes: array<vec4<f32>, 6>,
  counts: vec4<u32>,
}

@group(0) @binding(0) var<storage, read> chunk_bounds: array<ChunkBounds>;
@group(0) @binding(1) var<storage, read_write> visibility_words: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: FrustumParams;

fn is_chunk_visible(origin: vec3<f32>) -> bool {
  let extents = vec3<f32>(${CHUNK_SIZE / 2}.0, ${CHUNK_SIZE / 2}.0, ${CHUNK_SIZE / 2}.0);
  let center = origin + extents;

  for (var plane_index = 0u; plane_index < 6u; plane_index += 1u) {
    let plane = params.planes[plane_index];
    let signed_distance = dot(plane.xyz, center) + plane.w;
    let radius = dot(abs(plane.xyz), extents);

    if (signed_distance + radius < 0.0) {
      return false;
    }
  }

  return true;
}

@compute @workgroup_size(${GPU_CHUNK_VISIBILITY_CULL_WORKGROUP_SIZE}, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let slot_index = global_id.x;

  if (slot_index >= params.counts.x) {
    return;
  }

  let chunk_bound = chunk_bounds[slot_index].origin_active;

  if (chunk_bound.w < 0.5) {
    return;
  }

  if (!is_chunk_visible(chunk_bound.xyz)) {
    return;
  }

  let word_index = slot_index >> 5u;
  let bit_index = slot_index & 31u;

  atomicOr(&visibility_words[word_index], 1u << bit_index);
}
`
}
