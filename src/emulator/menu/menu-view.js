'use strict';

/**
 * emulator/menu/menu-view.js
 *
 * Owns: the Emulator Quick Menu OSD (On-Screen Display).
 * - Fixed top positioning
 * - 6 Tabs paged with L and R:
 *     0: VIEW (Default - the paused screen undistorted, pan & zoom; room and coordinates for Evermore)
 *     1: OVERLAYS (Extended Map, Triggers, Entities, Anim Tiles, Collision, Fog, Sound FX, Zoom) - all off by default
 *     2: OBJECTS (Section 3 objects list, state 0...max, stepper alters WRAM & engine)
 *     3: LOOT (Chests, Gourds & Sniff spots, preview icon, looted toggle, safe script run)
 *     4: CHEATS
 *     5: EMULATION (Speed 1/4x..4x, Master Audio, Keep Focus, Reset, Soft Reset)
 *     6: CONTROLS (Interactive keybinds & gamepad remapper, presets)
 * Tabs 1-4 need Secret of Evermore (data-needs="evermore", webview/emulator-profile.js).
 * - Non-looping stepped values (Speed: 1/4x, 1/2x, 1x, 2x, 4x; Zoom, toggles)
 * - Up/Down automatic scroll-into-view
 * - Wheel events inside menu scroll the menu instead of the map
 * - Outside clicks/drags on Lens tab pan the map
 * - Sound visualization toggle in menu with script position mapping
 * - Unified Pause / Menu toggle (Start by default, Esc always pauses)
 *
 * Strictly ASCII-only.
 */

const { getMenuSoundScript } = require('./menu-sound');

function getMenuCss() {
  return `
    /* -- Emulator Quick Menu OSD --------------------------------------- */
    #emulator-menu {
      position: absolute;
      inset: 0;
      z-index: 60;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 0;
      background: rgba(8, 8, 12, 0.78);
      backdrop-filter: blur(2px);
      user-select: none;
      font-family: monospace;
    }
    #emulator-menu.hidden {
      display: none !important;
    }

    /* Lens Tab Active: top-bar only, completely unobstructed map */
    #emulator-menu.lens-tab-active {
      background: transparent !important;
      backdrop-filter: none !important;
      pointer-events: none !important;
      padding-top: 0 !important;
    }
    #emulator-menu.lens-tab-active #menu-card {
      pointer-events: auto !important;
      background: #1c1c22 !important;
      border: 1px solid #30303a !important;
      border-top: none !important;
      border-radius: 0 0 6px 6px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
      width: 520px !important;
      max-width: 95% !important;
    }
    #emulator-menu.lens-tab-active #menu-body,
    #emulator-menu.lens-tab-active #menu-footer {
      display: none !important;
    }

    #menu-card {
      width: 520px;
      max-width: 95%;
      max-height: 85vh;
      background: #141418;
      border: 1px solid #363640;
      border-top: none;
      border-radius: 0 0 6px 6px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.9);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #ccc;
    }

    /* Header & L / R Tabs */
    #menu-header {
      display: flex;
      align-items: center;
      background: #1c1c22;
      border-bottom: 1px solid #30303a;
      padding: 4px 8px;
      gap: 6px;
      flex-shrink: 0;
    }
    .menu-shoulder-btn {
      flex-shrink: 0;
      background: #25252e;
      border: 1px solid #454555;
      color: #8899aa;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      padding: 3px 7px;
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, color 0.12s;
    }
    .menu-shoulder-btn:hover {
      background: #353542;
      color: #fff;
    }
    #menu-tabs {
      display: flex;
      gap: 3px;
      flex: 1 1 auto;
      min-width: 0;
      justify-content: flex-start;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
      scrollbar-color: #3e3e50 transparent;
      align-items: center;
    }
    #menu-tabs::-webkit-scrollbar {
      height: 4px;
    }
    #menu-tabs::-webkit-scrollbar-track {
      background: transparent;
    }
    #menu-tabs::-webkit-scrollbar-thumb {
      background: #3e3e50;
      border-radius: 2px;
    }
    #menu-tabs::-webkit-scrollbar-thumb:hover {
      background: #55556a;
    }
    .menu-tab-btn {
      flex-shrink: 0;
      background: transparent;
      border: none;
      color: #778899;
      font-family: inherit;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      padding: 4px 7px;
      cursor: pointer;
      border-radius: 3px;
      transition: all 0.12s;
      white-space: nowrap;
    }
    .menu-tab-btn:hover {
      color: #ddd;
      background: rgba(255, 255, 255, 0.05);
    }
    .menu-tab-btn.active {
      color: #4ec9b0;
      background: rgba(78, 201, 176, 0.12);
      border-bottom: 2px solid #4ec9b0;
    }
    #menu-close-btn {
      flex-shrink: 0;
      background: transparent;
      border: none;
      color: #667;
      font-size: 14px;
      font-weight: bold;
      padding: 2px 7px;
      cursor: pointer;
      border-radius: 3px;
      line-height: 1;
    }
    #menu-close-btn:hover {
      color: #f66;
      background: rgba(255, 100, 100, 0.15);
    }

    /* Tab Content Views */
    #menu-body {
      flex: 1;
      min-height: 0;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      background: #101014;
    }
    .menu-tab-panel {
      display: none;
      flex-direction: column;
      width: 100%;
    }
    .menu-tab-panel.active {
      display: flex;
    }

    /* Rows */
    .menu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 14px;
      border-bottom: 1px solid #1a1a20;
      cursor: pointer;
      font-size: 11px;
      transition: background 0.08s, border-color 0.08s;
      flex-shrink: 0;
    }
    .menu-row:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .menu-row.selected {
      background: rgba(78, 201, 176, 0.14);
      color: #fff;
      border-left: 3px solid #4ec9b0;
      padding-left: 11px;
    }
    .menu-row-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .menu-row-cursor {
      color: #4ec9b0;
      font-weight: bold;
      opacity: 0;
      width: 10px;
    }
    .menu-row.selected .menu-row-cursor {
      opacity: 1;
    }
    .menu-row-value {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Stepper & Toggle Pills */
    .menu-stepper-btn {
      background: #202028;
      border: 1px solid #3c3c48;
      color: #8899aa;
      border-radius: 3px;
      width: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 10px;
      line-height: 1;
      padding: 0;
    }
    .menu-stepper-btn:hover {
      background: #353545;
      color: #fff;
    }
    .menu-pill {
      display: inline-block;
      min-width: 44px;
      text-align: center;
      background: #181820;
      border: 1px solid #333340;
      border-radius: 3px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      color: #778899;
    }
    .menu-pill.active {
      color: #4ec9b0;
      border-color: rgba(78, 201, 176, 0.4);
      background: rgba(78, 201, 176, 0.08);
    }
    .menu-state-pill {
      min-width: 20px;
      padding: 1px 4px;
      font-size: 9px;
      cursor: pointer;
    }
    .menu-state-pill:hover {
      background: #2a2a36;
      color: #fff;
    }
    .menu-state-pill.active {
      background: rgba(78, 201, 176, 0.25);
      border-color: #4ec9b0;
      color: #4ec9b0;
      font-weight: bold;
    }
    .menu-action-pill {
      background: #252535;
      border: 1px solid #444458;
      color: #ccd;
      border-radius: 3px;
      padding: 3px 9px;
      font-size: 10px;
      font-weight: 600;
    }
    .menu-action-pill:hover {
      background: #383850;
      color: #fff;
    }

    /* Tab 0: VIEW Panel */
    .menu-lens-panel {
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .menu-lens-header {
      background: #161620;
      border: 1px solid #282836;
      border-radius: 4px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .menu-lens-room {
      color: #4ec9b0;
      font-weight: bold;
      font-size: 12px;
      letter-spacing: 0.04em;
    }
    .menu-lens-coords {
      color: #8899aa;
      font-size: 10px;
    }
    .menu-lens-hint-box {
      margin-top: 6px;
      padding: 8px 12px;
      background: rgba(78, 201, 176, 0.06);
      border-left: 3px solid #4ec9b0;
      font-size: 10px;
      color: #aab;
      line-height: 1.5;
    }
    .menu-lens-hint-title {
      color: #4ec9b0;
      font-weight: bold;
      margin-bottom: 2px;
    }

    /* Section headers & lists for Objects and Loot */
    .menu-section-header {
      padding: 6px 14px;
      font-size: 10px;
      font-weight: bold;
      color: #8899aa;
      background: #16161e;
      border-bottom: 1px solid #252530;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }
    .menu-scroll-list {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .menu-empty-hint {
      padding: 20px;
      color: #778899;
      text-align: center;
      font-style: italic;
      font-size: 11px;
    }
    /* Preview Thumbnail Box (Fixed size, stretched inside) */
    .menu-preview-box {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      background: #0d0d12;
      border: 1px solid #282836;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .menu-preview-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
    }
    .menu-preview-empty {
      font-size: 8px;
      color: #556;
      text-align: center;
    }

    /* Keybind Remapper List */
    .menu-device-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 14px;
      background: #181822;
      border-bottom: 1px solid #282836;
      font-size: 10px;
      color: #99aabb;
      flex-shrink: 0;
    }
    .menu-device-status {
      color: #4ec9b0;
      font-weight: bold;
    }
    .menu-keybind-list {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .menu-bind-badge {
      background: #1a1a24;
      border: 1px solid #353545;
      color: #ccd;
      border-radius: 3px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: bold;
      min-width: 52px;
      text-align: center;
      display: inline-block;
    }
    .menu-bind-badge.listening {
      background: #c72e2e;
      border-color: #f55;
      color: #fff;
      animation: menuPulse 0.8s infinite alternate;
    }
    @keyframes menuPulse {
      from { opacity: 0.7; }
      to { opacity: 1; }
    }
    .menu-preset-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 14px;
      border-top: 1px solid #20202a;
      background: #121218;
      flex-shrink: 0;
    }
    .menu-preset-btn {
      background: #202028;
      border: 1px solid #3c3c4a;
      color: #99a;
      border-radius: 3px;
      padding: 3px 8px;
      font-size: 10px;
      cursor: pointer;
    }
    .menu-preset-btn:hover {
      background: #2c2c36;
      color: #fff;
    }

    /* Footer Navigation Legend */
    #menu-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #16161c;
      border-top: 1px solid #282832;
      padding: 5px 12px;
      font-size: 9px;
      color: #778;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }
    .menu-footer-hint {
      display: flex;
      gap: 12px;
    }
  `;
}

