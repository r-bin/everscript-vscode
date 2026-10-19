// TODO port to TS (docs/todo/port-to-ts.md)

    // Where the screen sits (set by the game's renderer each frame; read by the CDL float and the clicks).
    let lastLayout = null;
    //@@game_overlaysScript

    // -- WRAM / Script stack ---------------------------------------------------
    //@@game_stackScript

    let lastDebugStatus = '';
    const RAM_TAG                  = [82, 65, 77, 32]; // "RAM "
    const WRAM_SIZE                = 0x20000;


    function readU16(w, off) { return (w[off] | (w[off + 1] << 8)) >>> 0; }
    function readU24(w, off) { return (w[off] | (w[off + 1] << 8) | (w[off + 2] << 16)) >>> 0; }
    function fmtHex(v, w)    { return (v >>> 0).toString(16).toUpperCase().padStart(w, '0'); }
    function fmtBreakpointAddr(v) {
      const raw = (v >>> 0);
      return raw > 0xFFFF ? fmtHex(raw, 6) : '7E' + fmtHex(raw, 4);
    }

    function setText(id, text, cls) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className   = cls || '';
    }

    function setControlEnabled(id, enabled) {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    }

    // Module is always window.Module (set by the Emscripten core script).
    let emulatorPausedState = false;
    function isEmulatorPaused() {
      const m = window.Module;
      return !!(m && typeof m.isEmulationPaused === 'function' && m.isEmulationPaused());
    }

    function getModule() {
      return window.Module && typeof Module._mainLoop === 'function' ? window.Module : null;
    }

    function hasDebuggerApi(m) {
      return !!m &&
        typeof m.getCPUState     === 'function' &&
        typeof m.readMemoryRange === 'function' &&
        typeof m.pauseEmulation  === 'function' &&
        typeof m.resumeEmulation === 'function';
    }

    function hasWriteBreakpointApi(m) {
      return hasDebuggerApi(m) &&
        typeof m.addWriteBreakpoint    === 'function' &&
        typeof m.removeWriteBreakpoint === 'function';
    }

    function reportDebugStatus(text) {
      if (text === lastDebugStatus) return;
      lastDebugStatus = text;
      vscodeApi.postMessage({ command: 'debugApiStatus', text });
    }

    function reportHookStatus(text) {
      vscodeApi.postMessage({ command: 'debugHookStatus', text });
    }

    function reportHookObserved(text) {
      vscodeApi.postMessage({ command: 'debugHookObserved', text });
    }

    function reportHookBreak(text) {
      vscodeApi.postMessage({ command: 'debugHookBreak', text });
    }

    /** Scan a snes9x save-state blob for the 128 KB WRAM block ("RAM " tag). */
    function parseWramFromState(raw) {
      const d = (raw instanceof Uint8Array) ? raw : new Uint8Array(raw);
      const limit = d.length - 8 - WRAM_SIZE;
      for (let i = 0; i < limit; i++) {
        if (d[i]   === RAM_TAG[0] && d[i+1] === RAM_TAG[1] &&
            d[i+2] === RAM_TAG[2] && d[i+3] === RAM_TAG[3]) {
          const sizeBE = ((d[i+4] << 24) | (d[i+5] << 16) | (d[i+6] << 8) | d[i+7]) >>> 0;
          const sizeLE = (d[i+4] | (d[i+5] << 8) | (d[i+6] << 16) | (d[i+7] << 24)) >>> 0;
          if (sizeBE === WRAM_SIZE || sizeLE === WRAM_SIZE) {
            return d.subarray(i + 8, i + 8 + WRAM_SIZE);
          }
        }
      }
      return null;
    }

    /** Read script-stack region bytes via custom debugger API or save-state fallback. */
    function installDebuggerBridge(m) {
      if (!hasDebuggerApi(m) || m.__everscriptBridgeInstalled) return;
      m.__everscriptBridgeInstalled = true;
      reportHookStatus('Debugger bridge installed; waiting for breakpoint events');
      m.onBreakpointHit = function(event) {
        // The VS Code script debugger's interpreter hook decides for itself (false = keep running).
        if (event.type === 'exec' && typeof sdbgOnHit === 'function' && event.address === SDBG_DISPATCH && sdbg.armed) return sdbgOnHit(m);
        // Who sent a sound effect (sound-source-view.ts): record, keep running.
        if (event.type === 'exec' && typeof sndOnHit === 'function' && event.address === SND_SEND && sndArmed) return sndOnHit(m);
        const addrText = event.type === 'write'
          ? '7E' + fmtHex(event.address, 4)
          : fmtBreakpointAddr(event.address);
        const details = event.type === 'write' ? ' value ' + fmtHex(event.value || 0, 2) : '';
        setText('ss-last-hit', 'last: ' + event.type + ' @ ' + addrText + details + ' pc ' + fmtHex(event.pc, 6), 'ss-bad');
        setText('ss-pause-state', 'paused', 'ss-bad');
        vscodeApi.postMessage({ command: 'debugBreakpointHit',
          type: event.type, address: addrText, pc: fmtHex(event.pc, 6) });
      };
    }

    function refreshDebuggerUi(m, sourceMode) {
      const customApi = hasDebuggerApi(m);
      const writeApi  = hasWriteBreakpointApi(m);
      if (customApi) {
        const cpu = m.getCPUState();
        setText('ss-api-status', 'api: custom debugger', 'ss-ok');
        setText('ss-cpu-status',
          'pc: ' + fmtHex(cpu.pc, 6) + ' pb:' + fmtHex(cpu.pb, 2) + ' a:' + fmtHex(cpu.a, 4), 'ss-ok');
        reportDebugStatus('Custom debugger API active (' + sourceMode + ')');
      } else {
        const label = sourceMode === 'save-state'      ? 'save-state fallback'
                    : sourceMode === 'connecting'       ? 'connecting...'
                    :                                     'unavailable';
        setText('ss-api-status', 'api: ' + label, sourceMode === 'save-state' ? 'ss-warn' : '');
        setText('ss-cpu-status', 'pc: ------');
        reportDebugStatus(sourceMode === 'save-state'
          ? 'Using save-state fallback for script stack'
          : 'Custom debugger API not available in this build');
      }
      setControlEnabled('ss-hook-btn',   writeApi);
      setControlEnabled('ss-hook-all-btn', customApi);
      setControlEnabled('ss-bp-add-btn', customApi);
      const bpInput = document.getElementById('ss-bp-input');
      if (bpInput) bpInput.disabled = !customApi;
      if (typeof updateExecBreakpointStatus === 'function') updateExecBreakpointStatus(customApi);
      if (!writeApi && typeof disarmScriptStackHook === 'function') {
        disarmScriptStackHook(m);
        setText('ss-break-status', 'hook: unavailable', 'ss-warn');
      }
    }

    /** Start the WRAM polling cycle (called on every boot; one timer per webview). */
    let wramPollTimer = null;
    function startWramPolling() {
      document.getElementById('ss-count').textContent = 'connecting...';
      if (wramPollTimer) return;

      let polledWhilePaused = false;
      function pollOnce() {
        try {
          const m = getModule();
          if (!m) return;
          installDebuggerBridge(m);
          // Paused: one last refresh shows the frozen state, then nothing changes until resume.
          if (isEmulatorPaused()) {
            if (polledWhilePaused) return;
            polledWhilePaused = true;
          } else {
            polledWhilePaused = false;
          }
          // The game's script VM (Evermore: stack-view.ts); without one only the debugger status updates.
          const src = typeof readScriptStackRegion === 'function' ? readScriptStackRegion() : { mode: hasDebuggerApi(m) ? 'debugger' : 'unavailable', bytes: null };
          refreshDebuggerUi(m, src.mode);
          if (src.bytes) {
            traceHookActivity(src.bytes);
            const snapshot = buildScriptSnapshot(src.bytes);
            updateScriptStack(snapshot);
            reportScriptFocus(snapshot);
            checkManualScriptBreakpoints(snapshot, m);
            checkScriptExecutionTrace();
            if (!tasReplaying() && typeof maintainCheats === 'function') maintainCheats(m);
            if (typeof refreshActiveBottomTab === 'function') refreshActiveBottomTab();
          } else {
            document.getElementById('ss-count').textContent =
              src.mode === 'connecting' ? 'connecting...' : 'unavailable';
          }
        } catch (_) { /* silently skip on error */ }
      }

      wramPollTimer = setInterval(pollOnce, 250);
    }

    const debugLinkBtn = document.getElementById('ss-debug-link-btn');
    if (debugLinkBtn) {
      debugLinkBtn.addEventListener('click', () => {
        vscodeApi.postMessage({ command: 'connectDebugger' });
      });
    }

    const toggleStackBtn = document.getElementById('ss-toggle-btn');
    if (toggleStackBtn) {
      toggleStackBtn.addEventListener('click', () => {
        const stack = document.getElementById('script-stack');
        if (!stack) return;
        stack.classList.toggle('collapsed');
        const isCollapsed = stack.classList.contains('collapsed');
        toggleStackBtn.textContent = isCollapsed ? 'show panel' : 'hide panel';
        window.dispatchEvent(new Event('resize'));
      });
    }

    //@@game_overlayTogglesScript

    // Keep the focus on the emulator when the VS Code debugger stops (the host re-reveals the panel).
    // Also keeps Tab in the emulator (emulator-profile.js).
    let keepFocusOnBreak = false;
    // save: a change by the user, kept by the host (not when the host sends the saved value).
    function setKeepFocusChip(on, save) {
      keepFocusOnBreak = !!on;
      const chip = document.getElementById('screen-focus-chip');
      if (chip) {
        chip.textContent = keepFocusOnBreak ? 'KEEP FOCUS ON' : 'KEEP FOCUS OFF';
        chip.classList.toggle('active', keepFocusOnBreak);
      }
      if (save) vscodeApi.postMessage({ command: 'setKeepFocusOnBreak', on: keepFocusOnBreak });
    }
    const focusChip = document.getElementById('screen-focus-chip');
    if (focusChip) {
      focusChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setKeepFocusChip(!keepFocusOnBreak, true);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    const speedChip = document.getElementById('screen-speed-chip');
    if (speedChip) {
      speedChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setSpeedUp(!speedUp);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    const menuBtn = document.getElementById('screen-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openEmulatorMenu === 'function') openEmulatorMenu();
      });
    }

    //@@game_clientScript

    //@@CdlFloatScript

    //@@CdlClientScript

    //@@CdlStripsScript

    //@@TasClientScript

    //@@game_scriptDebugScript

    //@@MemoryBridgeClientScript

    //@@game_soundSourceScript
    //@@ApuStreamClientScript

    //@@FpsClientScript

    //@@MenuClientScript

    const resizer = document.getElementById('ss-resizer');
    if (resizer) {
      let isDragging = false;
      let startY = 0;
      let startH = 0;
      resizer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        const stackEl = document.getElementById('script-stack');
        startH = stackEl ? stackEl.getBoundingClientRect().height : 260;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = startY - e.clientY;
        const newH = Math.max(80, Math.min(window.innerHeight - 100, startH + delta));
        const stackEl = document.getElementById('script-stack');
        if (stackEl) stackEl.style.height = newH + 'px';
        window.dispatchEvent(new Event('resize'));
      });
      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }

    function escH(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    //@@game_traceScript

    window.addEventListener('message', evt => {
      if (!evt.data) return;
      if (handleCdlMessage(evt.data)) return;
      if (handleTasMessage(evt.data)) return;
      if (typeof sdbgHandleMessage === 'function' && sdbgHandleMessage(evt.data)) return;
      if (evt.data.command === 'keepFocusOnBreak') { setKeepFocusChip(evt.data.on); return; }
      if (evt.data.command === 'focusScreen') {
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
        return;
      }
      if (evt.data.command === 'debuggerConnectionStatus') {
        setText('ss-debug-link-status', 'dbg: ' + evt.data.text, evt.data.ok ? 'ss-ok' : 'ss-warn');
      } else if (evt.data.command === 'scriptTraceLogged') {
        if (typeof appendTraceEntries === 'function') appendTraceEntries(evt.data.entries);
      } else if (evt.data.command === 'roomMapRendered') {
        if (typeof gameOnRoomMap === 'function') gameOnRoomMap(evt.data);
      } else if (evt.data.command === 'idleSprites') {
        const got = evt.data.sprites || {};
        if (typeof idleSprites !== 'undefined') for (const k in got) idleSprites.set(k, got[k]);
      } else if (evt.data.command === 'injectEverscript') {
        if (typeof injectEverscript === 'function') injectEverscript(evt.data.code);
      } else if (evt.data.command === 'gameRomData') {
        if (evt.data.data && typeof gameRomData === 'function') gameRomData(evt.data.data, true);
      }
    });

    if (typeof renderManualExecBreakpoints === 'function') renderManualExecBreakpoints();
    initCdlTab();