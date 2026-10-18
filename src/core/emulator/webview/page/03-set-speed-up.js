
    function setSpeedUp(on) {
      setSpeedMultiplier(on ? 4.0 : 1.0);
    }
    document.addEventListener('keydown', e => {
      if (e.key === '#' && !e.repeat) {
        const tag = e.target && e.target.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setSpeedUp(!speedUp);
          e.preventDefault();
          return;
        }
      }
      if (!romLoaded) {
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const k = e.key;
        if (k === 'ArrowDown' || k === 's' || k === 'S') {
          const items = getOverlayFocusables();
          if (items.length) {
            const next = overlayFocusedIdx < 0 ? 0 : (overlayFocusedIdx + 1) % items.length;
            setOverlayFocus(next);
            e.preventDefault();
          }
          return;
        }
        if (k === 'ArrowUp' || k === 'w' || k === 'W') {
          const items = getOverlayFocusables();
          if (items.length) {
            const next = overlayFocusedIdx < 0 ? 0 : (overlayFocusedIdx - 1 + items.length) % items.length;
            setOverlayFocus(next);
            e.preventDefault();
          }
          return;
        }
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
          if (overlayFocusedIdx === 1) { setOverlayFocus(0); e.preventDefault(); return; }
        }
        if (k === 'ArrowRight' || k === 'd' || k === 'D') {
          if (overlayFocusedIdx === 0) { setOverlayFocus(1); e.preventDefault(); return; }
        }
        if (k === 'Enter' || k === ' ' || k === 'v' || k === 'V') {
          if (overlayFocusedIdx >= 0) {
            activateOverlayFocused();
            e.preventDefault();
          } else {
            setOverlayFocus(0);
            e.preventDefault();
          }
          return;
        }
        if (k === 'Escape' || k === 'c' || k === 'C' || k === 'b' || k === 'B') {
          const items = getOverlayFocusables();
          items.forEach(el => el.classList.remove('keyboard-focused'));
          overlayFocusedIdx = -1;
          e.preventDefault();
          return;
        }
        return;
      }
      if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
      if (e.repeat) return;
      const bit = (typeof dynamicKeyToBit !== 'undefined' && dynamicKeyToBit[e.key]) ? dynamicKeyToBit[e.key] : KEY_MAP[e.key];
      if (bit) { keyInput |= bit; e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      if (!romLoaded) return;
      if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
      const bit = (typeof dynamicKeyToBit !== 'undefined' && dynamicKeyToBit[e.key]) ? dynamicKeyToBit[e.key] : KEY_MAP[e.key];
      if (bit) keyInput &= ~bit;
    });
    // Focus left the panel (a debugger stop focuses the editor): the key-ups go
    // elsewhere, so release everything instead of holding e.g. Start forever.
    window.addEventListener('blur', () => { keyInput = 0; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) keyInput = 0; });

    // -- ROM loading -----------------------------------------------------------
    // (ROM state is declared at boot, above romStage: the ROM offer and crash
    // reporting read it before this point, and a let read early throws.)

    function startWithRom(dataUrl, name) {
      try {
        romStage('decode begin: ' + (name || 'game'));
        const comma   = dataUrl.indexOf(',');
        const binStr  = atob(dataUrl.slice(comma + 1));
        const romData = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) romData[i] = binStr.charCodeAt(i);
        romStage('decode complete: ' + romData.length + ' bytes');
        bootRom(romData, name);
      } catch (e) {
        romStage('launch failed: ' + e.message);
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
        document.getElementById('load-status').textContent = 'Error: ' + e.message;
      }
    }

    // (Re)start the core with a ROM: a power-on, also used to start a replay.
    function bootRom(romData, name) {
      try {
        if (typeof gameRomReset === 'function') gameRomReset();
        if (typeof emuGateRom === 'function') emuGateRom(romData);
        romStage('core start begin');
        cdlBeforeRomChange();
        tasFlush();
        const ptr = Module._my_malloc(romData.length);
        HEAPU8.set(romData, ptr);
        Module._startWithRom(ptr, romData.length, AUDIO_FREQ);
        Module._my_free(ptr);
        if (typeof sdbgOnBoot === 'function') sdbgOnBoot();
        romStage('core start complete');

        romLoaded = true;
        loadedRomData = romData;
        loadedRomName = name || 'game';
        if (typeof gameTraceReset === 'function') gameTraceReset();
        romLaunchTimestamp = performance.now();
        romFrameCount = 0;
        initAudio();
        ensureAudioRunning();
        document.getElementById('overlay').style.display = 'none';
        if (typeof emuPanelsLayout === 'function') emuPanelsLayout();
        window.dispatchEvent(new Event('resize'));
        if (emuScriptHook) startWramPolling();
        if (emuGameRom) vscodeApi.postMessage({ command: 'requestGameRomData' });
        vscodeApi.postMessage({ command: 'gameStarted', name: name || 'game' });
        tasOnBoot(name);
        romStage('launch success: ' + (name || 'game'));
      } catch (e) {
        romStage('launch failed: ' + e.message);
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
        document.getElementById('load-status').textContent = 'Error: ' + e.message;
      }
    }
