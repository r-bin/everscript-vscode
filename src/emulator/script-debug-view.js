'use strict';

/**
 * emulator/script-debug-view.js
 *
 * Webview half of the VS Code script debugger (host: script-debug-host.js,
 * session: debugger/emulator-session.js).
 *
 * The script interpreter fetches every opcode at $8C:D0A6 (lda [$82]), with
 * the instruction's address in $82-$84 and the running slot's pointer in $7E.
 * An exec breakpoint there, armed only while something is wanted, makes the
 * core call sdbgOnHit() at every script instruction; returning false keeps
 * the game running (custom core: a conditional breakpoint), true pauses it
 * right after that one CPU instruction, before the script instruction runs.
 *
 * A stop is wanted on a breakpoint address (ROM offset), a requested pause,
 * or when a step's predicate says so (debugger/script-frames.js):
 *   { slot, scope, parent, parentScope, ranges: [[start, end)], into, callerOnly }
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getScriptDebugClientScript() {
  return `
    // -- VS Code script debugger -----------------------------------------------
    const SDBG_DISPATCH = 0x8CD0A6;
    const SDBG_DIRECT_PAGE = 0x7E007E; // $7E slot pointer, $80, $82-$84 instruction address
    const SDBG_PARENT_OFFSET = 0x0B;
    const SDBG_IDLE_PAUSE_MS = 300;
    const sdbg = {
      active: false, breakpoints: new Set(), step: null, pauseNext: false,
      armed: false, ourPause: false, idleTimer: null,
    };

    function sdbgApiReady(m) {
      return hasDebuggerApi(m) && typeof m.addExecBreakpoint === 'function' && typeof m.removeExecBreakpoint === 'function';
    }

    function sdbgArm() {
      const m = getModule();
      if (!sdbgApiReady(m)) return;
      const want = sdbg.active && (sdbg.breakpoints.size > 0 || !!sdbg.step || sdbg.pauseNext);
      if (want && !sdbg.armed) m.addExecBreakpoint(SDBG_DISPATCH);
      if (!want && sdbg.armed) m.removeExecBreakpoint(SDBG_DISPATCH);
      sdbg.armed = want;
    }

    function sdbgInRanges(ranges, offset) {
      for (let i = 0; i < ranges.length; i++) {
        if (offset >= ranges[i][0] && offset < ranges[i][1]) return true;
      }
      return false;
    }

    function sdbgInScope(scope, offset) {
      return !scope || (offset >= scope[0] && offset < scope[1]);
    }

    function sdbgStepDone(m, slot, offset) {
      const step = sdbg.step;
      // Outside its function the slot runs a new script: the stepped one ended.
      if (slot === step.slot) return sdbgInScope(step.scope, offset) && !step.callerOnly && !sdbgInRanges(step.ranges, offset);
      if (step.parent && slot === step.parent) return sdbgInScope(step.parentScope, offset);
      if (step.into) {
        const parent = m.readMemoryRange(0x7E0000 + slot + SDBG_PARENT_OFFSET, 2);
        return (parent[0] | (parent[1] << 8)) === step.slot;
      }
      return false;
    }

    // Called by the core (Module.onBreakpointHit) at every script instruction while armed.
    function sdbgOnHit(m) {
      const dp = m.readMemoryRange(SDBG_DIRECT_PAGE, 7);
      const slot = dp[0] | (dp[1] << 8);
      const address = (dp[4] | (dp[5] << 8) | (dp[6] << 16)) >>> 0;
      const offset = address & 0x3FFFFF;
      let reason = null;
      if (sdbg.pauseNext) reason = 'pause';
      else if (sdbg.breakpoints.has(offset)) reason = 'breakpoint';
      else if (sdbg.step && sdbgStepDone(m, slot, offset)) reason = 'step';
      if (!reason) return false;
      sdbg.step = null;
      sdbg.pauseNext = false;
      sdbgClearIdle();
      sdbg.ourPause = true;
      sdbgArm();
      sdbgReportStop(m, reason, slot, address);
      return true;
    }

    function sdbgSlots(m) {
      const region = m.readMemoryRange(SCRIPT_STACK_BUS_ADDR, SCRIPT_REGION_SIZE);
      const slots = [];
      for (let i = 0; i < SLOT_COUNT; i++) {
        const base = i * SLOT_SIZE;
        const args = [];
        for (let a = 0; a < SCRIPT_ARG_BYTES / 2; a++) args.push(readU16(region, base + SCRIPT_ARG_OFFSET + a * 2));
        slots.push({
          index: i,
          ptr: SCRIPT_BASE + base,
          loc: readU24(region, base),
          state: readU16(region, base + 0x03),
          timer: readU16(region, base + 0x05),
          parent: readU16(region, base + SDBG_PARENT_OFFSET),
          entity: readU16(region, base + 0x0D),
          args,
        });
      }
      return slots;
    }

    function sdbgReportStop(m, reason, slot, address) {
      setText('ss-pause-state', 'paused', 'ss-bad');
      setText('ss-last-hit', 'last: VS Code ' + reason + (address != null ? ' @ ' + fmtHex(address, 6) : ''), 'ss-bad');
      vscodeApi.postMessage({ command: 'scriptDebugStop', reason, slot: slot || null, address, slots: sdbgSlots(m) });
    }

    function sdbgClearIdle() {
      if (sdbg.idleTimer) clearTimeout(sdbg.idleTimer);
      sdbg.idleTimer = null;
    }

    function sdbgPause() {
      const m = getModule();
      if (!sdbgApiReady(m)) return;
      if (isEmulatorPaused()) { sdbg.ourPause = true; sdbgReportStop(m, 'pause', 0, null); return; }
      sdbg.pauseNext = true;
      sdbgArm();
      sdbgClearIdle();
      // No script running: stop the CPU wherever it is.
      sdbg.idleTimer = setTimeout(() => {
        sdbg.idleTimer = null;
        if (!sdbg.pauseNext) return;
        sdbg.pauseNext = false;
        sdbgArm();
        sdbg.ourPause = true;
        m.pauseEmulation();
        sdbgReportStop(m, 'pause', 0, null);
      }, SDBG_IDLE_PAUSE_MS);
    }

    function sdbgResume(step) {
      sdbg.step = step || null;
      sdbg.pauseNext = false;
      sdbgClearIdle();
      sdbgArm();
      const m = getModule();
      if (m && isEmulatorPaused()) {
        sdbg.ourPause = false;
        m.resumeEmulation();
        setText('ss-pause-state', 'running', 'ss-ok');
      }
    }

    function sdbgReportStatus() {
      vscodeApi.postMessage({ command: 'scriptDebugStatus', active: sdbg.active, api: sdbgApiReady(getModule()), running: !!romLoaded });
    }

    function sdbgConfigure(config) {
      const wasActive = sdbg.active;
      sdbg.active = !!(config && config.active);
      sdbg.breakpoints = new Set((config && config.breakpoints) || []);
      if (!sdbg.active) { sdbg.step = null; sdbg.pauseNext = false; sdbgClearIdle(); }
      sdbgArm();
      if (sdbg.active !== wasActive) sdbgReportStatus();
    }

    // After every power-on: the hook must be live before the first frame.
    function sdbgOnBoot() {
      const m = getModule();
      if (m) installDebuggerBridge(m);
      sdbg.ourPause = false;
      sdbgArm();
      if (sdbg.active) sdbgReportStatus();
    }

    // Pause / resume from the panel itself (Esc, buttons, other breakpoints).
    function sdbgOnPauseChanged(paused) {
      if (!sdbg.active) return;
      const m = getModule();
      if (!sdbgApiReady(m)) return;
      if (paused) {
        if (sdbg.ourPause) return;
        sdbg.ourPause = true;
        sdbgReportStop(m, 'pause', 0, null);
      } else if (sdbg.ourPause) {
        sdbg.ourPause = false;
        vscodeApi.postMessage({ command: 'scriptDebugContinued' });
      }
    }

    function sdbgHandleMessage(msg) {
      switch (msg && msg.command) {
        case 'scriptDebugConfigure': sdbgConfigure(msg); return true;
        case 'scriptDebugResume': sdbgResume(msg.step); return true;
        case 'scriptDebugPause': sdbgPause(); return true;
        case 'scriptDebugRead': {
          const m = getModule();
          const bytes = sdbgApiReady(m) ? Array.from(m.readMemoryRange(msg.address >>> 0, Math.min(msg.length | 0, 4096))) : [];
          vscodeApi.postMessage({ command: 'scriptDebugReadResult', id: msg.id, bytes });
          return true;
        }
        default: return false;
      }
    }
  `;
}

module.exports = { getScriptDebugClientScript };
