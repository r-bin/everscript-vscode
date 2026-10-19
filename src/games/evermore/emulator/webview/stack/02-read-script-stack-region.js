// TODO port to TS (docs/todo/port-to-ts.md)

    function readScriptStackRegion() {
      const m = getModule();
      if (!m) return { mode: 'connecting', bytes: null };

      // Preferred: custom debugger API (only available in custom-built core).
      if (hasDebuggerApi(m)) {
        return {
          mode: 'custom-debugger',
          bytes: m.readMemoryRange(SCRIPT_STACK_BUS_ADDR, SCRIPT_REGION_SIZE),
        };
      }

      // Fallback: read via save state.
      try {
        const size = m._getStateSaveSize();
        if (!size) return { mode: 'save-state-unavailable', bytes: null };
        const ptr  = m._saveState();
        if (!ptr)  return { mode: 'save-state-unavailable', bytes: null };
        // Copy bytes out of WASM heap before HEAPU8 might be reassigned.
        const copy = new Uint8Array(size);
        copy.set(new Uint8Array(HEAPU8.buffer, ptr, size));
        const wram = parseWramFromState(copy);
        if (!wram) return { mode: 'save-state-unavailable', bytes: null };
        return {
          mode: 'save-state',
          bytes: wram.subarray(SCRIPT_BASE, SCRIPT_BASE + SCRIPT_REGION_SIZE),
        };
      } catch (_) {
        return { mode: 'save-state-unavailable', bytes: null };
      }
    }

    function updateScriptStack(snapshot) {
      const tbody = document.getElementById('ss-tbody');
      if (!tbody) return;
      const focusSlot = snapshot.activeSlots.length
        ? snapshot.activeSlots[0].slot
        : (snapshot.liveSlots.length ? snapshot.liveSlots[0].slot : -1);

      let html = '';
      const displaySlots = snapshot.liveSlots.length
        ? snapshot.liveSlots
        : snapshot.slots.filter(s => s.loc !== 0 || s.entity !== 0);

      for (const { slot, loc, state, nextSlot, timer1, entity } of displaySlots) {
        const cls   = (state === 2 ? 'exec' : state === 4 ? 'wait' : 'dead') + (slot === focusSlot ? ' focus' : '');
        const sname = stateName(state);
        html += '<tr class="menu-pick ' + cls + '"><td>' + slot + '</td><td>' +
          fmtHex(loc, 6) + '</td><td>' + sname + '</td><td>' +
          (nextSlot >= 0 ? nextSlot : '--') + '</td><td>' +
          fmtHex(entity, 4) + '</td><td>' + timer1 + '</td></tr>';
      }
      if (!html) html = '<tr><td colspan="6" style="color:#555;text-align:center;padding:6px">no active scripts</td></tr>';
      tbody.innerHTML = html;
      if (typeof emuPanelRowsChanged === 'function') emuPanelRowsChanged('stack');

      const actLen = snapshot.activeSlots.length;
      const waitLen = snapshot.waitingSlots ? snapshot.waitingSlots.length : 0;
      if (actLen > 0 || waitLen > 0) {
        document.getElementById('ss-count').textContent =
          actLen + ' exec' + (waitLen ? ', ' + waitLen + ' wait' : '');
      } else {
        document.getElementById('ss-count').textContent = '0 active (idle)';
      }

      renderScriptDetail(snapshot);
    }

    function disarmScriptStackHook(m) {
      const wasArmed = scriptHookArmed || breakOnObservedHookWrites;
      if (m && typeof m.removeWriteBreakpoint === 'function')
        for (const addr of activeScriptWatchpoints) m.removeWriteBreakpoint(addr);
      activeScriptWatchpoints = [];
      previousScriptRegion = null;
      scriptHookArmed = false;
      breakOnObservedHookWrites = false;
      setText('ss-break-status', 'hook: off', 'ss-warn');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'arm stack hook';
      const allBtn = document.getElementById('ss-hook-all-btn');
      if (allBtn) allBtn.textContent = 'break all hooks';
      if (wasArmed) reportHookStatus('Script hook disarmed');
    }

    function armScriptStackHook(m) {
      if (!hasWriteBreakpointApi(m)) return false;
      disarmScriptStackHook(m);
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const base = SCRIPT_BASE + slot * SLOT_SIZE;
        for (const offset of SCRIPT_BREAK_WATCH_OFFSETS) activeScriptWatchpoints.push(base + offset);
      }
      for (const addr of activeScriptWatchpoints) m.addWriteBreakpoint(addr);
      scriptHookArmed = true;
      setText('ss-break-status', 'hook: armed (' + activeScriptWatchpoints.length + ')', 'ss-ok');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'disarm stack hook';
      reportHookStatus('Script hook armed with ' + activeScriptWatchpoints.length + ' WRAM offset watchpoints');
      return true;
    }

    function toggleBreakAllHooks() {
      breakOnObservedHookWrites = !breakOnObservedHookWrites;
      const btn = document.getElementById('ss-hook-all-btn');
      if (btn) btn.textContent = breakOnObservedHookWrites ? 'ignore hook writes' : 'break all hooks';
      setText('ss-break-status',
        breakOnObservedHookWrites ? 'hook: break on all observed writes' : (scriptHookArmed ? 'hook: armed (' + activeScriptWatchpoints.length + ')' : 'hook: off'),
        breakOnObservedHookWrites ? 'ss-bad' : (scriptHookArmed ? 'ss-ok' : 'ss-warn'));
      reportHookStatus(breakOnObservedHookWrites ? 'Break-all-hooks enabled' : 'Break-all-hooks disabled');
    }

    function traceHookActivity(region) {
      if (!scriptHookArmed || !region || region.length < SCRIPT_REGION_SIZE) {
        previousScriptRegion = region ? region.slice() : null;
        return;
      }
      if (!previousScriptRegion || previousScriptRegion.length !== region.length) {
        previousScriptRegion = region.slice();
        return;
      }
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const slotBase = slot * SLOT_SIZE;
        for (const offset of SCRIPT_BREAK_WATCH_OFFSETS) {
          const index = slotBase + offset;
          const before = previousScriptRegion[index];
          const after = region[index];
          if (before === after) continue;
          const addr = SCRIPT_BASE + slot * SLOT_SIZE + offset;
          const msg = 'Hook trace observed write @ 7E' + fmtHex(addr, 4) +
            ' slot=' + slot + ' off=0x' + fmtHex(offset, 2) +
            ' ' + fmtHex(before, 2) + '->' + fmtHex(after, 2);
          setText('ss-last-hit', 'last: ' + msg, breakOnObservedHookWrites ? 'ss-bad' : 'ss-warn');
          reportHookObserved(msg);
          if (breakOnObservedHookWrites) {
            const m = getModule();
            if (hasDebuggerApi(m)) m.pauseEmulation();
            setText('ss-pause-state', 'paused', 'ss-bad');
            reportHookBreak(msg + ' [paused by break-all-hooks]');
          }
          previousScriptRegion = region.slice();
          return;
        }
      }
      previousScriptRegion = region.slice();
    }

    const hookBtn = document.getElementById('ss-hook-btn');
    if (hookBtn) {
      hookBtn.addEventListener('click', () => {
        const m = getModule();
        if (!hasWriteBreakpointApi(m)) return;
        if (scriptHookArmed) disarmScriptStackHook(m);
        else armScriptStackHook(m);
      });
    }

    const hookAllBtn = document.getElementById('ss-hook-all-btn');
    if (hookAllBtn) {
      hookAllBtn.addEventListener('click', () => {
        const m = getModule();
        if (!hasDebuggerApi(m)) return;
        if (!scriptHookArmed && hasWriteBreakpointApi(m)) armScriptStackHook(m);
        toggleBreakAllHooks();
      });
    }

    const bpAddBtn = document.getElementById('ss-bp-add-btn');
    if (bpAddBtn) {
      bpAddBtn.addEventListener('click', () => {
        const input = document.getElementById('ss-bp-input');
        if (!input) return;
        if (addManualExecBreakpoint(input.value)) input.value = '';
        else setText('ss-last-hit', 'last: invalid script breakpoint address', 'ss-bad');
      });
    }

    const bpInput = document.getElementById('ss-bp-input');
    if (bpInput) {
      bpInput.addEventListener('keydown', (evt) => {
        if (evt.key !== 'Enter') return;
        evt.preventDefault();
        const addBtn = document.getElementById('ss-bp-add-btn');
        if (addBtn) addBtn.click();
      });
    }

    const bpList = document.getElementById('ss-bp-list');
    if (bpList) {
      bpList.addEventListener('click', (evt) => {
        const btn = evt.target && evt.target.closest ? evt.target.closest('[data-remove-exec-bp]') : null;
        if (!btn) return;
        const addr = parseInt(btn.getAttribute('data-remove-exec-bp') || '', 10);
        if (!Number.isFinite(addr)) return;
        removeManualExecBreakpoint(addr >>> 0);
      });
    }

  