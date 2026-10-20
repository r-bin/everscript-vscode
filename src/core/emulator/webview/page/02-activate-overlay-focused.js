// TODO port to TS (docs/todo/port-to-ts.md)

    function activateOverlayFocused() {
      if (overlayFocusCol === 1) {
        if (overlayCol1Idx === 2 || overlayCol1Idx === 3) {
          changeOverlayValue(1);
        } else if (overlayCol1Idx === 4) {
          handleClearRecentAction();
        }
        return;
      }
      launchSelectedRom();
    }

    let lastOverlayGamepadPoll = 0;
    function pollGamepadOverlay() {
      if (romLoaded) return;
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      let pad = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) { pad = gamepads[i]; break; }
      }
      if (!pad) return;

      const now = performance.now();
      if (now - lastOverlayGamepadPoll < 160) return;

      const dUp = (pad.buttons[12] && pad.buttons[12].pressed) || (pad.axes[1] && pad.axes[1] < -0.5);
      const dDown = (pad.buttons[13] && pad.buttons[13].pressed) || (pad.axes[1] && pad.axes[1] > 0.5);
      const dLeft = (pad.buttons[14] && pad.buttons[14].pressed) || (pad.axes[0] && pad.axes[0] < -0.5);
      const dRight = (pad.buttons[15] && pad.buttons[15].pressed) || (pad.axes[0] && pad.axes[0] > 0.5);
      const btnL = (pad.buttons[4] && pad.buttons[4].pressed);
      const btnR = (pad.buttons[5] && pad.buttons[5].pressed);
      const btnA = (pad.buttons[0] && pad.buttons[0].pressed);
      const btnB = (pad.buttons[1] && pad.buttons[1].pressed);
      const btnStart = (pad.buttons[9] && pad.buttons[9].pressed);

      if (btnStart) {
        lastOverlayGamepadPoll = now + 200;
        if (overlayFocusCol === 1 && overlayCol1Idx === 4 && clearRecentConfirming) {
          handleClearRecentAction();
        } else {
          launchSelectedRom();
        }
      } else if (btnL || btnR) {
        lastOverlayGamepadPoll = now;
        switchOverlayColumn();
      } else if (dUp || dDown) {
        lastOverlayGamepadPoll = now;
        moveOverlaySelection(dUp ? -1 : 1);
      } else if (dLeft || dRight) {
        lastOverlayGamepadPoll = now;
        if (overlayFocusCol === 1) {
          changeOverlayValue(dLeft ? -1 : 1);
        }
      } else if (btnA) {
        lastOverlayGamepadPoll = now + 160;
        activateOverlayFocused();
      } else if (btnB) {
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
      const statusEl = document.getElementById('load-status');
      if (statusEl) statusEl.textContent = 'Waiting for file picker...';
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
        if (vscodeApi) vscodeApi.postMessage(Object.assign({ command: 'loadVanillaRom' }, getLaunchOptions()));
        const statusEl = document.getElementById('load-status');
        if (statusEl) statusEl.textContent = 'Loading Vanilla ROM...';
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
      const statusEl = document.getElementById('load-status');
      if (statusEl) statusEl.textContent = 'Reading dropped ROM: ' + fileName + '...';

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
        startWithRom(dataUrl, fileName);
      };
      reader.onerror = function(err) {
        if (statusEl) statusEl.textContent = 'Failed to read dropped file: ' + (err && err.message || '');
      };
      reader.readAsDataURL(file);
    });

    if (currentOfferData) {
      renderRomOffer(currentOfferData);
    }

    window.addEventListener('load', () => {
      try { window.focus(); } catch (_) {}
      if (!romLoaded) {
        const targetIdx = overlayFocusCol === 0 ? overlayCol0Idx : overlayCol1Idx;
        setOverlayFocus(targetIdx, overlayFocusCol);
      }
    });

    window.addEventListener('message', evt => {
      if (evt.data.command === 'hostStatus') {
        const el = document.getElementById('load-status');
        if (!el) return;
        const level = evt.data.level || 'info';
        el.textContent = evt.data.text || '';
        el.style.color =
          level === 'error'
            ? '#ff8c8c'
            : (level === 'ok' ? '#7ad67a' : '#c8c8c8');
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
        currentIsolatedSram = !!evt.data.isolatedSram;
        if (evt.data.preset) applyLaunchPreset(evt.data.preset);
        startWithRom(evt.data.dataUrl, evt.data.name, evt.data.sramData);
      }
    });

    // -- Audio -----------------------------------------------------------------
    // ScriptProcessorNode reading directly from the core's exported Float32 planar
    // buffer. snes9x2005-wasm exposes 2048 samples for left followed by 2048 for right.
    const AUDIO_FREQ      = 44100;
    const AUDIO_BLOCK_SIZE = 2048;

    let audioCtx  = null;
    let audioNode = null;
    let audioResumeHandlersInstalled = false;

    function ensureAudioRunning() {
      if (!audioCtx || audioCtx.state === 'running') return;
      audioCtx.resume().catch(err => {
        vscodeApi.postMessage({ command: 'ejsError', error: 'Audio resume failed: ' + err.message });
      });
    }

    function installAudioResumeHandlers() {
      if (audioResumeHandlersInstalled) return;
      audioResumeHandlersInstalled = true;
      const wakeAudio = () => ensureAudioRunning();
      window.addEventListener('pointerdown', wakeAudio, { passive: true });
      window.addEventListener('keydown', wakeAudio, true);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') wakeAudio();
      });
    }

    function initAudio() {
      if (audioCtx) {
        ensureAudioRunning();
        return;
      }
      try {
        audioCtx  = new AudioContext({ sampleRate: AUDIO_FREQ });
        installAudioResumeHandlers();
        // ScriptProcessorNode is deprecated but reliable in VS Code WebViews
        // (AudioWorklet requires a Worker context that can be blocked by CSP).
        audioNode = audioCtx.createScriptProcessor(AUDIO_BLOCK_SIZE, 0, 2);
        audioNode.onaudioprocess = function(e) {
          const L = e.outputBuffer.getChannelData(0);
          const R = e.outputBuffer.getChannelData(1);
          const m = getModule();
          if (!romLoaded || emuMuted || !m || typeof m._getSoundBuffer !== 'function') {
            L.fill(0);
            R.fill(0);
            return;
          }
          try {
            const ptr = m._getSoundBuffer();
            if (!ptr) {
              L.fill(0);
              R.fill(0);
              return;
            }
            const samples = new Float32Array(HEAPF32.buffer, ptr, AUDIO_BLOCK_SIZE * 2);
            for (let i = 0; i < AUDIO_BLOCK_SIZE; i++) {
              L[i] = samples[i];
              R[i] = samples[i + AUDIO_BLOCK_SIZE];
            }
          } catch (_) {
            L.fill(0);
            R.fill(0);
          }
        };
        audioNode.connect(audioCtx.destination);
        ensureAudioRunning();
      } catch (err) {
        vscodeApi.postMessage({ command: 'ejsError', error: 'Audio init failed: ' + err.message });
      }
    }

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
