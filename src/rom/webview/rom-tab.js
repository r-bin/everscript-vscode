// Ownership: the ROM tab in the webview — bank strips, the selected half's
// table, search, the CDL layer, and row details with CDL readers.
// State owned: _rom (model, layer, mode, selected half, open row, search, readers,
// the host's bus facts and the selected bus address). Wiring: rom-init.js.
// Runs inside the panel's shared IIFE (`vs` = the VS Code API). The model comes
// from the host (src/rom/host.js) on demand: the tab asks the first time it shows.

var _rom = { model: null, error: '', layer: 'content', mode: 'file', sel: -1, open: '', query: '', showTiny: false, readers: {}, requested: false, xrefs: false,
  bus: null, busSel: null };

var ROM_COLORS = {
  '🗺️': '#4fa36b', '🖼️': '#3d7fb8', '🧍': '#7a62c4', '🎵': '#c9824a', '📜': '#b8a33d', '💬': '#c25f87',
  '🎞️': '#8f6fd6', '🧠': '#5c6b7a', '📋': '#4bb3b3', '👾': '#d4675a', '⚗️': '#9cc45a', '🎨': '#e0a33d',
  '🏷️': '#9a9a9a', '🐶': '#d4675a', '⚔️': '#d4675a', '🎒': '#d4675a', '⬜': '#2b2f36', '🟫': '#6b4f2a'
};
var ROM_LABELS = [['🗺️', 'Rooms'], ['🖼️', 'Map graphics'], ['🧍', 'Sprites'], ['🎵', 'Audio'], ['📜', 'Scripts'], ['💬', 'Strings'],
  ['🎞️', 'Animation'], ['🧠', 'Code'], ['📋', 'Tables'], ['👾', 'Entities'], ['⚗️', 'Alchemy'], ['🎨', 'Palettes'], ['⬜', 'Unmapped']];
var ROM_CDL_COLORS = ['#2b2f36', '#d16969', '#4e94ce'];   // not seen, executed, read
var ROM_CDL_LABELS = [['#d16969', 'Executed'], ['#4e94ce', 'Read as data'], ['#2b2f36', 'Not seen']];

function romEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function romMd(s) { return romEsc(s).replace(/`([^`]+)`/g, '<code>$1</code>'); }
function romHex(n, w) { return (n >>> 0).toString(16).toUpperCase().padStart(w, '0'); }
function romNum(n) { return Number(n).toLocaleString('en-US'); }
function romPct(n, d) { return d ? Math.round(100 * n / d) + '%' : '—'; }
function romBase(h) { return h.upper ? 0x80 + h.bank : 0xC0 + h.bank; }
function romHalfName(h) { return '$' + romHex(romBase(h), 2) + ':' + (h.upper ? '8000' : '0000') + ' – $' + romHex(romBase(h), 2) + ':' + (h.upper ? 'FFFF' : '7FFF'); }
function romRowKey(r) { return r.a + ':' + (r.n == null ? 'p' : r.n) + ':' + r.name; }

function romRequest(refresh) {
  _rom.requested = true;
  if (vs) vs.postMessage({ command: 'romMapRequest', refresh: !!refresh });
}

// ── Strips ───────────────────────────────────────────────────────────────────
function romStripHtml(h, i) {
  var runs = _rom.layer === 'cdl' ? (h.cdlStrip || [[0, 256]]) : h.strip;
  var segs = runs.map(function (r) {
    var c = _rom.layer === 'cdl' ? ROM_CDL_COLORS[r[0]] : (ROM_COLORS[r[0]] || '#555');
    return '<i style="flex:' + r[1] + ';background:' + c + '"></i>';
  }).join('');
  var tip = romHalfName(h) + ' · mapped ' + romPct(h.mapped + h.code, 0x8000) + (h.cdl ? ' · CDL ' + romPct(h.cdl.code + h.cdl.data, 0x8000) : '');
  return '<div class="rom-half' + (i === _rom.sel ? ' rom-sel' : '') + '" data-rom-half="' + i + '" title="' + romEsc(tip) + '">' + segs + '</div>';
}

function romRenderStrips() {
  var box = document.getElementById('rom-strips');
  if (!box) return;
  var m = _rom.model;
  if (!m) { box.innerHTML = '<div class="rom-empty">' + romEsc(_rom.error || 'Loading the ROM map…') + '</div>'; return; }
  var html = '';
  for (var i = 0; i < m.halves.length; i += 2) {
    html += '<div class="rom-row"><span class="rom-bk">$' + romHex(m.halves[i].bank, 2) + '</span>' +
      romStripHtml(m.halves[i], i) + (m.halves[i + 1] ? romStripHtml(m.halves[i + 1], i + 1) : '<div class="rom-half"></div>') + '</div>';
  }
  box.innerHTML = html;
  var legend = _rom.layer === 'cdl' ? ROM_CDL_LABELS.map(function (l) { return [l[0], l[1]]; })
    : ROM_LABELS.map(function (l) { return [ROM_COLORS[l[0]], l[1]]; });
  document.getElementById('rom-legend').innerHTML = legend.map(function (l) {
    return '<span class="rom-chip"><span class="rom-dot" style="background:' + l[0] + '"></span>' + l[1] + '</span>';
  }).join('');
}

function romRenderTop() {
  var m = _rom.model, t = m && m.totals;
  document.getElementById('rom-title').textContent = m ? m.title + ' · ' + (m.size / 1048576).toFixed(m.size % 1048576 ? 2 : 0) + ' MB' : 'ROM';
  var cdlOn = !!(m && m.hasCdl);
  document.querySelectorAll('[data-rom-layer="cdl"]').forEach(function (b) { b.disabled = !cdlOn; b.title = cdlOn ? 'Colour by what the CDL recorder saw' : 'No CDL library for this ROM (record one in the emulator\'s CDL tab)'; });
  document.getElementById('rom-stats').innerHTML = !m ? '' :
    '<span><b>' + romPct(t.mapped, m.size) + '</b> mapped</span>' +
    '<span><b>' + romNum(t.code) + '</b> B unnamed code</span>' +
    '<span><b>' + romNum(t.unknown) + '</b> B unmapped</span>' +
    '<span><b>' + romNum(t.free) + '</b> B free</span>' +
    (cdlOn ? '<span title="Bytes the CDL recorder saw executed / read"><b>' + romPct(t.cdlCode + t.cdlData, m.size) + '</b> seen by the CDL</span>' : '');
}

// ── Selected half ────────────────────────────────────────────────────────────
function romRowHtml(r) {
  var key = romRowKey(r), point = r.n == null, open = _rom.open === key;
  var cdl = !r.cdl || point ? '' : (r.cdl.code || r.cdl.data)
    ? '<span class="rom-cdlbar" title="CDL: ' + romNum(r.cdl.code) + ' B executed, ' + romNum(r.cdl.data) + ' B read"><i style="flex:' + r.cdl.code + ';background:' + ROM_CDL_COLORS[1] + '"></i><i style="flex:' + r.cdl.data + ';background:' + ROM_CDL_COLORS[2] + '"></i><i style="flex:' + Math.max(0, r.n - r.cdl.code - r.cdl.data) + '"></i></span>' : '';
  var badges = (r.warn ? ' <span class="rom-badge">⚠ overlap</span>' : '') + (r.part ? ' <span class="rom-badge rom-dim">shares bytes</span>' : '');
  var html = '<tr class="rom-tr' + (point ? ' rom-pt' : '') + (r.warn ? ' rom-warn' : '') + (open ? ' rom-open' : '') + '" data-rom-row="' + romEsc(key) + '">' +
    '<td class="rom-addr">' + r.addr + '</td><td class="rom-num">' + (point ? '—' : romNum(r.n)) + '</td>' +
    '<td><span class="rom-dot" style="background:' + (ROM_COLORS[r.cat] || '#555') + '"></span>' + romMd(r.name) + badges + '</td>' +
    '<td class="rom-area">' + romEsc(r.area) + '</td><td class="rom-cdl">' + cdl + '</td>' +
    '<td class="rom-note">' + romMd((r.notes || '').replace(/ · ⚠.*| · bytes also.*/, '')) + '</td></tr>';
  if (open) html += '<tr class="rom-more"><td colspan="6">' + romMoreHtml(r) + '</td></tr>';
  return html;
}

function romMoreHtml(r) {
  var lines = [];
  lines.push('<div><b>File</b> <code>0x' + romHex(r.a, 6) + '</code>' + (r.n != null ? ' – <code>0x' + romHex(r.a + r.n - 1, 6) + '</code> · ' + romNum(r.n) + ' bytes ($' + romHex(r.n, 4) + ')' : ' · point (routine entry or unmeasured table)') + '</div>');
  if (r.notes) lines.push('<div class="rom-fullnote">' + romMd(r.notes) + '</div>');
  if (r.room != null) lines.push('<div><button class="rom-btn" data-rom-goto-room="' + r.room + '">Open in Rooms</button></div>');
  if (r.n != null && _rom.model.hasCdl) {
    lines.push('<div><b>CDL</b> ' + romNum(r.cdl.code) + ' B executed · ' + romNum(r.cdl.data) + ' B read · ' + romNum(r.n - r.cdl.code - r.cdl.data) + ' B not seen</div>');
    var rd = _rom.readers[romRowKey(r)];
    lines.push('<div><b>Read by</b> ' + (!rd ? '<span class="rom-dim">asking…</span>' : rd.none ? '<span class="rom-dim">' + romEsc(rd.none) + '</span>'
      : !rd.readers.length ? '<span class="rom-dim">no exact recorded reads</span>'
      : '<table class="rom-readers">' + rd.readers.map(function (x) {
        return '<tr><td class="rom-addr">' + x.pc + '</td><td>' + romMd(x.where) + '</td><td class="rom-num">' + romNum(x.bytes) + ' B</td><td class="rom-dim">' + (x.dma ? 'DMA ' : '') + (x.bulk ? 'range' : '') + '</td></tr>';
      }).join('') + '</table>') +
      (rd && rd.wide ? '<div class="rom-dim">+ ' + rd.wide + ' routine' + (rd.wide > 1 ? 's' : '') + ' whose recorded reads span more than this half (decompressors, DMA); not listed</div>' : '') + '</div>');
  }
  return '<div class="rom-morebox">' + lines.join('') + '</div>';
}

function romHalfBars(h) {
  var segs = h.rows.filter(function (r) { return r.n; }).map(function (r) {
    return '<i title="' + romEsc(r.addr + ' ' + r.name) + '" style="flex:' + r.n + ';background:' + (ROM_COLORS[r.cat] || '#555') + '"></i>';
  }).join('');
  var cdl = h.cdlStrip ? '<div class="rom-dbar rom-dcdl" title="CDL: executed / read / not seen">' + h.cdlStrip.map(function (r) {
    return '<i style="flex:' + r[1] + ';background:' + ROM_CDL_COLORS[r[0]] + '"></i>';
  }).join('') + '</div>' : '';
  var lo = h.upper ? 0x8000 : 0;
  var ruler = [0, 0x2000, 0x4000, 0x6000, 0x7FFF].map(function (o) { return '<span>$' + romHex(lo + o, 4) + '</span>'; }).join('');
  return '<div class="rom-dbar">' + segs + '</div>' + cdl + '<div class="rom-ruler">' + ruler + '</div>';
}

function romRenderDetail() {
  var box = document.getElementById('rom-detail');
  if (!box) return;
  var m = _rom.model;
  if (!m) { box.innerHTML = ''; return; }
  if (_rom.query && !romAddressQuery(_rom.query)) { box.innerHTML = romSearchHtml(_rom.query); return; }
  var h = m.halves[_rom.sel];
  if (!h) { box.innerHTML = '<div class="rom-empty">Pick a half on the left.</div>'; return; }
  var rows = h.rows, hidden = 0;
  if (!_rom.showTiny) rows = rows.filter(function (r) { var tiny = r.gap && r.gap !== 'code' && r.n < 4; if (tiny) hidden++; return !tiny; });
  var count = function (f) { return h.rows.filter(f).length; };
  var cards = [['Mapped', romPct(h.mapped + h.code, 0x8000)], ['Items', count(function (r) { return r.n && !r.gap; })],
    ['Named points', count(function (r) { return r.n == null; })]];
  if (h.cdl) cards.push(['CDL seen', romPct(h.cdl.code + h.cdl.data, 0x8000)]);
  var warns = count(function (r) { return r.warn; });
  if (warns) cards.push(['Warnings', warns]);
  box.innerHTML =
    '<div class="rom-crumb">ROM › Bank <b>$' + romHex(h.bank, 2) + '</b> › ' + (h.upper ? '⬆️ Upper' : '⬇️ Lower') + ' half</div>' +
    '<h2 class="rom-h2">' + romHalfName(h) + '</h2>' +
    '<div class="rom-sub">file <code>0x' + romHex(h.lo, 6) + '</code> · 32 KB · nothing in the ROM crosses a half line</div>' +
    romHalfBars(h) +
    '<div class="rom-cards">' + cards.map(function (c) { return '<div class="rom-card"><div class="rom-k">' + c[0] + '</div><div class="rom-v">' + c[1] + '</div></div>'; }).join('') + '</div>' +
    '<table class="rom-table"><tr><th>Address</th><th class="rom-num">Size</th><th>Name</th><th>Area</th><th>CDL</th><th>Notes</th></tr>' +
    rows.map(romRowHtml).join('') + '</table>' +
    (hidden ? '<div class="rom-foot">' + hidden + ' gap' + (hidden > 1 ? 's' : '') + ' of 1–3 bytes hidden · <a href="#" data-rom-tiny="1">show</a></div>' : '');
}

// ── Search ───────────────────────────────────────────────────────────────────
function romAddressQuery(q) {
  var t = String(q).trim().replace(/^0x/i, '').replace(/[$:\s]/g, '');
  if (!/^[0-9a-fA-F]{5,6}$/.test(t)) return null;
  var v = parseInt(t, 16), file = /^0x/i.test(String(q).trim()) ? v : (v & 0x3FFFFF);
  return file < (_rom.model ? _rom.model.size : 0) ? file : null;
}

function romFind(file) {
  var m = _rom.model, i = file >> 15, h = m.halves[i];
  if (!h) return;
  _rom.sel = i;
  var hit = null;
  h.rows.forEach(function (r) { if (r.n && file >= r.a && file < r.a + r.n) hit = r; });
  _rom.open = hit ? romRowKey(hit) : '';
  if (hit) romAskReaders(hit);
}

function romSearchHtml(q) {
  var needle = q.toLowerCase(), hits = [];
  _rom.model.halves.forEach(function (h, i) {
    h.rows.forEach(function (r) {
      if (hits.length < 200 && !r.gap && ((r.name + ' ' + (r.notes || '') + ' ' + r.area).toLowerCase().indexOf(needle) >= 0)) hits.push([i, r]);
    });
  });
  return '<div class="rom-crumb">Search</div><h2 class="rom-h2">' + hits.length + (hits.length === 200 ? '+' : '') + ' matches for “' + romEsc(q) + '”</h2>' +
    '<table class="rom-table"><tr><th>Address</th><th class="rom-num">Size</th><th>Name</th><th>Area</th></tr>' +
    hits.map(function (x) {
      var r = x[1];
      return '<tr class="rom-tr" data-rom-jump="' + r.a + '"><td class="rom-addr">' + r.addr + '</td><td class="rom-num">' + (r.n == null ? '—' : romNum(r.n)) + '</td>' +
        '<td><span class="rom-dot" style="background:' + (ROM_COLORS[r.cat] || '#555') + '"></span>' + romMd(r.name) + '</td><td class="rom-area">' + romEsc(r.area) + '</td></tr>';
    }).join('') + '</table>';
}

function romAskReaders(r) {
  if (!r || r.n == null || !_rom.model.hasCdl || _rom.readers[romRowKey(r)]) return;
  if (vs) vs.postMessage({ command: 'romReaders', s: r.a, e: r.a + r.n, key: romRowKey(r) });
}
