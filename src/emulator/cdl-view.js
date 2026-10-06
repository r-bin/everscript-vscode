'use strict';

/**
 * emulator/cdl-view.js
 *
 * The emulator's CDL bottom-bar tab: record toggle (off by default), ROM
 * coverage strips (one per 64 KB of ROM, one pixel per byte), Asar / WRAM
 * export buttons and the xref lookup box. Recording state lives in the core
 * (cdl.c); this script seeds it from the host library, drains deltas every
 * CDL_FLUSH_MS and repaints the chunks the core marks dirty.
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
    #cdl-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
    #cdl-banks { flex: 3; min-width: 0; overflow-y: auto; padding: 4px 8px; }
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

const LEGEND = [
  ['unreached', '#101010'], ['empty', '#2f4f4f'], ['opcode', '#ffff00'], ['operand', '#9acd32'],
  ['data', '#ffdead'], ['pointer', '#da70d6'], ['graphics (DMA)', '#ffb6c1'], ['music (APU)', '#add8e6'],
  ['M/X conflict', '#ff4040'],
];

function getCdlViewHtml() {
  const legend = LEGEND.map(([name, color]) => `<span><i style="background:${color}"></i>${name}</span>`).join('');
  return `
    <div id="ss-view-cdl" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="cdl-toggle" class="ss-btn" type="button" title="Record code/data coverage, calls and memory accesses (in memory, flushed every 15 s)">start recording</button>
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
who calls each function and who reads or writes each WRAM address. Data is kept per ROM
in the extension's storage and merges across sessions, so the game does not have to be
finished in one sitting. Click a strip to look up that address.</div></div>
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
    const CDL_FLUSH_MS = 15000;
    const CDL_CHUNK = 0x10000;
    const CDL_W = 1024;
    const CDL_COLORS = [${colors}];
    let cdlWanted = false;
    let cdlOn = false;
    let cdlTimer = null;
    let cdlPaintTimer = null;
    let cdlLabels = [];
    let cdlCanvases = [];
    let cdlLastFlush = 0;
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

    function cdlRefreshUi() {
      const t = document.getElementById('cdl-toggle');
      if (t) { t.textContent = cdlOn ? 'stop recording' : 'start recording'; t.classList.toggle('active', cdlOn); }
      setControlEnabled('cdl-flush', cdlOn);
      const badge = document.getElementById('ss-cdl-count');
      if (badge) {
        if (!cdlOn) badge.textContent = 'off';
        else if (cdlSummary) badge.textContent = (100 * (cdlSummary.code + cdlSummary.data) / cdlSummary.romSize).toFixed(1) + '%';
        else badge.textContent = 'rec';
      }
    }

    function cdlStart() {
      const m = cdlApi();
      if (!m) { cdlSetStatus('this core has no CDL recorder (custom debugger core required)'); return; }
      cdlWanted = true;
      cdlSetStatus('loading library...');
      vscodeApi.postMessage({ command: 'cdlEnable' });
    }

    function cdlOnSeed(msg) {
      const m = cdlApi();
      if (!m || !cdlWanted || cdlOn) return;
      if (!m.cdlEnable()) { cdlSetStatus('could not start recording (no ROM?)'); return; }
      m.cdlSeed(cdlB64ToBytes(msg.cdl), cdlB64ToBytes(msg.ext));
      cdlOn = true;
      cdlLabels = msg.labels || [];
      cdlBuildStrips(m.cdlView(true).size);
      if (!cdlTimer) cdlTimer = setInterval(cdlFlush, CDL_FLUSH_MS);
      if (!cdlPaintTimer) cdlPaintTimer = setInterval(cdlPaint, 1000);
      cdlRefreshUi();
      cdlPaint();
    }

    function cdlFlush() {
      const m = cdlApi();
      if (!m || !cdlOn) return;
      const d = m.cdlDrain();
      if (!d.chunks.length && !d.wvals.length && !d.xrefs.length && !d.edges.length && !d.stats.length) return;
      vscodeApi.postMessage({ command: 'cdlDelta', delta: {
        chunks: d.chunks.map(c => ({ index: c.index, cdl: cdlBytesToB64(c.cdl), ext: cdlBytesToB64(c.ext) })),
        wvals: d.wvals.map(w => ({ index: w.index, data: cdlBytesToB64(w.data) })),
        xrefs: cdlWordsToB64(d.xrefs),
        edges: cdlWordsToB64(d.edges),
        stats: cdlWordsToB64(d.stats),
      } });
      cdlLastFlush = Date.now();
    }

    function cdlHalt() {
      const m = cdlApi();
      if (!cdlOn) return;
      cdlFlush();
      if (m) m.cdlDisable();
      cdlOn = false;
      if (cdlTimer) { clearInterval(cdlTimer); cdlTimer = null; }
      if (cdlPaintTimer) { clearInterval(cdlPaintTimer); cdlPaintTimer = null; }
    }

    function cdlStop() {
      cdlWanted = false;
      cdlHalt();
      vscodeApi.postMessage({ command: 'cdlDisabled' });
      cdlRefreshUi();
      cdlSetStatus('recording off');
    }

    // Called before the core is restarted with another ROM: flush what belongs to the old one.
    function cdlBeforeRomChange() {
      cdlHalt();
      cdlRefreshUi();
    }

    function cdlBuildStrips(size) {
      const host = document.getElementById('cdl-banks');
      if (!host) return;
      host.innerHTML = '';
      cdlCanvases = [];
      const chunks = Math.ceil(size / CDL_CHUNK);
      for (let i = 0; i < chunks; i++) {
        const len = Math.min(CDL_CHUNK, size - i * CDL_CHUNK);
        const row = document.createElement('div');
        row.className = 'cdl-bank';
        const label = document.createElement('div');
        label.className = 'cdl-bank-label';
        label.innerHTML = (cdlLabels[i] || cdlHex(i, 2)) + '<small>-</small>';
        const canvas = document.createElement('canvas');
        canvas.width = CDL_W;
        canvas.height = Math.ceil(len / CDL_W);
        canvas.setAttribute('data-chunk', String(i));
        row.appendChild(label);
        row.appendChild(canvas);
        host.appendChild(row);
        cdlCanvases.push({ canvas, label, len });
      }
    }

    function cdlColor(c, e, b) {
      if (!c && !e) return (b === 0 || b === 0xFF) ? 1 : 0;
      if ((e & 0x04) && (((c & 0x20) && (e & 0x08)) || ((c & 0x10) && (e & 0x10)))) return 8;
      if (e & 0x04) return 2;
      if (c & 0x01) return 3;
      if (e & 0x02) return 7;
      if (e & 0x01) return 6;
      if (e & 0x20) return 5;
      return 4;
    }

    function cdlPaintChunk(view, i, rom) {
      const s = cdlCanvases[i];
      if (!s) return;
      const ctx = s.canvas.getContext('2d');
      const img = ctx.createImageData(s.canvas.width, s.canvas.height);
      const base = i * CDL_CHUNK;
      let hit = 0;
      for (let j = 0; j < s.len; j++) {
        const c = view.cdl[base + j], e = view.ext[base + j];
        if (c) hit++;
        const col = CDL_COLORS[cdlColor(c, e, rom ? rom[base + j] : 0)];
        const p = j * 4;
        img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const small = s.label.querySelector('small');
      if (small) small.textContent = (100 * hit / s.len).toFixed(1) + '%';
    }

    function cdlRom() {
      return loadedRomData ? ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData) : null;
    }

    function cdlPaint() {
      const m = cdlApi();
      if (!m || !cdlOn || currentBottomTab !== 'cdl') return;
      const view = m.cdlView();
      if (!view) return;
      const rom = cdlRom();
      for (let i = 0; i < cdlCanvases.length; i++) if (view.dirty[i]) cdlPaintChunk(view, i, rom);
      const age = cdlLastFlush ? Math.round((Date.now() - cdlLastFlush) / 1000) + ' s ago' : 'pending';
      const s = cdlSummary;
      cdlSetStatus('recording - ' + (s ? s.code + ' code / ' + s.data + ' data bytes, ' + s.edges + ' edges, ' + s.xrefs + ' xrefs' : 'merging') + ' - flushed ' + age);
    }

    function cdlOffsetAt(evt) {
      const canvas = evt.target;
      const i = parseInt(canvas.getAttribute('data-chunk') || '-1', 10);
      if (i < 0) return -1;
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((evt.clientX - r.left) * canvas.width / r.width);
      const y = Math.floor((evt.clientY - r.top) * canvas.height / r.height);
      return i * CDL_CHUNK + y * CDL_W + x;
    }

    function cdlDescribe(off) {
      const m = cdlApi();
      const view = m && cdlOn ? m.cdlView(true) : null;
      const i = Math.floor(off / CDL_CHUNK);
      const bank = cdlLabels[i] || cdlHex(i, 2);
      let text = bank + ':' + cdlHex(off % CDL_CHUNK, 4) + '  (ROM $' + cdlHex(off, 6) + ')';
      if (view) {
        const c = view.cdl[off], e = view.ext[off];
        const parts = [];
        if (e & 0x04) parts.push('opcode ' + ((c & 0x20) ? 'M8' : '') + ((e & 0x08) ? 'M16' : '') + ' ' + ((c & 0x10) ? 'X8' : '') + ((e & 0x10) ? 'X16' : ''));
        else if (c & 0x01) parts.push('operand');
        if (c & 0x02) parts.push('data');
        if (c & 0x08) parts.push('function entry');
        if (c & 0x04) parts.push('jump target');
        if (e & 0x01) parts.push('DMA source');
        if (e & 0x02) parts.push('APU');
        if (e & 0x20) parts.push('pointer');
        text += '  ' + (parts.join(', ') || 'unreached');
      }
      return text;
    }

    function cdlLookup(query) {
      const input = document.getElementById('cdl-lookup-input');
      if (input && query !== undefined) input.value = query;
      const q = input ? input.value.trim() : '';
      if (!q) return;
      if (cdlOn) cdlFlush();
      const out = document.getElementById('cdl-lookup-out');
      if (out) out.textContent = 'looking up ' + q + '...';
      vscodeApi.postMessage({ command: 'cdlLookup', query: q });
    }

    function initCdlTab() {
      const toggle = document.getElementById('cdl-toggle');
      if (!toggle || toggle.getAttribute('data-bound')) return;
      toggle.setAttribute('data-bound', '1');
      toggle.addEventListener('click', () => { if (cdlOn || cdlWanted) cdlStop(); else cdlStart(); });
      document.getElementById('cdl-flush').addEventListener('click', () => { cdlFlush(); cdlSetStatus('flushed'); });
      document.getElementById('cdl-export-asm').addEventListener('click', () => {
        cdlFlush();
        cdlSetStatus('exporting Asar...');
        vscodeApi.postMessage({ command: 'cdlExport', kind: 'asm' });
      });
      document.getElementById('cdl-export-wram').addEventListener('click', () => {
        cdlFlush();
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
        const off = cdlOffsetAt(evt);
        if (off >= 0) document.getElementById('cdl-hover').textContent = cdlDescribe(off);
      });
      banks.addEventListener('click', evt => {
        if (!evt.target || evt.target.tagName !== 'CANVAS') return;
        const off = cdlOffsetAt(evt);
        if (off < 0) return;
        const i = Math.floor(off / CDL_CHUNK);
        cdlLookup((cdlLabels[i] || cdlHex(i, 2)) + ':' + cdlHex(off % CDL_CHUNK, 4));
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden) cdlFlush(); });
      window.addEventListener('beforeunload', cdlFlush);
    }

    function handleCdlMessage(data) {
      if (data.command === 'cdlConfig') {
        initCdlTab();
        if (data.autoEnable || cdlWanted) cdlStart();
        else cdlRefreshUi();
      } else if (data.command === 'cdlSeed') {
        cdlOnSeed(data);
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
