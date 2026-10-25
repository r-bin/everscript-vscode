// TODO port to TS (docs/todo/port-to-ts.md)

    function activateOverlayFocused() {
      if (overlayFocusCol === 1) {
        if (overlayCol1Idx >= 2 && overlayCol1Idx <= 4) {
          changeOverlayValue(1);
        } else if (overlayCol1Idx === 5) {
          handleClearRecentAction();
        }
        return;
      }
      launchSelectedRom();
    }

    let lastOverlayGamepadPoll = 0;
    function pollGamepadOverlay() {
      if (romLoaded) return;
      // Every connected pad, through the CONTROLS tab's bindings (menu/03-last-gamepad-buttons.js).
      const pads = EmuPad.connectedPads(navigator);
      if (!pads.length) return;

      const now = performance.now();
      if (now - lastOverlayGamepadPoll < 160) return;

      const bits = padSnesBits(pads);
      const M = SNES_BIT_MASKS;
      const dUp = bits & M.Up, dDown = bits & M.Down, dLeft = bits & M.Left, dRight = bits & M.Right;
      const btnL = bits & M.L, btnR = bits & M.R;
      const btnB = bits & M.B; // SNES B = Confirm / Interact
      const btnA = bits & M.A; // SNES A = Cancel / Back
      const btnStart = bits & M.Start;

      if (btnStart) {
        lastOverlayGamepadPoll = now + 200;
        window.startKeySuppressedUntilRelease = true;
        window.ignoreStartUntil = performance.now() + 600;
        if (overlayFocusCol === 1 && overlayCol1Idx === 5 && clearRecentConfirming) {
          handleClearRecentAction();
        } else {
          launchSelectedRom();
        }
      } else if (btnL || btnR) {
        lastOverlayGamepadPoll = now;
        moveOverlayColumn(btnL ? -1 : 1);
      } else if (dUp || dDown) {
        lastOverlayGamepadPoll = now;
        moveOverlaySelection(dUp ? -1 : 1);
      } else if (dLeft || dRight) {
        lastOverlayGamepadPoll = now;
        if (overlayFocusCol === 1) {
          changeOverlayValue(dLeft ? -1 : 1);
        } else {
          romSessionStepFocused(dLeft ? -1 : 1);
        }
      } else if (btnB) {
        lastOverlayGamepadPoll = now + 160;
        activateOverlayFocused();
      } else if (btnA) {
        lastOverlayGamepadPoll = now + 160;
        if (overlayFocusCol === 1 && clearRecentConfirming) {
          cancelClearRecentConfirm();
        }
      }
    }

    function triggerPickRom() {
      try { initAudio(); } catch (_) {}
      try { ensureAudioRunning(); } catch (_) {}
      if (vscodeApi) vscodeApi.postMessage(Object.assign({ command: 'pickRom' }, getLaunchOptions()));
    }

    const pickBtn = document.getElementById('pickBtn');
    if (pickBtn) pickBtn.addEventListener('click', triggerPickRom);

    const dropZone = document.getElementById('rom-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('click', triggerPickRom);
      dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerPickRom();
        }
      });
    }

    const vanillaBtn = document.getElementById('vanillaBtn');
    if (vanillaBtn) {
      vanillaBtn.addEventListener('click', () => {
        if (vanillaBtn.disabled) return;
        try { initAudio(); } catch (_) {}
        try { ensureAudioRunning(); } catch (_) {}
        // "Open ROM: Continue" continues the base ROM's newest session too.
        const v = currentOfferData && currentOfferData.vanilla;
        const resume = openMode === 'continue' && v && v.sessions && v.sessions.length ? v.sessions[0].id : '';
        if (vscodeApi) vscodeApi.postMessage(Object.assign({ command: 'loadVanillaRom', resume: resume }, getLaunchOptions()));
      });
    }

    function isFileTransfer(evt) {
      return evt.dataTransfer && Array.from(evt.dataTransfer.types || []).includes('Files');
    }

    window.addEventListener('dragenter', evt => {
      if (isFileTransfer(evt)) {
        evt.preventDefault();
        document.body.classList.add('window-drag-active');
        if (dropZone) dropZone.classList.add('drag-active');
      }
    });

    window.addEventListener('dragover', evt => {
      if (isFileTransfer(evt)) {
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('dragleave', evt => {
      if (evt.clientX <= 0 || evt.clientY <= 0 || evt.clientX >= window.innerWidth || evt.clientY >= window.innerHeight) {
        document.body.classList.remove('window-drag-active');
        if (dropZone) dropZone.classList.remove('drag-active');
      }
    });

    window.addEventListener('drop', evt => {
      document.body.classList.remove('window-drag-active');
      if (dropZone) dropZone.classList.remove('drag-active');

      if (!evt.dataTransfer || !evt.dataTransfer.files || !evt.dataTransfer.files.length) return;
      evt.preventDefault();
      evt.stopPropagation();

      const file = evt.dataTransfer.files[0];
      const fileName = file.name || 'game.sfc';
      const filePath = file.path || '';

      try { initAudio(); } catch (_) {}
      try { ensureAudioRunning(); } catch (_) {}

      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        vscodeApi.postMessage(Object.assign({
          command: 'romDropped',
          name: fileName,
          path: filePath,
          dataUrl: dataUrl,
          size: file.size,
        }, getLaunchOptions()));
      };
      reader.onerror = function(err) {
        console.error('[EVS] Failed to read dropped file:', err);
      };
      reader.readAsDataURL(file);
    });

    if (currentOfferData) {
      renderRomOffer(currentOfferData);
    }

    window.addEventListener('load', () => {
      try { window.focus(); } catch (_) {}
      if (!romLoaded) {
        const items0 = getOverlayCol0Focusables();
        overlayCol0Idx = getInitialCol0Index(items0);
        overlayFocusCol = 0;
        setOverlayFocus(overlayCol0Idx, overlayFocusCol);
      }
    });

    window.addEventListener('message', evt => {
      if (evt.data.command === 'hostStatus') {
        return;
      }
      if (evt.data.command === 'romOfferInfo') {
        renderRomOffer(evt.data.data);
        return;
      }
      if (evt.data.command === 'loadRom') {
        if (evt.data.gameData && typeof gameRomData === 'function') gameRomData(evt.data.gameData, false);
        if (evt.data.scriptDebug && typeof sdbgConfigure === 'function') sdbgConfigure(evt.data.scriptDebug);
        romStage('loadRom received: ' + (evt.data.name || 'game'));
        currentRomSha1 = evt.data.romSha1 || '';
        currentSramMode = evt.data.sramMode || (evt.data.isolatedSram ? 'individual' : 'default');
        currentIsolatedSram = currentSramMode === 'individual';
        if (evt.data.preset) applyLaunchPreset(evt.data.preset);
        startWithRom(evt.data.dataUrl, evt.data.name, evt.data.sramData);
      }
    });

    // -- Input -----------------------------------------------------------------
    var isLensModeActive = false;
    var zoomLevel = 1.0;
    var panX = 0;
    var panY = 0;
    var updateScreenLayout = function() {};
    var zoomAt = function() {};
    var resetZoom = function() {};
    const KEY_MAP = {
      'ArrowRight': 1 << 8,  'ArrowLeft': 1 << 9,
      'ArrowDown':  1 << 10, 'ArrowUp':   1 << 11,
      'Enter':      1 << 12, ' ':         1 << 13,
      'v': 1 << 7,  'V': 1 << 7,   // A
      'c': 1 << 15, 'C': 1 << 15,  // B
      'd': 1 << 6,  'D': 1 << 6,   // X
      'x': 1 << 14, 'X': 1 << 14,  // Y
      'a': 1 << 5,  'A': 1 << 5,   // L
      's': 1 << 4,  'S': 1 << 4,   // R
    };
    let keyInput = 0;
    // Speed multipliers: 1/4x, 1/2x, 1x, 2x, 4x
    const SPEED_FACTORS = [0.25, 0.5, 1.0, 2.0, 4.0];
    const SPEED_LABELS = ['1/4x', '1/2x', '1x', '2x', '4x'];
    let speedIndex = 2; // default: 1x
    let speedMultiplier = 1.0;
    let speedAccumulator = 0;
    let speedUp = false;

    function setSpeedMultiplier(val) {
      if (typeof val === 'number') {
        speedMultiplier = val;
        const found = SPEED_FACTORS.indexOf(val);
        if (found !== -1) speedIndex = found;
      }
      speedUp = (speedMultiplier > 1.0);
      const chip = document.getElementById('screen-speed-chip');
      if (chip) {
        chip.textContent = 'SPEED ' + SPEED_LABELS[speedIndex];
        chip.classList.toggle('active', speedMultiplier !== 1.0);
      }
      const menuVal = document.getElementById('menu-val-speed');
      if (menuVal) {
        menuVal.textContent = SPEED_LABELS[speedIndex];
      }
    }
