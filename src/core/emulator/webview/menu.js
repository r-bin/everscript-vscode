
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
  