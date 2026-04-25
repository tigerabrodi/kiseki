export const GPU_CHUNK_INDIRECT_DRAW_CULL_WORKGROUP_SIZE = 64
export const GPU_CHUNK_INDIRECT_DRAW_PARAM_BYTE_LENGTH =
  4 * Uint32Array.BYTES_PER_ELEMENT

export function createGpuChunkIndirectDrawCullingShader(): string {
  return /* wgsl */ `
struct DrawArgs {
  index_count: u32,
  instance_count: u32,
  first_index: u32,
  base_vertex: u32,
  first_instance: u32,
}

struct Params {
  slot_count: u32,
  visibility_word_count: u32,
  _pad0: u32,
  _pad1: u32,
}

@group(0) @binding(0) var<storage, read> visibility_words: array<u32>;
@group(0) @binding(1) var<storage, read> draw_templates: array<DrawArgs>;
@group(0) @binding(2) var<storage, read_write> draw_args: array<DrawArgs>;
@group(0) @binding(3) var<uniform> params: Params;

fn is_slot_visible(slot_index: u32) -> bool {
  let word_index = slot_index >> 5u;

  if (word_index >= params.visibility_word_count) {
    return false;
  }

  let word = visibility_words[word_index];
  let bit_index = slot_index & 31u;

  return ((word >> bit_index) & 1u) == 1u;
}

@compute @workgroup_size(${GPU_CHUNK_INDIRECT_DRAW_CULL_WORKGROUP_SIZE}, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let slot_index = global_id.x;

  if (slot_index >= params.slot_count) {
    return;
  }

  if (is_slot_visible(slot_index)) {
    draw_args[slot_index] = draw_templates[slot_index];
    return;
  }

  draw_args[slot_index] = DrawArgs(0u, 0u, 0u, 0u, 0u);
}
`
}
