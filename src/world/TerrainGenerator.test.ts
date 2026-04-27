import { describe, expect, it } from 'vitest'

import { TerrainGenerator } from './TerrainGenerator.ts'
import {
  BOULDER_MATERIAL_ID,
  createTerrainGenerationSettings,
  getOutdoorFeatureMaterialId,
  getTerrainMaterialId,
  getTerrainSurfaceSampleAt,
  TREE_LEAF_MATERIAL_ID,
  TREE_TRUNK_MATERIAL_ID,
} from './terrainNoise.ts'

describe('TerrainGenerator', () => {
  it('produces identical chunk data for the same seed and chunk coordinates', () => {
    const generatorA = new TerrainGenerator({ seed: 'kiseki' })
    const generatorB = new TerrainGenerator({ seed: 'kiseki' })
    const coords = { x: 2, y: -1, z: 3 }

    const chunkA = generatorA.createChunk(coords)
    const chunkB = generatorB.createChunk(coords)

    expect([...chunkA.voxels]).toEqual([...chunkB.voxels])
  })

  it('uses outdoor surface materials from deterministic terrain features', () => {
    const settings = createTerrainGenerationSettings({ seed: 'kiseki' })
    const surfaceMaterials = new Set<number>()

    for (let z = -320; z <= 320; z += 8) {
      for (let x = -320; x <= 320; x += 8) {
        const surfaceSample = getTerrainSurfaceSampleAt(x, z, settings)

        surfaceMaterials.add(
          getTerrainMaterialId(
            surfaceSample.surfaceHeight,
            surfaceSample,
            settings
          )
        )
      }
    }

    expect(surfaceMaterials).toEqual(new Set([1, 3, 4]))
  })

  it('keeps subsurface material layers deliberate', () => {
    const settings = createTerrainGenerationSettings({ seed: 'kiseki' })
    let grassSample: ReturnType<typeof getTerrainSurfaceSampleAt> | undefined =
      undefined
    let sandSample: ReturnType<typeof getTerrainSurfaceSampleAt> | undefined =
      undefined

    for (let z = -320; z <= 320 && grassSample === undefined; z += 8) {
      for (let x = -320; x <= 320 && grassSample === undefined; x += 8) {
        const surfaceSample = getTerrainSurfaceSampleAt(x, z, settings)
        const materialId = getTerrainMaterialId(
          surfaceSample.surfaceHeight,
          surfaceSample,
          settings
        )

        if (materialId === 3) {
          grassSample = surfaceSample
        }
      }
    }

    for (let z = -320; z <= 320 && sandSample === undefined; z += 8) {
      for (let x = -320; x <= 320 && sandSample === undefined; x += 8) {
        const surfaceSample = getTerrainSurfaceSampleAt(x, z, settings)
        const materialId = getTerrainMaterialId(
          surfaceSample.surfaceHeight,
          surfaceSample,
          settings
        )

        if (materialId === 4) {
          sandSample = surfaceSample
        }
      }
    }

    expect(grassSample).toBeDefined()
    expect(sandSample).toBeDefined()

    if (grassSample === undefined || sandSample === undefined) {
      return
    }

    expect(
      getTerrainMaterialId(grassSample.surfaceHeight - 1, grassSample, settings)
    ).toBe(2)
    expect(
      getTerrainMaterialId(grassSample.surfaceHeight - 6, grassSample, settings)
    ).toBe(1)
    expect(
      getTerrainMaterialId(sandSample.surfaceHeight - 1, sandSample, settings)
    ).toBe(4)
  })

  it('places deterministic outdoor feature materials above terrain', () => {
    const settings = createTerrainGenerationSettings({ seed: 'kiseki' })
    const featureMaterials = new Set<number>()

    for (let z = -192; z <= 192; z += 1) {
      for (let x = -192; x <= 192; x += 1) {
        const surfaceSample = getTerrainSurfaceSampleAt(x, z, settings)

        for (
          let y = surfaceSample.surfaceHeight;
          y <= surfaceSample.surfaceHeight + 10;
          y += 1
        ) {
          const materialId = getOutdoorFeatureMaterialId(x, y, z, settings)

          if (materialId !== 0) {
            featureMaterials.add(materialId)
          }
        }

        if (
          featureMaterials.has(TREE_TRUNK_MATERIAL_ID) &&
          featureMaterials.has(TREE_LEAF_MATERIAL_ID) &&
          featureMaterials.has(BOULDER_MATERIAL_ID)
        ) {
          break
        }
      }
    }

    expect(featureMaterials).toEqual(
      new Set([
        TREE_TRUNK_MATERIAL_ID,
        TREE_LEAF_MATERIAL_ID,
        BOULDER_MATERIAL_ID,
      ])
    )
  })
})
