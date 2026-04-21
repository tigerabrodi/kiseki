# Textures

What's in `public/textures/pbr-arrays/`, how to consume it, how to rebuild it.

## Bundle

Five KTX2 texture arrays, one per PBR map type. Each array has 40 layers — one per material — plus a JSON layer-index map.

| File              | Shape                  | Format / Compression        | Size     |
| ----------------- | ---------------------- | --------------------------- | -------- |
| `basecolor.ktx2`  | 512×512 × 40 × 10 mips | Basis ETC1S (sRGB)          | 2.0 MB   |
| `normal.ktx2`     | 512×512 × 40 × 10 mips | UASTC (linear, normal flag) | 14.0 MB  |
| `roughness.ktx2`  | 512×512 × 40 × 10 mips | Basis ETC1S (linear)        | 1.6 MB   |
| `metalness.ktx2`  | 512×512 × 40 × 10 mips | Basis ETC1S (linear)        | 19 KB    |
| `height.ktx2`     | 512×512 × 40 × 10 mips | Basis ETC1S (linear)        | 1.6 MB   |
| `atlas.json`      | —                      | —                           | 2 KB     |

Total ~19 MB. Normal uses UASTC (higher quality, no block artifacts) instead of ETC1S. Metalness is tiny because 39/40 materials are dielectric, so the map is a uniform black that ETC1S crushes to almost nothing.

## The one invariant

`atlas.json.materials[name].layer` is **the same index in every KTX2 file**. `stone` at layer 0 in basecolor is `stone` at layer 0 in normal, roughness, metalness, and height. That's the contract the engine relies on.

```json
{
  "version": 2,
  "format": "ktx2_array",
  "cellSize": 512,
  "layerCount": 40,
  "mipmaps": true,
  "materials": {
    "stone":       { "layer": 0 },
    "cobblestone": { "layer": 1 },
    ...
  }
}
```

Material IDs are an engine concern. Pick a convention at step 14 (probably `atlas.json.materials[name].layer + 1` so 0 stays "air") and write it down.

## Loading (Three.js, step 14 reference)

```ts
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

const loader = new KTX2Loader()
  .setTranscoderPath('/basis/')       // copy basis transcoder wasm into public/basis/
  .detectSupport(renderer)

const basecolor = await loader.loadAsync('/textures/pbr-arrays/basecolor.ktx2')
// basecolor is a CompressedArrayTexture.
basecolor.colorSpace = THREE.SRGBColorSpace  // only for basecolor
basecolor.magFilter = THREE.NearestFilter    // blocky look on mag
basecolor.minFilter = THREE.LinearMipmapLinearFilter

// Normal/rough/metal/height: keep default linear color space, same filters.
```

Fragment shader samples via `textureSample(arr, sampler, vec3<f32>(uv, layerFloat))`. Material ID becomes the layer index. See step 14 in `plan.md`.

## Encoder settings (per map type)

Baked into the arrays already — documented here for reference if you ever swap one out:

- **basecolor** — `VkFormat.R8G8B8A8_SRGB`, sRGB OETF + primaries, ETC1S quality 200.
- **normal** — `VkFormat.R8G8B8A8_UNORM`, linear OETF, UASTC with `normalMap: true`, UASTC RDO on at 1.25.
- **roughness / metalness / height** — UNORM linear, ETC1S quality 180.

## Cell size: 512, not 1024

The arrays are 512×512 per layer. At 1024×40-layers × full mip chain, the libktx WASM heap aborts mid-encode — peak raw-pixel footprint per map type is ~213 MB, which exceeds the default Emscripten heap (`Aborted()` with no assertions).

For a voxel engine at 1 m per block with typical view distances 512 is already oversized, so this is not a real problem. If it ever is, the paths are:

- Chunked encoding — split 40 layers into two 20-layer passes, concatenate.
- Rebuild `public/vendor/libktx/` with larger `INITIAL_MEMORY` / `ALLOW_MEMORY_GROWTH`.

Mip chain goes to 1×1 — 10 levels for 512, 11 for 1024. Normal maps go through a re-normalizing resampler so distant voxels don't get wrong lighting.

## How this bundle was produced

Two separate repos on this machine. Keep them — they're the rebuild path.

1. **`~/Desktop/pbr-material-generator/`** — Bun script that calls `fal-ai/patina/material` for 40 crafted prompts (stone, cobblestone, grass_top, grass_side, oak_log_top, ores, …). Downloads 200 PNGs (40 materials × 5 map types) to `output/<name>/<map>.png`, writes a `manifest.json` with the authoritative layer order.
   - Cost ~$3.20 total. Resumable (skips materials already on disk).
   - Run: `FAL_KEY=... bun run generate.ts && bun run verify.ts`.

2. **`~/Desktop/pbr-atlas-packer/`** — Vite/React app that loads those PNGs and encodes them into KTX2 arrays via libktx WASM (`public/vendor/libktx/`). Has a bulk export helper for N materials: `window.__PBR_BULK__.runFromManifest('/manifest.json', { settings: { cellSize: 512, generateMipmaps: true } })`. Mip chains are generated via Canvas 2D; normal maps use a custom re-normalizing resampler (`src/lib/normalMap.ts`).
   - See that repo's README for the headless `agent-browser` recipe.

### Rebuild from scratch

```bash
# 1. Regenerate source PNGs (or skip if ~/Desktop/pbr-material-generator/output/ is already populated)
cd ~/Desktop/pbr-material-generator
FAL_KEY=... bun run generate.ts

# 2. Pack into KTX2 arrays via the packer app
cd ~/Desktop/pbr-atlas-packer
ln -sfn ~/Desktop/pbr-material-generator/output public/materials
cp     ~/Desktop/pbr-material-generator/manifest.json public/manifest.json
bun run dev
# Open http://localhost:5173, then in devtools:
# await window.__PBR_BULK__.runFromManifest('/manifest.json', {
#   settings: { cellSize: 512, generateMipmaps: true },
# })

# 3. Drop the resulting pbr-texture-arrays.zip into Kiseki
cd ~/Desktop/kiseki
unzip -o ~/Downloads/pbr-texture-arrays.zip -d public/textures/pbr-arrays/
```

### Adding or swapping materials

Edit `prompts.ts` in `pbr-material-generator` — add a `MaterialSpec`, re-run generate, then repack. The manifest's layer order is material-list order, so **appending** (not inserting) preserves existing material IDs. Inserting in the middle shifts every layer index after it and breaks any world data that references by ID.

## Sanity check

If something looks wrong in-engine, verify the bundle first:

```bash
cd ~/Desktop/pbr-texture-arrays
bun run verify-ktx2.ts
```

Checks KTX2 magic bytes, that all 5 files share the same shape (width/height/layerCount/levelCount), and that `atlas.json.layerCount` matches the KTX2 arrays. Silent pass means the bundle is internally consistent — any bug is downstream.
