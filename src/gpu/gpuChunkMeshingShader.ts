import { CHUNK_SIZE } from '../voxel/chunk.ts'

export const GPU_CHUNK_MESH_COUNTER_COUNT = 4
export const GPU_CHUNK_MESH_MAX_FACE_COUNT = 6 * CHUNK_SIZE * CHUNK_SIZE
export const GPU_CHUNK_MESH_MAX_INDEX_COUNT = GPU_CHUNK_MESH_MAX_FACE_COUNT * 6
export const GPU_CHUNK_MESH_MAX_VERTEX_COUNT = GPU_CHUNK_MESH_MAX_FACE_COUNT * 4
export const GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH =
  GPU_CHUNK_MESH_COUNTER_COUNT * Uint32Array.BYTES_PER_ELEMENT
export const GPU_CHUNK_MESH_INDEX_BYTE_LENGTH =
  GPU_CHUNK_MESH_MAX_INDEX_COUNT * Uint32Array.BYTES_PER_ELEMENT
export const GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH =
  GPU_CHUNK_MESH_MAX_VERTEX_COUNT * Uint32Array.BYTES_PER_ELEMENT

export function createGpuChunkMeshingShader(): string {
  return /* wgsl */ `
const CHUNK_SIZE: u32 = ${CHUNK_SIZE}u;
const CHUNK_SIZE_I32: i32 = ${CHUNK_SIZE};
const CHUNK_LAYER_SIZE: u32 = ${CHUNK_SIZE * CHUNK_SIZE}u;

struct MesherParams {
  faceDirection: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

struct MeshCounts {
  quadCount: atomic<u32>,
  vertexCount: atomic<u32>,
  indexCount: atomic<u32>,
  visibleFaceCount: atomic<u32>,
}

@group(0) @binding(0) var<storage, read> currentVoxels: array<u32>;
@group(0) @binding(1) var<storage, read> neighborVoxels: array<u32>;
@group(0) @binding(2) var<storage, read_write> vertices: array<u32>;
@group(0) @binding(3) var<storage, read_write> indices: array<u32>;
@group(0) @binding(4) var<storage, read_write> counts: MeshCounts;
@group(0) @binding(5) var<uniform> params: MesherParams;

var<workgroup> rowMasks: array<u32, ${CHUNK_SIZE}>;
var<workgroup> materials: array<u32, ${CHUNK_SIZE * CHUNK_SIZE}>;

fn voxelIndex(x: u32, y: u32, z: u32) -> u32 {
  return x + y * CHUNK_SIZE + z * CHUNK_LAYER_SIZE;
}

fn getVoxelCoordinates(
  faceDirection: u32,
  slice: u32,
  row: u32,
  column: u32,
) -> vec3<u32> {
  switch faceDirection {
    case 0u, 1u: {
      return vec3<u32>(slice, row, column);
    }
    case 2u, 3u: {
      return vec3<u32>(column, slice, row);
    }
    default: {
      return vec3<u32>(column, row, slice);
    }
  }
}

fn getNeighborOffset(faceDirection: u32) -> vec3<i32> {
  switch faceDirection {
    case 0u: {
      return vec3<i32>(1, 0, 0);
    }
    case 1u: {
      return vec3<i32>(-1, 0, 0);
    }
    case 2u: {
      return vec3<i32>(0, 1, 0);
    }
    case 3u: {
      return vec3<i32>(0, -1, 0);
    }
    case 4u: {
      return vec3<i32>(0, 0, 1);
    }
    default: {
      return vec3<i32>(0, 0, -1);
    }
  }
}

fn getMaterialAt(faceDirection: u32, x: i32, y: i32, z: i32) -> u32 {
  let xInBounds = x >= 0 && x < CHUNK_SIZE_I32;
  let yInBounds = y >= 0 && y < CHUNK_SIZE_I32;
  let zInBounds = z >= 0 && z < CHUNK_SIZE_I32;

  if (xInBounds && yInBounds && zInBounds) {
    return currentVoxels[voxelIndex(u32(x), u32(y), u32(z))];
  }

  switch faceDirection {
    case 0u: {
      if (x >= CHUNK_SIZE_I32 && yInBounds && zInBounds) {
        return neighborVoxels[voxelIndex(0u, u32(y), u32(z))];
      }
    }
    case 1u: {
      if (x < 0 && yInBounds && zInBounds) {
        return neighborVoxels[voxelIndex(CHUNK_SIZE - 1u, u32(y), u32(z))];
      }
    }
    case 2u: {
      if (y >= CHUNK_SIZE_I32 && xInBounds && zInBounds) {
        return neighborVoxels[voxelIndex(u32(x), 0u, u32(z))];
      }
    }
    case 3u: {
      if (y < 0 && xInBounds && zInBounds) {
        return neighborVoxels[voxelIndex(u32(x), CHUNK_SIZE - 1u, u32(z))];
      }
    }
    case 4u: {
      if (z >= CHUNK_SIZE_I32 && xInBounds && yInBounds) {
        return neighborVoxels[voxelIndex(u32(x), u32(y), 0u)];
      }
    }
    default: {
      if (z < 0 && xInBounds && yInBounds) {
        return neighborVoxels[voxelIndex(u32(x), u32(y), CHUNK_SIZE - 1u)];
      }
    }
  }

  return 0u;
}

fn createSpanMask(start: u32, width: u32) -> u32 {
  if (width == CHUNK_SIZE) {
    return 0xffffffffu;
  }

  return (((1u << width) - 1u) << start);
}

fn rowMatchesMaterial(
  row: u32,
  startColumn: u32,
  width: u32,
  materialId: u32,
) -> bool {
  let rowOffset = row * CHUNK_SIZE;

  for (var columnOffset = 0u; columnOffset < width; columnOffset += 1u) {
    if (materials[rowOffset + startColumn + columnOffset] != materialId) {
      return false;
    }
  }

  return true;
}

fn resolveMaterialLayer(materialId: u32, faceDirection: u32) -> u32 {
  switch materialId {
    case 1u: {
      return 0u;
    }
    case 2u: {
      return 4u;
    }
    case 3u: {
      if (faceDirection == 2u) {
        return 5u;
      }

      if (faceDirection == 3u) {
        return 4u;
      }

      return 6u;
    }
    case 4u: {
      return 7u;
    }
    case 5u: {
      return 1u;
    }
    default: {
      return 0u;
    }
  }
}

fn packVoxelVertex(
  x: u32,
  y: u32,
  z: u32,
  normalDirection: u32,
  materialId: u32,
) -> u32 {
  let xOverflow = x >> 5u;
  let yOverflow = y >> 5u;
  let zOverflow = z >> 5u;

  return (
    ((x & 0x1fu) << 0u) |
    ((y & 0x1fu) << 5u) |
    ((z & 0x1fu) << 10u) |
    (normalDirection << 15u) |
    (materialId << 18u) |
    (xOverflow << 26u) |
    (yOverflow << 27u) |
    (zOverflow << 28u)
  );
}

fn getQuadCorner(
  faceDirection: u32,
  x: u32,
  y: u32,
  z: u32,
  width: u32,
  height: u32,
  cornerIndex: u32,
) -> vec3<u32> {
  switch faceDirection {
    case 0u: {
      switch cornerIndex {
        case 0u: {
          return vec3<u32>(x + 1u, y, z + width);
        }
        case 1u: {
          return vec3<u32>(x + 1u, y, z);
        }
        case 2u: {
          return vec3<u32>(x + 1u, y + height, z);
        }
        default: {
          return vec3<u32>(x + 1u, y + height, z + width);
        }
      }
    }
    case 1u: {
      switch cornerIndex {
        case 0u: {
          return vec3<u32>(x, y, z);
        }
        case 1u: {
          return vec3<u32>(x, y, z + width);
        }
        case 2u: {
          return vec3<u32>(x, y + height, z + width);
        }
        default: {
          return vec3<u32>(x, y + height, z);
        }
      }
    }
    case 2u: {
      switch cornerIndex {
        case 0u: {
          return vec3<u32>(x, y + 1u, z + height);
        }
        case 1u: {
          return vec3<u32>(x + width, y + 1u, z + height);
        }
        case 2u: {
          return vec3<u32>(x + width, y + 1u, z);
        }
        default: {
          return vec3<u32>(x, y + 1u, z);
        }
      }
    }
    case 3u: {
      switch cornerIndex {
        case 0u: {
          return vec3<u32>(x, y, z);
        }
        case 1u: {
          return vec3<u32>(x + width, y, z);
        }
        case 2u: {
          return vec3<u32>(x + width, y, z + height);
        }
        default: {
          return vec3<u32>(x, y, z + height);
        }
      }
    }
    case 4u: {
      switch cornerIndex {
        case 0u: {
          return vec3<u32>(x, y, z + 1u);
        }
        case 1u: {
          return vec3<u32>(x + width, y, z + 1u);
        }
        case 2u: {
          return vec3<u32>(x + width, y + height, z + 1u);
        }
        default: {
          return vec3<u32>(x, y + height, z + 1u);
        }
      }
    }
    default: {
      switch cornerIndex {
        case 0u: {
          return vec3<u32>(x + width, y, z);
        }
        case 1u: {
          return vec3<u32>(x, y, z);
        }
        case 2u: {
          return vec3<u32>(x, y + height, z);
        }
        default: {
          return vec3<u32>(x + width, y + height, z);
        }
      }
    }
  }
}

@compute @workgroup_size(${CHUNK_SIZE})
fn main(@builtin(local_invocation_id) localInvocationId: vec3<u32>) {
  let row = localInvocationId.x;
  let faceDirection = params.faceDirection;
  let neighborOffset = getNeighborOffset(faceDirection);

  for (var slice = 0u; slice < CHUNK_SIZE; slice += 1u) {
    let rowOffset = row * CHUNK_SIZE;
    var rowMask = 0u;

    for (var column = 0u; column < CHUNK_SIZE; column += 1u) {
      let coords = getVoxelCoordinates(faceDirection, slice, row, column);
      let materialId = currentVoxels[voxelIndex(coords.x, coords.y, coords.z)];
      materials[rowOffset + column] = 0u;

      if (materialId == 0u) {
        continue;
      }

      let neighborMaterialId = getMaterialAt(
        faceDirection,
        i32(coords.x) + neighborOffset.x,
        i32(coords.y) + neighborOffset.y,
        i32(coords.z) + neighborOffset.z,
      );

      if (neighborMaterialId != 0u) {
        continue;
      }

      rowMask = rowMask | (1u << column);
      materials[rowOffset + column] = materialId;
    }

    rowMasks[row] = rowMask;
    workgroupBarrier();

    if (row == 0u) {
      for (var greedyRow = 0u; greedyRow < CHUNK_SIZE; greedyRow += 1u) {
        loop {
          let activeMask = rowMasks[greedyRow];

          if (activeMask == 0u) {
            break;
          }

          let startColumn = countTrailingZeros(activeMask);
          let materialId = materials[greedyRow * CHUNK_SIZE + startColumn];
          var width = 1u;

          loop {
            let nextColumn = startColumn + width;

            if (nextColumn >= CHUNK_SIZE) {
              break;
            }

            let nextBit = 1u << nextColumn;

            if ((rowMasks[greedyRow] & nextBit) == 0u) {
              break;
            }

            if (
              materials[greedyRow * CHUNK_SIZE + nextColumn] != materialId
            ) {
              break;
            }

            width += 1u;
          }

          let spanMask = createSpanMask(startColumn, width);
          var height = 1u;

          loop {
            let nextRow = greedyRow + height;

            if (nextRow >= CHUNK_SIZE) {
              break;
            }

            if ((rowMasks[nextRow] & spanMask) != spanMask) {
              break;
            }

            if (!rowMatchesMaterial(nextRow, startColumn, width, materialId)) {
              break;
            }

            height += 1u;
          }

          let quadOrigin = getVoxelCoordinates(
            faceDirection,
            slice,
            greedyRow,
            startColumn,
          );
          let materialLayer = resolveMaterialLayer(materialId, faceDirection);
          let baseVertex = atomicAdd(&counts.vertexCount, 4u);
          let baseIndex = atomicAdd(&counts.indexCount, 6u);

          _ = atomicAdd(&counts.quadCount, 1u);
          _ = atomicAdd(&counts.visibleFaceCount, width * height);

          for (var cornerIndex = 0u; cornerIndex < 4u; cornerIndex += 1u) {
            let corner = getQuadCorner(
              faceDirection,
              quadOrigin.x,
              quadOrigin.y,
              quadOrigin.z,
              width,
              height,
              cornerIndex,
            );

            vertices[baseVertex + cornerIndex] = packVoxelVertex(
              corner.x,
              corner.y,
              corner.z,
              faceDirection,
              materialLayer,
            );
          }

          indices[baseIndex] = baseVertex;
          indices[baseIndex + 1u] = baseVertex + 1u;
          indices[baseIndex + 2u] = baseVertex + 2u;
          indices[baseIndex + 3u] = baseVertex;
          indices[baseIndex + 4u] = baseVertex + 2u;
          indices[baseIndex + 5u] = baseVertex + 3u;

          let clearMask = ~spanMask;

          for (
            var clearRow = greedyRow;
            clearRow < greedyRow + height;
            clearRow += 1u
          ) {
            rowMasks[clearRow] = rowMasks[clearRow] & clearMask;
          }
        }
      }
    }

    workgroupBarrier();
  }
}
`
}
