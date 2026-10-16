'use strict';
// Ownership: server-side HTML rendering and tab pane scaffold for the Sprites tab. Pure.

/**
 * Build the HTML string for the Sprites tab pane.
 * @returns {string} HTML string
 */
function buildSpritesTabHtml() {
    return `
<div class="tab-pane" data-tab="sprites" style="display:none">
  <div class="sp-panels">
    <!-- Left rail: Mode Switch + Search + List -->
    <div class="sp-rail">
      <div class="sp-mode-bar">
        <button class="sp-mode-btn sp-active" data-mode="chars" id="sp-btn-mode-chars">Characters</button>
        <button class="sp-mode-btn" data-mode="anims" id="sp-btn-mode-anims" title="Every animation in the ROM's record table">Animations</button>
        <button class="sp-mode-btn" data-mode="raw" id="sp-btn-mode-raw">Sprites</button>
      </div>

      <div class="sp-search-wrap">
        <input type="text" id="sp-search" class="sp-input" placeholder="Search name, ID or $addr..." autocomplete="off" spellcheck="false" />
      </div>

      <div class="sp-filter-bar" id="sp-char-filters">
        <button class="sp-filter-chip sp-active" data-filter="all">All</button>
        <button class="sp-filter-chip" data-filter="enemies">Enemies</button>
        <button class="sp-filter-chip" data-filter="npcs">NPCs</button>
        <button class="sp-filter-chip" data-filter="heroes">Heroes</button>
      </div>

      <div class="sp-list" id="sp-list"></div>
    </div>

    <!-- Resizable Splitter -->
    <div class="sp-split" data-resize="rail" title="Drag to resize"></div>

    <!-- Right Main Area -->
    <div class="sp-main">
      <!-- ── Characters View ── -->
      <div class="sp-view-content" id="sp-char-view">
       <div class="sp-char-layout">
        <div class="sp-char-main">
        <!-- Top Title & Badge bar -->
        <div class="sp-header">
          <div class="sp-header-left">
            <span class="sp-char-id" id="sp-char-id">#--</span>
            <span class="sp-char-name" id="sp-char-name">Select a character</span>
            <span class="sp-badge" id="sp-char-badge"></span>
          </div>
          <div class="sp-header-right">
            <span class="sp-palette-label">Palette:</span>
            <span class="sp-palette-hex" id="sp-palette-hex">$0000</span>
            <div class="sp-palette-swatch" id="sp-palette-swatch"></div>
          </div>
        </div>

        <div class="sp-tool-group" style="display:none">
          <label class="sp-label" for="sp-anim-sel">Animation:</label>
          <select class="sp-select" id="sp-anim-sel"></select>
        </div>

        <!-- The stage fills the row, controls float over it, the seek bar runs along the bottom -->
        <div class="sp-stage-row">
          <div class="sp-stage-col">
            <div class="sp-stage" id="sp-stage">
              <canvas id="sp-canvas" width="320" height="320"></canvas>
              <!-- Stage overlay: facing and overlay toggles, floating over the map -->
          <div class="sp-controls sp-stage-overlay">
            <div class="sp-controls-title">Facing</div>
            <div class="sp-compass" title="Facing. The game's direction tables move facing 0 up the screen and 8 down; characters with four poses round the diagonals to the nearest">
              <button class="sp-facing-btn" data-facing="14" title="NW (14)">NW</button>
              <button class="sp-facing-btn" data-facing="0" title="N (0)">N</button>
              <button class="sp-facing-btn" data-facing="2" title="NE (2)">NE</button>
              <button class="sp-facing-btn" data-facing="12" title="W (12)">W</button>
              <span class="sp-compass-mid"></span>
              <button class="sp-facing-btn" data-facing="4" title="E (4)">E</button>
              <button class="sp-facing-btn" data-facing="10" title="SW (10)">SW</button>
              <button class="sp-facing-btn sp-active" data-facing="8" title="S (8)">S</button>
              <button class="sp-facing-btn" data-facing="6" title="SE (6)">SE</button>
            </div>
            <div class="sp-controls-title">Overlays</div>
            <div class="sp-overlay-list">
            <label class="sp-check-label" title="Body collision box (2r × r) — what entities bump into">
              <input type="checkbox" id="sp-chk-body" checked /> <span class="sp-tag tag-body">Body Hitbox</span>
            </label>
            <label class="sp-check-label" title="Hurt region (2r × 2r) centred on the feet, as the hit test measures it. Dashed grey when the character is 30 px or more up: out of reach of a ground-level attack">
              <input type="checkbox" id="sp-chk-hurt" checked /> <span class="sp-tag tag-hurt">Hurt Box</span>
            </label>
            <label class="sp-check-label" title="Strike box (w × h) declared by attack animations">
              <input type="checkbox" id="sp-chk-strike" checked /> <span class="sp-tag tag-strike">Strike Box</span>
            </label>
            <label class="sp-check-label" title="Projectiles thrown by command 0x4C, flying from their spawn point">
              <input type="checkbox" id="sp-chk-proj" checked /> <span class="sp-tag tag-proj">Projectiles</span>
            </label>
            <label class="sp-check-label" title="Move the sprite along its steps (x/y). Off keeps it in place; jump height always shows">
              <input type="checkbox" id="sp-chk-walk" checked /> <span class="sp-tag tag-walk">Walk path</span>
            </label>
            <label class="sp-check-label" title="Aggro square: the character engages when the target is within this many pixels in both x and y ($8FD72D), checked only once its stamina is full and then with the aggro chance">
              <input type="checkbox" id="sp-chk-aggro" /> <span class="sp-tag tag-aggro">Aggro</span>
            </label>
            <label class="sp-check-label" title="A second character to aim at: the Boy for enemies, a Wimpy Flower for the Boy, the Dog and NPCs. Hits flash red">
              <input type="checkbox" id="sp-chk-target" /> <span class="sp-tag tag-target">Target</span>
            </label>
            <label class="sp-check-label" title="How far ahead the target stands, in pixels">
              <input type="number" id="sp-target-dist" class="sp-input sp-num" value="40" min="0" max="200" step="4" />px
            </label>
            <label class="sp-check-label" title="Stamina when the attack starts ($9082D8 picks the attack: under 100% Lvl 0, 100% Lvl 1, 200% Lvl 2, 300% Lvl 3). It also scales the attack's power ($8FC02B): under 50% ×¼, under 100% ×½, 100% ×1, 200% ×2, 300% ×4">
              <span class="sp-tag tag-stamina">Stamina</span>
              <select id="sp-stamina" class="sp-select sp-sel-sm">
                <option value="q">&lt; 50%</option>
                <option value="h">50–99%</option>
                <option value="1" selected>100%</option>
                <option value="2">200%</option>
                <option value="3">300%</option>
              </select>
            </label>
            <label class="sp-check-label" title="Keep each tick's strike and projectile hit boxes on screen for this many ticks, fading out (0 = off)">
              <span class="sp-tag tag-trail">Trail</span> <input type="number" id="sp-trail" class="sp-input sp-num" value="0" min="0" max="120" step="2" />
            </label>
            <label class="sp-check-label" title="Sprite feet origin (0,0)">
              <input type="checkbox" id="sp-chk-origin" checked /> <span class="sp-tag tag-origin">Origin</span>
            </label>
            </div>
          </div>
              <!-- Stage overlay: playback speed, scale, and how fast the animation moves the character -->
              <div class="sp-stage-hud">
            <div class="sp-speed-group sp-hud-row">
              <span class="sp-label">Speed:</span>
              <select class="sp-select sp-sel-sm" id="sp-speed-sel">
                <option value="0.25">0.25×</option>
                <option value="0.5">0.5×</option>
                <option value="1" selected>1×</option>
                <option value="2">2×</option>
                <option value="4">4×</option>
              </select>
            </div>

            <div class="sp-zoom-group sp-hud-row">
              <span class="sp-label">Scale:</span>
              <button class="sp-scale-btn" data-scale="2">2×</button>
              <button class="sp-scale-btn sp-active" data-scale="3">3×</button>
              <button class="sp-scale-btn" data-scale="4">4×</button>
            </div>

                <div class="sp-hud-speeds" id="sp-speed-readout"></div>
              </div>
            </div>
          </div>
        </div>

          <!-- Playback Bar -->
          <div class="sp-player-bar">
            <div class="sp-player-btns">
              <button class="sp-ctrl-btn" id="sp-btn-step-prev" title="Step backward">⏮</button>
              <button class="sp-ctrl-btn sp-btn-play" id="sp-btn-play" title="Play / Pause">⏸</button>
              <button class="sp-ctrl-btn" id="sp-btn-step-next" title="Step forward">⏭</button>
              <button class="sp-ctrl-btn sp-active" id="sp-btn-loop" title="Loop animation">🔁</button>
            </div>

            <div class="sp-scrubber-wrap">
              <input type="range" class="sp-scrubber" id="sp-scrubber" min="0" max="0" value="0" />
              <span class="sp-frame-info" id="sp-frame-info">Frame 1/1 (0 ticks)</span>
            </div>

            <div class="sp-current-sprite">
              <span class="sp-label">Sprite:</span>
              <span class="sp-sprite-link" id="sp-cur-sprite-addr" title="Click to view in Raw Sprites tab">$000000</span>
            </div>
          </div>

        </div>

        <div class="sp-split sp-split-right" data-resize="side" title="Drag to resize"></div>

        <!-- Right sidebar: animations, stats, script, chunks, palettes -->
        <div class="sp-side">
          <div class="sp-side-tabs">
            <button class="sp-side-tab sp-active" data-side="anims">Animations</button>
            <button class="sp-side-tab" data-side="stats">Stats</button>
            <button class="sp-side-tab" data-side="script">Script</button>
            <button class="sp-side-tab" data-side="chunks">Chunks</button>
            <button class="sp-side-tab" data-side="palettes" id="sp-btn-palettes">Palettes</button>
          </div>
        <!-- The character's animations, as tiles -->
        <div class="sp-details-col sp-side-pane" data-side="anims">
          <div class="sp-tool-group sp-side-tool" id="sp-weapon-group" style="display:none">
            <label class="sp-label" for="sp-weapon-sel">Weapon:</label>
            <select class="sp-select" id="sp-weapon-sel"></select>
          </div>
          <div class="sp-anim-grid" id="sp-anim-grid"></div>
        </div>

        <!-- Every palette: the current frame recoloured, click to apply -->
        <div class="sp-palette-panel sp-side-pane" data-side="palettes" id="sp-palette-panel" style="display:none">
          <div class="sp-col-title">
            <span>All palettes</span>
            <span class="sp-col-sub" id="sp-palette-status"></span>
            <button class="sp-chip-btn" id="sp-btn-palette-own" title="Back to the character's own palette">Own palette</button>
          </div>
          <div class="sp-palette-grid" id="sp-palette-grid"></div>
        </div>

        <!-- Animation script: the bytecode behind the playing animation -->
        <div class="sp-script-panel sp-side-pane" data-side="script" style="display:none">
          <div class="sp-col-title">
            <span>Animation Script</span>
            <span class="sp-col-sub" id="sp-script-status"></span>
            <label class="sp-check-label" title="Show what each command loads beneath it: sprites, palettes, projectiles"><input type="checkbox" id="sp-chk-script-spr" checked /> previews</label>
          </div>
          <div class="sp-script-owners" id="sp-script-owners"></div>
          <div class="sp-script-wrap" id="sp-script-wrap">
            <table class="sp-script-table" id="sp-script-table">
              <tbody id="sp-script-body"></tbody>
            </table>
          </div>
        </div>

        <!-- Stats & engine meanings -->
        <div class="sp-details-col sp-side-pane" data-side="stats" style="display:none">
          <div class="sp-col-title sp-col-only-title">Character Stats & Engine Meanings</div>
          <div class="sp-stats-grid" id="sp-stats-grid"></div>
        </div>

        <!-- Sprite chunks of the current frame -->
        <div class="sp-details-col sp-side-pane" data-side="chunks" style="display:none">
          <div class="sp-col-title">
            <span>Frame Chunks</span>
            <span class="sp-col-sub" id="sp-chunks-count">(0 chunks)</span>
          </div>
          <div class="sp-chunks-table-wrap">
            <table class="sp-chunks-table" id="sp-chunks-table">
              <thead>
                <tr>
                  <th>Tile</th>
                  <th>Block</th>
                  <th>Offset (X, Y)</th>
                  <th>Flags</th>
                  <th>Properties</th>
                </tr>
              </thead>
              <tbody id="sp-chunks-body"></tbody>
            </table>
          </div>
        </div>
        </div>
       </div>
      </div>

      <!-- ── Raw Sprites View ── -->
      <div class="sp-view-content" id="sp-raw-view" style="display:none">
       <div class="sp-char-layout">
        <div class="sp-char-main">
        <div class="sp-header">
          <div class="sp-header-left">
            <span class="sp-char-name" id="sp-raw-name">Raw Sprite $ca0003</span>
            <span class="sp-badge" id="sp-raw-badge">9 chunks</span>
          </div>
          <div class="sp-header-right">
            <div class="sp-tool-group" style="display:none">
              <label class="sp-label" for="sp-raw-palette-sel">Palette:</label>
              <select class="sp-select" id="sp-raw-palette-sel"></select>
            </div>
            <div class="sp-tool-group">
              <label class="sp-label" for="sp-raw-bg-sel">Background:</label>
              <select class="sp-select" id="sp-raw-bg-sel">
                <option value="none">None (Transparent)</option>
                <option value="dark" selected>Dark</option>
                <option value="light">Light</option>
                <option value="check">Checkerboard</option>
                <option value="green">Green (Chroma)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="sp-stage-wrap">
          <div class="sp-stage sp-raw-stage" id="sp-raw-stage">
            <canvas id="sp-raw-canvas" width="256" height="256"></canvas>
          </div>
        </div>
        </div>

        <div class="sp-split sp-split-right" data-resize="side" title="Drag to resize"></div>

        <!-- Same sidebar as the Characters view: chunks, palettes -->
        <div class="sp-side">
          <div class="sp-side-tabs">
            <button class="sp-side-tab sp-active" data-rawside="chunks">Chunks</button>
            <button class="sp-side-tab" data-rawside="palettes">Palettes</button>
          </div>
          <div class="sp-details-col sp-side-pane" data-rawside="chunks">
            <div class="sp-col-title sp-col-only-title">Chunks in this sprite</div>
            <div class="sp-chunks-table-wrap">
              <table class="sp-chunks-table" id="sp-raw-chunks-table">
                <thead>
                  <tr>
                    <th>Tile</th>
                    <th>Block</th>
                    <th>Offset (X, Y)</th>
                    <th>Flags</th>
                    <th>Properties</th>
                  </tr>
                </thead>
                <tbody id="sp-raw-chunks-body"></tbody>
              </table>
            </div>
          </div>
          <div class="sp-palette-panel sp-side-pane" data-rawside="palettes" style="display:none">
            <div class="sp-col-title"><span>All palettes</span><span class="sp-col-sub" id="sp-raw-palette-status"></span></div>
            <div class="sp-palette-grid" id="sp-raw-palette-grid"></div>
          </div>
        </div>
       </div>
      </div>
    </div>
  </div>
</div>`;
}

module.exports = {
    buildSpritesTabHtml,
};
