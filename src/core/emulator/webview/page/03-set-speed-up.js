// TODO port to TS (docs/todo/port-to-ts.md)

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

        // L / R Shoulder navigation to move focus between center and right column
        const keyL = (typeof userKeyMap !== 'undefined' && userKeyMap['L']) ? userKeyMap['L'] : 'a';
        const keyR = (typeof userKeyMap !== 'undefined' && userKeyMap['R']) ? userKeyMap['R'] : 's';
        const isL = k === 'q' || k === 'Q' || k === 'PageUp' || k === 'l' || k === 'L' || k === '[' || k.toLowerCase() === keyL.toLowerCase() || (typeof userKeyMap !== 'undefined' && e.code === userKeyMap['L']);
        const isR = k === 'e' || k === 'E' || k === 'PageDown' || k === 'r' || k === 'R' || k === ']' || k.toLowerCase() === keyR.toLowerCase() || (typeof userKeyMap !== 'undefined' && e.code === userKeyMap['R']);

        if (isL || isR || k === 'Tab') {
          switchOverlayColumn();
          e.preventDefault();
          return;
        }

        const keyUp = (typeof userKeyMap !== 'undefined' && userKeyMap['Up']) ? userKeyMap['Up'] : 'ArrowUp';
        const keyDown = (typeof userKeyMap !== 'undefined' && userKeyMap['Down']) ? userKeyMap['Down'] : 'ArrowDown';
        if (k === 'ArrowDown' || k.toLowerCase() === keyDown.toLowerCase()) {
          moveOverlaySelection(1);
          e.preventDefault();
          return;
        }
        if (k === 'ArrowUp' || k === 'w' || k === 'W' || k.toLowerCase() === keyUp.toLowerCase()) {
          moveOverlaySelection(-1);
          e.preventDefault();
          return;
        }

        const keyLeft = (typeof userKeyMap !== 'undefined' && userKeyMap['Left']) ? userKeyMap['Left'] : 'ArrowLeft';
        const keyRight = (typeof userKeyMap !== 'undefined' && userKeyMap['Right']) ? userKeyMap['Right'] : 'ArrowRight';
        if (k === 'ArrowLeft' || k.toLowerCase() === keyLeft.toLowerCase()) {
          if (overlayFocusCol === 1) changeOverlayValue(-1);
          else romSessionStepFocused(-1);
          e.preventDefault();
          return;
        }
        if (k === 'ArrowRight' || k.toLowerCase() === keyRight.toLowerCase()) {
          if (overlayFocusCol === 1) changeOverlayValue(1);
          else romSessionStepFocused(1);
          e.preventDefault();
          return;
        }
        // Start button (Enter or userKeyMap Start): launches the ROM selected in center
        const isStart = (k === 'Enter' || (typeof userKeyMap !== 'undefined' && userKeyMap['Start'] && k.toLowerCase() === userKeyMap['Start'].toLowerCase()));
        if (isStart) {
          window.startKeySuppressedUntilRelease = true;
          window.ignoreStartUntil = performance.now() + 600;
          if (overlayFocusCol === 1 && overlayCol1Idx === 5 && clearRecentConfirming) {
            handleClearRecentAction();
          } else {
            launchSelectedRom();
          }
          e.preventDefault();
          return;
        }

        // Action / Confirm button (c, C, Space, userKeyMap['B']): interacts / confirms focused item
        const keyB = (typeof userKeyMap !== 'undefined' && userKeyMap['B']) ? userKeyMap['B'] : 'c';
        const isActionB = (k === 'c' || k === 'C' || k === ' ' || k.toLowerCase() === keyB.toLowerCase() || (typeof userKeyMap !== 'undefined' && e.code === userKeyMap['B']));
        if (isActionB) {
          if (overlayFocusCol === 0) {
            launchSelectedRom();
          } else {
            if (overlayCol1Idx >= 2 && overlayCol1Idx <= 4) {
              changeOverlayValue(1);
            } else if (overlayCol1Idx === 5) {
              handleClearRecentAction();
            }
          }
          e.preventDefault();
          return;
        }

        // Cancel / Back button (v, V, Escape, userKeyMap['A']): cancels confirmation, never jumps columns
        const keyA = (typeof userKeyMap !== 'undefined' && userKeyMap['A']) ? userKeyMap['A'] : 'v';
        const isCancelA = (k === 'Escape' || k === 'v' || k === 'V' || k.toLowerCase() === keyA.toLowerCase() || (typeof userKeyMap !== 'undefined' && e.code === userKeyMap['A']));
        if (isCancelA) {
          if (overlayFocusCol === 1 && clearRecentConfirming) {
            cancelClearRecentConfirm();
          }
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
      const startKey = (typeof userKeyMap !== 'undefined' && userKeyMap['Start']) ? userKeyMap['Start'] : 'Enter';
      if (e.key === startKey || (startKey === 'Enter' && e.key === 'Enter')) {
        window.startKeySuppressedUntilRelease = false;
      }
      if (!romLoaded) return;
      if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
      const bit = (typeof dynamicKeyToBit !== 'undefined' && dynamicKeyToBit[e.key]) ? dynamicKeyToBit[e.key] : KEY_MAP[e.key];
      if (bit) keyInput &= ~bit;
    });
    // Focus left the panel (a debugger stop focuses the editor): the key-ups go
    // elsewhere, so release everything instead of holding e.g. Start forever.
    window.addEventListener('blur', () => { keyInput = 0; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) keyInput = 0; });

    function applyLaunchPreset(preset) {
      if (!preset || preset === 'default') return;
      if (preset === 'everscript') {
        if (typeof emuApplyPanels === 'function') {
          emuApplyPanels({ cdl: 'hidden', trace: 'bottom', stack: 'bottom', entities: 'hidden', alchemy: 'hidden', palettes: 'hidden' });
        }
        if (typeof setGameFeaturesEnabled === 'function') setGameFeaturesEnabled(true);
        if (typeof setExtendMap === 'function') setExtendMap(true);
        if (typeof setTriggersOverlay === 'function') setTriggersOverlay(true);
        if (typeof setObjectsOverlay === 'function') setObjectsOverlay(true);
        if (typeof setAnimTilesOverlay === 'function') setAnimTilesOverlay(false);
        if (typeof setCollisionOverlay === 'function') setCollisionOverlay(false);
        if (typeof setFogOfWar === 'function') setFogOfWar(false);
      } else if (preset === 'cdl') {
        if (typeof emuApplyPanels === 'function') {
          emuApplyPanels({ cdl: 'left', trace: 'hidden', stack: 'hidden', entities: 'hidden', alchemy: 'hidden', palettes: 'hidden' });
        }
        if (typeof setGameFeaturesEnabled === 'function') setGameFeaturesEnabled(false);
        if (typeof setExtendMap === 'function') setExtendMap(false);
        if (typeof setTriggersOverlay === 'function') setTriggersOverlay(false);
        if (typeof setObjectsOverlay === 'function') setObjectsOverlay(false);
        if (typeof setAnimTilesOverlay === 'function') setAnimTilesOverlay(false);
        if (typeof setCollisionOverlay === 'function') setCollisionOverlay(false);
        if (typeof setFogOfWar === 'function') setFogOfWar(false);
        if (typeof setThinHpBar === 'function') setThinHpBar(false);
        if (typeof setThinStaminaBar === 'function') setThinStaminaBar(false);
      } else if (preset === 'clean') {
        if (typeof emuApplyPanels === 'function') {
          emuApplyPanels({ cdl: 'hidden', trace: 'hidden', stack: 'hidden', entities: 'hidden', alchemy: 'hidden', palettes: 'hidden' });
        }
        if (typeof setExtendMap === 'function') setExtendMap(false);
        if (typeof setTriggersOverlay === 'function') setTriggersOverlay(false);
        if (typeof setObjectsOverlay === 'function') setObjectsOverlay(false);
        if (typeof setAnimTilesOverlay === 'function') setAnimTilesOverlay(false);
        if (typeof setCollisionOverlay === 'function') setCollisionOverlay(false);
        if (typeof setFogOfWar === 'function') setFogOfWar(false);
        if (typeof setThinHpBar === 'function') setThinHpBar(false);
        if (typeof setThinStaminaBar === 'function') setThinStaminaBar(false);
      }
    }

    function getSramBytes() {
      try {
        const heap = (typeof HEAPU8 !== 'undefined' ? HEAPU8 : (typeof Module !== 'undefined' && Module.HEAP8 ? new Uint8Array(Module.HEAP8.buffer) : null));
        if (!heap) return null;
        if (typeof Module._saveSramRequest === 'function' && typeof Module._getSaveSramSize === 'function' && typeof Module._getSaveSram === 'function') {
          Module._saveSramRequest();
          const sz = Module._getSaveSramSize();
          const ptr = Module._getSaveSram();
          if (sz && ptr) return new Uint8Array(heap.subarray(ptr, ptr + sz));
        }
        if (typeof Module._getSpacePtr === 'function' && typeof Module._getSpaceSize === 'function') {
          const sz = Module._getSpaceSize(3);
          const ptr = Module._getSpacePtr(3);
          if (sz && ptr) return new Uint8Array(heap.subarray(ptr, ptr + sz));
        }
      } catch (_) {}
      return null;
    }

    function putSramBytes(bytes) {
      if (!bytes || !bytes.length) return;
      try {
        const heap = (typeof HEAPU8 !== 'undefined' ? HEAPU8 : (typeof Module !== 'undefined' && Module.HEAP8 ? new Uint8Array(Module.HEAP8.buffer) : null));
        if (!heap) return;
        if (typeof Module._getSpacePtr === 'function') {
          const sramPtr = Module._getSpacePtr(3);
          const maxSz = typeof Module._getSpaceSize === 'function' ? Module._getSpaceSize(3) : 0x20000;
          if (sramPtr && bytes.length <= maxSz) {
            heap.set(bytes, sramPtr);
          }
        }
        if (typeof Module._loadSram === 'function' && typeof Module._my_malloc === 'function') {
          const ptr = Module._my_malloc(bytes.length);
          heap.set(bytes, ptr);
          Module._loadSram(bytes.length, ptr);
          if (typeof Module._my_free === 'function') Module._my_free(ptr);
        }
      } catch (_) {}
    }

    function persistSramIfNeeded() {
      if (currentIsolatedSram || !romLoaded || !currentRomSha1 || (typeof tasPlay !== 'undefined' && tasPlay) || (typeof tasPendingMovie !== 'undefined' && tasPendingMovie)) return;
      const sram = getSramBytes();
      if (!sram || !sram.length) return;
      let b64 = '';
      for (let i = 0; i < sram.length; i++) b64 += String.fromCharCode(sram[i]);
      b64 = btoa(b64);
      if (b64 !== lastSavedSramB64) {
        lastSavedSramB64 = b64;
        if (vscodeApi) vscodeApi.postMessage({ command: 'saveSram', hash: currentRomSha1, data: b64 });
      }
    }
    setInterval(persistSramIfNeeded, 1000);
    window.addEventListener('beforeunload', persistSramIfNeeded);
    window.addEventListener('pagehide', persistSramIfNeeded);

    // -- ROM loading -----------------------------------------------------------
    // (ROM state is declared at boot, above romStage: the ROM offer and crash
    // reporting read it before this point, and a let read early throws.)

    function startWithRom(dataUrl, name, sramData) {
      try {
        romStage('decode begin: ' + (name || 'game'));
        const comma   = dataUrl.indexOf(',');
        const binStr  = atob(dataUrl.slice(comma + 1));
        const romData = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) romData[i] = binStr.charCodeAt(i);
        romStage('decode complete: ' + romData.length + ' bytes');
        bootRom(romData, name, sramData);
      } catch (e) {
        romStage('launch failed: ' + e.message);
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
      }
    }

    // (Re)start the core with a ROM: a power-on, also used to start a replay.
    function bootRom(romData, name, sramData) {
      try {
        persistSramIfNeeded();
        if (typeof gameRomReset === 'function') gameRomReset();
        if (typeof emuGateRom === 'function') emuGateRom(romData);
        romStage('core start begin');
        cdlBeforeRomChange();
        tasSnapshot();   // the session ends here: keep where it stood, so it can be continued
        tasFlush();
        const ptr = Module._my_malloc(romData.length);
        HEAPU8.set(romData, ptr);
        Module._startWithRom(ptr, romData.length, AUDIO_FREQ);
        Module._my_free(ptr);

        const isReplay = !!(typeof tasPendingMovie !== 'undefined' && tasPendingMovie);
        const shouldApplySram = sramData && (!currentIsolatedSram || isReplay);
        if (shouldApplySram) {
          try {
            const bin = atob(sramData);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            putSramBytes(u8);
            lastStartingSramB64 = sramData;
            lastSavedSramB64 = sramData;
          } catch (_) {
            lastStartingSramB64 = '';
            lastSavedSramB64 = '';
          }
        } else {
          lastStartingSramB64 = '';
          lastSavedSramB64 = '';
        }

        if (typeof sdbgOnBoot === 'function') sdbgOnBoot();
        romStage('core start complete');

        romLoaded = true;
        window.startKeySuppressedUntilRelease = true;
        window.ignoreStartUntil = performance.now() + 600;
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
      }
    }
