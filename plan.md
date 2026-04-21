# Kiseki 奇跡 — Voxel Engine. Go Ham WebGPU Roadmap

**Kiseki** (奇跡) — "miracle." The name fits because what we're building is kind of absurd for a browser.

Single player. In memory only. **WebGPU** via Three.js `WebGPURenderer`. Bun + Vite + TypeScript strict. Vitest for unit tests. No React, no UI framework — plain TS all the way down. PBR materials from fal Patina, delivered as KTX2 texture arrays.

Goal. A GPU-driven, performant, genuinely innovative voxel engine in the browser. No game on top. Pure learning and engine work. Push WebGPU hard. End with something nobody has shipped in a browser before.

## How to work

**TDD where it earns its keep.** Pure logic functions get tests first. Visual stuff, shaders, and compute pipelines get eyeballed and debugged via readback.

**Less optimal first, then optimal** for the early phases so you understand what the optimization does. Skipped for the obvious winners.

**Profile at every checkpoint.** Chrome DevTools plus WebGPU inspector. On GPU-side phases, also readback-debug and dump buffers. Numbers written down. Watch them improve.

**Accept that it gets hard.** Phase 1b onward is where the pain starts. Compute shaders are harder to debug than CPU code. WGSL alignment rules are strict. Three.js WebGPU has rough edges. The payoff is an engine that pushes the browser to its limits.

## A note on TypeGPU

TypeGPU is a type-safe abstraction over WebGPU from Software Mansion. Not a framework. It's primitives that compose. Two things it does well. One, typed data schemas that handle WGSL alignment rules for you. Two, you can write shader functions in TypeScript with `'use gpu'`, transpile to WGSL via a Vite plugin, and call the same function on the CPU for unit tests.

Not committing to it. Just a thing to check at specific points where it might fit. The concepts don't change. You still think in storage buffers, workgroups, atomics, bind groups. It just kills the copy-paste WGSL string debugging and manual alignment pain. Ecosystem packages `@typegpu/noise`, `@typegpu/sdf`, `@typegpu/three` line up with specific phases here.

Entry points:
- Why TypeGPU: https://docs.swmansion.com/TypeGPU/why-typegpu/
- Getting Started: https://docs.swmansion.com/TypeGPU/getting-started/
- WebGPU Interop (ejecting to raw WebGPU when needed): https://docs.swmansion.com/TypeGPU/integration/webgpu-interoperability/

Worth asking Renaud what he thinks of TypeGPU vs raw WGSL vs TSL when you get to Phase 1b.

---

# PHASE 1a. CPU foundation

Build a working voxel world with CPU meshing and WebGPU rendering. Get something flyable and textured before touching compute shaders. This phase mostly follows the original roadmap.

## Step 1. Project setup

- Bun as runtime and package manager. `bun create vite` to scaffold.
- Vite + TypeScript strict.
- Three.js with `WebGPURenderer` from `three/webgpu`.
- `simplex-noise`, `vitest`, `stats.js`.
- No React, no UI framework. Plain TypeScript. Canvas is the app.
- Folder structure. `src/voxel/`, `src/mesh/`, `src/render/`, `src/camera/`, `src/world/`, `src/shader/`, `src/compute/`, `src/gpu/`, `src/main.ts`.
- Empty scene rendering via WebGPU. Confirm the browser supports it.
- One dummy vitest test passes via `bun test` or `bunx vitest`.

## Step 2. Chunk data (TDD)

- `CHUNK_SIZE = 32`.
- Tests first.
  - `xyz2i(0, 0, 0) === 0`.
  - `xyz2i(31, 31, 31) === 32767`.
  - Round trip `xyz2i` and `i2xyz`.
  - New chunk is all zeros.
  - Set and get a voxel.
- Then implement `Chunk` class. `Uint8Array(32768)`.
- Value 0 is air. 1 to 255 are material IDs.

## Step 3. Naive debug mesh (throwaway)

- One `THREE.BoxGeometry` per solid voxel.
- See cubes. Confirm data is right. Delete after step 4.

## Step 4. Custom chunk geometry

- One `BufferGeometry` per chunk.
- Manually write positions, normals, indices into typed arrays.
- All six faces of every solid voxel. One mesh per chunk. One draw call.

Test. A chunk with one solid voxel has 24 verts and 36 indices.

## Step 5. Face culling

- Skip faces between two solid voxels.
- Out of bounds treated as air for now.

Test. Two adjacent solid voxels produce 10 faces, not 12.

## Step 6. Fixed update loop

