export function createDebugWorldMarkup(): string {
  return `
    <main class="app-shell">
      <div class="hud">
        <p class="eyebrow">Kiseki / Step 24</p>
        <h1 class="title">Profile Checkpoint 3</h1>
        <p class="subtitle">
          The terrain, meshing, and render path are now GPU-driven end to end. Use the crosshair to break or place blocks, then profile the streamed world in motion.
        </p>
        <dl class="stats">
          <div class="stats-card">
            <dt>Status</dt>
            <dd data-status>Checking WebGPU</dd>
          </div>
          <div class="stats-card">
            <dt>Pointer</dt>
            <dd data-pointer-state>Unlocked</dd>
          </div>
          <div class="stats-card">
            <dt>Fixed Hz</dt>
            <dd data-fixed-rate>60</dd>
          </div>
          <div class="stats-card">
            <dt>FPS</dt>
            <dd data-fps>0.0</dd>
          </div>
          <div class="stats-card">
            <dt>CPU ms</dt>
            <dd data-cpu-time>0.00</dd>
          </div>
          <div class="stats-card">
            <dt>GPU ms</dt>
            <dd data-gpu-time>n/a</dd>
          </div>
          <div class="stats-card">
            <dt>Mesh ms</dt>
            <dd data-mesh-time>0.00</dd>
          </div>
          <div class="stats-card">
            <dt>Terrain ms</dt>
            <dd data-terrain-time>0.00</dd>
          </div>
          <div class="stats-card">
            <dt>Voxel Buffers</dt>
            <dd data-gpu-voxel-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Voxel MB</dt>
            <dd data-gpu-voxel-mb>0.00</dd>
          </div>
          <div class="stats-card">
            <dt>GPU Meshes</dt>
            <dd data-gpu-mesh-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Mesh MB</dt>
            <dd data-gpu-mesh-mb>0.00</dd>
          </div>
          <div class="stats-card">
            <dt>Vertex Bytes</dt>
            <dd data-vertex-bytes>4</dd>
          </div>
          <div class="stats-card">
            <dt>Profile</dt>
            <dd data-profile-state>Idle</dd>
          </div>
          <div class="stats-card">
            <dt>Pipeline</dt>
            <dd data-pipeline-state>Mixed</dd>
          </div>
          <div class="stats-card">
            <dt>Chunks</dt>
            <dd data-chunk-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Player Chunk</dt>
            <dd data-player-chunk>0,0,0</dd>
          </div>
          <div class="stats-card">
            <dt>Visible Chunks</dt>
            <dd data-visible-chunks>0</dd>
          </div>
          <div class="stats-card">
            <dt>Position</dt>
            <dd data-position>0, 0, 0</dd>
          </div>
          <div class="stats-card">
            <dt>Quads</dt>
            <dd data-face-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Triangles</dt>
            <dd data-triangle-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Draw Calls</dt>
            <dd data-draw-calls>0</dd>
          </div>
          <div class="stats-card">
            <dt>Edited Voxels</dt>
            <dd data-edited-voxels>0</dd>
          </div>
        </dl>
        <button class="lock-button" type="button" data-lock-button>
          Click To Fly
        </button>
        <div class="action-row">
          <button class="secondary-button" type="button" data-profile-button>
            Start Profile Run
          </button>
          <button
            class="ghost-button"
            type="button"
            data-copy-profile-button
            disabled
          >
            Copy Report
          </button>
        </div>
        <pre class="profile-report" data-profile-report>
Press Start Profile Run, fly around for a bit, then stop to capture a fresh checkpoint-3 report.
        </pre>
      </div>
      <div class="viewport" data-viewport></div>
      <div class="crosshair" aria-hidden="true"></div>
      <p class="footnote">WASD to strafe, Space and Shift to rise or descend. Left click breaks, right click places cobblestone. The CPU keeps only empty chunk placeholders plus sparse edit overrides while live voxels and meshes stay on the GPU.</p>
    </main>
  `
}
