// Ownership: the ROM tab's wiring — one delegated click / input / hover listener
// per node, the host messages, and switching between the File, Bus and Compare
// views. Loaded last: every render function it calls is defined by then.
// Bound once per page (the panel rebuilds the page on every re-render).

function romRenderView() {
  var views = { file: 'rom-file-view', bus: 'rom-bus-view', cmp: 'rom-cmp-view' };
  Object.keys(views).forEach(function (k) {
    var el = document.getElementById(views[k]);
    if (el) el.style.display = k === _rom.mode ? '' : 'none';
  });
  document.querySelectorAll('[data-rom-mode]').forEach(function (b) { b.classList.toggle('rom-on', b.dataset.romMode === _rom.mode); });
  if (_rom.mode === 'bus') romRenderBus();
  else if (_rom.mode === 'cmp') romRenderCompare();
  else { romRenderStrips(); romRenderDetail(); }
}

function romRenderAll() { romRenderTop(); romRenderView(); }

function romRowByKey(key) {
  var h = _rom.model && _rom.model.halves[_rom.sel], hit = null;
  if (h) h.rows.forEach(function (r) { if (romRowKey(r) === key) hit = r; });
  return hit;
}

function romClosest(el, attr, root) {
  for (var n = el; n && n !== root; n = n.parentNode) if (n.dataset && n.dataset[attr] !== undefined) return n;
  return null;
}

function romClearSearch() { _rom.query = ''; var s = document.getElementById('rom-search'); if (s) s.value = ''; }

function romCanvasClick(canvas, e) {
  var at = romBusFromEvent(canvas, e);
  if (_rom.mode === 'bus') { _rom.busSel = at; romRenderBus(); return; }
  var hit = romBusAt(at.bank, at.a);
  if (hit.k === 'rom') { _rom.sel = hit.file >> 15; romRenderCompare(); }
}

function romOnClick(e, pane) {
  var t;
  if ((t = romClosest(e.target, 'romCanvas', pane))) { romCanvasClick(t, e); return; }
  if ((t = romClosest(e.target, 'romMode', pane))) { _rom.mode = t.dataset.romMode; romClearSearch(); romRenderView(); return; }
  if ((t = romClosest(e.target, 'romHalf', pane))) { _rom.sel = Number(t.dataset.romHalf); _rom.open = ''; romClearSearch(); romRenderView(); return; }
  if ((t = romClosest(e.target, 'romLayer', pane))) {
    if (t.disabled) return;
    _rom.layer = t.dataset.romLayer;
    pane.querySelectorAll('[data-rom-layer]').forEach(function (b) { b.classList.toggle('rom-on', b === t); });
    romRenderView(); return;
  }
  if ((t = romClosest(e.target, 'romGotoRoom', pane))) {
    var rooms = document.querySelector('.tab[data-tab="rooms"]');
    if (rooms) rooms.click();
    if (typeof gotoVanillaRoom === 'function') gotoVanillaRoom(Number(t.dataset.romGotoRoom));
    return;
  }
  if ((t = romClosest(e.target, 'romOpenMemory', pane))) { var mem = document.querySelector('.tab[data-tab="radar"]'); if (mem) mem.click(); return; }
  if ((t = romClosest(e.target, 'romShowFile', pane))) { _rom.mode = 'file'; romFind(Number(t.dataset.romShowFile)); romRenderView(); return; }
  if ((t = romClosest(e.target, 'romTiny', pane))) { e.preventDefault(); _rom.showTiny = true; romRenderDetail(); return; }
  if ((t = romClosest(e.target, 'romJump', pane))) { romClearSearch(); romFind(Number(t.dataset.romJump)); romRenderView(); return; }
  if ((t = romClosest(e.target, 'romRow', pane))) {
    _rom.open = _rom.open === t.dataset.romRow ? '' : t.dataset.romRow;
    romAskReaders(romRowByKey(_rom.open));
    romRenderDetail();
  }
}

function romOnSearch(q) {
  _rom.query = q;
  if (!_rom.model) return;
  if (_rom.mode === 'bus') {
    var b = romParseBus(q);
    if (b) { _rom.busSel = b; romRenderBus(); }
    return;
  }
  var file = romAddressQuery(q);
  if (file != null) romFind(file);
  if (_rom.mode === 'cmp') { if (file != null) romRenderCompare(); return; }
  romRenderStrips(); romRenderDetail();
}

/** Hover on a grid: the address and what it reaches, as the canvas tooltip. */
function romOnHover(e) {
  var c = e.target;
  if (!c || !c.dataset || c.dataset.romCanvas === undefined || !_rom.model) return;
  var at = romBusFromEvent(c, e), hit = romBusAt(at.bank, at.a), what = hit.k;
  if (hit.k === 'rom') { var r = romRowAt(hit.file); what = (r ? r.name : 'ROM') + ' · file 0x' + romHex(hit.file, 6) + (hit.fast ? '' : ' · slow'); }
  else if (hit.k === 'io') what = romIoName(at.a);
  c.title = '$' + romHex(at.bank, 2) + ':' + romHex(at.a, 4) + '–' + romHex(at.a + ROM_BUS_STEP - 1, 4) + ' · ' + what;
}

function setupRomTab() {
  var pane = document.querySelector('.rom-pane');
  // A node-only harness (tests/memory/ui.test.js) runs this bundle without a browser.
  if (!pane || !pane.dataset || pane.dataset.romBound || typeof window === 'undefined' || !window.addEventListener) return;
  pane.dataset.romBound = '1';
  pane.addEventListener('click', function (e) { romOnClick(e, pane); });
  pane.addEventListener('mousemove', romOnHover);
  document.getElementById('rom-refresh').addEventListener('click', function () { _rom.readers = {}; romRequest(true); });
  document.getElementById('rom-search').addEventListener('input', function (e) { romOnSearch(e.target.value.trim()); });
  var tab = document.querySelector('.tab[data-tab="rom"]');
  if (tab) tab.addEventListener('click', function () { if (!_rom.model && !_rom.requested) romRequest(false); });
  window.addEventListener('message', function (ev) {
    var msg = ev.data || {};
    if (msg.command === 'romMap') {
      _rom.model = msg.model || null; _rom.error = msg.error || ''; _rom.xrefs = !!msg.hasXrefs; _rom.bus = msg.bus || null;
      if (_rom.model && (_rom.sel < 0 || _rom.sel >= _rom.model.halves.length)) _rom.sel = 0;
      romRenderAll();
    } else if (msg.command === 'romReaders') {
      _rom.readers[msg.key] = { readers: msg.readers || [], none: msg.none || '', wide: msg.wide || 0 };
      if (_rom.open === msg.key && _rom.mode === 'file') romRenderDetail();
    }
  });
  if (typeof ACTIVE_TAB !== 'undefined' && ACTIVE_TAB === 'rom') romRequest(false);
}

setupRomTab();