Do this before the camera because it affects everything after it.

- Separate update rate and render rate.
- Update runs at fixed timestep (60 Hz). Accumulates deltas, runs zero or more update steps per frame.
- Render interpolates between the last two update states.
- Read "Fix Your Timestep" by Glenn Fiedler. Implement the pattern.

## Step 7. Fly camera

- `PointerLockControls`.
- WASD, space, shift, mouse look.
- Camera position updates in the fixed update loop. Render uses interpolated position.

## Step 8. Multiple chunks

- `World` class.
- 3 by 3 by 3 grid.
- Position meshes at `(chunkX * 32, chunkY * 32, chunkZ * 32)`.
- Seams visible at boundaries. Fix in step 9.

## Step 9. Chunk neighbors in meshing

- Mesher takes the chunk plus its six neighbors.
- Boundary faces check into neighbor chunk instead of treating as air.
- Seams gone.

Test. Two fully solid adjacent chunks produce zero faces on the shared boundary.

## Step 10. Procedural terrain (CPU)

- Seeded simplex noise.
- 2D height map first. Below height is stone, above is air.
- Chunks generated on demand.

Test. Same seed plus same coordinates always produces identical chunk data.

## Step 11. Chunk streaming

- Track player chunk position.
- Load chunks within radius N. Unload beyond N plus buffer (hysteresis).
- `Map<string, Chunk>` keyed by `"x,y,z"`.

Test. Player movement triggers correct load and unload transitions.

## Step 12. Frustum culling

- After building each chunk mesh, call `geometry.computeBoundingBox()` and `geometry.computeBoundingSphere()`.
- Three.js handles the culling if bounds are set.
- Verify in DevTools that off screen chunks are skipped.

## Step 13. Binary greedy meshing (CPU)

Skip classic greedy. Go straight to binary greedy.

- For each face direction, each slice of the chunk is a 2D bit grid.
- Pack each row into `Uint32Array`. Bits indicate solid faces that need emitting.
- Use bitwise AND, XOR, trailing zero count to find runs of identical faces.
- Merge runs across rows into rectangles.
- Emit one quad per rectangle.

Tests.
- 2x2x1 slab of one material emits two large rectangles.
- Checkerboard emits the expected non-mergeable pattern.
- All-one-material chunk emits six big square faces.

## Step 14. Texture arrays and packed vertex rendering

- Atlas packer tool outputs five KTX2 texture arrays (40 layers each).
- Engine loads them with `KTX2Loader`. Result is a `CompressedArrayTexture`.
- Pack per vertex data into a single `Uint32`. Layout: 5 bits position X, 5 bits Y, 5 bits Z, 3 bits normal direction, 8 bits material ID, 2 bits AO (reserved), 4 bits light (reserved).
- Custom WGSL vertex shader unpacks the data.
- UVs computed in the shader from normal direction and local position.
- 4 bytes per vertex instead of 28 bytes.
- Fragment shader samples all 5 texture arrays at the material ID layer.
- Nearest filtering on magnification for blocky look, linear trilinear for minification.

This shader replaces `MeshStandardMaterial`. You write your own WGSL pipeline. Big learning moment.

> **TypeGPU check.** The packed Uint32 vertex layout and texture array bindings are where alignment rules and typed struct schemas start to matter. Worth looking at:
> - Data Schemas: https://docs.swmansion.com/TypeGPU/fundamentals/data-schemas/
> - Buffers: https://docs.swmansion.com/TypeGPU/fundamentals/buffers/
> - Textures: https://docs.swmansion.com/TypeGPU/fundamentals/textures/
> - Vertex Layouts: https://docs.swmansion.com/TypeGPU/fundamentals/vertex-layouts/
>
> Also `typegpu/std` has `pack4x8unorm`, `unpack4x8unorm`, `bitShiftLeft`, `extractBits` built in if you want them.

## Step 15. HDR environment

- Poly Haven 2K outdoor HDRI.
- Load with `RGBELoader`. Run through `PMREMGenerator`.
- `scene.environment = pmremTexture`.
- PBR materials now get proper ambient lighting.

## Step 16. Profile checkpoint 1

- Record a flying session.
- Write down FPS, chunk count, triangle count, mesh generation time, GPU time, CPU time, memory.
- This is your baseline. Everything after this should beat it.

---

# PHASE 1b. Move meshing to GPU

This is the first real GPU-driven step. Rewrite binary greedy meshing as a compute shader. The CPU version from Phase 1a is your reference for correctness.

## Step 17. GPU voxel storage

