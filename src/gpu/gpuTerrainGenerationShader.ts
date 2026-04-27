import { CHUNK_SIZE } from '../voxel/chunk.ts'

export const GPU_TERRAIN_GENERATION_WORKGROUP_SIZE = 4
export const GPU_TERRAIN_GENERATION_PARAM_WORD_COUNT = 20
export const GPU_TERRAIN_GENERATION_PARAM_BYTE_LENGTH =
  GPU_TERRAIN_GENERATION_PARAM_WORD_COUNT * Uint32Array.BYTES_PER_ELEMENT
export const GPU_TERRAIN_GENERATION_DISPATCH_SIZE =
  CHUNK_SIZE / GPU_TERRAIN_GENERATION_WORKGROUP_SIZE

export function createGpuTerrainGenerationShader(): string {
  return /* wgsl */ `
struct TerrainParams {
  chunk_coords: vec4<i32>,
  scalars_a: vec4<f32>,
  scalars_b: vec4<f32>,
  scalars_c: vec4<f32>,
  seeds: vec4<u32>,
}

@group(0) @binding(0) var<storage, read_write> voxels: array<u32>;
@group(0) @binding(1) var<uniform> params: TerrainParams;

fn fade(value: f32) -> f32 {
  return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
}

fn mix_hash(value: u32) -> u32 {
  var hash = value;

  hash = hash ^ (hash >> 16u);
  hash = hash * 0x7feb352du;
  hash = hash ^ (hash >> 15u);
  hash = hash * 0x846ca68bu;
  hash = hash ^ (hash >> 16u);

  return hash;
}

fn hash_grid_point(seed_hash: u32, grid_x: i32, grid_z: i32) -> u32 {
  let mixed = seed_hash ^
    (bitcast<u32>(grid_x) * 0x1f123bb5u) ^
    (bitcast<u32>(grid_z) * 0x5f356495u);

  return mix_hash(mixed);
}

fn gradient(hash: u32) -> vec2<f32> {
  switch (hash & 7u) {
    case 0u: {
      return vec2<f32>(1.0, 0.0);
    }
    case 1u: {
      return vec2<f32>(-1.0, 0.0);
    }
    case 2u: {
      return vec2<f32>(0.0, 1.0);
    }
    case 3u: {
      return vec2<f32>(0.0, -1.0);
    }
    case 4u: {
      return vec2<f32>(0.70710678, 0.70710678);
    }
    case 5u: {
      return vec2<f32>(-0.70710678, 0.70710678);
    }
    case 6u: {
      return vec2<f32>(0.70710678, -0.70710678);
    }
    default: {
      return vec2<f32>(-0.70710678, -0.70710678);
    }
  }
}

fn gradient_dot(
  seed_hash: u32,
  grid_x: i32,
  grid_z: i32,
  offset_x: f32,
  offset_z: f32
) -> f32 {
  let gradient_vector = gradient(hash_grid_point(seed_hash, grid_x, grid_z));

  return gradient_vector.x * offset_x + gradient_vector.y * offset_z;
}

fn sample_gradient_noise_2d(sample_x: f32, sample_z: f32, seed_hash: u32) -> f32 {
  let min_x = i32(floor(sample_x));
  let min_z = i32(floor(sample_z));
  let offset_x = sample_x - floor(sample_x);
  let offset_z = sample_z - floor(sample_z);
  let fade_x = fade(offset_x);
  let fade_z = fade(offset_z);

  let noise_00 = gradient_dot(seed_hash, min_x, min_z, offset_x, offset_z);
  let noise_10 = gradient_dot(seed_hash, min_x + 1, min_z, offset_x - 1.0, offset_z);
  let noise_01 = gradient_dot(seed_hash, min_x, min_z + 1, offset_x, offset_z - 1.0);
  let noise_11 = gradient_dot(seed_hash, min_x + 1, min_z + 1, offset_x - 1.0, offset_z - 1.0);

  return mix(
    mix(noise_00, noise_10, fade_x),
    mix(noise_01, noise_11, fade_x),
    fade_z
  );
}

fn sample_normalized_noise_2d(
  world_x: i32,
  world_z: i32,
  frequency: f32,
  seed_hash: u32
) -> f32 {
  return clamp(
    0.5 + sample_gradient_noise_2d(
      f32(world_x) * frequency,
      f32(world_z) * frequency,
      seed_hash
    ),
    0.0,
    1.0
  );
}

fn get_surface_height(world_x: i32, world_z: i32) -> i32 {
  let continental_noise = sample_gradient_noise_2d(
    f32(world_x) * params.scalars_a.w,
    f32(world_z) * params.scalars_a.w,
    params.seeds.x
  );
  let detail_noise = sample_gradient_noise_2d(
    f32(world_x) * params.scalars_b.x + params.scalars_b.y,
    f32(world_z) * params.scalars_b.x + params.scalars_b.z,
    params.seeds.y
  );
  let ridge_noise = sample_gradient_noise_2d(
    f32(world_x) * params.scalars_c.x,
    f32(world_z) * params.scalars_c.x,
    params.seeds.z
  );
  let ridge = clamp(1.0 - abs(ridge_noise) * 3.1, 0.0, 1.0);
  let valley = clamp(-continental_noise * 1.45, 0.0, 1.0);
  let raw_height = params.scalars_a.x +
    continental_noise * params.scalars_a.y +
    detail_noise * params.scalars_a.z +
    ridge * params.scalars_b.w -
    valley * params.scalars_c.w;
  let terrace_height = floor(raw_height / 2.0 + 0.5) * 2.0;
  let height = mix(raw_height, terrace_height, params.scalars_c.z);

  return i32(floor(height));
}

fn get_moisture(world_x: i32, world_z: i32) -> f32 {
  return sample_normalized_noise_2d(
    world_x,
    world_z,
    params.scalars_c.y,
    params.seeds.w
  );
}

fn get_slope(world_x: i32, world_z: i32, surface_height: i32) -> i32 {
  let east_height = get_surface_height(world_x + 1, world_z);
  let south_height = get_surface_height(world_x, world_z + 1);

  return max(abs(surface_height - east_height), abs(surface_height - south_height));
}

fn get_top_material_id(world_x: i32, world_z: i32, surface_height: i32) -> u32 {
  let moisture = get_moisture(world_x, world_z);
  let slope = get_slope(world_x, world_z, surface_height);
  let is_lowland = f32(surface_height) <= params.scalars_a.x - 3.0;
  let is_dry_low_grass =
    moisture <= 0.21 &&
    f32(surface_height) <= params.scalars_a.x + 3.0;

  if (slope >= 2) {
    return 1u;
  }

  if ((is_lowland && moisture >= 0.42) || is_dry_low_grass) {
    return 4u;
  }

  return 3u;
}

fn get_material_id(
  world_x: i32,
  world_y: i32,
  world_z: i32,
  surface_height: i32
) -> u32 {
  if (world_y > surface_height) {
    return 0u;
  }

  let depth = surface_height - world_y;

  if (depth == 0) {
    return get_top_material_id(world_x, world_z, surface_height);
  }

  if (depth < 4) {
    if (get_top_material_id(world_x, world_z, surface_height) == 4u) {
      return 4u;
    }

    return 2u;
  }

  return 1u;
}

@compute @workgroup_size(${GPU_TERRAIN_GENERATION_WORKGROUP_SIZE}, ${GPU_TERRAIN_GENERATION_WORKGROUP_SIZE}, ${GPU_TERRAIN_GENERATION_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= ${CHUNK_SIZE}u ||
    global_id.y >= ${CHUNK_SIZE}u ||
    global_id.z >= ${CHUNK_SIZE}u
  ) {
    return;
  }

  let local_x = i32(global_id.x);
  let local_y = i32(global_id.y);
  let local_z = i32(global_id.z);
  let world_x = params.chunk_coords.x * ${CHUNK_SIZE} + local_x;
  let world_y = params.chunk_coords.y * ${CHUNK_SIZE} + local_y;
  let world_z = params.chunk_coords.z * ${CHUNK_SIZE} + local_z;
  let surface_height = get_surface_height(world_x, world_z);
  let flat_index =
    global_id.x +
    global_id.y * ${CHUNK_SIZE}u +
    global_id.z * ${CHUNK_SIZE * CHUNK_SIZE}u;

  voxels[flat_index] = get_material_id(world_x, world_y, world_z, surface_height);
}
`
}
