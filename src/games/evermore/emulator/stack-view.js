'use strict';

/**
 * games/evermore/emulator/stack-view.js
 *
 * Evermore's script VM in the emulator page, handed in through host.js webview(): the 20 script slots
 * at $7E:28FC (STACK panel: chains, detail, the write hook on the slot bytes, byte-script exec
 * breakpoints) and the script execution trace (TRACE panel). panel-webview.js splices both where they
 * always ran and calls them only behind typeof guards.
 *
 * Invariant: Must remain strictly ASCII-only.
 */

function getStackScript() {
  return `
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

      detail.textContent = lines.join('\\n');
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
      const text = String(raw || '').trim().replace(/^\\$/u, '0x');
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

  `;
}

function getTraceScript() {
  return `
    const SCRIPT_TOKEN = /("[^"]*")|(\\([^()]*\\))|(\\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\\b0d\\d+\\b|\\b\\d+\\b)|(^[A-Z][A-Z_?]+(?: [A-Z][A-Z_?]+)?\\b|\\b_[a-z_]+(?=\\())/g;

    function scriptHighlight(text) {
      let out = '';
      let last = 0;
      let m;
      const src = String(text || '');
      const re = new RegExp(SCRIPT_TOKEN.source, 'g');
      while ((m = re.exec(src))) {
        out += escH(src.slice(last, m.index));
        if (m[2]) {
          const aside = !src.slice(m.index + m[0].length).trim();
          const inner = '(' + scriptHighlight(m[2].slice(1, -1)) + ')';
          out += aside ? '<span class="sx-aside">' + inner + '</span>' : inner;
        } else {
          out += '<span class="' + (m[1] ? 'sx-str' : m[3] ? 'sx-num' : 'sx-kw') + '">' + escH(m[0]) + '</span>';
        }
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      return out + escH(src.slice(last));
    }

    const scriptSlotTrackers = Array.from({ length: SLOT_COUNT }, () => ({
      loc: 0,
      state: 0,
      timer1: 0,
      entity: 0,
      triggerKind: null,
      triggerIndex: null,
      initialized: false,
    }));

    let lastStepOnScriptId = 0xFFFF;
    let lastStepOnIndex = -1;
    // A (re)started ROM (panel-webview.js bootRom).
    function gameTraceReset() {
      lastStepOnScriptId = 0xFFFF;
      lastStepOnIndex = -1;
    }

    let totalTraceCount = 0;

    function isValidScriptAddr(loc) {
      if (typeof loc !== 'number' || isNaN(loc)) return false;
      const raw = loc >>> 0;
      if (raw === 0 || raw === 0x555555 || raw === 0xFFFFFF) return false;
      const bank = (raw >>> 16) & 0xFF;
      const addr = raw & 0xFFFF;
      if (bank < 0x80 || addr < 0x8000) return false;
      return true;
    }

    function checkScriptExecutionTrace() {
      const m = getModule();
      if (!m || !hasDebuggerApi(m)) return;
      const region = m.readMemoryRange(SCRIPT_STACK_BUS_ADDR, SCRIPT_REGION_SIZE);
      if (!region || region.length < SCRIPT_REGION_SIZE) return;

      const batch = [];

      for (let s = 0; s < SLOT_COUNT; s++) {
        const base = s * SLOT_SIZE;
        const loc = readU24(region, base + 0x00);
        const state = readU16(region, base + 0x03);
        const timer1 = readU16(region, base + 0x05);
        const entity = readU16(region, base + 0x0D);
        const tracker = scriptSlotTrackers[s];

        if (!tracker.initialized) {
          tracker.loc = loc;
          tracker.state = state;
          tracker.timer1 = timer1;
          tracker.entity = entity;
          tracker.initialized = true;
          continue;
        }

        let event = null;
        let targetLoc = 0;

        // Condition 1: New script started
        if ((tracker.state === 0 || tracker.loc === 0) && (state !== 0 && loc !== 0)) {
          event = 'start';
          targetLoc = loc;
          if (typeof lastInjectedTrigger !== 'undefined' && lastInjectedTrigger && romFrameCount <= lastInjectedTrigger.expiryFrame) {
            tracker.triggerKind = lastInjectedTrigger.kind;
            tracker.triggerIndex = lastInjectedTrigger.index;
            lastInjectedTrigger = null;
          }
        }
        // Condition 2: Slot was waiting (state 4) and resumed to executing (state 2)
        else if (tracker.state === 4 && state === 2) {
          event = 'resume';
          targetLoc = loc;
        }
        // Condition 3: Slot was waiting, still waiting, but loc advanced (ran & slept within this frame)
        else if (tracker.state === 4 && state === 4 && loc !== tracker.loc && tracker.loc !== 0) {
          event = 'resume';
          targetLoc = tracker.loc;
        }
        // Condition 4: Slot executing and stepped loc
        else if (tracker.state === 2 && state === 2 && loc !== tracker.loc && loc !== 0) {
          event = 'step';
          targetLoc = loc;
        }
        // Condition 5: Slot ended
        else if (tracker.state !== 0 && state === 0 && tracker.loc !== 0) {
          event = 'end';
          targetLoc = tracker.loc;
        }

        // Filter cold-RAM garbage or uninitialized addresses
        if (event && !isValidScriptAddr(targetLoc)) {
          event = null;
        }

        // Room 0x15 enter script executes in frame 1 and reaches 0xBC8006 before frame poll.
        // Catch when slot 0 starts and points to 0xBC8000..0xBC8008, resetting targetLoc to 0xBC8000
        if (s === 0 && event === 'start' && targetLoc >= 0xBC8000 && targetLoc <= 0xBC8008) {
          targetLoc = 0xBC8000;
        }

        if (event && targetLoc > 0) {
          let rawBytes = [];
          try {
            const buf = m.readMemoryRange(targetLoc, 32);
            if (buf && buf.length) rawBytes = Array.from(buf);
          } catch (_) {}
          const elapsedSec = romLaunchTimestamp > 0 ? ((performance.now() - romLaunchTimestamp) / 1000) : 0;
          const timeStr = '+' + elapsedSec.toFixed(2) + 's, f' + romFrameCount;
          const entry = {
            slot: s,
            entity,
            event,
            loc: targetLoc,
            nextLoc: loc,
            state,
            timer1,
            bytes: rawBytes,
            timeStr,
            frame: romFrameCount,
          };
          if (tracker.triggerKind) {
            entry.triggerKind = tracker.triggerKind;
            entry.triggerIndex = tracker.triggerIndex;
            if (event === 'end') {
              tracker.triggerKind = null;
              tracker.triggerIndex = null;
            }
          }
          batch.push(entry);
        }

        tracker.loc = loc;
        tracker.state = state;
        tracker.timer1 = timer1;
        tracker.entity = entity;
      }

      // Step-on trigger execution detection via $7E2429
      try {
        const curStepOnScriptId = (m.readMemory(0x7E2429) | (m.readMemory(0x7E242A) << 8)) >>> 0;
        if (curStepOnScriptId !== 0xFFFF && curStepOnScriptId !== 0x5555) {
          let activeStepIndex = -1;
          if (typeof cachedTriggers !== 'undefined' && cachedTriggers && Array.isArray(cachedTriggers.stepOn) && cachedTriggers.stepOn.length > 0) {
            const rawBoyX = m.readMemory(0x7E4EA3) | (m.readMemory(0x7E4EA4) << 8);
            const rawBoyY = m.readMemory(0x7E4EA5) | (m.readMemory(0x7E4EA6) << 8);
            const rawOX = m.readMemory(0x7E0F86) | (m.readMemory(0x7E0F87) << 8);
            const rawOY = m.readMemory(0x7E0F88) | (m.readMemory(0x7E0F89) << 8);
            const playerTileX = ((rawBoyX >> 4) + rawOX) & 0xFFFF;
            const playerTileY = ((rawBoyY >> 4) + rawOY) & 0xFFFF;
            const sList = cachedTriggers.stepOn;

            // Replicate SNES $8FACB1 step-on search:
            // Condition: playerTileY >= t.y1 && playerTileY < t.y2 && playerTileX >= t.x1 && playerTileX < t.x2
            for (let i = 0; i < sList.length; i++) {
              const t = sList[i];
              if (playerTileY >= t.y1 && playerTileY < t.y2 &&
                  playerTileX >= t.x1 && playerTileX < t.x2) {
                activeStepIndex = i;
                break;
              }
            }
            if (activeStepIndex === -1) {
              for (let i = 0; i < sList.length; i++) {
                if (sList[i].scriptId === curStepOnScriptId) {
                  activeStepIndex = i;
                  break;
                }
              }
            }
          }
          if (activeStepIndex === -1) activeStepIndex = 0;

          const slotStartItem = batch.find(item => item.event === 'start' && item.slot === 0);
          if (slotStartItem) {
            slotStartItem.triggerKind = 'stepOn';
            slotStartItem.triggerIndex = activeStepIndex;
            if (scriptSlotTrackers[0]) {
              scriptSlotTrackers[0].triggerKind = 'stepOn';
              scriptSlotTrackers[0].triggerIndex = activeStepIndex;
            }
          } else {
            if (scriptSlotTrackers[0] && scriptSlotTrackers[0].state !== 0 && !scriptSlotTrackers[0].triggerKind) {
              scriptSlotTrackers[0].triggerKind = 'stepOn';
              scriptSlotTrackers[0].triggerIndex = activeStepIndex;
            }
            const isNewActivation = (lastStepOnScriptId === 0xFFFF) || (activeStepIndex !== lastStepOnIndex && lastStepOnIndex !== -1);
            if (isNewActivation) {
              const targetLoc = resolveScriptIdToSnes(loadedRomData, curStepOnScriptId);
              if (isValidScriptAddr(targetLoc)) {
                let rawBytes = [];
                try {
                  const buf = m.readMemoryRange(targetLoc, 32);
                  if (buf && buf.length) rawBytes = Array.from(buf);
                } catch (_) {}
                const elapsedSec = romLaunchTimestamp > 0 ? ((performance.now() - romLaunchTimestamp) / 1000) : 0;
                const timeStr = '+' + elapsedSec.toFixed(2) + 's, f' + romFrameCount;
                // Emit paired start and end for 0-frame executions so lifecycle is consistently logged
                batch.push({
                  slot: 0,
                  entity: 0x4E89,
                  event: 'start',
                  loc: targetLoc,
                  nextLoc: targetLoc,
                  state: 0,
                  timer1: 0,
                  bytes: rawBytes,
                  timeStr,
                  frame: romFrameCount,
                  triggerKind: 'stepOn',
                  triggerIndex: activeStepIndex,
                });
                batch.push({
                  slot: 0,
                  entity: 0x4E89,
                  event: 'end',
                  loc: targetLoc,
                  nextLoc: targetLoc,
                  state: 0,
                  timer1: 0,
                  bytes: [],
                  timeStr,
                  frame: romFrameCount,
                  triggerKind: 'stepOn',
                  triggerIndex: activeStepIndex,
                });
              }
            }
          }
          lastStepOnScriptId = curStepOnScriptId;
          lastStepOnIndex = activeStepIndex;
        } else {
          lastStepOnScriptId = 0xFFFF;
          lastStepOnIndex = -1;

          // B-trigger execution detection for slot 0
          const slotStartItem = batch.find(item => item.event === 'start' && item.slot === 0);
          if (slotStartItem && !slotStartItem.triggerKind && typeof cachedTriggers !== 'undefined' && cachedTriggers && Array.isArray(cachedTriggers.bTrigger) && cachedTriggers.bTrigger.length > 0) {
            const rawBoyX = m.readMemory(0x7E4EA3) | (m.readMemory(0x7E4EA4) << 8);
            const rawBoyY = m.readMemory(0x7E4EA5) | (m.readMemory(0x7E4EA6) << 8);
            const rawOX = m.readMemory(0x7E0F86) | (m.readMemory(0x7E0F87) << 8);
            const rawOY = m.readMemory(0x7E0F88) | (m.readMemory(0x7E0F89) << 8);
            const playerTileX = ((rawBoyX >> 4) + rawOX) & 0xFFFF;
            const playerTileY = ((rawBoyY >> 4) + rawOY) & 0xFFFF;
            const rawFacing = m.readMemory(0x7E4EAB);
            const FACING_DELTAS = {
              0:  [ 0, -1], // N
              2:  [ 1, -1], // NE
              4:  [ 1,  0], // E
              6:  [ 1,  1], // SE
              8:  [ 0,  1], // S
              10: [-1,  1], // SW
              12: [-1,  0], // W
              14: [-1, -1], // NW
            };
            const delta = FACING_DELTAS[rawFacing & 0x0E] || [0, 1];
            const targetTileX = (playerTileX + delta[0]) & 0xFFFF;
            const targetTileY = (playerTileY + delta[1]) & 0xFFFF;
            const bList = cachedTriggers.bTrigger;
            let activeBIndex = -1;

            // 1. Check facing tile first (normal B-press target)
            for (let i = 0; i < bList.length; i++) {
              const t = bList[i];
              if (targetTileY >= t.y1 && targetTileY < t.y2 &&
                  targetTileX >= t.x1 && targetTileX < t.x2) {
                activeBIndex = i;
                break;
              }
            }
            // 2. Check player standing tile as fallback
            if (activeBIndex === -1) {
              for (let i = 0; i < bList.length; i++) {
                const t = bList[i];
                if (playerTileY >= t.y1 && playerTileY < t.y2 &&
                    playerTileX >= t.x1 && playerTileX < t.x2) {
                  activeBIndex = i;
                  break;
                }
              }
            }
            // 3. Check matching script address in B-triggers
            if (activeBIndex === -1 && slotStartItem.loc) {
              for (let i = 0; i < bList.length; i++) {
                const tLoc = resolveScriptIdToSnes(loadedRomData, bList[i].scriptId);
                if (tLoc === slotStartItem.loc && tLoc !== 0x92A42F) {
                  activeBIndex = i;
                  break;
                }
              }
            }

            if (activeBIndex !== -1) {
              slotStartItem.triggerKind = 'bTrigger';
              slotStartItem.triggerIndex = activeBIndex;
              if (scriptSlotTrackers[0]) {
                scriptSlotTrackers[0].triggerKind = 'bTrigger';
                scriptSlotTrackers[0].triggerIndex = activeBIndex;
              }
            }
          }
        }
      } catch (_) {}

      if (batch.length > 0 && vscodeApi) {
        vscodeApi.postMessage({ command: 'scriptTraceBatch', items: batch });
      }
    }

    function appendTraceEntries(entries) {
      const container = document.getElementById('ss-trace-log');
      if (!container || !entries || !entries.length) return;
      const frag = document.createDocumentFragment();
      for (const entry of entries) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ss-trace-entry ' + (entry.event || '');
        if (entry.html) {
          wrapper.innerHTML = entry.html;
        } else {
          wrapper.textContent = entry.line || '';
        }
        frag.appendChild(wrapper);
      }
      container.appendChild(frag);
      while (container.childNodes.length > 250) {
        container.removeChild(container.firstChild);
      }
      totalTraceCount += entries.length;
      const tabCountEl = document.getElementById('ss-tab-trace-count');
      if (tabCountEl) {
        tabCountEl.textContent = totalTraceCount;
      }
      // Always follow the newest line: nothing arrives while paused, so pausing keeps the view.
      container.scrollTop = container.scrollHeight;
    }

    // The TRACE menu tab's "Clear" row (emulator-panels.js emuPanelMenuAction).
    function traceClear() {
      const log = document.getElementById('ss-trace-log');
      if (log) log.innerHTML = '';
      totalTraceCount = 0;
      const tabCount = document.getElementById('ss-tab-trace-count');
      if (tabCount) tabCount.textContent = '0';
    }

  `;
}

module.exports = { getStackScript, getTraceScript };