- Voxel data lives in a GPU storage buffer.
- CPU still generates it for now but uploads immediately.
- One buffer per chunk, initially. (Slab allocator comes in Phase 1d.)
- Write a readback helper. Given a GPU buffer, return its contents as a typed array on CPU. You'll use this constantly for debugging.

> **TypeGPU check.** Storage buffer creation, upload patterns, and struct layouts are the bread and butter of TypeGPU. https://docs.swmansion.com/TypeGPU/fundamentals/buffers/

## Step 18. GPU binary greedy meshing (compute shader)

The hardest step so far. Plan for 1-2 weeks.

- Compute shader reads voxel storage buffer, writes packed vertex buffer plus index buffer.
- Dispatch one workgroup per chunk (or per face direction within a chunk).
- Use shared workgroup memory for the bit grids.
- Handle the six face directions. You can dispatch six times or handle all six in one shader with branching. Start with six dispatches, easier to debug.
- Atomics to claim output vertex slots.

Correctness check. For a given chunk, CPU mesher and GPU mesher must produce the same mesh (modulo vertex order). Write a test that runs both and compares.

Expect painful debugging. WGSL does not have `console.log`. You dump intermediate buffers via readback and inspect them. Renaud can help here if you get stuck.

> **TypeGPU check. This is the step where it might pay off the most.** Two specific things:
>
> One. The CPU mesher from step 13 is your correctness reference. If you write the GPU mesher as a TypeGPU `'use gpu'` function, the *same function* can run on CPU for tests and dispatch on GPU in prod. Your correctness check becomes trivial. This maps 1:1 to the testing plan already in this doc.
>
> Two. `typegpu/std` has every primitive the binary greedy mesher needs: `countTrailingZeros`, `bitShiftLeft`, `bitShiftRight`, `extractBits`, plus `atomicAdd` for claiming vertex slots, plus `workgroupBarrier` and `storageBarrier` for the shared workgroup memory pattern.
>
> Docs:
> - Functions (how `'use gpu'` works): https://docs.swmansion.com/TypeGPU/fundamentals/functions/
> - Pipelines: https://docs.swmansion.com/TypeGPU/fundamentals/pipelines/
> - Bind Groups: https://docs.swmansion.com/TypeGPU/fundamentals/bind-groups/
> - typegpu/std reference (find the ops you need): https://docs.swmansion.com/TypeGPU/getting-started/

## Step 19. Hook GPU meshes into the renderer

- Skip the `BufferGeometry` creation path. Render directly from the GPU vertex and index buffers the compute shader wrote.
- In Three.js WebGPU this means a custom node-based material or raw WebGPU interop. Check what the current API looks like.

> **TypeGPU check.** `@typegpu/three` exists specifically for bridging TypeGPU functions into Three.js TSL nodes. Plug into `material.colorNode` etc. Caveat worth knowing: using `@typegpu/three` makes the app WebGPU-only (no WebGL fallback). Fine for this project since we're WebGPU-only anyway. https://docs.swmansion.com/TypeGPU/ecosystem/typegpu-three/

## Step 20. Profile checkpoint 2

- Mesh generation time per chunk should drop by 10x or more versus CPU in Workers.
- Main thread becomes basically idle during chunk loading.
- Write down numbers.

---

# PHASE 1c. Move terrain gen to GPU

Now the CPU stops touching voxel data entirely.

## Step 21. GPU terrain generation (compute shader)

- Compute shader takes chunk coords, seed, and generation params.
- Writes voxel IDs directly to the chunk's GPU storage buffer.
- Implement seeded simplex or perlin noise in WGSL. There are reference implementations online.
- CPU side is just a dispatcher. It tells the GPU "generate chunk X, Y, Z" and moves on.

Test. Same seed plus same coordinates produces identical voxel data (readback and compare).

> **TypeGPU check.** `@typegpu/noise` ships with `perlin3d` already implemented as a TypeGPU function. Drops the "implement noise in WGSL from scratch" bullet down to a 30-minute job. Also lets the determinism test be literal: call the same `perlin3d.sample(...)` on CPU and GPU, compare. https://docs.swmansion.com/TypeGPU/ecosystem/typegpu-noise/

## Step 22. Full GPU pipeline verification

- Flying around, CPU should be basically idle.
- All voxel data lives on GPU.
- All meshes live on GPU.
- CPU just tracks which chunks exist, dispatches gen and mesh passes, and runs game logic.

## Step 23. Break and place blocks

