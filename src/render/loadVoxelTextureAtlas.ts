import * as THREE from 'three/webgpu'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

type VoxelTextureAtlasManifest = {
  cellSize: number
  format: string
  layerCount: number
  materials: Record<string, { layer: number }>
  mipmaps: boolean
  version: number
}

export type VoxelTextureAtlas = {
  atlas: VoxelTextureAtlasManifest
  basecolor: THREE.CompressedArrayTexture
  height: THREE.CompressedArrayTexture
  metalness: THREE.CompressedArrayTexture
  normal: THREE.CompressedArrayTexture
  roughness: THREE.CompressedArrayTexture
}

function assertCompressedArrayTexture(
  texture: THREE.Texture
): asserts texture is THREE.CompressedArrayTexture {
  if (
    !('isCompressedArrayTexture' in texture) ||
    !texture.isCompressedArrayTexture
  ) {
    throw new Error(
      'Expected a compressed 2D array texture from the KTX2 atlas'
    )
  }
}

function configureAtlasTexture(
  texture: THREE.CompressedArrayTexture,
  colorSpace: THREE.ColorSpace
): void {
  texture.colorSpace = colorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
}

async function loadArrayTexture(
  loader: KTX2Loader,
  path: string,
  colorSpace: THREE.ColorSpace
): Promise<THREE.CompressedArrayTexture> {
  const texture = await loader.loadAsync(path)

  assertCompressedArrayTexture(texture)
  configureAtlasTexture(texture, colorSpace)

  return texture
}

export async function loadVoxelTextureAtlas(
  renderer: THREE.WebGPURenderer
): Promise<VoxelTextureAtlas> {
  const loader = new KTX2Loader()
  loader.setTranscoderPath('/basis/')
  loader.detectSupport(renderer)

  try {
    const atlasResponse = await fetch('/textures/pbr-arrays/atlas.json')

    if (!atlasResponse.ok) {
      throw new Error(
        `Failed to load texture atlas manifest: ${atlasResponse.status} ${atlasResponse.statusText}`
      )
    }

    const atlas = (await atlasResponse.json()) as VoxelTextureAtlasManifest
    const [basecolor, normal, roughness, metalness, height] = await Promise.all(
      [
        loadArrayTexture(
          loader,
          '/textures/pbr-arrays/basecolor.ktx2',
          THREE.SRGBColorSpace
        ),
        loadArrayTexture(
          loader,
          '/textures/pbr-arrays/normal.ktx2',
          THREE.NoColorSpace
        ),
        loadArrayTexture(
          loader,
          '/textures/pbr-arrays/roughness.ktx2',
          THREE.NoColorSpace
        ),
        loadArrayTexture(
          loader,
          '/textures/pbr-arrays/metalness.ktx2',
          THREE.NoColorSpace
        ),
        loadArrayTexture(
          loader,
          '/textures/pbr-arrays/height.ktx2',
          THREE.NoColorSpace
        ),
      ]
    )

    return {
      atlas,
      basecolor,
      height,
      metalness,
      normal,
      roughness,
    }
  } finally {
    loader.dispose()
  }
}
