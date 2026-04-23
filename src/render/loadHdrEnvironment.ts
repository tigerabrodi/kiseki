import * as THREE from 'three/webgpu'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'

export type HdrEnvironment = {
  backgroundTexture: THREE.DataTexture
  dispose: () => void
  environmentName: string
  environmentTexture: THREE.Texture
}

export async function loadHdrEnvironment(
  renderer: THREE.WebGPURenderer
): Promise<HdrEnvironment> {
  const loader = new HDRLoader()
  const hdrTexture = await loader.loadAsync(
    '/environments/citrus_orchard_road_puresky_2k.hdr'
  )
  hdrTexture.mapping = THREE.EquirectangularReflectionMapping

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const pmremRenderTarget = pmremGenerator.fromEquirectangular(hdrTexture)
  pmremGenerator.dispose()

  return {
    backgroundTexture: hdrTexture,
    dispose: () => {
      hdrTexture.dispose()
      pmremRenderTarget.dispose()
    },
    environmentName: 'Citrus Orchard Road (Pure Sky) 2K',
    environmentTexture: pmremRenderTarget.texture,
  }
}
