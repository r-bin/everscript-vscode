'use strict';

/**
 * emulator/cdl-strips.js
 *
 * Client script for the CDL tab's strips (see cdl-view.js for the tab and its
 * state): one canvas per 64 KB of ROM and per WRAM bank, one pixel per byte,
 * repainted only for the chunks marked in cdlNeedsPaint; hover descriptions.
 * Shares the tab's globals (cdlRomStrips, cdlWramStrips, cdlNeedsPaint,
 * CDL_COLORS, ...) - both scripts are embedded in the same <script>.
 *
 * Invariant: ASCII only, no backslashes (template literal).
 */

function getCdlStripsScript() {
  return `
    // -- strips -------------------------------------------------------------------
    function cdlAddStrip(host, label, len, attr) {
      const row = document.createElement('div');
      row.className = 'cdl-bank';
      const lab = document.createElement('div');
      lab.className = 'cdl-bank-label';
      lab.innerHTML = label + '<small>-</small>';
      const canvas = document.createElement('canvas');
      canvas.width = CDL_W;
      canvas.height = Math.ceil(len / CDL_W);
      canvas.setAttribute('data-strip', attr);
      row.appendChild(lab);
      row.appendChild(canvas);
      host.appendChild(row);
      return { canvas, label: lab, len };
    }

    function cdlBuildStrips(size) {
      const host = document.getElementById('cdl-banks');
      if (!host) return;
      host.innerHTML = '';
      const group = text => { const g = document.createElement('div'); g.className = 'cdl-group'; g.textContent = text; host.appendChild(g); };
      group('WRAM');
      cdlWramStrips = [0, 1].map(b => cdlAddStrip(host, '7' + (b ? 'F' : 'E'), CDL_CHUNK, 'w' + b));
      group('ROM');
      cdlRomStrips = [];
      for (let i = 0; i * CDL_CHUNK < size; i++) {
        cdlRomStrips.push(cdlAddStrip(host, cdlLabels[i] || cdlHex(i, 2), Math.min(CDL_CHUNK, size - i * CDL_CHUNK), String(i)));
      }
    }

    function cdlRomColor(c, e, b) {
      if (!c && !e) return (b === 0 || b === 0xFF) ? 1 : 0;
      if ((e & 0x04) && (((c & 0x20) && (e & 0x08)) || ((c & 0x10) && (e & 0x10)))) return 8;
      if (e & 0x04) return 2;
      if (c & 0x01) return 3;
      if (e & 0x02) return 7;
      if (e & 0x80) return 14;
      if (e & 0x01) return 6;
      if (e & 0x20) return 5;
      return 4;
    }

    function cdlWramColor(f) {
      if (f & 0x10) return 13;
      if (f & 0x20) return 12;
      if (f & 0x80) return 15;
      if ((f & 3) === 3) return 11;
      if (f & 2) return 10;
      if (f & 1) return 9;
      return 0;
    }

    function cdlPaintStrip(s, colorAt) {
      const ctx = s.canvas.getContext('2d');
      const img = ctx.createImageData(s.canvas.width, s.canvas.height);
      let hit = 0;
      for (let j = 0; j < s.len; j++) {
        const id = colorAt(j);
        if (id > 1) hit++;
        const col = CDL_COLORS[id];
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
      if (currentBottomTab !== 'cdl' || !cdlNeedsPaint.size) return;
      const data = cdlData();
      if (!data) return;
      const rom = cdlRom();
      for (const key of cdlNeedsPaint) {
        if (typeof key === 'number') {
          const base = key * CDL_CHUNK;
          if (cdlRomStrips[key]) cdlPaintStrip(cdlRomStrips[key], j => cdlRomColor(data.cdl[base + j], data.ext[base + j], rom ? rom[base + j] : 0));
        } else if (data.wflags && data.wflags.length) {
          const b = key === 'w1' ? 1 : 0;
          if (cdlWramStrips[b]) cdlPaintStrip(cdlWramStrips[b], j => cdlWramColor(data.wflags[b * CDL_CHUNK + j]));
        }
      }
      cdlNeedsPaint.clear();
      if (cdlOn) {
        const age = cdlLastDrain ? Math.round((Date.now() - cdlLastDrain) / 1000) + ' s ago' : 'pending';
        const s = cdlSummary;
        cdlSetStatus((cdlPaused ? 'paused' : 'recording') + ' - ' + (s ? s.code + ' code / ' + s.data + ' data bytes, ' + s.wram + ' WRAM bytes, '
          + s.edges + ' edges, ' + s.xrefs + ' xrefs, ' + s.scriptXrefs + ' script xrefs' : 'merging') + ' - sent ' + age);
      }
    }

    function cdlOnTabShown() {
      if (!cdlOn) { cdlRequestSnapshot(); if (cdlSnap) { cdlNeedsPaint = cdlAllStrips(); cdlPaint(); } return; }
      cdlNeedsPaint = cdlAllStrips();
      cdlPaint();
    }

    // -- hover / lookup -----------------------------------------------------------
    function cdlAddressAt(evt) {
      const canvas = evt.target;
      const strip = canvas.getAttribute('data-strip');
      if (strip === null) return null;
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((evt.clientX - r.left) * canvas.width / r.width);
      const y = Math.floor((evt.clientY - r.top) * canvas.height / r.height);
      const inner = y * CDL_W + x;
      if (strip[0] === 'w') return { wram: true, off: (strip === 'w1' ? CDL_CHUNK : 0) + inner };
      const i = parseInt(strip, 10);
      return { wram: false, off: i * CDL_CHUNK + inner, bank: cdlLabels[i] || cdlHex(i, 2), inner };
    }

    function cdlWramName(off) { return '7' + (off >= CDL_CHUNK ? 'F' : 'E') + ':' + cdlHex(off & 0xFFFF, 4); }

    function cdlDescribe(a) {
      const data = cdlData();
      const parts = [];
      if (a.wram) {
        const f = data && data.wflags ? data.wflags[a.off] : 0;
        if (f & 1) parts.push('read');
        if (f & 2) parts.push('written');
        if (f & 8) parts.push('16-bit');
        if (f & 4) parts.push('8-bit');
        if (f & 0x20) parts.push('by scripts');
        if (f & 0x10) parts.push('executed');
        if (f & 0x40) parts.push('pointer');
        if (f & 0x80) parts.push('DMA / HDMA / $2180');
        return cdlWramName(a.off) + '  ' + (parts.join(', ') || 'untouched');
      }
      const text = a.bank + ':' + cdlHex(a.inner, 4) + '  (ROM $' + cdlHex(a.off, 6) + ')';
      if (!data) return text;
      const c = data.cdl[a.off], e = data.ext[a.off];
      if (e & 0x04) parts.push('opcode ' + ((c & 0x20) ? 'M8' : '') + ((e & 0x08) ? 'M16' : '') + ' ' + ((c & 0x10) ? 'X8' : '') + ((e & 0x10) ? 'X16' : ''));
      else if (c & 0x01) parts.push('operand');
      if (c & 0x02) parts.push('data');
      if (c & 0x08) parts.push('function entry');
      if (c & 0x04) parts.push('jump target');
      if (e & 0x01) parts.push('DMA source');
      if (e & 0x02) parts.push('APU');
      if (e & 0x20) parts.push('pointer');
      if (e & 0x80) parts.push('HDMA table');
      return text + '  ' + (parts.join(', ') || 'unreached');
    }

  `;
}

module.exports = { getCdlStripsScript };
