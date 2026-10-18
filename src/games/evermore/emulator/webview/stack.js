
    const SCRIPT_BASE              = 0x28FC;
    const SLOT_SIZE                = 0x4F;
    const SLOT_COUNT               = 20;
    const SCRIPT_REGION_SIZE       = SLOT_SIZE * SLOT_COUNT;
    const SCRIPT_STACK_BUS_ADDR    = 0x7E0000 + SCRIPT_BASE;
    const SCRIPT_ARG_OFFSET        = 0x0F;
    const SCRIPT_ARG_BYTES         = 0x20;
    const SCRIPT_BREAK_WATCH_OFFSETS = [0x00, 0x03, 0x0D];

    let scriptHookArmed         = false;
    let breakOnObservedHookWrites = false;
    let activeScriptWatchpoints = [];
    let previousScriptRegion    = null;
    let manualScriptBreakpoints = [];
    let lastFocusedScriptLoc    = '';
    let lastTriggeredScriptLoc  = 0;

    function slotPtrToIndex(ptr) {
      const raw = ptr >>> 0;
      const delta = raw - SCRIPT_BASE;
      if (!raw || delta < 0 || delta >= SCRIPT_REGION_SIZE || (delta % SLOT_SIZE) !== 0) return -1;
      return delta / SLOT_SIZE;
    }

    function stateName(state) {
      return state === 2 ? 'exec' : state === 4 ? 'wait' : state === 0 ? 'dead' : '0x' + state.toString(16);
    }

    function slotShort(slot) {
      return 's' + slot.slot + '@' + fmtHex(slot.loc, 6) + '(' + stateName(slot.state) + ')';
    }

    function formatArgWords(words) {
      if (!Array.isArray(words) || !words.length) return 'none';
      const nonZero = words
        .map((value, index) => ({ index, value }))
        .filter(item => item.value !== 0);
      if (!nonZero.length) return 'none (all 0000)';
      return nonZero.map(item => 'w' + item.index.toString(16).toUpperCase() + '=' + fmtHex(item.value, 4)).join(' ');
    }

    function buildScriptChains(slots) {
      const liveSlots = slots.filter(slot => slot.state === 2 || slot.state === 4);
      if (!liveSlots.length) return [];
      const bySlot = new Map(liveSlots.map(slot => [slot.slot, slot]));
      const targeted = new Set();
      for (const slot of liveSlots) if (slot.nextSlot >= 0) targeted.add(slot.nextSlot);
      const heads = liveSlots.filter(slot => !targeted.has(slot.slot));
      const visited = new Set();
      const chains = [];
      const sources = heads.length ? heads : liveSlots;
      for (const head of sources) {
        if (visited.has(head.slot)) continue;
        const chain = [];
        let current = head;
        while (current && !visited.has(current.slot)) {
          visited.add(current.slot);
          chain.push(current.slot);
          current = current.nextSlot >= 0 ? bySlot.get(current.nextSlot) || null : null;
        }
        if (chain.length) chains.push(chain);
      }
      return chains;
    }

    function buildScriptSnapshot(region) {
      const slots = [];
      for (let i = 0; i < SLOT_COUNT; i++) {
        const base = i * SLOT_SIZE;
        if (base + SLOT_SIZE > region.length) break;
        const loc = readU24(region, base + 0x00);
        const state = readU16(region, base + 0x03);
        const timer1 = readU16(region, base + 0x05);
        const nextPtr = readU16(region, base + 0x0B);
        const entity = readU16(region, base + 0x0D);
        const argsBytes = Array.from(region.subarray(base + SCRIPT_ARG_OFFSET, base + SCRIPT_ARG_OFFSET + SCRIPT_ARG_BYTES));
        const argWords = [];
        for (let offset = 0; offset < argsBytes.length; offset += 2) {
          argWords.push(((argsBytes[offset] || 0) | ((argsBytes[offset + 1] || 0) << 8)) >>> 0);
        }
        const live = state === 2 || state === 4;
        slots.push({
          slot: i,
          loc,
          state,
          timer1,
          nextPtr,
          nextSlot: slotPtrToIndex(nextPtr),
          entity,
          argsBytes,
          argWords,
          live,
        });
      }
      const liveSlots = slots.filter(slot => slot.live);
      const activeSlots = liveSlots.filter(slot => slot.state === 2);
      const waitingSlots = liveSlots.filter(slot => slot.state === 4);
      return { slots, liveSlots, activeSlots, waitingSlots, chains: buildScriptChains(slots) };
    }

    function renderScriptDetail(snapshot) {
      const detail = document.getElementById('ss-detail');
      if (!detail) return;
      const lines = [];

      if (snapshot.activeSlots.length > 0) {
        lines.push('active: ' + snapshot.activeSlots.map(slotShort).join(', '));
      } else if (snapshot.waitingSlots && snapshot.waitingSlots.length > 0) {
        lines.push('active: none (' + snapshot.waitingSlots.length + ' waiting)');
      } else {
        lines.push('active: none (all slots idle)');
      }

      if (snapshot.chains.length > 0) {
        lines.push('scheduler chain: ' + snapshot.chains.map(chain => chain.map(slotId => 's' + slotId).join(' -> ')).join(' | '));
      } else {
        lines.push('scheduler chain: idle');
      }

      const focus = snapshot.activeSlots[0] || snapshot.liveSlots[0] || null;
      if (focus) {
        lines.push('focus: ' + slotShort(focus) + ' | next=' + (focus.nextSlot >= 0 ? ('s' + focus.nextSlot) : '--') + ' | entity=' + fmtHex(focus.entity, 4) + ' | timer=' + focus.timer1);
        lines.push('args[0x0F..0x2E] words: ' + formatArgWords(focus.argWords));
      } else {
        const lastSlot = snapshot.slots.find(s => s.loc !== 0);
        if (lastSlot) {
          lines.push('last slot: ' + slotShort(lastSlot) + ' | entity=' + fmtHex(lastSlot.entity, 4));
        }
      }

      detail.textContent = lines.join('\n');
    }

    function renderManualExecBreakpoints() {
      const list = document.getElementById('ss-bp-list');
      if (!list) return;
      if (!manualScriptBreakpoints.length) {
        list.innerHTML = '<span class="ss-bp-empty">no manual script breakpoints</span>';
        return;
      }
      list.innerHTML = manualScriptBreakpoints.map(addr =>
        '<span class="ss-bp-chip">' + fmtBreakpointAddr(addr) +
        ' <button type="button" data-remove-exec-bp="' + addr + '">x</button></span>'
      ).join('');
    }

    function updateExecBreakpointStatus(enabled) {
      const status = enabled
        ? (manualScriptBreakpoints.length ? 'script bp: ' + manualScriptBreakpoints.length + ' manual' : 'script bp: ready')
        : 'script bp: unavailable';
      setText('ss-exec-break-status', status, enabled ? (manualScriptBreakpoints.length ? 'ss-ok' : 'ss-warn') : 'ss-warn');
    }

    function parseExecBreakpointInput(raw) {
      const text = String(raw || '').trim().replace(/^\$/u, '0x');
      if (!text) return null;
      if (!/^(?:0x)?[0-9a-f]{1,6}$/i.test(text)) return null;
      return parseInt(text, 16) >>> 0;
    }

    function addManualExecBreakpoint(raw) {
      const addr = parseExecBreakpointInput(raw);
      if (addr == null) return false;
      if (manualScriptBreakpoints.includes(addr)) return true;
      manualScriptBreakpoints = manualScriptBreakpoints.concat([addr]).sort((a, b) => a - b);
      const m = getModule();
      renderManualExecBreakpoints();
      updateExecBreakpointStatus(hasDebuggerApi(m));
      setText('ss-last-hit', 'last: added script breakpoint @ ' + fmtBreakpointAddr(addr), 'ss-ok');
      return true;
    }

    function removeManualExecBreakpoint(addr) {
      const next = manualScriptBreakpoints.filter(value => value !== addr);
      if (next.length === manualScriptBreakpoints.length) return;
      manualScriptBreakpoints = next;
      renderManualExecBreakpoints();
      updateExecBreakpointStatus(hasDebuggerApi(getModule()));
      setText('ss-last-hit', 'last: removed script breakpoint @ ' + fmtBreakpointAddr(addr), 'ss-warn');
      if (lastTriggeredScriptLoc === (addr >>> 0)) lastTriggeredScriptLoc = 0;
    }

    function reportScriptFocus(snapshot) {
      const focus = snapshot.activeSlots[0] || snapshot.liveSlots[0] || null;
      const addr = focus && focus.loc ? fmtHex(focus.loc, 6) : '';
      if (addr === lastFocusedScriptLoc) return;
      lastFocusedScriptLoc = addr;
      vscodeApi.postMessage({
        command: 'scriptFocus',
        address: addr,
        slot: focus ? focus.slot : null,
        state: focus ? stateName(focus.state) : 'none',
      });
    }

    function checkManualScriptBreakpoints(snapshot, m) {
      if (!hasDebuggerApi(m) || !manualScriptBreakpoints.length || !snapshot.activeSlots.length) {
        if (!snapshot.liveSlots.some(slot => slot.loc === lastTriggeredScriptLoc)) lastTriggeredScriptLoc = 0;
        return;
      }
      const hit = snapshot.activeSlots.find(slot => manualScriptBreakpoints.includes(slot.loc >>> 0));
      if (!hit) {
        if (!snapshot.liveSlots.some(slot => slot.loc === lastTriggeredScriptLoc)) lastTriggeredScriptLoc = 0;
        return;
      }
      if (lastTriggeredScriptLoc === (hit.loc >>> 0)) return;
      lastTriggeredScriptLoc = hit.loc >>> 0;
      m.pauseEmulation();
      setText('ss-pause-state', 'paused', 'ss-bad');
      setText('ss-last-hit', 'last: byte script @ ' + fmtHex(hit.loc, 6) + ' slot s' + hit.slot, 'ss-bad');
      vscodeApi.postMessage({ command: 'byteScriptBreakpointHit', address: fmtHex(hit.loc, 6), slot: hit.slot });
    }

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

  