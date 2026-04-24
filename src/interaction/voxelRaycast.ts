import type { WorldVoxelCoordinates } from '../world/worldVoxelCoordinates.ts'

type Vector3Like = {
  x: number
  y: number
  z: number
}

export type VoxelRaycastHit = {
  distance: number
  hitVoxel: WorldVoxelCoordinates
  materialId: number
  normal: WorldVoxelCoordinates
  placementVoxel: WorldVoxelCoordinates
}

function normalize(vector: Vector3Like): Vector3Like | null {
  const length = Math.hypot(vector.x, vector.y, vector.z)

  if (length === 0) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  }
}

function createZeroVoxel(): WorldVoxelCoordinates {
  return { x: 0, y: 0, z: 0 }
}

function createPlacementVoxel(
  hitVoxel: WorldVoxelCoordinates,
  normal: WorldVoxelCoordinates
): WorldVoxelCoordinates {
  return {
    x: hitVoxel.x + normal.x,
    y: hitVoxel.y + normal.y,
    z: hitVoxel.z + normal.z,
  }
}

export function raycastVoxels(
  origin: Vector3Like,
  direction: Vector3Like,
  maxDistance: number,
  getMaterial: (coords: WorldVoxelCoordinates) => number
): VoxelRaycastHit | null {
  const normalizedDirection = normalize(direction)

  if (normalizedDirection === null) {
    return null
  }

  const voxel = {
    x: Math.floor(origin.x),
    y: Math.floor(origin.y),
    z: Math.floor(origin.z),
  }
  const initialMaterial = getMaterial(voxel)

  if (initialMaterial !== 0) {
    return {
      distance: 0,
      hitVoxel: { ...voxel },
      materialId: initialMaterial,
      normal: createZeroVoxel(),
      placementVoxel: { ...voxel },
    }
  }

  const stepX = Math.sign(normalizedDirection.x)
  const stepY = Math.sign(normalizedDirection.y)
  const stepZ = Math.sign(normalizedDirection.z)
  const tDeltaX =
    stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / normalizedDirection.x)
  const tDeltaY =
    stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / normalizedDirection.y)
  const tDeltaZ =
    stepZ === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / normalizedDirection.z)
  let tMaxX =
    stepX === 0
      ? Number.POSITIVE_INFINITY
      : ((stepX > 0 ? voxel.x + 1 : voxel.x) - origin.x) / normalizedDirection.x
  let tMaxY =
    stepY === 0
      ? Number.POSITIVE_INFINITY
      : ((stepY > 0 ? voxel.y + 1 : voxel.y) - origin.y) / normalizedDirection.y
  let tMaxZ =
    stepZ === 0
      ? Number.POSITIVE_INFINITY
      : ((stepZ > 0 ? voxel.z + 1 : voxel.z) - origin.z) / normalizedDirection.z

  while (true) {
    const normal = createZeroVoxel()

    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      voxel.x += stepX
      const distance = tMaxX
      tMaxX += tDeltaX
      normal.x = -stepX

      if (distance > maxDistance) {
        return null
      }

      const materialId = getMaterial(voxel)

      if (materialId !== 0) {
        return {
          distance,
          hitVoxel: { ...voxel },
          materialId,
          normal,
          placementVoxel: createPlacementVoxel(voxel, normal),
        }
      }
    } else if (tMaxY <= tMaxX && tMaxY <= tMaxZ) {
      voxel.y += stepY
      const distance = tMaxY
      tMaxY += tDeltaY
      normal.y = -stepY

      if (distance > maxDistance) {
        return null
      }

      const materialId = getMaterial(voxel)

      if (materialId !== 0) {
        return {
          distance,
          hitVoxel: { ...voxel },
          materialId,
          normal,
          placementVoxel: createPlacementVoxel(voxel, normal),
        }
      }
    } else {
      voxel.z += stepZ
      const distance = tMaxZ
      tMaxZ += tDeltaZ
      normal.z = -stepZ

      if (distance > maxDistance) {
        return null
      }

      const materialId = getMaterial(voxel)

      if (materialId !== 0) {
        return {
          distance,
          hitVoxel: { ...voxel },
          materialId,
          normal,
          placementVoxel: createPlacementVoxel(voxel, normal),
        }
      }
    }
  }
}
