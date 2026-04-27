# Kiseki Final Pre-Refactor Plan

This is the final working roadmap before Kiseki becomes a cleaner reusable
voxel engine. The goal is still not gameplay, networking, or a shooter yet. The
goal is to make the outdoor infinite-world demo feel vast, smooth, beautiful,
and WebGPU-heavy enough that the later engine API is worth extracting.

## North Star

Kiseki should feel like an outdoor voxel engine that can later power many kinds
of games:

- Infinite outdoor terrain that feels massive from high viewpoints.
- Near terrain remains real voxels: editable, lit, collidable, and detailed.
- Far terrain is cheap visual context, not full voxel chunks.
- Chunk streaming feels smooth during fly mode and should feel invisible during
  normal ground movement.
- Lighting, fog, materials, and atmosphere feel intentional instead of accidental.
- WebGPU does meaningful work: terrain, SDF/light data, meshing, visibility, and
  indirect draw masking.
- Final refactor exposes clean engine seams so future games can plug in custom
  maps, generators, render settings, and gameplay systems.

## Core Rule

Do not solve vastness by loading more full voxel chunks.

Full chunks are for the playable near field. Huge views come from far terrain,
LOD rings, horizon treatment, and fog. If a fix makes the world look bigger by
brute-forcing near chunks, it is probably the wrong long-term fix.

## Phase 0. Baseline And Safety

Goal: keep the repo on a trusted baseline before continuing.

Status: done.

What this means:

- Keep the current committed outdoor-feature checkpoint as the safe baseline.
- Do not keep experimental streaming/startup changes unless they are verified.
- Do not commit future work until the user has reviewed it, unless explicitly
  asked.
- Every implementation phase must be tested before it is considered done.

## Phase 1. World Provider Boundary

Goal: make world generation a replaceable input to the engine without doing the
full final refactor yet.

Work:

- Define a small `WorldProvider`-style seam for terrain/material generation.
- Keep the current outdoor generator behind that seam.
- Make room for future providers: finite arena maps, handmade maps, imported
  maps, procedural worlds, and debug worlds.
- Keep rendering, storage, streaming, and profiling separate from provider
  decisions.

Exit criteria:

- The core engine does not need to know whether terrain comes from an infinite
  generator or a finite custom map.
- The outdoor generator still behaves the same visually.
- No broad folder churn yet; this is a clean seam, not the final refactor.

## Phase 2. Terrain Shape Pass

Goal: make the base outdoor terrain worth looking at before adding more content.

Work:

- Improve hills, valleys, ridges, flatter traversal areas, and cliffs.
- Use deterministic noise layers and material rules that compose cleanly.
- Reduce ugly slab repetition and unnatural vertical walls where possible.
- Keep generation chunk-boundary safe.

Exit criteria:

- A fly-through reads as a real outdoor landscape, not only stacked blocks.
- Terrain still matches across chunk boundaries.
- The world is ready for far terrain, trees, rocks, and water.

## Phase 3. Far Terrain And LOD Design

Goal: design the vast-world model before building it.

Ranges:

- Near: full voxel chunks, editable, lit, collidable, detailed.
- Mid: normal chunks or slightly cheaper voxel meshes.
- Far: cheap visual-only terrain generated from the same seed.
- Very far: fog, silhouettes, sky blend, or heightfield horizon.

Work:

- Decide the data format for far terrain: heightfield tiles, rings, or both.
- Decide how near chunks and far terrain share seed/settings/material logic.
- Define where transitions happen and how fog hides unavoidable detail loss.
- Decide which far features exist visually and which are omitted.

Exit criteria:

- The LOD plan is written down enough that implementation is not guesswork.
- We know which parts are editable and which are only visual.
- We know how this avoids the "missing giant areas" problem.

## Phase 4. Far Heightfield Prototype

Goal: make the world feel huge without loading huge numbers of full chunks.

Work:

- Generate visual-only far terrain from the same seed as near chunks.
- Render far terrain cheaply as heightfield/ring geometry.
- Keep it non-editable and separate from voxel chunk storage.
- Start simple: terrain silhouette and color are more important than detail.

Exit criteria:

- From a high point, the world extends far beyond the near chunk radius.
- Far terrain does not meaningfully increase chunk pool pressure.
- Near chunks can still stream and edit normally.

## Phase 5. Near/Far Transition

Goal: hide the handoff between full voxel chunks and cheap far terrain.

Work:

- Overlap near chunks and far terrain enough to avoid visible holes.
- Use fog, fade bands, or material blending to reduce pop-in.
- Avoid obvious "world ends here" cliffs.
- Verify chunk loading from high viewpoints and ground viewpoints.

Exit criteria:

- The horizon feels continuous during movement.
- New near chunks replace far terrain without distracting pops.
- Missing terrain is no longer visible during normal movement.

## Phase 6. Startup Loading Contract

Goal: make first load feel intentional instead of half-loaded.

Work:

- Define the minimum near-field readiness before the player is released.
- Show a loading/progress state when needed instead of dropping into gaps.
- Prioritize initial chunks by player safety and visible importance.
- Keep startup fast, but do not sacrifice obvious correctness.

Exit criteria:

- The first playable frame has enough terrain to feel coherent.
- The user is not dropped into an obviously missing world.
- Startup time is measured, not guessed.

## Phase 7. Runtime Streaming Polish