// Pause-menu tabs of the panels (webview/emulator-panels.js EMU_PANEL_MENU_TAB).
const MENU_PANELS = [
  [8, 'cdl', ''],
  [9, 'trace', 'full evermore'],
  [10, 'stack', 'full evermore'],
  [11, 'entities', 'full evermore'],
  [12, 'alchemy', 'full evermore'],
  [13, 'palettes', 'full evermore'],
];

// CDL's own rows (cdl-view.js cdlMenuStep / cdlMenuActivate); below them one row per bank.
const MENU_CDL_ROWS = `
            <div class="menu-row" data-row="1" data-action="cdl-record" title="Record code/data coverage, calls and memory accesses">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Recording</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-cdl-rec" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="2" data-action="cdl-export" title="Left / Right: what to export, B: export it">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Export</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-cdl-export" class="menu-pill">-</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
                <span class="menu-action-pill">[B] Export</span>
              </div>
            </div>`;

// TRACE's own row (emulator-panels.js emuPanelMenuAction); Down past it scrolls the trace.
const MENU_TRACE_ROWS = `
            <div class="menu-row" data-row="1" data-action="trace-clear" title="Empty the trace">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Clear</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[B] Clear</span>
              </div>
            </div>`;

// ENTITIES / ALCHEMY / PALETTES: what to list (games/evermore/emulator/bottom-bar-views.js panelFilterStep / panelFilterLabel).
const MENU_FILTER_PANELS = ['entities', 'alchemy', 'palettes'];
function menuFilterRow(name) {
  return `
            <div class="menu-row" data-row="1" data-action="panel-filter" title="What to list (also in the bottom bar)">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Show</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-filter-${name}" class="menu-pill active">All</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>`;
}

