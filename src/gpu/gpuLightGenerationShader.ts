import { CHUNK_SIZE, CHUNK_VOLUME } from '../voxel/chunk.ts'
import {
  GPU_LIGHT_MAX_LEVEL,
  GPU_LIGHT_PROPAGATION_ITERATIONS,
} from './lightStorageCodec.ts'

export const GPU_LIGHT_GENERATION_WORKGROUP_SIZE = 64

export function createGpuLightSeedShader(): string {
  return /* wgsl */ `
const CHUNK_SIZE: u32 = ${CHUNK_SIZE}u;
const CHUNK_VOLUME: u32 = ${CHUNK_VOLUME}u;
const MAX_LIGHT: u32 = ${GPU_LIGHT_MAX_LEVEL}u;

@group(0) @binding(0) var<storage, read> voxels: array<u32>;
@group(0) @binding(1) var<storage, read_write> lightOut: array<u32>;

fn unpackMaterial(word: u32) -> u32 {
  return word & 0xffu;
}

fn indexToY(index: u32) -> u32 {
  return (index / CHUNK_SIZE) % CHUNK_SIZE;
}

@compute @workgroup_size(${GPU_LIGHT_GENERATION_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let index = globalId.x;

  if (index >= CHUNK_VOLUME) {
    return;
  }

  let material = unpackMaterial(voxels[index]);

  if (material != 0u) {
    lightOut[index] = 0u;
    return;
  }

  lightOut[index] = select(0u, MAX_LIGHT, indexToY(index) == CHUNK_SIZE - 1u);
}
`
}

export function createGpuLightPropagationShader(): string {
  return /* wgsl */ `
const CHUNK_SIZE: u32 = ${CHUNK_SIZE}u;
const CHUNK_VOLUME: u32 = ${CHUNK_VOLUME}u;
const MAX_LIGHT: u32 = ${GPU_LIGHT_MAX_LEVEL}u;
const ITERATIONS: u32 = ${GPU_LIGHT_PROPAGATION_ITERATIONS}u;

@group(0) @binding(0) var<storage, read> voxels: array<u32>;
@group(0) @binding(1) var<storage, read> lightIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> lightOut: array<u32>;

fn unpackMaterial(word: u32) -> u32 {
  return word & 0xffu;
}

fn xyzToIndex(x: u32, y: u32, z: u32) -> u32 {
  return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
}

fn indexToX(index: u32) -> u32 {
  return index % CHUNK_SIZE;
}

fn indexToY(index: u32) -> u32 {
  return (index / CHUNK_SIZE) % CHUNK_SIZE;
}

fn indexToZ(index: u32) -> u32 {
  return index / (CHUNK_SIZE * CHUNK_SIZE);
}

fn neighborContribution(index: u32) -> u32 {
  let neighborLight = lightIn[index];

  if (neighborLight == 0u) {
    return 0u;
  }

  return neighborLight - 1u;
}

@compute @workgroup_size(${GPU_LIGHT_GENERATION_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let index = globalId.x;

  if (index >= CHUNK_VOLUME) {
    return;
  }

  let material = unpackMaterial(voxels[index]);

  if (material != 0u) {
    lightOut[index] = 0u;
    return;
  }

  let x = indexToX(index);
  let y = indexToY(index);
  let z = indexToZ(index);
  var light = lightIn[index];

  if (x > 0u) {
    light = max(light, neighborContribution(xyzToIndex(x - 1u, y, z)));
  }

  if (x + 1u < CHUNK_SIZE) {
    light = max(light, neighborContribution(xyzToIndex(x + 1u, y, z)));
  }

  if (y > 0u) {
    light = max(light, neighborContribution(xyzToIndex(x, y - 1u, z)));
  }

  if (y + 1u < CHUNK_SIZE) {
    light = max(light, neighborContribution(xyzToIndex(x, y + 1u, z)));
  }

  if (z > 0u) {
    light = max(light, neighborContribution(xyzToIndex(x, y, z - 1u)));
  }

  if (z + 1u < CHUNK_SIZE) {
    light = max(light, neighborContribution(xyzToIndex(x, y, z + 1u)));
  }

  lightOut[index] = min(light, MAX_LIGHT);
}
`
}
