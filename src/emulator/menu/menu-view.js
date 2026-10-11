'use strict';

/**
 * emulator/menu/menu-view.js
 *
 * Owns: the Emulator Quick Menu OSD (On-Screen Display).
 * - Fixed top positioning
 * - Tabs paged with L and R (Overlays, Emulation, Controls)
 * - Map Lens mode as default entry for un-distorted room exploration
 * - Non-looping stepped values (Speed: 1/4x, 1/2x, 1x, 2x, 4x; Zoom, toggles)
 * - Up/Down automatic scroll-into-view
 * - Wheel events inside menu scroll the menu instead of the map
 * - Sound visualization toggle in menu
 * - Unified Pause / Menu toggle (Start by default, Esc always pauses)
 * - Interactive keybinding and gamepad remapping
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
      padding-top: 14px;
      background: rgba(8, 8, 12, 0.78);
      backdrop-filter: blur(2px);
      user-select: none;
      font-family: monospace;
    }
    #emulator-menu.hidden {
      display: none !important;
    }

    /* Lens Mode: hides menu card, reveals floating top HUD bar */
    #emulator-menu.lens-active {
      background: rgba(0, 0, 0, 0.15) !important;
      backdrop-filter: none !important;
      pointer-events: auto;
    }
    #emulator-menu.lens-active #menu-card {
      display: none !important;
    }
    #menu-lens-hud {
      display: none;
      background: rgba(16, 18, 24, 0.92);
      border: 1px solid #3c3c48;
      border-radius: 5px;
      padding: 6px 14px;
      font-size: 11px;
      color: #ccc;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.8);
      align-items: center;
      gap: 12px;
    }
    #emulator-menu.lens-active #menu-lens-hud {
      display: flex;
    }
    .menu-lens-tag {
      color: #4ec9b0;
      font-weight: bold;
      letter-spacing: 0.05em;
    }
    .menu-lens-hint {
      color: #8899aa;
      font-size: 10px;
    }
    .menu-lens-close {
      background: #252530;
      border: 1px solid #445;
      color: #ddd;
      border-radius: 3px;
      padding: 2px 7px;
      cursor: pointer;
      font-size: 10px;
    }
    .menu-lens-close:hover {
      background: #353545;
      color: #fff;
    }

    #menu-card {
      width: 470px;
      max-width: 95%;
      max-height: 88vh;
      background: #141418;
      border: 1px solid #363640;
      border-radius: 6px;
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
      gap: 4px;
      flex: 1;
      justify-content: center;
    }
    .menu-tab-btn {
      background: transparent;
      border: none;
      color: #778899;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      padding: 5px 10px;
      cursor: pointer;
      border-radius: 3px;
      transition: all 0.12s;
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
      max-height: 380px;
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
      background: #30303c;
      color: #fff;
    }
    .menu-stepper-btn:disabled, .menu-stepper-btn.disabled {
      opacity: 0.35;
      cursor: default;
    }
    .menu-pill {
      min-width: 68px;
      text-align: center;
      background: #181820;
      border: 1px solid #343440;
      border-radius: 3px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: #aaa;
    }
    .menu-pill.active {
      background: rgba(46, 125, 50, 0.25);
      border-color: #2e7d32;
      color: #7ad67a;
    }

    /* Action button in row */
    .menu-action-pill {
      background: #202028;
      border: 1px solid #404050;
      border-radius: 3px;
      padding: 3px 10px;
      font-size: 10px;
      color: #ccc;
      cursor: pointer;
    }
    .menu-action-pill:hover {
      background: #30303c;
      color: #fff;
      border-color: #555566;
    }

    /* Controls Tab */
    .menu-device-banner {
      background: #16161d;
      border-bottom: 1px solid #282832;
      padding: 6px 12px;
      font-size: 10px;
      color: #8899aa;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .menu-device-status {
      color: #6f9;
      font-weight: bold;
    }
    .menu-keybind-list {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .menu-bind-badge {
      display: inline-block;
      min-width: 80px;
      text-align: center;
      background: #20202a;
      border: 1px solid #3c3c4a;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
      color: #ddd;
    }
    .menu-bind-badge.listening {
      background: rgba(220, 100, 40, 0.35);
      border-color: #d64;
      color: #ff9;
      animation: menu-pulse 0.8s infinite alternate;
    }
    @keyframes menu-pulse {
      from { opacity: 0.7; }
      to { opacity: 1; }
    }
    .menu-preset-row {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      background: #14141a;
      border-top: 1px solid #252530;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    .menu-preset-btn {
      background: #1f1f26;
      border: 1px solid #383844;
      border-radius: 3px;
      color: #aaa;
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

function getMenuHtml() {
  return `
    <div id="emulator-menu" class="hidden">
      <!-- Lens Mode Floating HUD Bar -->
      <div id="menu-lens-hud">
        <span class="menu-lens-tag">[MAP LENS]</span>
        <span class="menu-lens-hint">Pan: Drag / D-Pad / Arrows | Zoom: Wheel / +/- | [B] / Esc: Menu</span>
        <button id="menu-lens-exit-btn" class="menu-lens-close" type="button">Back to Menu</button>
      </div>

      <div id="menu-card">
        <div id="menu-header">
          <button id="menu-l-btn" class="menu-shoulder-btn" type="button" title="Previous Tab (L)">[L]</button>
          <div id="menu-tabs">
            <button id="menu-tab-btn-0" class="menu-tab-btn active" type="button" data-tab="0">OVERLAYS</button>
            <button id="menu-tab-btn-1" class="menu-tab-btn" type="button" data-tab="1">EMULATION</button>
            <button id="menu-tab-btn-2" class="menu-tab-btn" type="button" data-tab="2">CONTROLS</button>
          </div>
          <button id="menu-r-btn" class="menu-shoulder-btn" type="button" title="Next Tab (R)">[R]</button>
          <button id="menu-close-btn" type="button" title="Resume Game (B / Esc)">[X]</button>
        </div>

        <div id="menu-body">
          <!-- Tab 0: OVERLAYS -->
          <div id="menu-panel-0" class="menu-tab-panel active">
            <!-- Row 0: Lens default entry -->
            <div class="menu-row selected" data-row="0" data-action="action-lens">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Map Lens (Explore Room)</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[A] Explore</span>
              </div>
            </div>
            <div class="menu-row" data-row="1" data-action="toggle-extend">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Extended Map Background</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-extend" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="2" data-action="toggle-triggers">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Triggers (B &amp; Step-on)</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-triggers" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="3" data-action="toggle-objects">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Entities &amp; Objects</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-objects" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="4" data-action="toggle-anim">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Animated Tile Outlines</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-anim" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="5" data-action="toggle-collision">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Collision Geometry</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-collision" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="6" data-action="toggle-fog">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Fog of War (Outer Bounds)</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-fog" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="7" data-action="toggle-sound-vis">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Sound Entity Visualizer</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-sound-vis" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="8" data-action="step-zoom">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Viewport Zoom / Scale</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-zoom" class="menu-pill">Fit</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
          </div>

          <!-- Tab 1: EMULATION -->
          <div id="menu-panel-1" class="menu-tab-panel">
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
            <div class="menu-row" data-row="2" data-action="toggle-sound-vis-tab1">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Sound Entity Visualizer</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-sound-vis-tab1" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="3" data-action="toggle-breakpoint-focus">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Debugger Break Focus</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-focus" class="menu-pill">Code</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="4" data-action="action-reset-rom">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Reset / Power-Cycle ROM</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[Press A to Reset]</span>
              </div>
            </div>
          </div>

          <!-- Tab 2: CONTROLS -->
          <div id="menu-panel-2" class="menu-tab-panel">
            <div class="menu-device-banner">
              <span id="menu-device-name">Input: Keyboard &amp; Gamepad</span>
              <span id="menu-device-status" class="menu-device-status">Active</span>
            </div>
            <div id="menu-bind-list" class="menu-keybind-list">
              <!-- Dynamically rendered keybind rows -->
            </div>
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
            <span>[A]: Action</span>
          </div>
          <div>[B] / Esc: Resume</div>
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

    let userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);
    try {
      const savedBinds = localStorage.getItem('everscript_emulator_keybinds_v1');
      if (savedBinds) {
        userKeyMap = Object.assign({}, DEFAULT_KEY_MAP, JSON.parse(savedBinds));
      }
    } catch (e) {}

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

    // Menu State
    let isMenuOpen = false;
    let isLensModeActive = false;
    let menuActiveTab = 0; // 0: Overlays, 1: Emulation, 2: Controls
    let menuSelectedRow = 0;
    let menuListeningBtn = null;
    let menuListeningTimeout = null;

    // Controllable Player Gate:
    // Only intercepts Start when player is actively controllable (not in intro, showcase, or name entry)
    function isPlayerControllable(m) {
      if (!m || !romLoaded) return false;
      try {
        if (typeof m.readMemory !== 'function') return false;
        // 1. Current map: 0x00 is title, Carlton cinema, intro, and name entry
        const curMap = m.readMemory(0x7E0ADB);
        if (curMap === 0x00 || curMap === 0xFF) return false;

        // 2. Engine sequence flags at $7E22EB:
        //    0x02 = intro sequence
        //    0x04 = showcase running
        //    0x20 = animation / dialog freeze
        const flags = m.readMemory(0x7E22EB);
        if ((flags & 0x26) !== 0) return false;

        // 3. Stats initialized check: Boy Max HP at $7E0A35 is 0 before name entry completes
        const boyMaxHp = m.readMemory(0x7E0A35) | (m.readMemory(0x7E0A36) << 8);
        if (boyMaxHp === 0) return false;

        // 4. Entity check: Boy ($7E4EB3) or Dog ($7E4F61) HP > 0
        const boyHp = m.readMemory(0x7E4EB3) | (m.readMemory(0x7E4EB4) << 8);
        const dogHp = m.readMemory(0x7E4F61) | (m.readMemory(0x7E4F62) << 8);
        if (boyHp === 0 && dogHp === 0) return false;

        return true;
      } catch (err) {
        return false;
      }
    }

    function openEmulatorMenu() {
      if (isMenuOpen) return;
      isMenuOpen = true;
      keyInput = 0;
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) {
        menuEl.classList.remove('hidden');
        menuEl.classList.remove('lens-active');
      }
      isLensModeActive = false;

      const m = getModule();
      if (m && hasDebuggerApi(m)) {
        m.pauseEmulation();
        setText('ss-pause-state', 'paused', 'ss-bad');
        setText('ss-last-hit', 'last: paused for Menu', 'ss-warn');
      }

      playMenuSound('wheel_open');
      syncMenuValuesFromRuntime();
      renderMenuTab(menuActiveTab);
    }

    function closeEmulatorMenu() {
      if (!isMenuOpen) return;
      if (menuListeningBtn) cancelKeybindListen();
      isMenuOpen = false;
      isLensModeActive = false;
      keyInput = 0;
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) {
        menuEl.classList.add('hidden');
        menuEl.classList.remove('lens-active');
      }

      const m = getModule();
      if (m && hasDebuggerApi(m)) {
        m.resumeEmulation();
        setText('ss-pause-state', 'running', 'ss-ok');
        setText('ss-last-hit', 'last: resumed from Menu', 'ss-ok');
      }

      playMenuSound('wheel_close');
      const screenCanvas = document.getElementById('screen');
      if (screenCanvas) screenCanvas.focus();
    }

    // Unified Pause Toggle:
    // Pausing opens the menu, resuming closes it.
    function togglePauseMenu(source) {
      if (isLensModeActive) {
        exitLensMode();
        return;
      }
      if (isMenuOpen) {
        closeEmulatorMenu();
      } else {
        openEmulatorMenu();
      }
    }

    function enterLensMode() {
      isLensModeActive = true;
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) menuEl.classList.add('lens-active');
      playMenuSound('click_confirm');
    }

    function exitLensMode() {
      isLensModeActive = false;
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) menuEl.classList.remove('lens-active');
      playMenuSound('wheel_turn');
      updateMenuRowSelection();
    }

    function switchMenuTab(delta) {
      if (isLensModeActive) {
        exitLensMode();
        return;
      }
      if (menuListeningBtn) cancelKeybindListen();
      // Tabs don't loop: clamped between 0 and 2
      const target = Math.max(0, Math.min(menuActiveTab + delta, 2));
      if (target !== menuActiveTab) {
        menuActiveTab = target;
        menuSelectedRow = 0;
        playMenuSound('wheel_turn');
        renderMenuTab(menuActiveTab);
      }
    }

    function renderMenuTab(tabIndex) {
      menuActiveTab = tabIndex;
      for (let i = 0; i < 3; i++) {
        const tabBtn = document.getElementById('menu-tab-btn-' + i);
        const panel = document.getElementById('menu-panel-' + i);
        if (tabBtn) tabBtn.classList.toggle('active', i === tabIndex);
        if (panel) panel.classList.toggle('active', i === tabIndex);
      }
      if (tabIndex === 2) {
        renderKeybindRows();
      }
      updateMenuRowSelection();
    }

    // Up / Down scrolls the active selection into view automatically!
    function updateMenuRowSelection() {
      const activePanel = document.getElementById('menu-panel-' + menuActiveTab);
      if (!activePanel) return;
      const rows = activePanel.querySelectorAll('.menu-row');
      if (menuSelectedRow < 0) menuSelectedRow = 0;
      if (menuSelectedRow >= rows.length) menuSelectedRow = Math.max(0, rows.length - 1);

      rows.forEach(function(row, idx) {
        const isSel = (idx === menuSelectedRow);
        row.classList.toggle('selected', isSel);
        if (isSel) {
          row.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
      });
    }

    function moveMenuSelection(delta) {
      if (isLensModeActive) return;
      const activePanel = document.getElementById('menu-panel-' + menuActiveTab);
      if (!activePanel) return;
      const rows = activePanel.querySelectorAll('.menu-row');
      if (rows.length === 0) return;
      // Do not wrap selection: clamp between 0 and rows.length - 1
      const target = Math.max(0, Math.min(menuSelectedRow + delta, rows.length - 1));
      if (target !== menuSelectedRow) {
        menuSelectedRow = target;
        playMenuSound('click_nav');
        updateMenuRowSelection();
      }
    }

    function syncMenuValuesFromRuntime() {
      // Tab 0
      setPillState('menu-val-extend', extendMapEnabled);
      setPillState('menu-val-triggers', triggersOverlayEnabled);
      setPillState('menu-val-objects', objectsOverlayEnabled);
      setPillState('menu-val-anim', animTilesOverlayEnabled);
      setPillState('menu-val-collision', collisionOverlayEnabled);
      setPillState('menu-val-fog', fogOfWarEnabled);
      if (typeof sndShow !== 'undefined') {
        setPillState('menu-val-sound-vis', sndShow);
        setPillState('menu-val-sound-vis-tab1', sndShow);
      }
      const zEl = document.getElementById('menu-val-zoom');
      if (zEl) zEl.textContent = MENU_ZOOM_LABELS[menuZoomIndex];

      // Tab 1
      const spdEl = document.getElementById('menu-val-speed');
      if (spdEl) spdEl.textContent = MENU_SPEED_LABELS[menuSpeedIndex];
      const focusEl = document.getElementById('menu-val-focus');
      if (focusEl) focusEl.textContent = keepFocusOnBreak ? 'Stay' : 'Code';
    }

    function setPillState(id, on) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = on ? 'ON' : 'OFF';
        el.classList.toggle('active', !!on);
      }
    }

    // Stepping values does NOT loop!
    function changeMenuValue(delta) {
      if (menuActiveTab === 0) {
        // Tab 0: OVERLAYS
        switch (menuSelectedRow) {
          case 0:
            // Lens Mode
            enterLensMode();
            break;
          case 1:
            // Extend map: delta < 0 is OFF, delta > 0 is ON
            setExtendMap(delta > 0);
            setPillState('menu-val-extend', extendMapEnabled);
            playMenuSound('click_toggle');
            break;
          case 2:
            setTriggersOverlay(delta > 0);
            setPillState('menu-val-triggers', triggersOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 3:
            setObjectsOverlay(delta > 0);
            setPillState('menu-val-objects', objectsOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 4:
            setAnimTilesOverlay(delta > 0);
            setPillState('menu-val-anim', animTilesOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 5:
            setCollisionOverlay(delta > 0);
            setPillState('menu-val-collision', collisionOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 6:
            setFogOfWar(delta > 0);
            setPillState('menu-val-fog', fogOfWarEnabled);
            playMenuSound('click_toggle');
            break;
          case 7:
            // Sound entity visualizer
            if (typeof sndSetShow === 'function') {
              sndSetShow(delta > 0);
              setPillState('menu-val-sound-vis', sndShow);
              setPillState('menu-val-sound-vis-tab1', sndShow);
              playMenuSound('click_toggle');
            }
            break;
          case 8:
            // Zoom stepper (clamped, does not loop!)
            menuZoomIndex = Math.max(0, Math.min(menuZoomIndex + delta, MENU_ZOOM_LABELS.length - 1));
            applyMenuZoom(menuZoomIndex);
            playMenuSound('click_toggle');
            break;
        }
      } else if (menuActiveTab === 1) {
        // Tab 1: EMULATION
        switch (menuSelectedRow) {
          case 0:
            // Speed: 1/4x, 1/2x, 1x, 2x, 4x (clamped, does not loop!)
            menuSpeedIndex = Math.max(0, Math.min(menuSpeedIndex + delta, MENU_SPEED_LABELS.length - 1));
            if (typeof setSpeedMultiplier === 'function') {
              setSpeedMultiplier(MENU_SPEED_VALUES[menuSpeedIndex]);
            }
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 1:
            // Master sound
            playMenuSound('click_toggle');
            break;
          case 2:
            // Sound entity visualizer
            if (typeof sndSetShow === 'function') {
              sndSetShow(delta > 0);
              setPillState('menu-val-sound-vis', sndShow);
              setPillState('menu-val-sound-vis-tab1', sndShow);
              playMenuSound('click_toggle');
            }
            break;
          case 3:
            // Breakpoint focus: delta < 0 is Code, delta > 0 is Stay (clamped!)
            setKeepFocusChip(delta > 0);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 4:
            // Action reset ROM handled by activate
            break;
        }
      } else if (menuActiveTab === 2) {
        // Tab 2: Remap
        activateMenuRow();
      }
    }

    function applyMenuZoom(idx) {
      const val = MENU_ZOOM_VALUES[idx];
      if (val === -1) {
        const fitBtn = document.getElementById('screen-zfit');
        if (fitBtn) fitBtn.click();
      } else {
        if (typeof zoomAt === 'function') {
          const wrap = document.getElementById('screen-wrap');
          const cx = wrap ? wrap.clientWidth / 2 : 256;
          const cy = wrap ? wrap.clientHeight / 2 : 224;
          zoomAt(val, cx, cy);
        }
      }
      syncMenuValuesFromRuntime();
    }

    function activateMenuRow() {
      if (menuActiveTab === 0) {
        if (menuSelectedRow === 0) {
          enterLensMode();
        } else {
          // Toggle on activate
          changeMenuValue(1);
        }
      } else if (menuActiveTab === 1) {
        if (menuSelectedRow === 4) {
          // Reset ROM
          playMenuSound('click_confirm');
          if (loadedRomData) {
            bootRom(loadedRomData, loadedRomName);
            closeEmulatorMenu();
          }
        } else {
          changeMenuValue(1);
        }
      } else if (menuActiveTab === 2) {
        // Start remapping selected button
        if (menuSelectedRow >= 0 && menuSelectedRow < SNES_BUTTON_NAMES.length) {
          startKeybindListen(SNES_BUTTON_NAMES[menuSelectedRow]);
        }
      }
    }

    // -- Remapper UI & Storage -------------------------------------------------
    function renderKeybindRows() {
      const container = document.getElementById('menu-bind-list');
      if (!container) return;
      container.innerHTML = '';

      SNES_BUTTON_NAMES.forEach(function(btnName, idx) {
        const row = document.createElement('div');
        row.className = 'menu-row' + (idx === menuSelectedRow ? ' selected' : '');
        row.setAttribute('data-row', idx);

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

        row.addEventListener('mouseenter', function() {
          if (!menuListeningBtn && menuSelectedRow !== idx) {
            menuSelectedRow = idx;
            updateMenuRowSelection();
          }
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
      try {
        localStorage.setItem('everscript_emulator_keybinds_v1', JSON.stringify(userKeyMap));
      } catch (e) {}
      rebuildKeyBitMap();
      playMenuSound('click_confirm');
      menuListeningBtn = null;
      if (menuListeningTimeout) clearTimeout(menuListeningTimeout);
      renderKeybindRows();
    }

    // -- Keyboard Event Interception -------------------------------------------
    window.addEventListener('keydown', function(e) {
      // 1. Esc ALWAYS pauses the emulator / toggles menu
      if (e.key === 'Escape') {
        if (menuListeningBtn) {
          cancelKeybindListen();
          e.preventDefault();
          return;
        }
        if (isLensModeActive) {
          exitLensMode();
          e.preventDefault();
          return;
        }
        togglePauseMenu('Escape');
        e.preventDefault();
        return;
      }

      // 2. Lens Mode Active: Arrow keys pan camera
      if (isLensModeActive) {
        if (e.key === 'ArrowUp') { panY += 24; if (typeof updateScreenLayout === 'function') updateScreenLayout(); e.preventDefault(); return; }
        if (e.key === 'ArrowDown') { panY -= 24; if (typeof updateScreenLayout === 'function') updateScreenLayout(); e.preventDefault(); return; }
        if (e.key === 'ArrowLeft') { panX += 24; if (typeof updateScreenLayout === 'function') updateScreenLayout(); e.preventDefault(); return; }
        if (e.key === 'ArrowRight') { panX -= 24; if (typeof updateScreenLayout === 'function') updateScreenLayout(); e.preventDefault(); return; }
        if (e.key === 'Enter' || e.key === 'c' || e.key === 'C') { exitLensMode(); e.preventDefault(); return; }
        return;
      }

      // 3. Menu is OPEN: Input belongs to menu
      if (isMenuOpen) {
        if (menuListeningBtn) {
          applyKeybind(e.key);
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // L / R Shoulder navigation
        if (e.key === 'q' || e.key === 'Q' || e.key === 'a' || e.key === 'A') {
          switchMenuTab(-1);
          e.preventDefault();
          return;
        }
        if (e.key === 'w' || e.key === 'W' || e.key === 's' || e.key === 'S') {
          switchMenuTab(1);
          e.preventDefault();
          return;
        }

        if (e.key === 'ArrowUp') {
          moveMenuSelection(-1);
          e.preventDefault();
          return;
        }
        if (e.key === 'ArrowDown') {
          moveMenuSelection(1);
          e.preventDefault();
          return;
        }
        if (e.key === 'ArrowLeft') {
          changeMenuValue(-1);
          e.preventDefault();
          return;
        }
        if (e.key === 'ArrowRight') {
          changeMenuValue(1);
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter' || e.key === 'v' || e.key === 'V') {
          activateMenuRow();
          e.preventDefault();
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          closeEmulatorMenu();
          e.preventDefault();
          return;
        }
        return;
      }

      // 4. Menu is CLOSED: Check Pause / Start hotkey
      const startKey = userKeyMap['Start'] || 'Enter';
      if (e.key === startKey && !e.repeat) {
        const m = getModule();
        if (isPlayerControllable(m)) {
          // Intercept Start and toggle pause / open menu
          togglePauseMenu('Start');
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Normal live gameplay inputs
      const bit = dynamicKeyToBit[e.key];
      if (bit && !e.repeat) {
        keyInput |= bit;
        e.preventDefault();
      }
    }, true);

    window.addEventListener('keyup', function(e) {
      if (isMenuOpen) return;
      const bit = dynamicKeyToBit[e.key];
      if (bit) {
        keyInput &= ~bit;
        e.preventDefault();
      }
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

      if (isLensModeActive) {
        // D-Pad or stick pans the camera in Lens mode!
        const dx = (gp.axes[0] < -0.3 ? 8 : (gp.axes[0] > 0.3 ? -8 : 0));
        const dy = (gp.axes[1] < -0.3 ? 8 : (gp.axes[1] > 0.3 ? -8 : 0));
        if (dx !== 0 || dy !== 0) {
          panX += dx;
          panY += dy;
          if (typeof updateScreenLayout === 'function') updateScreenLayout();
        }
        if ((gp.buttons[0] && gp.buttons[0].pressed && !lastGamepadButtons[0]) ||
            (gp.buttons[9] && gp.buttons[9].pressed && !lastGamepadButtons[9])) {
          exitLensMode();
        }
        lastGamepadButtons[0] = gp.buttons[0] && gp.buttons[0].pressed;
        lastGamepadButtons[9] = gp.buttons[9] && gp.buttons[9].pressed;
        return;
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
        // Button A (btn 1 or btn 0)
        if (gp.buttons[1] && gp.buttons[1].pressed && !lastGamepadButtons[1]) {
          activateMenuRow();
        }
        // Button B (btn 0)
        if (gp.buttons[0] && gp.buttons[0].pressed && !lastGamepadButtons[0]) {
          closeEmulatorMenu();
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

      // When closed: Check Start button gating from Gamepad (button 9)
      if (gp.buttons[9] && gp.buttons[9].pressed && !lastGamepadButtons[9]) {
        const m = getModule();
        if (isPlayerControllable(m)) {
          togglePauseMenu('GamepadStart');
          lastGamepadButtons[9] = true;
          return;
        }
      }
      lastGamepadButtons[9] = gp.buttons[9] && gp.buttons[9].pressed;
    }

    function menuFrameTick() {
      pollGamepadMenu();
      requestAnimationFrame(menuFrameTick);
    }
    requestAnimationFrame(menuFrameTick);

    // -- Mouse & Tab Bindings --------------------------------------------------
    function setupMenuDomEvents() {
      // Lens exit button
      const lensExit = document.getElementById('menu-lens-exit-btn');
      if (lensExit) lensExit.addEventListener('click', function(e) {
        e.stopPropagation();
        exitLensMode();
      });

      // L / R buttons
      const lBtn = document.getElementById('menu-l-btn');
      if (lBtn) lBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        switchMenuTab(-1);
      });
      const rBtn = document.getElementById('menu-r-btn');
      if (rBtn) rBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        switchMenuTab(1);
      });

      // Close button
      const closeBtn = document.getElementById('menu-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeEmulatorMenu();
      });

      // Backdrop click closes menu (only when not in lens mode)
      const menuBackdrop = document.getElementById('emulator-menu');
      if (menuBackdrop) {
        menuBackdrop.addEventListener('click', function(e) {
          if (e.target === menuBackdrop && !isLensModeActive) {
            closeEmulatorMenu();
          }
        });
      }

      // Tabs click
      for (let i = 0; i < 3; i++) {
        const tabBtn = document.getElementById('menu-tab-btn-' + i);
        if (tabBtn) {
          tabBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            menuActiveTab = i;
            menuSelectedRow = 0;
            playMenuSound('wheel_turn');
            renderMenuTab(i);
          });
        }
      }

      // Row click and hover delegation
      [0, 1].forEach(function(tabIdx) {
        const panel = document.getElementById('menu-panel-' + tabIdx);
        if (!panel) return;
        const rows = panel.querySelectorAll('.menu-row');
        rows.forEach(function(row, rIdx) {
          row.addEventListener('click', function(e) {
            e.stopPropagation();
            menuSelectedRow = rIdx;
            updateMenuRowSelection();
            if (e.target.closest('.menu-stepper-btn')) {
              const step = parseInt(e.target.closest('.menu-stepper-btn').getAttribute('data-step') || '1', 10);
              changeMenuValue(step);
            } else {
              activateMenuRow();
            }
          });
          row.addEventListener('mouseenter', function() {
            if (menuSelectedRow !== rIdx) {
              menuSelectedRow = rIdx;
              updateMenuRowSelection();
            }
          });
        });
      });

      // Presets
      const btnArrows = document.getElementById('menu-preset-arrows');
      if (btnArrows) btnArrows.addEventListener('click', function() {
        userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);
        localStorage.setItem('everscript_emulator_keybinds_v1', JSON.stringify(userKeyMap));
        rebuildKeyBitMap();
        playMenuSound('click_confirm');
        renderKeybindRows();
      });

      const btnWasd = document.getElementById('menu-preset-wasd');
      if (btnWasd) btnWasd.addEventListener('click', function() {
        userKeyMap = Object.assign({}, DEFAULT_KEY_MAP, {
          'Up': 'w',
          'Down': 's',
          'Left': 'a',
          'Right': 'd',
          'B': 'k',
          'A': 'l',
          'Y': 'j',
          'X': 'i',
          'L': 'q',
          'R': 'e',
          'Select': ' ',
          'Start': 'Enter',
        });
        localStorage.setItem('everscript_emulator_keybinds_v1', JSON.stringify(userKeyMap));
        rebuildKeyBitMap();
        playMenuSound('click_confirm');
        renderKeybindRows();
      });

      const btnReset = document.getElementById('menu-preset-reset');
      if (btnReset) btnReset.addEventListener('click', function() {
        userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);
        try { localStorage.removeItem('everscript_emulator_keybinds_v1'); } catch (e) {}
        rebuildKeyBitMap();
        playMenuSound('click_confirm');
        renderKeybindRows();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupMenuDomEvents);
    } else {
      setupMenuDomEvents();
    }
  `;
}

module.exports = {
  getMenuCss,
  getMenuHtml,
  getMenuClientScript,
};