/** `parts`: the game's tabs 1-4 ({ tabButtonsHtml, panelsHtml }, Evermore: games/evermore/emulator/menu-tabs.js). */
function getMenuHtml(parts = {}) {
  return `
    <div id="emulator-menu" class="hidden">
      <div id="menu-card">
        <div id="menu-header">
          <button id="menu-l-btn" class="menu-shoulder-btn" type="button" title="Previous Tab (L)">&lt; L</button>
          <div id="menu-tabs">
            <button id="menu-tab-btn-0" class="menu-tab-btn active" type="button" data-tab="0">VIEW</button>
${parts.tabButtonsHtml || ''}
            <button id="menu-tab-btn-7" class="menu-tab-btn" type="button" data-tab="7">REPLAYS</button>
            <button id="menu-tab-btn-8" class="menu-tab-btn" type="button" data-tab="8">CDL</button>
            <button id="menu-tab-btn-9" class="menu-tab-btn" data-needs="full evermore" type="button" data-tab="9">TRACE</button>
            <button id="menu-tab-btn-10" class="menu-tab-btn" data-needs="full evermore" type="button" data-tab="10">STACK</button>
            <button id="menu-tab-btn-11" class="menu-tab-btn" data-needs="full evermore" type="button" data-tab="11">ENTITIES</button>
            <button id="menu-tab-btn-12" class="menu-tab-btn" data-needs="full evermore" type="button" data-tab="12">ALCHEMY</button>
            <button id="menu-tab-btn-13" class="menu-tab-btn" data-needs="full evermore" type="button" data-tab="13">PALETTES</button>
            <button id="menu-tab-btn-5" class="menu-tab-btn" type="button" data-tab="5">EMULATION</button>
            <button id="menu-tab-btn-6" class="menu-tab-btn" type="button" data-tab="6">CONTROLS</button>
          </div>
          <button id="menu-r-btn" class="menu-shoulder-btn" type="button" title="Next Tab (R)">R &gt;</button>
          <button id="menu-close-btn" type="button" title="Resume Game (A / Esc)">[X]</button>
        </div>

        <div id="menu-body">
          <!-- Tab 0: VIEW -->
          <div id="menu-panel-0" class="menu-tab-panel active">
            <div class="menu-lens-panel">
              <div class="menu-lens-header" data-needs="evermore">
                <div class="menu-lens-room" id="menu-lens-room-title">View (Undistorted Room View)</div>
                <div class="menu-lens-coords" id="menu-lens-coords">Cam: (0, 0) | Player: (0, 0)</div>
              </div>
              <div class="menu-row selected" data-row="0" data-action="step-zoom-lens">
                <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Zoom / Scale</div>
                <div class="menu-row-value">
                  <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                  <span id="menu-val-lens-zoom" class="menu-pill">Fit</span>
                  <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
                </div>
              </div>
              <div class="menu-row" data-row="1" data-action="action-reset-pan" data-needs="evermore">
                <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Center on Player / Reset Pan</div>
                <div class="menu-row-value">
                  <span class="menu-action-pill">[B] Center</span>
                </div>
              </div>
              <div class="menu-lens-hint-box">
                <div class="menu-lens-hint-title">Navigation:</div>
                <div>&bull; Drag map canvas or use D-Pad / Arrows to pan</div>
                <div>&bull; Mouse wheel to zoom in / out</div>
                <div>&bull; [L] / [R] to switch menus &middot; Esc / Start to resume</div>
              </div>
            </div>
          </div>

${parts.panelsHtml || ''}
                    <!-- Tab 7: REPLAYS (the REPLAYS view is moved in, emulator-panels.js; its rows: webview/replays-list.js) -->
          <div id="menu-panel-7" class="menu-tab-panel menu-panel-host">
            <div id="emu-slot-tas" class="emu-panel-slot"></div>
          </div>

          <!-- Tabs 8-13: the panels, each with where it is shown while playing -->
          ${MENU_PANELS.map(([tab, name, needs]) => `
          <div id="menu-panel-${tab}" class="menu-tab-panel menu-panel-host"${needs ? ` data-needs="${needs}"` : ''}>
            <div class="menu-row" data-row="0" data-action="step-place" title="Where this panel is shown while the game runs">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Show while playing</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-place-${name}" class="menu-pill">Hidden</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            ${name === 'cdl' ? MENU_CDL_ROWS : name === 'trace' ? MENU_TRACE_ROWS : MENU_FILTER_PANELS.includes(name) ? menuFilterRow(name) : ''}
            <div id="emu-slot-${name}" class="emu-panel-slot"></div>
          </div>`).join('')}

          <!-- Tab 5: EMULATION -->
          <div id="menu-panel-5" class="menu-tab-panel">
            <div class="menu-row" data-row="0" data-action="step-speed">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Emulation Speed</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-speed" class="menu-pill">1x</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="1" data-action="toggle-audio-mute">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Master Audio</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-sound" class="menu-pill active">Normal</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="2" data-action="toggle-keep-focus" title="Tab and debugger stops leave the focus on the emulator">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Keep Focus</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-focus" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="3" data-action="action-reset-rom">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Reset / Power-Cycle ROM</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[B] Reset</span>
              </div>
            </div>
            <div class="menu-row" data-row="4" data-action="action-soft-reset">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Soft Reset (keeps RAM and save)</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[B] Reset</span>
              </div>
            </div>
          </div>

          <!-- Tab 6: CONTROLS -->
          <div id="menu-panel-6" class="menu-tab-panel">
            <div class="menu-device-banner">
              <span id="menu-device-name">Input: Keyboard &amp; Gamepad</span>
              <span id="menu-device-status" class="menu-device-status">Active</span>
            </div>
            <div id="menu-bind-list" class="menu-keybind-list"></div>
            <div class="menu-preset-row">
              <button id="menu-preset-arrows" class="menu-preset-btn" type="button">Default Arrows</button>
              <button id="menu-preset-wasd" class="menu-preset-btn" type="button">WASD</button>
              <button id="menu-preset-reset" class="menu-preset-btn" type="button">Reset</button>
            </div>
          </div>
        </div>

        <div id="menu-footer">
          <div class="menu-footer-hint">
            <span>[L]/[R]: Tabs</span>
            <span>Up/Down: Select</span>
            <span>Left/Right: Change</span>
            <span>[B]: Action</span>
          </div>
          <div>[A] / Esc: Back</div>
        </div>
      </div>
    </div>
  `;
}