Goal: make edge catch-up fast when needed and gentle when frames are tight.

Work:

- Keep streaming paced around actual player movement, not camera jitter.
- Use adaptive catch-up when pending loads grow or visible edges are exposed.
- Avoid reintroducing hitches from too many submissions, passes, or rebuilds.
- Keep profiler output specific enough to explain bad frames.

Exit criteria:

- Fly mode stays smooth under normal stress.
- Ground movement should feel fully stable.
- Chunk-edge gaps fill quickly without dumping work into one frame.

## Phase 8. Lively Outdoor Features

Goal: add nature after the terrain and far horizon are structurally solid.

Work:

- Keep tree, rock, and boulder placement deterministic.
- Make stamps sparse, readable, and chunk-boundary safe.
- Treat these as optional provider/decorator features, not engine identity.
- Prefer simple good-looking content over lots of noisy content.

Exit criteria:

- The outdoor world feels more alive without breaking load behavior.
- Features can be disabled or swapped by future world providers.
- No giant structure artifacts or partial chunk-boundary failures.

## Phase 9. Water V1

Goal: add water as a visual outdoor feature without simulating fluid physics.

Work:

- Add lakes first; rivers can come later if terrain supports them cleanly.
- Render water separately if it avoids transparency and meshing issues.
- Use a simple WebGPU-friendly water look: tint, subtle motion, and lighting.
- Keep water non-physical for now.

Exit criteria:

- Water improves the outdoor read of the scene.
- Water does not destabilize chunk meshing or visibility.
- There is a clear path to future gameplay, but no gameplay dependency.

## Phase 10. Atmosphere And Material Pass

Goal: tune the world after terrain, far views, and water exist together.

Work:

- Revisit sun, sky, HDR, AO, SDF shadows, fog, brightness, and saturation.
- Tune grass top/side, dirt, stone, snow, bark, leaf, and water materials.
- Keep debug presets useful: natural outdoor, bright debug, moody shooter, flat.
- Use screenshots and profiles, not vibes alone.

Exit criteria:

- The default look feels intentional.
- The debug knobs remain useful but do not hide broken defaults.
- The world screenshots well from ground level and high vistas.

## Phase 11. WebGPU Innovation Lab

Goal: do the fun GPU experiments before freezing architecture.

Candidates:

- Batched multi-chunk compute dispatches.
- GPU-generated far terrain rings.
- Palette-compressed or virtualized chunk storage.
- Temporal AO or shadow accumulation.
- GPU-side request buffers for future streaming experiments.
- Hybrid raster plus voxel tricks for far detail or reflections.

Exit criteria:

- Keep only experiments that are measurable, understandable, and maintainable.
- Document anything that should survive the final refactor.
- Do not let experiments leak into the engine API unless they earn it.

## Phase 12. Profile Gauntlet

Goal: prove the pre-refactor engine is stable enough to freeze behavior.

Scenarios:

- Startup loading.
- High-vista fly-through.
- Fast movement plus camera-look stress.
- Ground-level walkthrough.
- Chunk-edge traversal.
- Block edit stress.
- Memory stability over time.

Metrics:

- FPS average/min/max.
- Frame time and worst-frame causes.
- CPU and GPU time.
- Chunk count, visible chunks, and pending loads.
- Triangle count and indirect draw count.
- Terrain, SDF, light, mesh, and far-terrain generation time.
- GPU memory, JS heap, and pool stability.

Exit criteria:

- No obvious streaming hitch in normal movement.
- Fly mode is smooth enough for demo work.
- GPU pools remain stable after startup.
- Worst frames have explainable causes.

## Phase 13. Final Architecture Analysis

Goal: decide the final public shape before moving files around.

Work:

- Document module boundaries for streaming, world providers, GPU storage,
  meshing, materials, lighting, rendering, profiling, debug UI, and input.
- Decide which APIs are public and which remain internal.
- Identify prototype code to delete, isolate, or rewrite.
- Preserve the WebGPU wins without preserving accidental coupling.

Exit criteria:

- The refactor has a written target.
- We know what future game code should import.
- Debug and profiling stay easy to remove or disable.

## Phase 14. Final Engine Refactor

Goal: turn Kiseki from a prototype demo into a reusable TypeScript voxel engine.

Work:

- Extract clean engine entry points.
- Keep world generation pluggable.
- Keep debug/profiling tools isolated.
- Keep renderer/storage/streaming internals understandable.
- Add docs for embedding Kiseki into a future game.

Exit criteria:

- A small public API can start the engine.
- A game can provide its own map or world generator.
- The outdoor demo still works as a showcase.
- The codebase is ready for future shooter experiments.

## Intentionally Not Now

- Capture-the-flag gameplay.
- Weapons, loadouts, ammo, grenades, and pickups.
- Networking, rooms, matchmaking, and voice chat.
- Spatial audio.
- Full physics or Rapier integration.
- Houses, ruins, or complex structures unless they directly help the outdoor
  engine demo.
- Infinite full-detail chunks as the answer to vastness.

## Verification Rule

Every implementation phase should finish with:

- `bun run format`
- `bun tsc --noEmit`
- `bun lint`
- `bun run test`
- `bun run build`
- Browser smoke on `http://localhost:5173/` when visuals/runtime behavior change.
- A profile run when streaming, rendering, generation, LOD, or GPU work changes.