- CPU raycast from camera. DDA through voxel grid, reading back the relevant chunk buffer (or keep a CPU shadow copy of recently-touched chunks for fast raycast).
- First solid hit is the break target. Voxel before hit is the place target.
- Modify GPU voxel buffer (small upload).
- Re-dispatch mesher for the affected chunk plus any boundary-affected neighbors.

Tests for the pure ray stepping logic on CPU.

## Step 24. Profile checkpoint 3

- Chunk generation time, mesh time, memory. Write down.

---

# PHASE 1d. Persistent GPU buffer allocator

Stop creating and destroying GPU buffers per chunk. Allocate once, sub-allocate forever.

## Step 25. Slab allocator

- One giant voxel storage buffer. Size for max loaded chunk count.
- One giant vertex buffer. Size for estimated max vertex count across all chunks.
- One giant index buffer. Same deal.
- Free list tracks available regions.
- When a chunk loads, grab a region. When it unloads, free the region.
- Fragmentation: start with fixed-size slots (every chunk gets the same voxel buffer size, same max vertex slot). Keeps it simple. Revisit if memory gets tight.

## Step 26. Mesh slot compaction

- Vertex buffer slots will get fragmented as chunks remesh with different vertex counts.
- Periodically compact. Or use a free-list of variable-size slots with a best-fit allocator.
- Start simple, optimize if you hit waste.

## Step 27. Profile checkpoint 4

- Zero GPU allocations after startup. Verify.
- Memory usage flat over time, not growing.

---

# PHASE 1e. GPU-driven rendering

CPU stops touching render commands. GPU decides what to draw.

## Step 28. GPU frustum culling

- Compute shader reads all loaded chunks' bounding boxes.
- Tests each against the camera frustum (passed as uniforms).
- Writes a visibility bitmask.
- Zero CPU work for culling.

> **TypeGPU check.** Frustum plane math is a good candidate for `'use gpu'` — pure function, unit-testable on CPU against a known-good reference (there are frustum-aabb test references everywhere online). Typed uniforms also remove one class of binding bugs.

## Step 29. Indirect draw

- Compute shader reads visibility bitmask plus per-chunk vertex count info.
- Writes an indirect draw command list (one command per visible chunk, or one big multi-draw).
- Render pass uses `drawIndexedIndirect`.
- CPU just says "execute the indirect draw buffer." Done.

Three.js WebGPU may or may not expose this cleanly as of now. If not, you drop to raw WebGPU calls for this one part. Ask Renaud.

> **TypeGPU check.** Indirect draw is likely below TypeGPU's current abstractions — they explicitly support ejecting to raw WebGPU for this kind of thing. If you're using TypeGPU for the rest of the pipeline, make sure you understand how to interop cleanly here before committing. https://docs.swmansion.com/TypeGPU/integration/webgpu-interoperability/

## Step 30. Profile checkpoint 5

- CPU frame time should be tiny. Under 1 ms for render-side work.
- Bottleneck is now GPU-side, which is where you want it.

## Step 31. Cave culling / chunk visibility graph

- Each chunk computes which of its face pairs connect through non-solid space. Store per chunk on GPU.
- Compute shader does a flood fill starting from the player chunk, walking only through connected faces.
- Chunks hidden behind solid terrain get masked out.
- Combine with frustum culling in the visibility bitmask.

This is the Minecraft trick but on GPU.

## Step 32. Profile checkpoint 6

- In dense worlds (caves, mountains), visible chunk count should drop massively.
- Overall FPS jump should be significant.

---

# PHASE 1f. Pick an innovation and ship it

At this point you have a GPU-driven voxel engine. Now pick one Tier 2 innovation and do it properly. Recommendation: SDF-based lighting and AO.

## Step 33. SDF alongside voxels

- Every chunk has a voxel buffer and a signed distance field buffer.
- SDF stores, for each voxel, the distance to the nearest solid surface.
- Compute shader generates SDF from voxel data. Jump flood algorithm works well on GPU.
- On block change, re-dispatch SDF gen for affected chunks.

