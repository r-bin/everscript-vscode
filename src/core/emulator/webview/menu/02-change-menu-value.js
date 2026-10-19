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

      // Normal SNES game keys pass through to panel-webview.ts input listener.
    }, true);
