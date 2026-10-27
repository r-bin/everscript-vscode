// TODO port to TS (docs/todo/port-to-ts.md)

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
      } else if (menuActiveTab === 6) {
        if (menuSelectedRow === 0) {
          setBindPage(delta > 0 ? 'gamepad' : 'keyboard');
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
          case 3:
            setStartOpensMenu(delta > 0);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 4:
            if (typeof setGameFeaturesEnabled === 'function') setGameFeaturesEnabled(delta > 0);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 5:
            setClickToWalk(delta > 0);
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
            setStartOpensMenu(!startOpensMenu);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 4:
            if (typeof setGameFeaturesEnabled === 'function') setGameFeaturesEnabled(!gameFeaturesEnabled);
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
          case 5:
            setClickToWalk(!clickToWalk);
            playMenuSound('click_toggle');
            break;
          case 6:
            playMenuSound('click_confirm');
            if (loadedRomData) {
              bootRom(loadedRomData, loadedRomName);
              closeEmulatorMenu();
            }
            break;
          case 7:
            if (typeof tasSoftReset === 'function' && tasSoftReset()) {
              playMenuSound('click_confirm');
              closeEmulatorMenu();
            }
            break;
          case 8:
            // Stays open: B again goes further back (tas/03-tas-rewind.js).
            if (typeof tasRewind === 'function') tasRewind();
            break;
          default:
            changeMenuValue(1);
            break;
        }
      } else if (menuActiveTab === 6) {
        // Tab 6: CONTROLS
        // Row 0 picks the page; the rows below bind the SNES buttons, then the actions.
        if (menuSelectedRow === 0) changeMenuValue(1);
        else if (menuSelectedRow <= BIND_ROW_NAMES.length) startKeybindListen(BIND_ROW_NAMES[menuSelectedRow - 1]);
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

      BIND_ROW_NAMES.forEach(function(btnName, i) {
        const idx = i + 1;   // row 0 is the page picker
        const row = document.createElement('div');
        row.className = 'menu-row' + (idx === menuSelectedRow ? ' selected' : '');
        row.setAttribute('data-row', String(idx));

        const label = document.createElement('div');
        label.className = 'menu-row-label';
        label.innerHTML = '<span class="menu-row-cursor">&gt;</span> ' + (ACTION_LABELS[btnName] || btnName);

        const val = document.createElement('div');
        val.className = 'menu-row-value';

        const badge = document.createElement('span');
        badge.className = 'menu-bind-badge' + (menuListeningBtn === btnName ? ' listening' : '');
        badge.id = 'menu-badge-' + btnName;
        badge.textContent = menuListeningBtn === btnName ? (bindPage === 'gamepad' ? '[PRESS BUTTON]' : '[PRESS KEY]')
          : bindPage === 'gamepad' ? formatPadButton(userPadMap[btnName]) : formatKeyDisplay(userKeyMap[btnName]);

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

    const BIND_ROW_NAMES = SNES_BUTTON_NAMES.concat(ACTION_NAMES);

    function formatKeyDisplay(k) {
      if (!k) return 'None';
      if (k === ' ') return 'Space';
      if (k.startsWith('Arrow')) return k.replace('Arrow', '');
      return k.toUpperCase();
    }

    // Standard-mapping button index -> what it is called on a pad (face buttons by position).
    // Face names for a standard-mapping pad; a raw one (or none seen yet) shows the numbers it reports.
    function formatPadButton(bind) {
      const pads = EmuPad.connectedPads(navigator);
      return EmuPad.formatBind(bind, !pads.length || pads.some(function(p) { return p.mapping === 'standard'; }));
    }

    function setBindPage(page) {
      bindPage = page === 'gamepad' ? 'gamepad' : 'keyboard';
      if (menuListeningBtn) cancelKeybindListen();
      syncBindPageUi();
      renderKeybindRows();
    }

    function syncBindPageUi() {
      const pad = bindPage === 'gamepad';
      const pill = document.getElementById('menu-val-bindpage');
      if (pill) pill.textContent = pad ? 'Gamepad' : 'Keyboard';
      for (const id of ['menu-preset-arrows', 'menu-preset-wasd']) {
        const el = document.getElementById(id);
        if (el) el.hidden = pad;
      }
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

    // keyStr is a key (keyboard page) or a pad binding (gamepad page: button index, axis or hat direction).
    function applyKeybind(keyStr) {
      if (!menuListeningBtn) return;
      if (bindPage === 'gamepad') userPadMap[menuListeningBtn] = keyStr;
      else userKeyMap[menuListeningBtn] = keyStr;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      rebuildKeyBitMap();
      playMenuSound('click_confirm');
      menuListeningBtn = null;
      if (menuListeningTimeout) clearTimeout(menuListeningTimeout);
      renderKeybindRows();
    }

    // -- Keyboard Event Interception -------------------------------------------
    window.addEventListener('keydown', function(e) {
      if (typeof romLoaded !== 'undefined' && !romLoaded) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const startKey = userKeyMap['Start'] || 'Enter';
      const isStartKey = e.key === startKey || (startKey === 'Enter' && e.key === 'Enter');

      if (isStartKey && (window.startKeySuppressedUntilRelease || (typeof window.ignoreStartUntil === 'number' && performance.now() < window.ignoreStartUntil))) {
        e.preventDefault();
        return;
      }

      // 1. Esc ALWAYS pauses/resumes the emulator & toggles menu.
      // When startOpensMenu is ON, Start button does the exact same thing as Esc.
      if (e.key === 'Escape' || (typeof startOpensMenu !== 'undefined' && startOpensMenu && isStartKey && !menuListeningBtn)) {
        if (menuListeningBtn) {
          cancelKeybindListen();
          e.preventDefault();
          return;
        }
        togglePauseMenu(e.key === 'Escape' ? 'Escape' : 'Start');
        e.preventDefault();
        return;
      }

      // 2. Menu is OPEN: Input belongs to menu
      if (isMenuOpen) {
        if (menuListeningBtn) {
          // On the gamepad page only a pad control binds (pollGamepadMenu); Esc cancelled above.
          if (bindPage === 'gamepad') { e.preventDefault(); return; }
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

      // 3. Menu is CLOSED: When startOpensMenu is OFF, Start passes through to the game.
      // Normal SNES game keys pass through to panel-webview.ts input listener.
    }, true);