function getMenuClientScript() {
  return `
    ${getMenuSoundScript()}

    // -- Emulator Quick Menu Controller ----------------------------------------
    const DEFAULT_KEY_MAP = {
      'Up': 'ArrowUp',
      'Down': 'ArrowDown',
      'Left': 'ArrowLeft',
      'Right': 'ArrowRight',
      'B': 'c',
      'A': 'v',
      'Y': 'x',
      'X': 'd',
      'L': 'a',
      'R': 's',
      'Select': ' ',
      'Start': 'Enter',
    };

    const SNES_BUTTON_NAMES = [
      'Up', 'Down', 'Left', 'Right',
      'B', 'A', 'Y', 'X',
      'L', 'R', 'Select', 'Start'
    ];

    const SNES_BIT_MASKS = {
      'R': 1 << 4,
      'L': 1 << 5,
      'X': 1 << 6,
      'A': 1 << 7,
      'Right': 1 << 8,
      'Left': 1 << 9,
      'Down': 1 << 10,
      'Up': 1 << 11,
      'Start': 1 << 12,
      'Select': 1 << 13,
      'Y': 1 << 14,
      'B': 1 << 15,
    };

    // Non-looping stepped values
    const MENU_SPEED_LABELS = ['1/4x', '1/2x', '1x', '2x', '4x'];
    const MENU_SPEED_VALUES = [0.25, 0.5, 1.0, 2.0, 4.0];
    let menuSpeedIndex = 2; // Default 1x

    const MENU_ZOOM_LABELS = ['50%', '100%', '150%', '200%', 'Fit'];
    const MENU_ZOOM_VALUES = [0.5, 1.0, 1.5, 2.0, -1]; // -1 is Fit
    let menuZoomIndex = 4; // Default Fit

    // The saved keybinds arrive with the host's settings (emulator-profile.js emuApplySettings).
    let userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);

    let dynamicKeyToBit = {};
    function rebuildKeyBitMap() {
      dynamicKeyToBit = {};
      for (const btn of Object.keys(userKeyMap)) {
        const key = userKeyMap[btn];
        const bit = SNES_BIT_MASKS[btn];
        if (key && bit) {
          dynamicKeyToBit[key] = bit;
          dynamicKeyToBit[key.toLowerCase()] = bit;
          dynamicKeyToBit[key.toUpperCase()] = bit;
        }
      }
    }
    rebuildKeyBitMap();

    // Menu State: 0: VIEW, 1: OVERLAYS, 2: OBJECTS, 3: LOOT, 4: CHEATS, 5: EMULATION, 6: CONTROLS,
    // 7: REPLAYS, 8..13: the panels CDL, TRACE, STACK, ENTITIES, ALCHEMY, PALETTES (emulator-panels.js).
    // L / R walk MENU_TAB_ORDER, the order of the tab buttons.
    const MENU_TAB_COUNT = 14;
    const MENU_TAB_ORDER = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 5, 6];
    let isMenuOpen = false;
    let menuActiveTab = 0; // Default VIEW
    let menuSelectedRow = 0;
    const tabSelectedRows = new Array(MENU_TAB_COUNT).fill(0);
    const tabScrollTops = new Array(MENU_TAB_COUNT).fill(0);
    let lastMenuMapId = -1;
    let menuListeningBtn = null;
    let menuListeningTimeout = null;

    // Start opens the menu only where the game says the player is in control (gameStartAllowed); other
    // games and ROMs keep Start for themselves.
    function isPlayerControllable(m) {
      if (!m || !romLoaded) return false;
      return typeof gameStartAllowed === 'function' && !!gameStartAllowed(m);
    }

    function checkMapChange() {
      const curMap = typeof getCurrentMapId === 'function' ? getCurrentMapId() : -1;
      if (curMap !== lastMenuMapId) {
        lastMenuMapId = curMap;
        if (typeof gameMenuMapChanged === 'function') gameMenuMapChanged();
        for (let i = 0; i < MENU_TAB_COUNT; i++) {
          tabSelectedRows[i] = 0;
          tabScrollTops[i] = 0;
        }
      }
    }

    function openEmulatorMenu() {
      if (isMenuOpen) return;
      isMenuOpen = true;
      keyInput = 0;
      if (typeof gameMenuOpened === 'function') gameMenuOpened();
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) menuEl.classList.remove('hidden');

      const m = getModule();
      if (m && hasDebuggerApi(m)) {
        m.pauseEmulation();
        setText('ss-pause-state', 'paused', 'ss-bad');
        setText('ss-last-hit', 'last: paused for Menu', 'ss-warn');
      }

      playMenuSound('wheel_open');
      syncMenuValuesFromRuntime();

      checkMapChange();

      if (typeof gameMenuLoad === 'function') gameMenuLoad();
      menuSelectedRow = tabSelectedRows[menuActiveTab] || 0;
      renderMenuTab(menuActiveTab);
    }

    function closeEmulatorMenu() {
      if (!isMenuOpen) return;
      if (menuListeningBtn) cancelKeybindListen();
      const menuBody = document.getElementById('menu-body');
      if (menuBody) tabScrollTops[menuActiveTab] = menuBody.scrollTop;
      tabSelectedRows[menuActiveTab] = menuSelectedRow;
      if (typeof gameMenuClosed === 'function') gameMenuClosed();
      isMenuOpen = false;
      isLensModeActive = false;
      if (typeof emuPanelsLayout === 'function') emuPanelsLayout();
      keyInput = 0;
      if (typeof closeInspector === 'function') closeInspector();
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) {
        menuEl.classList.add('hidden');
        menuEl.classList.remove('lens-tab-active');
      }

      const m = getModule();
      if (m && typeof m.resumeEmulation === 'function') {
        m.resumeEmulation();
        setText('ss-pause-state', 'running', 'ss-ok');
        setText('ss-last-hit', 'last: resumed from Menu', 'ss-ok');
      }
      if (typeof ensureAudioRunning === 'function') {
        ensureAudioRunning();
      }

      playMenuSound('wheel_close');
      const screenCanvas = document.getElementById('screen');
      if (screenCanvas) screenCanvas.focus();
    }

    // Unified Pause Toggle:
    // Pausing opens the menu, resuming closes it.
    function togglePauseMenu(source) {
      if (isMenuOpen) {
        closeEmulatorMenu();
      } else {
        openEmulatorMenu();
      }
    }

    function selectMenuTab(targetTab) {
      if (menuListeningBtn) cancelKeybindListen();
      const target = Math.max(0, Math.min(targetTab, MENU_TAB_COUNT - 1));
      if (target !== menuActiveTab) {
        tabSelectedRows[menuActiveTab] = menuSelectedRow;
        const menuBody = document.getElementById('menu-body');
        if (menuBody) tabScrollTops[menuActiveTab] = menuBody.scrollTop;

        menuActiveTab = target;
        menuSelectedRow = tabSelectedRows[menuActiveTab] || 0;
        playMenuSound('wheel_turn');
        renderMenuTab(menuActiveTab);
      }
    }

    // Tabs a ROM does not get (data-needs, emulator-profile.js) are skipped; no wrap-around.
    function switchMenuTab(delta) {
      const at = MENU_TAB_ORDER.indexOf(menuActiveTab);
      for (let i = at + delta; i >= 0 && i < MENU_TAB_ORDER.length; i += delta) {
        const t = MENU_TAB_ORDER[i];
        if (typeof emuMenuTabShown !== 'function' || emuMenuTabShown(t)) { selectMenuTab(t); return; }
      }
    }

    function renderMenuTab(tabIndex) {
      menuActiveTab = tabIndex;
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) {
        menuEl.classList.toggle('lens-tab-active', tabIndex === 0);
      }
      for (let i = 0; i < MENU_TAB_COUNT; i++) {
        const tabBtn = document.getElementById('menu-tab-btn-' + i);
        const panel = document.getElementById('menu-panel-' + i);
        if (tabBtn) tabBtn.classList.toggle('active', i === tabIndex);
        if (panel) panel.classList.toggle('active', i === tabIndex);
      }
      // After the tab is shown, so a panel moved into it can scroll (emulator-panels.js).
      if (typeof emuPanelsLayout === 'function') emuPanelsLayout();

      const activeTabBtn = document.getElementById('menu-tab-btn-' + tabIndex);
      if (activeTabBtn && typeof activeTabBtn.scrollIntoView === 'function') {
        try { activeTabBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch (_) {}
      }

      if (tabIndex === 0) {
        updateLensTabInfo();
      } else if (tabIndex >= 1 && tabIndex <= 4) {
        if (typeof gameMenuRender === 'function') gameMenuRender(tabIndex);
      } else if (tabIndex === 5) {
        syncMenuValuesFromRuntime();
      } else if (tabIndex === 6) {
        renderKeybindRows();
      } else if (tabIndex === 7) {
        if (romLoaded && typeof tasRequestList === 'function') tasRequestList();
      } else if (tabIndex === 8) {
        if (typeof cdlMenuSync === 'function') cdlMenuSync();
      }

      const menuBody = document.getElementById('menu-body');
      if (menuBody && typeof tabScrollTops[tabIndex] === 'number') {
        menuBody.scrollTop = tabScrollTops[tabIndex];
      }
      updateMenuRowSelection(false);
      try {
        requestAnimationFrame(function() {
          if (menuBody && typeof tabScrollTops[tabIndex] === 'number') {
            menuBody.scrollTop = tabScrollTops[tabIndex];
          }
          updateMenuRowSelection(false);
        });
      } catch (_) {}
    }

    function updateLensTabInfo() {
      const roomTitleEl = document.getElementById('menu-lens-room-title');
      const coordsEl = document.getElementById('menu-lens-coords');
      const zoomPill = document.getElementById('menu-val-lens-zoom');

      if (roomTitleEl) {
        const mapName = (typeof activeRoomMap !== 'undefined' && activeRoomMap && activeRoomMap.name) ? activeRoomMap.name : '';
        const hex = (typeof cachedMapId === 'number' && cachedMapId >= 0) ? ('0x' + cachedMapId.toString(16).toUpperCase().padStart(2, '0')) : '0x00';
        roomTitleEl.textContent = 'Room ' + hex + (mapName ? ' (' + mapName + ')' : ' Exploration Lens');
      }

      if (coordsEl) {
        let playerX = 0, playerY = 0;
        const m = getModule();
        if (m && typeof m.readMemory === 'function') {
          playerX = m.readMemory(0x7E4E89 + 0x1A) | (m.readMemory(0x7E4E89 + 0x1B) << 8);
          playerY = m.readMemory(0x7E4E89 + 0x1C) | (m.readMemory(0x7E4E89 + 0x1D) << 8);
        }
        const px = (typeof panX !== 'undefined') ? panX : 0;
        const py = (typeof panY !== 'undefined') ? panY : 0;
        coordsEl.textContent = 'Cam: (' + Math.round(px) + ', ' + Math.round(py) + ') | Player: (' + playerX + ', ' + playerY + ')';
      }

      if (zoomPill) {
        zoomPill.textContent = MENU_ZOOM_LABELS[menuZoomIndex];
      }
    }

    // Up / Down scrolls the active selection into view automatically!
    function updateMenuRowSelection(smooth) {
      const isSmooth = (smooth !== false);
      const activePanel = document.getElementById('menu-panel-' + menuActiveTab);
      if (!activePanel) return;
      const rows = menuSelectableRows(activePanel);
      if (menuSelectedRow < 0) menuSelectedRow = 0;
      if (menuSelectedRow >= rows.length) menuSelectedRow = Math.max(0, rows.length - 1);
      tabSelectedRows[menuActiveTab] = menuSelectedRow;

      rows.forEach(function(row, idx) {
        const isSel = (idx === menuSelectedRow);
        row.classList.toggle('selected', isSel);
        if (isSel) {
          const menuBody = document.getElementById('menu-body');
          if (menuBody) {
            const rowRect = row.getBoundingClientRect();
            const bodyRect = menuBody.getBoundingClientRect();
            if (rowRect.top < bodyRect.top) {
              menuBody.scrollTop -= (bodyRect.top - rowRect.top);
            } else if (rowRect.bottom > bodyRect.bottom) {
              menuBody.scrollTop += (rowRect.bottom - bodyRect.bottom);
            }
          }
          try {
            row.scrollIntoView({ block: 'nearest', behavior: isSmooth ? 'smooth' : 'auto' });
          } catch (_) {
            try { row.scrollIntoView(false); } catch (__) {}
          }
        }
      });
    }

    // The rows Up / Down walk: every .menu-row (by index, hidden ones too, as the tabs' actions
    // count them) and every shown .menu-pick (panel rows: CDL banks, entities, slots, palettes).
    function menuSelectableRows(panel) {
      return Array.from(panel.querySelectorAll('.menu-row, .menu-pick'))
        .filter(el => !el.classList.contains('menu-pick') || el.getClientRects().length > 0);
    }

    function moveMenuSelection(delta) {
      // Panels 9+: Up / Down walk the rows, Down past the last row scrolls the panel.
      if (menuActiveTab >= 9 && typeof emuPanelMenuMove === 'function' && emuPanelMenuMove(menuActiveTab, delta)) return;
      const activePanel = document.getElementById('menu-panel-' + menuActiveTab);
      if (!activePanel) return;
      const rows = menuSelectableRows(activePanel);
      if (!rows.length) return;

      const nextRow = Math.max(0, Math.min(menuSelectedRow + delta, rows.length - 1));
      if (nextRow !== menuSelectedRow) {
        menuSelectedRow = nextRow;
        tabSelectedRows[menuActiveTab] = nextRow;
        playMenuSound('click_nav');
        // REPLAYS: moving away drops a pending play / delete question.
        if (menuActiveTab === 7 && typeof replaysCancel === 'function' && replaysCancel()) tasRenderList();
        updateMenuRowSelection();
      }
    }

    // Steppers / Toggles: Non-looping, clamped left and right
    function changeMenuValue(delta) {
      if (menuActiveTab === 8 && menuSelectedRow > 0) {
        if (typeof cdlMenuStep === 'function') cdlMenuStep(menuSelectedRow, delta);
        return;
      }
      if (menuActiveTab >= 8) {
        if (typeof emuPanelScrolling === 'function' && emuPanelScrolling(menuActiveTab)) return;
        if (menuSelectedRow === 0) { if (typeof emuPanelMenuStep === 'function') emuPanelMenuStep(menuActiveTab, delta); }
        else if (typeof emuPanelMenuValue === 'function') emuPanelMenuValue(menuActiveTab, menuSelectedRow, delta);
        return;
      }
      if (menuActiveTab === 7) {
        if (typeof tasMenuStep === 'function') tasMenuStep(menuSelectedRow, delta);
        return;
      }
      if (menuActiveTab === 0) {
        // Tab 0: VIEW
        if (menuSelectedRow === 0) {
          // Zoom stepper
          menuZoomIndex = Math.max(0, Math.min(menuZoomIndex + delta, MENU_ZOOM_LABELS.length - 1));
          applyMenuZoom(menuZoomIndex);
          updateLensTabInfo();
          playMenuSound('click_toggle');
        }
      } else if (menuActiveTab >= 1 && menuActiveTab <= 4) {
        if (typeof gameMenuStep === 'function') gameMenuStep(menuActiveTab, menuSelectedRow, delta);
      } else if (menuActiveTab === 5) {
        // Tab 5: EMULATION
        switch (menuSelectedRow) {
          case 0:
            menuSpeedIndex = Math.max(0, Math.min(menuSpeedIndex + delta, MENU_SPEED_LABELS.length - 1));
            if (typeof setSpeedMultiplier === 'function') {
              setSpeedMultiplier(MENU_SPEED_VALUES[menuSpeedIndex]);
            }
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 1:
            if (typeof emuSetMuted === 'function') emuSetMuted(delta < 0);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 2:
            setKeepFocusChip(delta > 0, true);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
        }
      }
    }

    function activateMenuRow() {
      if (menuActiveTab === 8 && menuSelectedRow > 0) {
        if (typeof cdlMenuActivate === 'function') cdlMenuActivate(menuSelectedRow);
        return;
      }
      if (menuActiveTab >= 8) {
        if (typeof emuPanelScrolling === 'function' && emuPanelScrolling(menuActiveTab)) return;
        if (menuSelectedRow === 0) { if (typeof emuPanelMenuStep === 'function') emuPanelMenuStep(menuActiveTab, 1); }
        else if (typeof emuPanelMenuAction === 'function') emuPanelMenuAction(menuActiveTab, menuSelectedRow);
        return;
      }
      if (menuActiveTab === 7) {
        if (typeof tasMenuActivate === 'function') tasMenuActivate(menuSelectedRow);
        return;
      }
      if (menuActiveTab === 0) {
        if (menuSelectedRow === 1) {
          // Reset pan & center on player
          panX = 0;
          panY = 0;
          if (typeof updateScreenLayout === 'function') updateScreenLayout();
          updateLensTabInfo();
          playMenuSound('click_confirm');
        } else {
          changeMenuValue(1);
        }
      } else if (menuActiveTab >= 1 && menuActiveTab <= 4) {
        if (typeof gameMenuActivate === 'function') gameMenuActivate(menuActiveTab, menuSelectedRow);
      } else if (menuActiveTab === 5) {
        // Tab 5: EMULATION
        switch (menuSelectedRow) {
          case 1:
            if (typeof emuSetMuted === 'function') emuSetMuted(!emuMuted);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 2:
            setKeepFocusChip(!keepFocusOnBreak, true);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 3:
            playMenuSound('click_confirm');
            if (loadedRomData) {
              bootRom(loadedRomData, loadedRomName);
              closeEmulatorMenu();
            }
            break;
          case 4:
            if (typeof tasSoftReset === 'function' && tasSoftReset()) {
              playMenuSound('click_confirm');
              closeEmulatorMenu();
            }
            break;
          default:
            changeMenuValue(1);
            break;
        }
      } else if (menuActiveTab === 6) {
        // Tab 6: CONTROLS
        if (menuSelectedRow >= 0 && menuSelectedRow < SNES_BUTTON_NAMES.length) {
          startKeybindListen(SNES_BUTTON_NAMES[menuSelectedRow]);
        }
      }
    }

    function refreshMenuDataIfOpen() {
      if (!isMenuOpen) return;
      if (menuActiveTab === 0) updateLensTabInfo();
      else if (menuActiveTab >= 1 && menuActiveTab <= 4 && typeof gameMenuRender === 'function') gameMenuRender(menuActiveTab);
    }

    // -- Remapper UI & Storage -------------------------------------------------
    function renderKeybindRows() {
      const container = document.getElementById('menu-bind-list');
      if (!container) return;
      container.innerHTML = '';

      SNES_BUTTON_NAMES.forEach(function(btnName, idx) {
        const row = document.createElement('div');
        row.className = 'menu-row' + (idx === menuSelectedRow ? ' selected' : '');
        row.setAttribute('data-row', String(idx));

        const label = document.createElement('div');
        label.className = 'menu-row-label';
        label.innerHTML = '<span class="menu-row-cursor">&gt;</span> ' + btnName;

        const val = document.createElement('div');
        val.className = 'menu-row-value';

        const badge = document.createElement('span');
        badge.className = 'menu-bind-badge' + (menuListeningBtn === btnName ? ' listening' : '');
        badge.id = 'menu-badge-' + btnName;
        badge.textContent = menuListeningBtn === btnName ? '[PRESS KEY]' : formatKeyDisplay(userKeyMap[btnName]);

        val.appendChild(badge);
        row.appendChild(label);
        row.appendChild(val);

        row.addEventListener('click', function(e) {
          e.stopPropagation();
          menuSelectedRow = idx;
          updateMenuRowSelection();
          startKeybindListen(btnName);
        });

        container.appendChild(row);
      });
    }

    function formatKeyDisplay(k) {
      if (!k) return 'None';
      if (k === ' ') return 'Space';
      if (k.startsWith('Arrow')) return k.replace('Arrow', '');
      return k.toUpperCase();
    }

    function startKeybindListen(btnName) {
      menuListeningBtn = btnName;
      playMenuSound('click_nav');
      renderKeybindRows();
      if (menuListeningTimeout) clearTimeout(menuListeningTimeout);
      menuListeningTimeout = setTimeout(cancelKeybindListen, 5000);
    }

    function cancelKeybindListen() {
      menuListeningBtn = null;
      if (menuListeningTimeout) clearTimeout(menuListeningTimeout);
      renderKeybindRows();
    }

    function applyKeybind(keyStr) {
      if (!menuListeningBtn) return;
      userKeyMap[menuListeningBtn] = keyStr;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      rebuildKeyBitMap();
      playMenuSound('click_confirm');
      menuListeningBtn = null;
      if (menuListeningTimeout) clearTimeout(menuListeningTimeout);
      renderKeybindRows();
    }

    // -- Keyboard Event Interception -------------------------------------------
    window.addEventListener('keydown', function(e) {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // 1. Esc ALWAYS pauses/resumes the emulator & toggles menu
      if (e.key === 'Escape') {
        if (menuListeningBtn) {
          cancelKeybindListen();
          e.preventDefault();
          return;
        }
        togglePauseMenu('Escape');
        e.preventDefault();
        return;
      }

      // 2. Menu is OPEN: Input belongs to menu
      if (isMenuOpen) {
        if (menuListeningBtn) {
          applyKeybind(e.key);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // L / R Shoulder navigation ([L] / [R])
        const isL = e.key === 'q' || e.key === 'Q' || e.key === 'PageUp' || e.key === 'l' || e.key === 'L' || e.key === '[' || (userKeyMap && (e.key === userKeyMap['L'] || e.code === userKeyMap['L']));
        const isR = e.key === 'e' || e.key === 'E' || e.key === 'PageDown' || e.key === 'r' || e.key === 'R' || e.key === ']' || (userKeyMap && (e.key === userKeyMap['R'] || e.code === userKeyMap['R']));
        if (isL) {
          switchMenuTab(-1);
          e.preventDefault();
          return;
        }
        if (isR) {
          switchMenuTab(1);
          e.preventDefault();
          return;
        }

        // Tab switches forward, Shift+Tab switches backward
        if (e.key === 'Tab') {
          switchMenuTab(e.shiftKey ? -1 : 1);
          e.preventDefault();
          return;
        }

        // On Lens Tab (Tab 0): Arrow keys pan the map!
        if (menuActiveTab === 0) {
          let dx = 0, dy = 0;
          if (e.key === 'ArrowUp') dy = 32;
          else if (e.key === 'ArrowDown') dy = -32;
          else if (e.key === 'ArrowLeft') dx = 32;
          else if (e.key === 'ArrowRight') dx = -32;
          if (dx !== 0 || dy !== 0) {
            panX += dx;
            panY += dy;
            if (typeof updateScreenLayout === 'function') updateScreenLayout();
            if (typeof updateLensTabInfo === 'function') updateLensTabInfo();
            e.preventDefault();
            return;
          }
        } else {
          const isUp = e.key === 'ArrowUp' || (userKeyMap && (e.key === userKeyMap['Up'] || (userKeyMap['Up'] && e.key.toLowerCase() === userKeyMap['Up'].toLowerCase())));
          const isDown = e.key === 'ArrowDown' || (userKeyMap && (e.key === userKeyMap['Down'] || (userKeyMap['Down'] && e.key.toLowerCase() === userKeyMap['Down'].toLowerCase())));
          const isLeft = e.key === 'ArrowLeft' || (userKeyMap && (e.key === userKeyMap['Left'] || (userKeyMap['Left'] && e.key.toLowerCase() === userKeyMap['Left'].toLowerCase())));
          const isRight = e.key === 'ArrowRight' || (userKeyMap && (e.key === userKeyMap['Right'] || (userKeyMap['Right'] && e.key.toLowerCase() === userKeyMap['Right'].toLowerCase())));

          if (isUp) {
            moveMenuSelection(-1);
            e.preventDefault();
            return;
          }
          if (isDown) {
            moveMenuSelection(1);
            e.preventDefault();
            return;
          }
          if (isLeft) {
            changeMenuValue(-1);
            e.preventDefault();
            return;
          }
          if (isRight) {
            changeMenuValue(1);
            e.preventDefault();
            return;
          }
        }

        const startKey = userKeyMap['Start'] || 'Enter';
        const aKey = userKeyMap['A'] || 'v';
        const bKey = userKeyMap['B'] || 'c';

        // 1. Start, A or Escape: back (drop a pending question on REPLAYS), else resume, from ANY tab:
        if (e.key === startKey || (startKey === 'Enter' && e.key === 'Enter') ||
            e.key === aKey || (aKey && e.key.toLowerCase() === aKey.toLowerCase()) ||
            e.key === 'Escape') {
          if (!(menuActiveTab === 7 && typeof tasMenuCancel === 'function' && tasMenuCancel())) closeEmulatorMenu();
          e.preventDefault();
          return;
        }

        // 2. Action / Confirm (B button, or Enter if Start is mapped to another key):
        if (e.key === bKey || (bKey && e.key.toLowerCase() === bKey.toLowerCase()) ||
            (startKey !== 'Enter' && e.key === 'Enter')) {
          if (menuActiveTab === 0) {
            closeEmulatorMenu();
          } else {
            activateMenuRow();
          }
          e.preventDefault();
          return;
        }

        e.preventDefault();
        return;
      }

      // 3. Menu is CLOSED: Check Start button for controllable player
      const startKey = userKeyMap['Start'] || 'Enter';
      if (e.key === startKey || (startKey === 'Enter' && e.key === 'Enter')) {
        const m = getModule();
        if (isPlayerControllable(m)) {
          openEmulatorMenu();
          e.preventDefault();
          return;
        }
      }

      // Normal SNES game keys pass through to panel-webview.js input listener.
    }, true);

    // -- Gamepad Polling & Menu Support ----------------------------------------
    let lastGamepadButtons = {};
    let lastGamepadAxisTick = 0;

    function pollGamepadMenu() {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      if (!gamepads) return;
      const gp = gamepads[0] || gamepads[1];
      if (!gp) return;

      const devNameEl = document.getElementById('menu-device-name');
      if (devNameEl && gp.id) {
        devNameEl.textContent = 'Pad: ' + gp.id.slice(0, 24);
      }

      if (isMenuOpen) {
        const now = Date.now();
        // L / R shoulders: buttons 4 and 5
        if (gp.buttons[4] && gp.buttons[4].pressed && !lastGamepadButtons[4]) {
          switchMenuTab(-1);
        }
        if (gp.buttons[5] && gp.buttons[5].pressed && !lastGamepadButtons[5]) {
          switchMenuTab(1);
        }
        // Dpad Up / Down (btn 12, 13) or Left Stick Y
        const dUp = (gp.buttons[12] && gp.buttons[12].pressed) || gp.axes[1] < -0.5;
        const dDown = (gp.buttons[13] && gp.buttons[13].pressed) || gp.axes[1] > 0.5;
        if (dUp && !lastGamepadButtons['up'] && now - lastGamepadAxisTick > 180) {
          moveMenuSelection(-1);
          lastGamepadAxisTick = now;
        }
        if (dDown && !lastGamepadButtons['down'] && now - lastGamepadAxisTick > 180) {
          moveMenuSelection(1);
          lastGamepadAxisTick = now;
        }
        // Dpad Left / Right (btn 14, 15) or Left Stick X
        const dLeft = (gp.buttons[14] && gp.buttons[14].pressed) || gp.axes[0] < -0.5;
        const dRight = (gp.buttons[15] && gp.buttons[15].pressed) || gp.axes[0] > 0.5;
        if (dLeft && !lastGamepadButtons['left'] && now - lastGamepadAxisTick > 180) {
          changeMenuValue(-1);
          lastGamepadAxisTick = now;
        }
        if (dRight && !lastGamepadButtons['right'] && now - lastGamepadAxisTick > 180) {
          changeMenuValue(1);
          lastGamepadAxisTick = now;
        }
        // Button B (btn 0, the bottom face button): action
        if (gp.buttons[0] && gp.buttons[0].pressed && !lastGamepadButtons[0]) {
          if (menuActiveTab === 0) closeEmulatorMenu(); else activateMenuRow();
        }
        // Button A (btn 1): back / resume
        if (gp.buttons[1] && gp.buttons[1].pressed && !lastGamepadButtons[1]) {
          if (!(menuActiveTab === 7 && typeof tasMenuCancel === 'function' && tasMenuCancel())) closeEmulatorMenu();
        }
        // Start button (btn 9)
        if (gp.buttons[9] && gp.buttons[9].pressed && !lastGamepadButtons[9]) {
          closeEmulatorMenu();
        }

        lastGamepadButtons[4] = gp.buttons[4] && gp.buttons[4].pressed;
        lastGamepadButtons[5] = gp.buttons[5] && gp.buttons[5].pressed;
        lastGamepadButtons[0] = gp.buttons[0] && gp.buttons[0].pressed;
        lastGamepadButtons[1] = gp.buttons[1] && gp.buttons[1].pressed;
        lastGamepadButtons[9] = gp.buttons[9] && gp.buttons[9].pressed;
        lastGamepadButtons['up'] = dUp;
        lastGamepadButtons['down'] = dDown;
        lastGamepadButtons['left'] = dLeft;
        lastGamepadButtons['right'] = dRight;
        return;
      }

      // When gameplay is active: Start button opens menu if controllable
      if (gp.buttons[9] && gp.buttons[9].pressed && !lastGamepadButtons[9]) {
        const m = getModule();
        if (isPlayerControllable(m)) {
          openEmulatorMenu();
        }
      }
      lastGamepadButtons[9] = gp.buttons[9] && gp.buttons[9].pressed;
    }
    window.pollGamepadMenu = pollGamepadMenu;

    // Helper utilities for UI
    function setPillState(id, on) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle('active', !!on);
        el.textContent = on ? 'ON' : 'OFF';
      }
    }

    function applyMenuZoom(idx) {
      const val = MENU_ZOOM_VALUES[idx];
      const lbl = MENU_ZOOM_LABELS[idx];
      const pill = document.getElementById('menu-val-zoom');
      const lensPill = document.getElementById('menu-val-lens-zoom');
      if (pill) pill.textContent = lbl;
      if (lensPill) lensPill.textContent = lbl;
      if (val === -1) {
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        if (typeof updateScreenLayout === 'function') updateScreenLayout();
      } else {
        const wrap = document.getElementById('screen-wrapper');
        const cx = wrap ? wrap.clientWidth / 2 : 256;
        const cy = wrap ? wrap.clientHeight / 2 : 224;
        if (typeof zoomAt === 'function') zoomAt(val, cx, cy);
      }
    }

    function syncMenuValuesFromRuntime() {
      if (typeof gameMenuSync === 'function') gameMenuSync();

      const spdEl = document.getElementById('menu-val-speed');
      if (spdEl) spdEl.textContent = MENU_SPEED_LABELS[menuSpeedIndex];

      const zmEl = document.getElementById('menu-val-zoom');
      if (zmEl) zmEl.textContent = MENU_ZOOM_LABELS[menuZoomIndex];

      setPillState('menu-val-focus', keepFocusOnBreak);
      const soundPill = document.getElementById('menu-val-sound');
      if (soundPill) {
        soundPill.textContent = emuMuted ? 'Muted' : 'Normal';
        soundPill.classList.toggle('active', !emuMuted);
      }
    }

    // Bind DOM events once DOM is loaded
    (function initMenuDom() {
      function setup() {
        const lBtn = document.getElementById('menu-l-btn');
        const rBtn = document.getElementById('menu-r-btn');
        const closeBtn = document.getElementById('menu-close-btn');

        if (lBtn) lBtn.addEventListener('click', function() { switchMenuTab(-1); });
        if (rBtn) rBtn.addEventListener('click', function() { switchMenuTab(1); });
        if (closeBtn) closeBtn.addEventListener('click', closeEmulatorMenu);

        for (let i = 0; i < MENU_TAB_COUNT; i++) {
          const tabBtn = document.getElementById('menu-tab-btn-' + i);
          if (tabBtn) {
            tabBtn.addEventListener('click', (function(idx) {
              return function() {
                selectMenuTab(idx);
              };
            })(i));
          }
        }

        const menuBody = document.getElementById('menu-body');
        if (menuBody) {
          menuBody.addEventListener('scroll', function() {
            tabScrollTops[menuActiveTab] = menuBody.scrollTop;
          });
        }

        // Steppers on Overlays & Emulation tabs
        const rows = document.querySelectorAll('.menu-row');
        rows.forEach(function(r) {
          const btnLeft = r.querySelector('[data-step="-1"]');
          const btnRight = r.querySelector('[data-step="1"]');
          const rIdx = parseInt(r.getAttribute('data-row'), 10);
          if (btnLeft) {
            btnLeft.addEventListener('click', function(e) {
              e.stopPropagation();
              menuSelectedRow = rIdx;
              tabSelectedRows[menuActiveTab] = rIdx;
              updateMenuRowSelection();
              changeMenuValue(-1);
            });
          }
          if (btnRight) {
            btnRight.addEventListener('click', function(e) {
              e.stopPropagation();
              menuSelectedRow = rIdx;
              tabSelectedRows[menuActiveTab] = rIdx;
              updateMenuRowSelection();
              changeMenuValue(1);
            });
          }
          r.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            menuSelectedRow = rIdx;
            tabSelectedRows[menuActiveTab] = rIdx;
            updateMenuRowSelection();
            activateMenuRow();
          });
        });

        // Keybind Presets
        const pArrows = document.getElementById('menu-preset-arrows');
        const pWasd = document.getElementById('menu-preset-wasd');
        const pReset = document.getElementById('menu-preset-reset');
        if (pArrows) {
          pArrows.addEventListener('click', function() {
            userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);
            if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
            rebuildKeyBitMap();
            playMenuSound('click_confirm');
            renderKeybindRows();
          });
        }
        if (pWasd) {
          pWasd.addEventListener('click', function() {
            userKeyMap = Object.assign({}, DEFAULT_KEY_MAP, {
              'Up': 'w', 'Down': 's', 'Left': 'a', 'Right': 'd',
              'B': 'j', 'A': 'k', 'Y': 'u', 'X': 'i', 'L': 'q', 'R': 'e'
            });
            if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
            rebuildKeyBitMap();
            playMenuSound('click_confirm');
            renderKeybindRows();
          });
        }
        if (pReset) {
          pReset.addEventListener('click', function() {
            userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);
            if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
            rebuildKeyBitMap();
            playMenuSound('click_confirm');
            renderKeybindRows();
          });
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
      } else {
        setup();
      }
    })();
  `;
}

module.exports = {
  getMenuCss,
  getMenuHtml,
  getMenuClientScript,
};
