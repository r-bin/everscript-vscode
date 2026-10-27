// TODO port to TS (docs/todo/port-to-ts.md)

    // -- Gamepad Polling & Menu Support ----------------------------------------
    // Every connected pad counts and reads as one SNES pad through userPadMap (EmuPad, ../../gamepad.ts):
    // the menu follows the same bindings as the game (B acts, A backs out, L / R page, the cross moves).
    const padHats = new Set();
    const padBindHeld = new Set();
    let padMenuPrev = 0;
    let padActionPrev = 0;
    let padStartPrev = false;
    let lastGamepadAxisTick = 0;
    let lastPadBanner = '';
    const PAD_ACTION_MASKS = { 'Rewind': 1, 'Speed': 2 };

    function currentPads() { return EmuPad.connectedPads(navigator); }
    function padSnesBits(pads) { return EmuPad.padBits(pads, userPadMap, SNES_BIT_MASKS, padHats); }

    function showPadBanner(pads) {
      const text = EmuPad.describePads(pads);
      if (text === lastPadBanner) return;
      lastPadBanner = text;
      const devNameEl = document.getElementById('menu-device-name');
      if (devNameEl) devNameEl.textContent = text;
    }

    function pollGamepadMenu() {
      const pads = currentPads();
      showPadBanner(pads);
      if (!pads.length) { padMenuPrev = 0; padActionPrev = 0; padStartPrev = false; padBindHeld.clear(); return; }

      if (isMenuOpen && menuListeningBtn && bindPage === 'gamepad') {
        // Binding: the first newly held control (button, axis or hat direction) is the answer and does nothing else.
        const hit = EmuPad.newControl(pads, padHats, padBindHeld);
        if (hit !== null) applyKeybind(hit);
        return;
      }
      EmuPad.newControl(pads, padHats, padBindHeld);

      const bits = padSnesBits(pads);
      const pressed = bits & ~padMenuPrev;
      padMenuPrev = bits;

      if (isMenuOpen) {
        const now = Date.now();
        const M = SNES_BIT_MASKS;
        if (pressed & M.L) switchMenuTab(-1);
        if (pressed & M.R) switchMenuTab(1);
        // One step per press of the cross, at most every 180 ms (a stick or hat can flicker).
        const cross = now - lastGamepadAxisTick > 180 ? pressed : 0;
        if (cross & M.Up) { moveMenuSelection(-1); lastGamepadAxisTick = now; }
        else if (cross & M.Down) { moveMenuSelection(1); lastGamepadAxisTick = now; }
        else if (cross & M.Left) { changeMenuValue(-1); lastGamepadAxisTick = now; }
        else if (cross & M.Right) { changeMenuValue(1); lastGamepadAxisTick = now; }
        if (pressed & M.B) {
          if (menuActiveTab === 0) closeEmulatorMenu(); else activateMenuRow();
        }
        if (pressed & M.A) {
          if (!(menuActiveTab === 7 && typeof tasMenuCancel === 'function' && tasMenuCancel())) closeEmulatorMenu();
        }
        if (pressed & M.Start) closeEmulatorMenu();
        padStartPrev = !!(bits & M.Start);
        return;
      }

      // Rewind and the speed toggle, on the pad page's buttons (the keyboard's are in page/03-set-speed-up.js).
      if (typeof romLoaded !== 'undefined' && romLoaded) {
        const act = EmuPad.padBits(pads, userPadMap, PAD_ACTION_MASKS, padHats, false);
        const actPressed = act & ~padActionPrev;
        padActionPrev = act;
        if ((actPressed & PAD_ACTION_MASKS.Rewind) && typeof tasRewind === 'function') tasRewind();
        if ((actPressed & PAD_ACTION_MASKS.Speed) && typeof setSpeedUp === 'function') setSpeedUp(!speedUp);
      }

      // When gameplay is active: Start opens the menu if enabled (doing the same as Esc).
      const isStartHeld = !!(bits & SNES_BIT_MASKS.Start);
      if (window.startKeySuppressedUntilRelease || (typeof window.ignoreStartUntil === 'number' && performance.now() < window.ignoreStartUntil)) {
        if (!isStartHeld && (typeof window.ignoreStartUntil !== 'number' || performance.now() >= window.ignoreStartUntil)) {
          window.startKeySuppressedUntilRelease = false;
        }
        padStartPrev = isStartHeld;
        return;
      }
      if (isStartHeld && !padStartPrev && typeof startOpensMenu !== 'undefined' && startOpensMenu) openEmulatorMenu();
      padStartPrev = isStartHeld;
    }
    window.pollGamepadMenu = pollGamepadMenu;
    window.addEventListener('gamepadconnected', function() { showPadBanner(currentPads()); });
    window.addEventListener('gamepaddisconnected', function() { showPadBanner(currentPads()); });

    // -- Gamepad as the SNES joypad ----------------------------------------------
    // Every connected pad, read through userPadMap (the CONTROLS tab's gamepad page; DEFAULT_PAD_MAP is
    // the SNES layout of a standard pad) plus the left stick and any hat as the cross.
    // Every gamepad bit is OR-ed with the keyboard's keyInput: both work at once.
    // Held while the menu was open: not sent to the game until released (the B that closes the menu).
    let padHeldInMenu = 0;
    function gamepadJoypad() {
      const held = padSnesBits(currentPads());
      if (typeof isMenuOpen !== 'undefined' && isMenuOpen) { padHeldInMenu = held; return 0; }
      padHeldInMenu &= held;
      let bits = held & ~padHeldInMenu;
      // Start belongs to the menu when it opens it (and until released after a menu close).
      if ((typeof startOpensMenu !== 'undefined' && startOpensMenu) || window.startKeySuppressedUntilRelease) bits &= ~SNES_BIT_MASKS.Start;
      return bits;
    }
    window.gamepadJoypad = gamepadJoypad;

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
      setPillState('menu-val-start-menu', typeof startOpensMenu !== 'undefined' && startOpensMenu);
      setPillState('menu-val-click-walk', typeof clickToWalk !== 'undefined' && clickToWalk);
      setPillState('menu-val-game-features', typeof gameFeaturesEnabled !== 'undefined' && gameFeaturesEnabled);
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
        syncBindPageUi();
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
            if (bindPage === 'gamepad') userPadMap = Object.assign({}, DEFAULT_PAD_MAP);
            else userKeyMap = Object.assign({}, DEFAULT_KEY_MAP);
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
  