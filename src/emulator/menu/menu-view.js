'use strict';

/**
 * emulator/menu/menu-view.js
 *
 * Owns: the Emulator Quick Menu OSD (On-Screen Display).
 * - Tabs paged with L and R (Overlays, Emulation, Controls)
 * - Mouse and Gamepad / Keyboard navigation
 * - Authentic Evermore sound effects
 * - Gated Start button (intercepts only when player is controllable)
 * - Interactive controller and keybindings remapper
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
      align-items: center;
      justify-content: center;
      background: rgba(8, 8, 12, 0.78);
      backdrop-filter: blur(2px);
      user-select: none;
      font-family: monospace;
    }
    #emulator-menu.hidden {
      display: none !important;
    }

    #menu-card {
      width: 460px;
      max-width: 94%;
      max-height: 92%;
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
      overflow-y: auto;
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
    }
    .menu-device-status {
      color: #6f9;
      font-weight: bold;
    }
    .menu-keybind-list {
      display: flex;
      flex-direction: column;
      max-height: 230px;
      overflow-y: auto;
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
            <div class="menu-row selected" data-row="0" data-action="toggle-extend">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Extended Map Background</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-extend" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="1" data-action="toggle-triggers">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Triggers (B &amp; Step-on)</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-triggers" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="2" data-action="toggle-objects">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Entities &amp; Objects</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-objects" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="3" data-action="toggle-anim">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Animated Tile Outlines</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-anim" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="4" data-action="toggle-collision">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Collision Geometry</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-collision" class="menu-pill active">ON</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="5" data-action="toggle-fog">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Fog of War (Outer Bounds)</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-fog" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="6" data-action="step-zoom">
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
            <div class="menu-row" data-row="2" data-action="toggle-breakpoint-focus">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Debugger Break Focus</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-focus" class="menu-pill">Code</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="3" data-action="action-reset-rom">
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
              <!-- Dynamically rendered or static keybind rows -->
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

    let userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);
    try {
      const savedBinds = localStorage.getItem('everscript_emulator_keybinds_v1');
      if (savedBinds) {
        userKeyMap = Object.assign({}, DEFAULT_KEY_MAP, JSON.parse(savedBinds));
      }
    } catch (e) {}

    // Reverse lookup from event.key to SNES bit
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
      keyInput = 0; // clear any held inputs
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
      renderMenuTab(menuActiveTab);
    }

    function closeEmulatorMenu() {
      if (!isMenuOpen) return;
      if (menuListeningBtn) cancelKeybindListen();
      isMenuOpen = false;
      keyInput = 0;
      const menuEl = document.getElementById('emulator-menu');
      if (menuEl) menuEl.classList.add('hidden');

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

    function switchMenuTab(delta) {
      if (menuListeningBtn) cancelKeybindListen();
      menuActiveTab = (menuActiveTab + delta + 3) % 3;
      menuSelectedRow = 0;
      playMenuSound('wheel_turn');
      renderMenuTab(menuActiveTab);
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

    function updateMenuRowSelection() {
      const activePanel = document.getElementById('menu-panel-' + menuActiveTab);
      if (!activePanel) return;
      const rows = activePanel.querySelectorAll('.menu-row');
      if (menuSelectedRow < 0) menuSelectedRow = 0;
      if (menuSelectedRow >= rows.length) menuSelectedRow = Math.max(0, rows.length - 1);

      rows.forEach(function(row, idx) {
        row.classList.toggle('selected', idx === menuSelectedRow);
      });
    }

    function moveMenuSelection(delta) {
      const activePanel = document.getElementById('menu-panel-' + menuActiveTab);
      if (!activePanel) return;
      const rows = activePanel.querySelectorAll('.menu-row');
      if (rows.length === 0) return;
      const prev = menuSelectedRow;
      menuSelectedRow = (menuSelectedRow + delta + rows.length) % rows.length;
      if (menuSelectedRow !== prev) {
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
      const zEl = document.getElementById('menu-val-zoom');
      if (zEl) {
        const lvlEl = document.getElementById('screen-zlevel');
        zEl.textContent = lvlEl ? lvlEl.textContent : 'Fit';
      }

      // Tab 1
      const spdEl = document.getElementById('menu-val-speed');
      if (spdEl) spdEl.textContent = speedUp ? '4x' : '1x';
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

    function changeMenuValue(delta) {
      if (menuActiveTab === 0) {
        // Tab 0: OVERLAYS
        switch (menuSelectedRow) {
          case 0:
            setExtendMap(!extendMapEnabled);
            setPillState('menu-val-extend', extendMapEnabled);
            playMenuSound('click_toggle');
            break;
          case 1:
            setTriggersOverlay(!triggersOverlayEnabled);
            setPillState('menu-val-triggers', triggersOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 2:
            setObjectsOverlay(!objectsOverlayEnabled);
            setPillState('menu-val-objects', objectsOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 3:
            setAnimTilesOverlay(!animTilesOverlayEnabled);
            setPillState('menu-val-anim', animTilesOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 4:
            setCollisionOverlay(!collisionOverlayEnabled);
            setPillState('menu-val-collision', collisionOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 5:
            setFogOfWar(!fogOfWarEnabled);
            setPillState('menu-val-fog', fogOfWarEnabled);
            playMenuSound('click_toggle');
            break;
          case 6:
            // Zoom stepper
            if (delta > 0) {
              const inBtn = document.getElementById('screen-zin');
              if (inBtn) inBtn.click();
            } else {
              const outBtn = document.getElementById('screen-zout');
              if (outBtn) outBtn.click();
            }
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
        }
      } else if (menuActiveTab === 1) {
        // Tab 1: EMULATION
        switch (menuSelectedRow) {
          case 0:
            setSpeedUp(!speedUp);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 1:
            // Sound mute
            playMenuSound('click_toggle');
            break;
          case 2:
            setKeepFocusChip(!keepFocusOnBreak);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 3:
            // Action handled by activate
            break;
        }
      } else if (menuActiveTab === 2) {
        // Tab 2: Remap
        activateMenuRow();
      }
    }

    function activateMenuRow() {
      if (menuActiveTab === 0) {
        changeMenuValue(1);
      } else if (menuActiveTab === 1) {
        if (menuSelectedRow === 3) {
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

        row.addEventListener('click', function() {
          menuSelectedRow = idx;
          updateMenuRowSelection();
          startKeybindListen(btnName);
        });

        row.addEventListener('mouseenter', function() {
          if (!menuListeningBtn) {
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
      // 1. Menu is OPEN: All input belongs to the menu
      if (isMenuOpen) {
        if (menuListeningBtn) {
          if (e.key === 'Escape') {
            cancelKeybindListen();
          } else {
            applyKeybind(e.key);
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Shoulder navigation (L / R)
        if (e.key === 'q' || e.key === 'Q' || e.key === 'a' || e.key === 'A') {
          // L tab left
          switchMenuTab(-1);
          e.preventDefault();
          return;
        }
        if (e.key === 'w' || e.key === 'W' || e.key === 's' || e.key === 'S') {
          // R tab right
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
        if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
          closeEmulatorMenu();
          e.preventDefault();
          return;
        }
        return;
      }

      // 2. Menu is CLOSED: Check Start button gating
      const startKey = userKeyMap['Start'] || 'Enter';
      if (e.key === startKey && !e.repeat) {
        const m = getModule();
        if (isPlayerControllable(m)) {
          // Intercept Start and open menu!
          openEmulatorMenu();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Live joypad mapping via dynamic key map
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

      if (isMenuOpen) {
        // D-Pad and Face Buttons for Menu Navigation
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
        // Button B (btn 0 or btn 1)
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
          openEmulatorMenu();
          lastGamepadButtons[9] = true;
          return;
        }
      }
      lastGamepadButtons[9] = gp.buttons[9] && gp.buttons[9].pressed;
    }

    // Hook Gamepad polling into requestAnimationFrame loop
    function menuFrameTick() {
      pollGamepadMenu();
      requestAnimationFrame(menuFrameTick);
    }
    requestAnimationFrame(menuFrameTick);

    // -- Mouse & Tab Bindings --------------------------------------------------
    function setupMenuDomEvents() {
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

      // Backdrop click closes menu
      const menuBackdrop = document.getElementById('emulator-menu');
      if (menuBackdrop) {
        menuBackdrop.addEventListener('click', function(e) {
          if (e.target === menuBackdrop) {
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
