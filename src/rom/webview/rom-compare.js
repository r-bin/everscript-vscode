// Ownership: the ROM tab's Compare view — file halves beside the bus map. The
// selected file half (_rom.sel) is outlined everywhere it appears on the bus;
// clicking the map selects the file half under it. Tables: that half's bus
// windows, and the four ROM windows over the whole cartridge.

function romWindowSummaryHtml() {
  var groups = {};
  for (var b = 0; b < 256; b++) for (var u = 0; u < 2; u++) {
    var at = romBusAt(b, u ? 0x8000 : 0);
    if (at.k !== 'rom') continue;
    var key = (at.fast ? 'fast' : 'slow') + '|' + at.window;
    var g = groups[key] || (groups[key] = { fast: at.fast, window: at.window, lo: b, hi: b, halves: 0, ex: 0 });
    g.lo = Math.min(g.lo, b); g.hi = Math.max(g.hi, b); g.halves++; g.ex += romBusExecuted(b, !!u);
  }
  var rows = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (x, y) { return x.lo - y.lo; });
  return '<table class="rom-table"><tr><th>Window</th><th>Banks</th><th>Speed</th><th class="rom-num">Shows</th><th class="rom-num">Code seen running (CDL)</th></tr>' +
    rows.map(function (g) {
      return '<tr><td>' + g.window + '</td><td class="rom-addr">$' + romHex(g.lo, 2) + '–$' + romHex(g.hi, 2) + '</td><td>' + (g.fast ? 'fast' : 'slow') + '</td>' +
        '<td class="rom-num">' + romNum(g.halves * 32) + ' KB</td><td class="rom-num ' + (g.ex ? 'rom-yes' : 'rom-dim') + '">' + (g.ex ? romNum(g.ex) + ' instruction' + (g.ex > 1 ? 's' : '') : '—') + '</td></tr>';
    }).join('') + '</table>';
}

function romCompareSideHtml(h) {
  var wins = romBusWindowsOf(h.lo);
  return '<div class="rom-crumb">Compare › file half</div><h2 class="rom-h2">file <code>0x' + romHex(h.lo, 6) + '–0x' + romHex(h.lo + 0x7FFF, 6) + '</code></h2>' +
    '<div class="rom-sub">' + romHalfName(h) + ' in the File view · appears ' + wins.length + '× on the bus (outlined)</div>' +
    '<table class="rom-table"><tr><th>Bus range</th><th>Window</th><th>Speed</th><th>Code seen running here (CDL)</th></tr>' +
    wins.map(function (w) {
      var from = w.upper ? 0x8000 : 0, ex = romBusExecuted(w.bank, w.upper);
      return '<tr><td class="rom-addr">$' + romHex(w.bank, 2) + ':' + romHex(from, 4) + '–' + romHex(from + 0x7FFF, 4) + '</td><td>' + w.window + '</td><td>' + (w.fast ? 'fast' : 'slow') + '</td>' +
        '<td class="' + (ex ? 'rom-yes' : 'rom-dim') + '">' + (ex ? '✓ ' + romNum(ex) + ' instruction' + (ex > 1 ? 's' : '') : '—') + '</td></tr>';
    }).join('') + '</table>' +
    '<div class="rom-cmp-items">' + h.rows.filter(function (r) { return r.n && !r.gap; }).slice(0, 12).map(function (r) {
      return '<span class="rom-chip"><span class="rom-dot" style="background:' + (ROM_COLORS[r.cat] || '#555') + '"></span>' + romMd(r.name) + '</span>';
    }).join('') + '</div>' +
    '<h3 class="rom-h3">The four ROM windows</h3>' + romWindowSummaryHtml();
}

function romRenderCompare() {
  var box = document.getElementById('rom-cmp-view');
  if (!box || !_rom.model) return;
  var m = _rom.model, h = m.halves[_rom.sel] || m.halves[0], rows = '';
  for (var i = 0; i < m.halves.length; i += 2) {
    rows += '<div class="rom-row"><span class="rom-bk">$' + romHex(m.halves[i].bank, 2) + '</span>' + romStripHtml(m.halves[i], i) +
      (m.halves[i + 1] ? romStripHtml(m.halves[i + 1], i + 1) : '<div class="rom-half"></div>') + '</div>';
  }
  box.innerHTML = '<div class="rom-cmp-file"><div class="rom-cap">File · 32 KB halves</div>' + rows + '</div>' +
    '<div class="rom-cmp-bus"><div class="rom-cap">Bus · where the selected half appears</div>' + romBusFrameHtml('rom-cmp-canvas') +
    '<div class="rom-legend">' + romBusLegendHtml() + '</div></div>' +
    '<div class="rom-cmp-side">' + romCompareSideHtml(h) + '</div>';
  romBusDraw(document.getElementById('rom-cmp-canvas'), romBusWindowsOf(h.lo), null);
}
