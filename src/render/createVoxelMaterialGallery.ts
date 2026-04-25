import * as THREE from 'three/webgpu'
import { texture as textureNode, uint, uv } from 'three/tsl'

import type {
  VoxelTextureAtlas,
  VoxelTextureAtlasManifest,
} from './loadVoxelTextureAtlas.ts'

const COLUMN_COUNT = 8
const TILE_SIZE = 0.72
const TILE_GAP = 0.2
const LABEL_WIDTH = 256
const LABEL_HEIGHT = 64
const PANEL_DISTANCE = 4

export type VoxelMaterialGalleryEntry = {
  layer: number
  name: string
}

export type VoxelMaterialGalleryInfo = {
  isVisible: boolean
  layerCount: number
  materials: Array<VoxelMaterialGalleryEntry>
}

export type VoxelMaterialGallery = {
  dispose: () => void
  group: THREE.Group
  info: () => VoxelMaterialGalleryInfo
  setVisible: (isVisible: boolean) => void
  syncToCamera: (camera: THREE.PerspectiveCamera) => void
}

type LabelSprite = {
  dispose: () => void
  sprite: THREE.Sprite
}

export function createVoxelMaterialGalleryEntries(
  atlas: VoxelTextureAtlasManifest
): Array<VoxelMaterialGalleryEntry> {
  return Object.entries(atlas.materials)
    .map(([name, material]) => ({
      layer: material.layer,
      name,
    }))
    .sort((left, right) => left.layer - right.layer)
}

function createLayerMaterial(
  atlas: VoxelTextureAtlas,
  layer: number
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial()

  material.colorNode = textureNode(atlas.basecolor)
    .depth(uint(layer))
    .sample(uv()).rgb
  material.depthTest = false
  material.depthWrite = false

  return material
}

function createLabelTexture(
  entry: VoxelMaterialGalleryEntry
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = LABEL_WIDTH
  canvas.height = LABEL_HEIGHT

  if (context === null) {
    throw new Error('Failed to create material gallery label canvas')
  }

  context.fillStyle = 'rgba(5, 10, 14, 0.82)'
  context.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT)
  context.fillStyle = '#9bd0ff'
  context.font = '22px monospace'
  context.fillText(
    `${entry.layer.toString().padStart(2, '0')} ${entry.name}`,
    14,
    40
  )

  const texture = new THREE.CanvasTexture(canvas)

  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  return texture
}

function createLabelSprite(entry: VoxelMaterialGalleryEntry): LabelSprite {
  const texture = createLabelTexture(entry)
  const material = new THREE.SpriteMaterial({
    depthTest: false,
    depthWrite: false,
    map: texture,
    transparent: true,
  })
  const sprite = new THREE.Sprite(material)

  sprite.scale.set(TILE_SIZE, TILE_SIZE * 0.25, 1)

  return {
    dispose(): void {
      texture.dispose()
      material.dispose()
    },
    sprite,
  }
}

export function createVoxelMaterialGallery(
  atlas: VoxelTextureAtlas
): VoxelMaterialGallery {
  const entries = createVoxelMaterialGalleryEntries(atlas.atlas)
  const group = new THREE.Group()
  const disposableGeometries: Array<THREE.BufferGeometry> = []
  const disposableMaterials: Array<THREE.Material> = []
  const disposableLabels: Array<LabelSprite> = []
  const tileStride = TILE_SIZE + TILE_GAP
  const rowCount = Math.ceil(entries.length / COLUMN_COUNT)
  const width = (COLUMN_COUNT - 1) * tileStride
  const height = (rowCount - 1) * tileStride

  group.name = 'voxel_material_gallery'
  group.visible = false
  group.renderOrder = 10_000

  for (const [index, entry] of entries.entries()) {
    const column = index % COLUMN_COUNT
    const row = Math.floor(index / COLUMN_COUNT)
    const x = column * tileStride - width / 2
    const y = height / 2 - row * tileStride
    const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE)
    const material = createLayerMaterial(atlas, entry.layer)
    const tile = new THREE.Mesh(geometry, material)
    const label = createLabelSprite(entry)

    tile.position.set(x, y, 0)
    tile.renderOrder = group.renderOrder
    label.sprite.position.set(x, y - TILE_SIZE * 0.62, 0.02)
    label.sprite.renderOrder = group.renderOrder + 1
    group.add(tile, label.sprite)
    disposableGeometries.push(geometry)
    disposableMaterials.push(material)
    disposableLabels.push(label)
  }

  return {
    dispose(): void {
      for (const geometry of disposableGeometries) {
        geometry.dispose()
      }

      for (const label of disposableLabels) {
        label.dispose()
      }

      for (const material of disposableMaterials) {
        material.dispose()
      }
    },
    group,
    info: () => ({
      isVisible: group.visible,
      layerCount: atlas.atlas.layerCount,
      materials: entries,
    }),
    setVisible(isVisible: boolean): void {
      group.visible = isVisible
    },
    syncToCamera(camera: THREE.PerspectiveCamera): void {
      if (!group.visible) {
        return
      }

      group.position
        .copy(camera.position)
        .add(
          new THREE.Vector3(0, 0, -PANEL_DISTANCE).applyQuaternion(
            camera.quaternion
          )
        )
      group.quaternion.copy(camera.quaternion)
    },
  }
}
