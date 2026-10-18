
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
  