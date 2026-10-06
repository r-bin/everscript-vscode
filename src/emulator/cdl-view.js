'use strict';

/**
 * emulator/cdl-view.js
 *
 * The emulator's CDL bottom-bar tab: record toggle (off by default), ROM
 * coverage strips (one per 64 KB, one pixel per byte), WRAM access strips
 * ($7E / $7F), Asar / WRAM export buttons and the xref lookup box.
 *
 * Recording state lives in the core (cdl.c). While recording and not paused,
 * one 1 s tick consumes the core's dirty chunks: it recounts their coverage
 * (feeding the floating gains, cdl-float.js), repaints them when the tab is
 * visible, and every CDL_DRAIN_TICKS ticks drains a delta to the host. Paused
 * or off, nothing runs. Not recording, the tab shows the library's last
 * flushed state (requested once, read-only). Strip painting and hover text:
 * cdl-strips.js.
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getCdlCss() {
  return `
    #ss-view-cdl .ss-subbar { flex-wrap: wrap; }
    #cdl-status { color: #888; margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #cdl-legend { display: flex; flex-wrap: wrap; gap: 10px; padding: 3px 8px; font-size: 10px; color: #999; background: #101010; border-bottom: 1px solid #1d1d1d; flex-shrink: 0; }
    #cdl-legend span { display: inline-flex; align-items: center; gap: 4px; }
    #cdl-legend i { display: inline-block; width: 10px; height: 10px; border: 1px solid #333; }
    #cdl-legend b { color: #666; font-weight: normal; }
    #cdl-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
    #cdl-banks { flex: 3; min-width: 0; overflow-y: auto; padding: 4px 8px; }
    .cdl-group { color: #777; font-size: 10px; margin: 6px 0 3px; letter-spacing: 0.05em; }
    .cdl-bank { display: flex; align-items: stretch; gap: 6px; margin-bottom: 3px; }
    .cdl-bank-label { width: 54px; flex-shrink: 0; color: #ccc; font-size: 11px; font-weight: bold; display: flex; flex-direction: column; justify-content: center; }
    .cdl-bank-label small { color: #777; font-weight: normal; font-size: 9px; }
    .cdl-bank canvas { flex: 1; min-width: 0; height: 48px; image-rendering: pixelated; background: #101010; border: 1px solid #222; cursor: crosshair; }
    #cdl-side { flex: 2; min-width: 0; display: flex; flex-direction: column; border-left: 1px solid #222; }
    #cdl-hover { padding: 3px 8px; color: #aaa; font-size: 10px; border-bottom: 1px solid #1d1d1d; min-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #cdl-lookup-out { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 4px 8px; color: #d4d4d4; font-size: 11px; line-height: 1.4; white-space: pre; }
    #cdl-empty { color: #666; padding: 12px 8px; font-size: 11px; line-height: 1.5; }
  `;
}

function getCdlTabButtonHtml() {
  return `<button id="ss-tab-cdl" class="ss-tab" type="button">CDL (<span id="ss-cdl-count">off</span>)</button>`;
}

// index = colour id used by the client script
const LEGEND = [
  ['unreached', '#101010'], ['empty', '#2f4f4f'], ['opcode', '#ffff00'], ['operand', '#9acd32'],
  ['data', '#ffdead'], ['pointer', '#da70d6'], ['graphics (DMA)', '#ffb6c1'], ['music (APU)', '#add8e6'],
  ['M/X conflict', '#ff4040'],
  ['read', '#3d7fd9'], ['written', '#e08a2e'], ['read+written', '#b05fd6'], ['by scripts', '#4ec9b0'], ['code', '#ffffff'],
];
const WRAM_LEGEND_START = 9;

function getCdlViewHtml() {
  const item = ([name, color]) => `<span><i style="background:${color}"></i>${name}</span>`;
  const legend = '<b>ROM</b>' + LEGEND.slice(0, WRAM_LEGEND_START).map(item).join('')
    + '<b>WRAM</b>' + LEGEND.slice(WRAM_LEGEND_START).map(item).join('');
  return `
    <div id="ss-view-cdl" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="cdl-toggle" class="ss-btn" type="button" title="Record code/data coverage, calls and memory accesses (in memory; written to disk only when something changed)">start recording</button>
        <button id="cdl-flush" class="ss-btn" type="button" disabled>flush now</button>
        <button id="cdl-export-asm" class="ss-btn" type="button" title="Write an Asar project (byte-exact) and open main.asm">export asar</button>
        <button id="cdl-export-wram" class="ss-btn" type="button" title="Write ram.asm: every WRAM address with its accessors and enum guesses">export wram</button>
        <input id="cdl-lookup-input" class="ss-search-input" type="text" spellcheck="false" placeholder="who? 7E4E57 / C0:8000" />
        <button id="cdl-lookup-btn" class="ss-btn" type="button">who?</button>
        <span id="cdl-status">recording off</span>
      </div>
      <div id="cdl-legend">${legend}</div>
      <div id="cdl-body">
        <div id="cdl-banks"><div id="cdl-empty">Recording is off. Start it to map which ROM bytes run as code, which are read as data,
who calls each function and who reads or writes each WRAM address (including which script
instruction did it). Data is kept per ROM in the extension's storage and merges across
sessions, so the game does not have to be finished in one sitting. Click a strip to look up
that address.</div></div>
        <div id="cdl-side">
          <div id="cdl-hover">&nbsp;</div>
          <pre id="cdl-lookup-out"></pre>
        </div>
      </div>
    </div>
  `;
}

function getCdlClientScript() {
  const colors = LEGEND.map(([, c]) => '[' + [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)).join(',') + ']').join(',');
  return `
    // -- CDL tab ----------------------------------------------------------------
    const CDL_TICK_MS = 1000;
    const CDL_DRAIN_TICKS = 15;
    const CDL_CHUNK = 0x10000;
    const CDL_W = 1024;
    const CDL_COLORS = [${colors}];
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

    function cdlCoverageText(s) {
      return s ? (100 * (s.code + s.data) / s.romSize).toFixed(1) + '%' : '';
    }

    function cdlRefreshUi() {
      const t = document.getElementById('cdl-toggle');
      if (t) { t.textContent = cdlWanted ? 'stop recording' : 'start recording'; t.classList.toggle('active', cdlWanted); }
      setControlEnabled('cdl-flush', cdlOn);
      const badge = document.getElementById('ss-cdl-count');
      if (badge) badge.textContent = !cdlOn ? 'off' : cdlPaused ? 'paused' : (cdlCoverageText(cdlSummary) || 'rec');
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
          && !d.edges.length && !d.stats.length && !d.scriptXrefs.length) return false;
      const enc = list => list.map(c => ({ index: c.index, data: cdlBytesToB64(c.data) }));
      vscodeApi.postMessage({ command: 'cdlDelta', delta: {
        chunks: d.chunks.map(c => ({ index: c.index, cdl: cdlBytesToB64(c.cdl), ext: cdlBytesToB64(c.ext) })),
        wvals: enc(d.wvals),
        wflags: enc(d.wflags),
        xrefs: cdlWordsToB64(d.xrefs),
        edges: cdlWordsToB64(d.edges),
        stats: cdlWordsToB64(d.stats),
        scriptXrefs: cdlWordsToB64(d.scriptXrefs),
      } });
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
      cdlWanted = false;
      cdlHalt();
      vscodeApi.postMessage({ command: 'cdlDisabled' });
      cdlSnapRequested = false;
      cdlRefreshUi();
      cdlSetStatus('recording off');
      if (currentBottomTab === 'cdl') cdlRequestSnapshot();
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
        cdlSetStatus('paused - saved');
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
      toggle.addEventListener('click', () => { if (cdlWanted) cdlStop(); else cdlStart(); });
      document.getElementById('cdl-flush').addEventListener('click', () => {
        const sent = cdlDrain();
        vscodeApi.postMessage({ command: 'cdlPause' });
        cdlSetStatus(sent ? 'saved' : 'nothing new to save');
      });
      document.getElementById('cdl-export-asm').addEventListener('click', () => {
        cdlDrain();
        cdlSetStatus('exporting Asar...');
        vscodeApi.postMessage({ command: 'cdlExport', kind: 'asm' });
      });
      document.getElementById('cdl-export-wram').addEventListener('click', () => {
        cdlDrain();
        cdlSetStatus('exporting WRAM...');
        vscodeApi.postMessage({ command: 'cdlExport', kind: 'wram' });
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
        if (!evt.target || evt.target.tagName !== 'CANVAS') return;
        const a = cdlAddressAt(evt);
        if (a) cdlLookup(a.wram ? cdlWramName(a.off) : a.bank + ':' + cdlHex(a.inner, 4));
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden) cdlDrain(); });
    }

    function handleCdlMessage(data) {
      if (data.command === 'cdlConfig') {
        initCdlTab();
        if (data.autoEnable || cdlWanted) cdlStart();
        else { cdlRefreshUi(); if (currentBottomTab === 'cdl') cdlRequestSnapshot(); }
      } else if (data.command === 'cdlSeed') {
        cdlOnSeed(data);
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
  `;
}

module.exports = { getCdlCss, getCdlTabButtonHtml, getCdlViewHtml, getCdlClientScript };
