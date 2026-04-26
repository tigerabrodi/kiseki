# Kiseki Pre-Refactor Finish Plan

This is the final engine push before we refactor Kiseki into a clean reusable
voxel engine for future game work. The goal is not gameplay yet. The goal is to
make the engine beautiful, vast, stable, and weirdly ambitious on WebGPU.

## North Star

Kiseki should feel like a real outdoor voxel world:

- Smooth flying and looking, with no chunk-streaming hitch.
- Intentional lighting and material color.
- Nature that reads as outdoors, not just generated block terrain.
- Far views that feel huge without paying full voxel cost everywhere.
- GPU-driven systems pushed far enough that the browser version feels special.
- A final codebase shape that can later host a voxel shooter without dragging
  prototype experiments into game code.

## Phase 1g. Lighting And Material Look Pass

Goal: make the current terrain colors and PBR textures feel intentional.

Work:

- Add debug knobs for exposure, sun strength, sky ambient, AO strength, SDF
  shadow strength, fog color/density, material brightness, and saturation.
- Add look presets: bright voxel, natural outdoor, moody shooter, and flat
  debug.
- Verify grass top, grass side, dirt, stone, and snow under each look.
- Keep this as an art-direction pass, not a renderer rewrite.

Exit criteria:

- The user can tweak lighting live in the HUD or debug surface.
- There is at least one preset that makes outdoor terrain feel good.
- The texture colors no longer feel mysterious or accidental.
- Full checks pass: `bun run format`, `bun tsc`, `bun lint`, `bun run test`,
  and `bun run build`.
- Browser smoke passes on `http://localhost:5173/`.

## Phase 1h. Smoothness Contract

Goal: make sure future visual features cannot reintroduce movement hitches.

Work:

- Keep streaming centered on stable player/body position.
- Use velocity-based prefetch later, not raw camera-facing prefetch.
- Budget terrain, SDF, light, mesh, and remesh work independently.
- Batch GPU submissions where it is straightforward, especially lighting.
- Improve profiler labels so a bad frame says what caused it.

Exit criteria:

- Moving and looking around stays smooth in a 60 second profile.
- Worst-frame profile output clearly identifies streaming/generation work.
- Chunk loading does not dump a large amount of work into a single frame.

## Phase 1i. Outdoor World Generation

Goal: make the world feel like natural terrain.

Work:

- Improve terrain shaping with hills, valleys, cliffs, and flatter areas.
- Assign materials by height, depth, slope, moisture, and biome-ish values.
- Keep generation deterministic per seed and chunk coordinate.
- Add simple biome controls before going deep on content.

Exit criteria:

- The world has recognizable outdoor variation.
- Terrain still generates deterministically.
- Material transitions look deliberate enough to support trees and water.

## Phase 1j. Trees, Rocks, Houses, And Ruins

Goal: add procedural points of interest without game logic.

Work:

- Add deterministic tree placement and tree voxel stamps.
- Add rocks and boulders as small natural structures.
- Add simple houses and ruins as voxel stamps or lightweight procedural
  grammars.
- Make all structures chunk-boundary safe.

Exit criteria:

- Structures generate consistently no matter which chunk loads first.
- Trees and rocks make the terrain feel outdoors.
- Houses and ruins give us a first exploration vibe.

## Phase 1k. Water V1

Goal: make water visually convincing without simulating fluid physics.

Work:

- Add lakes or simple river bands from terrain inputs.
- Render water separately from solid terrain if that gives cleaner visuals.
- Add a simple WebGPU-friendly water material: tint, depth-ish fade, subtle
  motion, and reflection-ish highlights if practical.
- Keep water non-physical for this phase.

Exit criteria:

- Water exists as an outdoor visual feature.
- Water does not wreck chunk meshing or transparency ordering.
- It has a clear path to future gameplay/physics, but does not require them.

## Phase 1l. LOD And Vast World

Goal: make the world feel large without full voxel cost everywhere.

Ranges:

- Near: full voxel chunks, editable, lit, detailed.
- Mid: normal or cheaper voxel chunk meshes.
- Far: cheap visual-only terrain generated from the same seed.
- Very far: fog, silhouettes, sky blending, or heightfield horizon.

Work:

- Add far terrain representation, likely heightfield or chunk rings.
- Share terrain seed/settings with near chunks so far and near match.
- Fade or morph between far terrain and real chunks to hide pop-in.
- Treat far trees/structures as simplified silhouettes or skip gracefully.

Exit criteria:

- From a high point, the world feels much larger than the editable chunk range.
- Far terrain is cheap in memory, generation, and draw cost.
- Near chunks can still stream in smoothly over the far representation.

## Phase 1m. WebGPU Innovation Lab

Goal: do the fun GPU experiments before freezing architecture.

Candidates:

- Batched multi-chunk compute dispatches.
- Palette-compressed or virtualized chunk storage.
- Temporal AO or shadow accumulation.
- Hybrid raster plus voxel raymarching for reflections or far detail.
- GPU-generated far terrain LOD rings.
- GPU-resident streaming experiments where GPU writes requests for CPU.

Exit criteria:

- Pick one or two experiments that genuinely improve the engine.
- Keep experiments only if they are measurable, understandable, and maintainable.
- Document anything that should survive the final refactor.

## Phase 1n. Final Profile Gauntlet

Goal: prove the engine is stable before refactor.

Scenarios:

- 60 second fly-through.
- Fast movement plus camera look stress test.
- Ground-level outdoor walkthrough.
- Block edit stress test.
- High view-distance vista test.
- Memory stability test.

Metrics:

- FPS average/min/max.
- Frame time and worst-frame causes.
- CPU and GPU time.
- Chunk count and visible chunk count.
- Triangle count and indirect draw count.
- Terrain/SDF/light/mesh generation time.
- GPU memory, JS heap, and pool stability.

Exit criteria:

- No obvious streaming hitch.
- GPU pools remain stable after startup.
- Worst frames have explainable causes.
- We have final numbers to compare against future refactors.

## Phase 2. Final Engine Refactor

Goal: turn the prototype into a reusable engine core.

Work:

- Separate modules for streaming, worldgen, GPU storage, meshing, materials,
  lighting, rendering, profiling, and debug UI.
- Keep debug hooks powerful but isolated from runtime engine code.
- Remove dead experiments and prototype coupling.
- Document how to embed Kiseki into a future game.

Exit criteria:

- The engine can be started from a small public API.
- Debug/profiling tools still work.
- The renderer/world systems are understandable enough to build a shooter on.
- Full checks and browser smoke pass after refactor.

