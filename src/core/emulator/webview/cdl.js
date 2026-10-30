// TODO port to TS (docs/todo/port-to-ts.md)

    // -- CDL tab ----------------------------------------------------------------
    const CDL_TICK_MS = 1000;
    const CDL_DRAIN_TICKS = 5;   // s between drains: what a page cut off from its host (or killed) can lose
    const CDL_CHUNK = 0x10000;
    const CDL_W = 1024;
    const CDL_COLORS = [/*@@colors*/0];
    let cdlWanted = false;       // user asked for recording (survives ROM changes)
    let cdlOn = false;           // the core is recording
    let cdlPaused = false;       // emulation paused: no ticks, no drains
    let cdlTimer = null;
    let cdlTicks = 0;
    let cdlLabels = [];
    let cdlRomStrips = [];
    let cdlWramStrips = [];
    let cdlHits = [];            // per ROM chunk: bytes with any CDL bit
    let cdlNeedsPaint = new Set();
    let cdlSnap = null;          // { cdl, ext, wflags } from the library while not recording
    let cdlSnapRequested = false;
    let cdlLastDrain = 0;
    let cdlSummary = null;

    function cdlApi() {
      const m = getModule();
      return m && typeof m.cdlEnable === 'function' ? m : null;
    }

    function cdlHex(v, w) { return (v >>> 0).toString(16).toUpperCase().padStart(w, '0'); }

    function cdlBytesToB64(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function cdlWordsToB64(words) {
      return words && words.length ? cdlBytesToB64(new Uint8Array(words.buffer, words.byteOffset, words.byteLength)) : '';
    }
    function cdlB64ToBytes(s) {
      const bin = atob(s || '');
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    function cdlSetStatus(text) {
      const el = document.getElementById('cdl-status');
      if (el) el.textContent = text;
    }

    function cdlIsRecorderMode() {
      return typeof emuProfile !== 'undefined' && emuProfile === 'recorder';
    }

    function cdlCoverageText(s) {
      return s ? (100 * (s.code + s.data) / s.romSize).toFixed(1) + '%' : '';
    }

    function cdlRefreshUi() {
      const t = document.getElementById('cdl-toggle');
      if (t) {
        if (cdlIsRecorderMode()) {
          t.textContent = 'recording';
          t.classList.add('active');
          t.setAttribute('disabled', 'true');
          t.setAttribute('title', 'Recording cannot be disabled in CDL Recorder mode');
        } else {
          t.removeAttribute('disabled');
          t.removeAttribute('title');
          t.textContent = cdlWanted ? 'stop recording' : 'start recording';
          t.classList.toggle('active', cdlWanted);
        }
      }
      setControlEnabled('cdl-flush', cdlOn);
      const badge = document.getElementById('ss-cdl-count');
      if (badge) badge.textContent = !cdlOn ? 'off' : cdlPaused ? 'paused' : (cdlCoverageText(cdlSummary) || 'rec');
      cdlMenuSync();
    }

    // -- pause-menu rows (menu/menu-view.ts: 1 Recording, 2 Export, then the banks) --
    // The exports are the panel's buttons: only those this profile shows are offered.
    const CDL_EXPORTS = [['cdl-export-asm', 'Asar project'], ['cdl-export-wram', 'WRAM map'], ['cdl-export-bundle', 'Bundle']];
    let cdlExportPick = 0;

    function cdlExportChoices() {
      return CDL_EXPORTS.filter(([id]) => {
        const b = document.getElementById(id);
        return b && (typeof emuShown !== 'function' || emuShown(b));
      });
    }

    function cdlMenuSync() {
      const rec = document.getElementById('menu-val-cdl-rec');
      if (rec) {
        const on = cdlIsRecorderMode() || cdlWanted;
        rec.textContent = on ? 'ON' : 'OFF';
        rec.classList.toggle('active', on);
        const recRow = document.getElementById('menu-row-8-1');
        if (recRow) {
          if (cdlIsRecorderMode()) {
            recRow.setAttribute('title', 'Recording cannot be disabled in CDL Recorder mode');
            recRow.classList.add('disabled');
          } else {
            recRow.removeAttribute('title');
            recRow.classList.remove('disabled');
          }
        }
      }
      const ex = document.getElementById('menu-val-cdl-export');
      const choices = cdlExportChoices();
      cdlExportPick = Math.max(0, Math.min(cdlExportPick, choices.length - 1));
      if (ex) ex.textContent = choices.length ? choices[cdlExportPick][1] : '-';
    }

    function cdlMenuStep(row, delta) {
      if (row === 1) {
        if (cdlIsRecorderMode()) return;
        if ((delta > 0) !== cdlWanted) { if (cdlWanted) cdlStop(); else cdlStart(); }
      } else if (row === 2) {
        cdlExportPick += delta;
      } else {
        return;   // a bank: nothing to change
      }
      cdlMenuSync();
      if (typeof playMenuSound === 'function') playMenuSound('click_toggle');
    }

    function cdlMenuActivate(row) {
      if (row === 1) {
        if (cdlIsRecorderMode()) return;
        cdlMenuStep(1, cdlWanted ? -1 : 1);
      } else if (row === 2) {
        const pick = cdlExportChoices()[cdlExportPick];
        if (pick) document.getElementById(pick[0]).click();
      }
    }

    function cdlInMenu() {
      const view = document.getElementById('ss-view-cdl');
      return !!(view && view.closest('.emu-panel-slot'));
    }

    // The live core while recording, else the library snapshot.
    function cdlData() {
      const m = cdlApi();
      if (cdlOn && m) return m.cdlView(true);
      return cdlSnap;
    }

    function cdlCountHits(cdl, i) {
      const base = i * CDL_CHUNK, end = Math.min(base + CDL_CHUNK, cdl.length);
      let hit = 0;
      for (let j = base; j < end; j++) if (cdl[j]) hit++;
      return hit;
    }

    function cdlAllStrips() {
      return new Set(cdlRomStrips.map((_, i) => i).concat(['w0', 'w1']));
    }

    // -- recording lifecycle ------------------------------------------------------
    function cdlStart() {
      const m = cdlApi();
      if (!m) { cdlSetStatus('this core has no CDL recorder (custom debugger core required)'); return; }
      cdlWanted = true;
      cdlSetStatus('loading library...');
      cdlRefreshUi();
      vscodeApi.postMessage({ command: 'cdlEnable' });
    }

    function cdlOnSeed(msg) {
      const m = cdlApi();
      if (!m || !cdlWanted || cdlOn) return;
      if (!m.cdlEnable()) { cdlSetStatus('could not start recording (no ROM?)'); return; }
      m.cdlSeed(cdlB64ToBytes(msg.cdl), cdlB64ToBytes(msg.ext), cdlB64ToBytes(msg.wflags));
      const ctx = msg.scriptContext;
      if (ctx && typeof m.cdlSetScriptContext === 'function') m.cdlSetScriptContext(ctx.fetchRomOff, ctx.ptr, ctx.excludes);
      cdlOn = true;
      cdlSnap = null;
      cdlLabels = msg.labels || [];
      const view = m.cdlView(false);
      cdlBuildStrips(view.size);
      cdlHits = cdlRomStrips.map((_, i) => cdlCountHits(view.cdl, i));
      cdlNeedsPaint = cdlAllStrips();
      cdlPaused = !!(m.isEmulationPaused && m.isEmulationPaused());
      cdlArm();
      cdlRefreshUi();
      cdlPaint();
    }

    function cdlArm() {
      const run = cdlOn && !cdlPaused;
      if (run && !cdlTimer) cdlTimer = setInterval(cdlTick, CDL_TICK_MS);
      if (!run && cdlTimer) { clearInterval(cdlTimer); cdlTimer = null; }
    }

    function cdlDrain() {
      const m = cdlApi();
      if (!m || !cdlOn) return false;
      const d = m.cdlDrain();
      if (!d.chunks.length && !d.wvals.length && !d.wflags.length && !d.xrefs.length
          && !d.edges.length && !d.stats.length && !d.scriptXrefs.length
          && !(d.romHits && d.romHits.length) && !(d.wramHits && d.wramHits.length)
          && !(d.rets && d.rets.length) && !(d.regs && d.regs.length) && !(d.bases && d.bases.length)
          && !(d.wcode && d.wcode.length) && !(d.aram && d.aram.length)
          && !(d.bus && d.bus.length) && !(d.busSites && d.busSites.length) && !(d.romCycles && d.romCycles.length)
          && !(d.ioVals && d.ioVals.length) && !(d.sramFlags && d.sramFlags.length) && !(d.wordRanges && d.wordRanges.length)) return false;
      const enc = list => list.map(c => ({ index: c.index, data: cdlBytesToB64(c.data) }));
      const delta = {
        chunks: d.chunks.map(c => ({ index: c.index, cdl: cdlBytesToB64(c.cdl), ext: cdlBytesToB64(c.ext) })),
        wvals: enc(d.wvals),
        wflags: enc(d.wflags),
        xrefs: cdlWordsToB64(d.xrefs),
        edges: cdlWordsToB64(d.edges),
        stats: cdlWordsToB64(d.stats),
        scriptXrefs: cdlWordsToB64(d.scriptXrefs),
        romHits: cdlWordsToB64(d.romHits),
        wramHits: cdlWordsToB64(d.wramHits),
        rets: cdlWordsToB64(d.rets),
        regs: cdlWordsToB64(d.regs),
        bases: cdlWordsToB64(d.bases),
        wcode: (d.wcode || []).map(c => ({ index: c.index, code: cdlBytesToB64(c.code), state: cdlBytesToB64(c.state) })),
        aram: enc(d.aram || []),
        bus: enc(d.bus || []),
        busSites: cdlWordsToB64(d.busSites || []),
        romCycles: cdlWordsToB64(d.romCycles || []),
        ioVals: enc(d.ioVals || []),
        sramFlags: enc(d.sramFlags || []),
        wordRanges: (d.wordRanges || []).map(c => ({ set: c.set, index: c.index, data: cdlBytesToB64(c.data) })),
        dropped: d.dropped || 0,
      };
      // Kept until the host says it is on disk (page/06-cdl-rescue.js).
      cdlKeep(delta);
      vscodeApi.postMessage({ command: 'cdlDelta', delta });
      cdlLastDrain = Date.now();
      return true;
    }

    function cdlTick() {
      const m = cdlApi();
      if (!m || !cdlOn || cdlPaused) return;
      const view = m.cdlView(false);
      const gains = {};
      for (let i = 0; i < cdlRomStrips.length; i++) {
        if (!view.dirty[i]) continue;
        const hit = cdlCountHits(view.cdl, i);
        if (hit > cdlHits[i]) gains[cdlLabels[i] || cdlHex(i, 2)] = 100 * (hit - cdlHits[i]) / cdlRomStrips[i].len;
        cdlHits[i] = hit;
        cdlNeedsPaint.add(i);
      }
      for (let k = 0; k < 32; k++) if (view.wdirty[k]) cdlNeedsPaint.add('w' + (k >> 4));
      cdlFloatGains(gains);
      if (++cdlTicks % CDL_DRAIN_TICKS === 0) cdlDrain();
      cdlPaint();
    }

    function cdlHalt() {
      const m = cdlApi();
      if (!cdlOn) return;
      cdlDrain();
      if (m) m.cdlDisable();
      cdlOn = false;
      cdlArm();
    }

    function cdlStop() {
      if (cdlIsRecorderMode()) return;
      cdlWanted = false;
      cdlHalt();
      vscodeApi.postMessage({ command: 'cdlDisabled' });
      cdlSnapRequested = false;
      cdlRefreshUi();
      cdlSetStatus('recording off');
      if (emuPanelVisible('cdl')) cdlRequestSnapshot();
    }

    function cdlSetRecording(on) {
      if (on) {
        if (!cdlWanted) cdlStart();
      } else {
        if (cdlWanted) cdlStop();
      }
    }

    // Called before the core is restarted with another ROM: flush what belongs to the old one.
    function cdlBeforeRomChange() {
      cdlHalt();
      cdlSnap = null;
      cdlSnapRequested = false;
      cdlRefreshUi();
    }

    // Called by the frame loop whenever the emulator pauses or resumes.
    function cdlOnPauseChanged(paused) {
      cdlPaused = paused;
      if (!cdlOn) return;
      if (paused) {
        cdlDrain();
        vscodeApi.postMessage({ command: 'cdlPause' });
        cdlSetStatus('paused - saving');
      }
      cdlArm();
      cdlRefreshUi();
    }

    function cdlRequestSnapshot() {
      if (cdlOn || cdlSnapRequested || !romLoaded) return;
      cdlSnapRequested = true;
      vscodeApi.postMessage({ command: 'cdlRequestSnapshot' });
    }

    function cdlOnSnapshot(msg) {
      if (cdlOn) return;
      if (msg.empty) { cdlSetStatus('recording off - nothing recorded for this ROM yet'); return; }
      cdlSnap = { cdl: cdlB64ToBytes(msg.cdl), ext: cdlB64ToBytes(msg.ext), wflags: cdlB64ToBytes(msg.wflags) };
      cdlSnap.size = cdlSnap.cdl.length;
      cdlLabels = msg.labels || [];
      cdlSummary = msg.summary || null;
      cdlBuildStrips(cdlSnap.size);
      cdlNeedsPaint = cdlAllStrips();
      cdlPaint();
      const when = msg.updated ? new Date(msg.updated).toLocaleString() : 'unknown';
      cdlSetStatus('not recording - last flush ' + when + ', ' + cdlCoverageText(cdlSummary) + ' covered');
    }

    function cdlLookup(query) {
      const input = document.getElementById('cdl-lookup-input');
      if (input && query !== undefined) input.value = query;
      const q = input ? input.value.trim() : '';
      if (!q) return;
      if (cdlOn) cdlDrain();
      const out = document.getElementById('cdl-lookup-out');
      if (out) out.textContent = 'looking up ' + q + '...';
      vscodeApi.postMessage({ command: 'cdlLookup', query: q });
    }

    function initCdlTab() {
      const toggle = document.getElementById('cdl-toggle');
      if (!toggle || toggle.getAttribute('data-bound')) return;
      toggle.setAttribute('data-bound', '1');
      toggle.addEventListener('click', () => {
        if (cdlIsRecorderMode()) return;
        if (cdlWanted) cdlStop(); else cdlStart();
      });
      document.getElementById('cdl-flush').addEventListener('click', () => {
        const sent = cdlDrain();
        vscodeApi.postMessage({ command: 'cdlPause' });
        cdlSetStatus(sent ? 'saved' : 'nothing new to save');
      });
      document.getElementById('cdl-export-asm').addEventListener('click', () => {
        cdlDrain();
        cdlSetStatus('exporting Asar in the background (the game keeps running)...');
        vscodeApi.postMessage({ command: 'cdlExport', kind: 'asm' });
      });
      document.getElementById('cdl-export-wram').addEventListener('click', () => {
        cdlDrain();
        cdlSetStatus('exporting WRAM in the background (the game keeps running)...');
        vscodeApi.postMessage({ command: 'cdlExport', kind: 'wram' });
      });
      document.getElementById('cdl-export-bundle').addEventListener('click', () => {
        cdlDrain();
        cdlSetStatus('exporting bundle...');
        vscodeApi.postMessage({ command: 'exportBundle' });
      });
      document.getElementById('cdl-lookup-btn').addEventListener('click', () => cdlLookup());
      document.getElementById('cdl-lookup-input').addEventListener('keydown', evt => {
        if (evt.key === 'Enter') { evt.preventDefault(); cdlLookup(); }
        evt.stopPropagation();
      });
      const banks = document.getElementById('cdl-banks');
      banks.addEventListener('mousemove', evt => {
        if (!evt.target || evt.target.tagName !== 'CANVAS') return;
        const a = cdlAddressAt(evt);
        if (a) document.getElementById('cdl-hover').textContent = cdlDescribe(a);
      });
      banks.addEventListener('click', evt => {
        if (!evt.target || evt.target.tagName !== 'CANVAS' || cdlInMenu()) return;
        const a = cdlAddressAt(evt);
        if (a && document.body.classList.contains('profile-full')) cdlLookup(a.wram ? cdlWramName(a.off) : a.bank + ':' + cdlHex(a.inner, 4));
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden) cdlDrain(); });
      cdlRefreshUi();
    }

    function handleCdlMessage(data) {
      if (data.command === 'cdlConfig') {
        initCdlTab();
        cdlRescueSend();
        if (cdlIsRecorderMode() || data.autoEnable || cdlWanted) cdlStart();
        else { cdlRefreshUi(); if (emuPanelVisible('cdl')) cdlRequestSnapshot(); }
      } else if (data.command === 'cdlSeed') {
        cdlRescueSetLib(data.lib);
        cdlOnSeed(data);
      } else if (data.command === 'cdlSaved') {
        cdlRescueSaved(data);
      } else if (data.command === 'cdlRescued') {
        cdlRescueDone(data);
      } else if (data.command === 'cdlSnapshot') {
        cdlOnSnapshot(data);
      } else if (data.command === 'cdlStatus') {
        if (data.summary) cdlSummary = data.summary;
        if (data.text) cdlSetStatus(data.text);
        cdlRefreshUi();
      } else if (data.command === 'cdlLookupResult') {
        const out = document.getElementById('cdl-lookup-out');
        if (out) out.textContent = (data.lines || []).join(String.fromCharCode(10));
      } else {
        return false;
      }
      return true;
    }
  

    // Closing the tab gives the page no last word: hand the host what the core has on the ways out the
    // page does see (the click on the tab's X blurs it first, Cmd/Ctrl+W is a key it sees, pagehide when
    // it is torn down). The host merges it at once and writes it when the panel closes.
    window.addEventListener('blur', () => { cdlDrain(); });
    window.addEventListener('pagehide', () => { cdlDrain(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) cdlDrain(); });
    document.addEventListener('keydown', evt => {
      if ((evt.metaKey || evt.ctrlKey) && (evt.key === 'w' || evt.key === 'W')) cdlDrain();
    }, true);
