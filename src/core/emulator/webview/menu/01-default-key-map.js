// TODO port to TS (docs/todo/port-to-ts.md)

    //@@sound

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

      // The room and the player: the game's (gameLensInfo, Evermore: menu-tabs.js); the line is data-needs="game".
      const info = typeof gameLensInfo === 'function' ? gameLensInfo() : null;
      if (roomTitleEl && info) roomTitleEl.textContent = info.room;
      if (coordsEl) {
        const px = (typeof panX !== 'undefined') ? panX : 0;
        const py = (typeof panY !== 'undefined') ? panY : 0;
        coordsEl.textContent = 'Cam: (' + Math.round(px) + ', ' + Math.round(py) + ')' + (info ? ' | Player: (' + info.playerX + ', ' + info.playerY + ')' : '');
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