> **TypeGPU check.** `@typegpu/sdf` ships a library of 2D and 3D signed distance functions based on Inigo Quilez's work. Won't implement jump flood for you (that's your compute shader to write), but the primitive SDF math and shape functions for AO/shadow sampling in steps 34 and 35 are ready. https://docs.swmansion.com/TypeGPU/ecosystem/typegpu-sdf/

## Step 34. SDF-based ambient occlusion

- In the fragment shader, sample the SDF around the shaded pixel.
- Short distance to a surface means more occlusion.
- Way more accurate than per-vertex AO and responds to real geometry.
- Kills the per-vertex AO slot in the packed vertex (or keep both and pick one).

## Step 35. SDF-based soft shadows

- Sphere trace the SDF from the shaded pixel toward the sun direction.
- Minimum distance along the trace becomes the soft shadow factor.
- Real soft shadows. Not shadow maps. Not baked.

## Step 36. Flood fill lighting on GPU

- Each voxel has a light level 0 to 15 in a separate GPU buffer per chunk.
- Sunlight fills from top via iterative compute dispatch. Ping pong between two buffers until stable.
- Block lights propagate from sources, same pattern.
- On block change, invalidate affected region and re-run until stable.
- Packed into the 4 bits reserved in step 14.

## Step 37. Final profile and polish

- Push view distance.
- Final numbers. FPS, chunk count, memory, mesh time, gen time.
- Targets worth aiming for:
  - 60 fps at 24 chunk view distance, 500 plus chunks loaded.
  - Mesh generation under 0.5 ms per chunk on GPU.
  - Chunk gen under 0.5 ms per chunk on GPU.
  - Memory under 500 MB.
  - CPU frame time under 2 ms.
  - Full PBR, SDF AO, soft shadows, flood fill lighting, all running in real time.

---

# Tier 2 and Tier 3 innovations for later

You can stop after Phase 1f and have something genuinely impressive. Or keep going into deeper innovation territory.

## Tier 2 worth exploring

- **Temporal accumulation.** Accumulate lighting, AO, reflections over multiple frames via reprojection. Each frame does 1/4 the work. Quality builds up when camera is still.
- **Hybrid rasterization plus voxel raymarching.** Main pass rasterizes meshed chunks. Second pass raymarches the voxel buffer for reflections and specular. Fast base, ray-traced feel on the stuff that matters.
- **Virtualized chunk storage.** Inactive chunks palette-compress themselves in place via compute shader. Active chunks stay uncompressed. 5-10x memory reduction.
- **Voxel cone tracing for global illumination.** Mipmap the voxel representation. Cone trace for indirect light. Your voxel world is already the perfect data structure for this.

## Tier 3 publish-a-paper territory

- **64-tree or brickmap storage.** Sparse voxel structures with sub-voxel detail. Full ray-marched rendering instead of meshing. Enables billions of voxels.
- **GPU-resident world streaming.** GPU decides what to load and dispatches fetch requests to CPU via a ring buffer. CPU becomes a file fetcher for the GPU.

## Genuinely skip

- **Octree storage.** Modern replacement is brickmap or 64-tree. Skip octrees.
- **Classic occlusion queries.** Not worth it. Cave culling covers the same ground more efficiently.

---

# What to test and what not to test

**Test (vitest, TDD where useful).**

- Pure functions. `xyz2i`, UV math, AO table, light propagation math.
- Data structure invariants.
- CPU binary greedy mesher input and output counts. (Used as reference for the GPU mesher.)
- DDA ray stepping.
- Determinism of procedural gen (CPU and GPU versions must match).

**Do not test.**

- Three.js or WebGPU scene setup. Run and look.
- Shader output. Eyeball it. Readback-debug when needed.
- Camera feel.
- Compute shader internals. Dump buffers and inspect.
- Performance numbers. Profile them, do not assert them.

---

# Tools to keep handy

- Chrome DevTools Performance tab.
- WebGPU inspector (browser extension) for GPU pipeline debugging.
- `stats.js` for FPS and frame time in the corner.
- Debug overlay with chunk count, triangle count, draw calls, memory, visible chunks, GPU time, CPU time.
- **Buffer readback helper.** Write this early in Phase 1b. Dumps any GPU buffer to CPU as a typed array. You will use it every single day.
- **Buffer-to-canvas visualizer.** Helper that renders any buffer as a grayscale image on a debug canvas. Amazing for inspecting SDFs, light fields, visibility masks.

---

# Out of scope for phase 1

- No game logic. No guns. No mobs. No AI.
- No multiplayer or networking.
- No persistence or save files.
- No UI beyond the debug overlay.
- No sound.
- No particles.
- No water physics. Water is a solid blue voxel for now.
- No transparency. Glass is opaque.

Phase 1 is a GPU-driven world you can fly through, modify, and admire. Nothing more. Game logic is Phase 2 territory.

---

# How to actually start

Just start. Phase 1a step 1. Don't over-plan the GPU stuff until you get there. Renaud is a resource if you get stuck on something specific in Phase 1b+, but don't prep a list for him. Build, hit walls, ask then.
