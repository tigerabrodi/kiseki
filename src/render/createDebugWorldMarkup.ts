export function createDebugWorldMarkup(): string {
  return `
    <main class="app-shell">
      <div class="hud">
        <p class="eyebrow">Kiseki / Step 18</p>
        <h1 class="title">GPU Binary Greedy Meshing</h1>
        <p class="subtitle">
          CPU terrain still generates and renders the world for now, but every streamed chunk also runs the binary greedy mesher as a WebGPU compute pass into packed vertex and index buffers so we can prove parity before step 19 hooks them into the renderer.
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
            Copy Baseline
          </button>
        </div>
        <pre class="profile-report" data-profile-report>
Press Start Profile Run, fly around for a bit, then stop to capture your step-18 baseline.
        </pre>
      </div>
      <div class="viewport" data-viewport></div>
      <p class="footnote">WASD to strafe, Space and Shift to rise or descend. The scene still renders from the CPU mesher today, but each loaded chunk now also owns GPU-computed packed mesh buffers that we can read back and compare against the CPU reference.</p>
    </main>
  `
}
