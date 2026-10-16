// Ownership: the ROM tab's Bus view — the 24-bit address-space map and the
// resolver for the selected bus address (what it reaches, its mirrors, what the
// CDL saw). Reads/writes _rom.busSel (rom-tab.js owns _rom).

function romBusAddr(bank, a) { return '$' + romHex(bank, 2) + ':' + romHex(a, 4); }

/** The model row (region or gap) that contains file offset `file`. */
function romRowAt(file) {
  var h = _rom.model.halves[file >> 15], hit = null;
  if (h) h.rows.forEach(function (r) { if (r.n && file >= r.a && file < r.a + r.n) hit = r; });
  return hit;
}

function romBusMirrorsHtml(file) {
  var rows = [];
  for (var b = 0; b < 256; b++) {
    var a = file & 0xFFFF, at = romBusAt(b, a);
    if (at.k !== 'rom' || at.file !== file) {
      // LoROM upper halves show the file at offset | $8000
      at = romBusAt(b, a | 0x8000);
      if (at.k !== 'rom' || at.file !== file) continue;
      a = a | 0x8000;
    }
    var ex = romBusExecuted(b, a >= 0x8000);
    rows.push('<tr' + (_rom.busSel && _rom.busSel.bank === b ? ' class="rom-open"' : '') + '><td class="rom-addr">' + romBusAddr(b, a) + '</td><td>' + at.window + '</td><td>' + (at.fast ? 'fast' : 'slow') + '</td>' +
      '<td class="' + (ex ? 'rom-yes' : 'rom-dim') + '">' + (ex ? '✓ ' + romNum(ex) + ' instruction' + (ex > 1 ? 's' : '') + ' ran in this bank half' : '—') + '</td></tr>');
  }
  return '<table class="rom-table"><tr><th>Mirror</th><th>Window</th><th>Speed</th><th>Code seen running here (CDL)</th></tr>' + rows.join('') + '</table>' +
    '<div class="rom-dim rom-small">Data reads are recorded by file offset, so the CDL cannot tell which mirror they went through; instruction addresses are bus addresses.</div>';
}

function romBusResolverHtml() {
  var s = _rom.busSel, m = _rom.model;
  if (!s) return '<div class="rom-empty">Click the map or search a bus address ($9F:D600, 7E:2258).</div>';
  var at = romBusAt(s.bank, s.a), html = '<div class="rom-crumb">Bus › bank <b>$' + romHex(s.bank, 2) + '</b></div><h2 class="rom-h2">' + romBusAddr(s.bank, s.a) + '</h2>';
  if (at.k === 'rom') {
    var r = romRowAt(at.file);
    html += '<div class="rom-sub">ROM · ' + (at.fast ? 'fast' : 'slow') + ' window (' + at.window + ') → file <code>0x' + romHex(at.file, 6) + '</code></div>';
    if (r) {
      html += '<div class="rom-card rom-wide"><div class="rom-k">Resolves to</div><div class="rom-v"><span class="rom-dot" style="background:' + (ROM_COLORS[r.cat] || '#555') + '"></span>' + romMd(r.name) +
        (r.area ? ' <span class="rom-dim">· ' + romEsc(r.area) + '</span>' : '') + '</div>' +
        '<div class="rom-k" style="margin-top:6px">' + r.addr + ' + $' + romHex(at.file - r.a, 4) + ' of ' + romNum(r.n) + ' B · ' +
        '<button class="rom-btn" data-rom-show-file="' + at.file + '">Show in File view</button>' +
        (r.room != null ? ' <button class="rom-btn" data-rom-goto-room="' + r.room + '">Open in Rooms</button>' : '') + '</div></div>';
    }
    html += romBusMirrorsHtml(at.file);
  } else if (at.k === 'wram') {
    html += '<div class="rom-sub">WRAM' + (at.mirror ? ' (mirror of the first 8 KB in every system bank)' : '') + ' → <code>$' + romHex(0x7E0000 + at.wram, 6) + '</code></div>' +
      '<div class="rom-card rom-wide"><div class="rom-k">Work RAM</div><div class="rom-v">128 KB at <code>$7E:0000–$7F:FFFF</code>; <code>$0000–$1FFF</code> of banks <code>$00–$3F</code> / <code>$80–$BF</code> show its first 8 KB.</div>' +
      '<div style="margin-top:6px"><button class="rom-btn" data-rom-open-memory="1">Open Memory tab</button></div></div>';
  } else if (at.k === 'io') {
    html += '<div class="rom-sub">Hardware registers · ' + romIoName(s.a) + '</div><div class="rom-card rom-wide"><div class="rom-v">Not memory: reads and writes go to the PPU, APU, CPU or DMA hardware.</div></div>';
  } else if (at.k === 'sram') {
    html += '<div class="rom-sub">SRAM · battery-backed save RAM, offset <code>$' + romHex(at.sram, 4) + '</code></div><div class="rom-card rom-wide"><div class="rom-v">' +
      romNum((m.mapping || {}).sramBytes || 0) + ' bytes, mirrored through <code>$6000–$7FFF</code> of banks <code>$20–$3F</code> / <code>$A0–$BF</code>.</div></div>';
  } else {
    html += '<div class="rom-sub">Open bus · nothing answers here; a read returns the last value on the data bus.</div>';
  }
  return html;
}

function romBusWramHtml() {
  var w = _rom.bus && _rom.bus.wram;
  if (!w) return '';
  return '<h3 class="rom-h3">WRAM $7E:0000 – $7F:FFFF</h3><div class="rom-wram">' + w.strip.map(function (r) {
    return '<i style="flex:' + r[1] + ';background:' + ROM_WRAM_CDL[r[0]] + '"></i>';
  }).join('') + '</div><div class="rom-ruler"><span>$7E:0000</span><span>$7E:8000</span><span>$7F:0000</span><span>$7F:8000</span><span>$7F:FFFF</span></div>' +
    '<div class="rom-dim rom-small">CDL: <span style="color:' + ROM_WRAM_CDL[2] + '">■</span> written · <span style="color:' + ROM_WRAM_CDL[1] + '">■</span> read · <span style="color:' + ROM_WRAM_CDL[3] + '">■</span> executed (code in RAM) · ' + romNum(w.touched) + ' B touched</div>';
}

function romRenderBus() {
  var box = document.getElementById('rom-bus-view');
  if (!box || !_rom.model) return;
  box.innerHTML = '<div class="rom-bus-left"><div class="rom-cap">banks $00–$FF → · offsets $0000–$FFFF ↓</div>' + romBusFrameHtml('rom-bus-canvas') +
    '<div class="rom-legend">' + romBusLegendHtml() + '</div></div>' +
    '<div class="rom-bus-right">' + romBusResolverHtml() + romBusWramHtml() + '</div>';
  romBusDraw(document.getElementById('rom-bus-canvas'), null, _rom.busSel);
}

/** Parse a bus address: $9F:D600, 9F:D600, 9FD600, 7E2258. */
function romParseBus(q) {
  var t = String(q).trim().replace(/[$:\s]/g, '');
  if (!/^[0-9a-fA-F]{5,6}$/.test(t)) return null;
  var v = parseInt(t, 16);
  return { bank: v >>> 16, a: v & 0xFFFF };
}
