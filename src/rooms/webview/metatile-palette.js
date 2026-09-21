// Ownership: the Rooms tab's tile palette — the metatile dictionary drawn
// as a sheet of 16x16 stamps, with what each one is made of.
//
// This is the brush set a map editor would place from: a room's grid stores
// metatile ids, and Block 3 turns each id into a Layer 1 word, a Layer 2
// word and a collision word. Nothing outside the dictionary can be placed
// without extending it. See docs/map-format/map_editor_ui.md.
//
// Owns: _mtPalette (the last palette received), _mtLayer, _mtFilter,
// _mtSelected. Nothing else may write them.
//
// Depends on: utils.js (escH), detail-renderer.js (roomVanillaIdNum).

var _mtPalette = null;
var _mtLayer = 'composite';
var _mtFilter = 'all';
var _mtSelected = -1;
var _mtRoomId = null;
var _mtRoomName = '';

/** Placeholder markup; the sheet arrives asynchronously. */
function buildMetatilePaletteHtml(room) {
  var id = (typeof roomVanillaIdNum === 'function') ? roomVanillaIdNum(room) : null;
  if (id == null) return '';
  return '<div class="rs rs-mt-sec" id="rs-mt"><div class="rs-h">Tile palette'
    + ' <span class="rs-note" id="rs-mt-note" style="font-weight:400;opacity:.6">not loaded</span>'
    + '</div><div class="rs-mt-body" id="rs-mt-body">'
    + '<button class="rdf" id="rs-mt-load">load the room’s metatiles</button>'
    + '</div></div>';
}

/** Ask the host for the dictionary of the room currently on screen. */
function requestMetatilePalette(room, layer) {
  var id = (typeof roomVanillaIdNum === 'function') ? roomVanillaIdNum(room) : null;
  if (id == null || typeof vs === 'undefined' || !vs) return;
  _mtRoomId = id;
  _mtRoomName = room && room.name;
  _mtLayer = layer || _mtLayer;
  var note = document.getElementById('rs-mt-note');
  if (note) note.textContent = 'loading…';
  vs.postMessage({ command: 'requestRoomMetatiles', roomId: id, mapName: _mtRoomName, layer: _mtLayer });
}

/** Host reply: keep it and draw. */
function applyMetatilePalette(msg) {
  if (!msg || msg.roomId !== _mtRoomId) return;
  if (msg.error) {
    var n = document.getElementById('rs-mt-note');
    if (n) { n.textContent = msg.error; n.classList.add('rs-err'); }
    return;
  }
  _mtPalette = msg.palette;
  renderMetatilePalette();
}

/**
 * How many distinct stamps the room defines, how many it uses, and what the
 * dictionary is built out of. The spare count is the interesting one: a slot
 * nothing places is a free combination for a new metatile.
 */
function metatilePaletteSummary(p) {
  var used = p.count - p.spare;
  return p.count + ' metatiles — ' + used + ' placed, ' + p.spare + ' spare'
    + ' · ' + p.tileFamilies.length + ' tile famil' + (p.tileFamilies.length === 1 ? 'y' : 'ies')
    + ' · ' + p.paletteCount + ' tile ids'
    + (p.animatedCount ? ' + ' + p.animatedCount + ' animated' : '');
}

function metatilePaletteControls(p) {
  var layers = [['composite', 'both'], ['layer2', 'terrain'], ['layer1', 'canopy']];
  var html = '<div class="rd-filters rs-mt-bar">';
  layers.forEach(function (l) {
    html += '<button class="rdf' + (_mtLayer === l[0] ? ' on' : '') + '" data-mt-layer="' + l[0]
      + '" title="Draw the stamps from this layer only">' + l[1] + '</button>';
  });
  html += '<span class="rs-mt-gap"></span>';
  [['all', 'all'], ['used', 'placed'], ['spare', 'spare']].forEach(function (f) {
    html += '<button class="rdf' + (_mtFilter === f[0] ? ' on' : '') + '" data-mt-filter="' + f[0] + '">'
      + f[1] + '</button>';
  });
  html += '<span class="rs-mt-gap"></span>';
  html += '<button class="rdf" data-mt-reload="1" title="Re-read the dictionary from the ROM">reload</button>';
  return html + '</div>';
}

/**
 * One cell per metatile, as a window onto the atlas.
 *
 * The sheet is a single PNG and each cell is a div with a background
 * offset, so 2131 stamps cost one image rather than 2131 of them.
 */
function metatileCells(p) {
  var html = '<div class="rs-mt-grid">';
  for (var i = 0; i < p.count; i++) {
    var e = p.entries[i];
    var uses = e[4];
    if (_mtFilter === 'used' && !uses) continue;
    if (_mtFilter === 'spare' && uses) continue;
    var x = (i % p.columns) * p.cell;
    var y = Math.floor(i / p.columns) * p.cell;
    var id = p.baseMetatile + i * 8;
    var tip = '#' + i + '  id $' + id.toString(16).toUpperCase()
      + '\ncanopy  $' + hex4(e[1])
      + '\nterrain $' + hex4(e[2])
      + '\ncollision $' + hex4(e[3])
      + '\n' + (uses ? uses + ' cell' + (uses === 1 ? '' : 's') : 'never placed — a spare slot');
    html += '<i class="rs-mt-cell' + (uses ? '' : ' spare') + (i === _mtSelected ? ' sel' : '') + '"'
      + ' data-mt-index="' + i + '" title="' + escH(tip) + '"'
      + ' style="background-position:-' + x + 'px -' + y + 'px"></i>';
  }
  return html + '</div>';
}

function hex4(v) { return (v >>> 0).toString(16).toUpperCase().padStart(4, '0'); }

/** The detail line under the sheet for whichever stamp is selected. */
function metatileDetail(p) {
  if (_mtSelected < 0 || _mtSelected >= p.count) {
    return '<div class="rs-mt-detail rs-note">pick a stamp to see what it is made of</div>';
  }
  var e = p.entries[_mtSelected];
  var id = p.baseMetatile + _mtSelected * 8;
  var field = function (label, value) {
    return '<span class="rs-mt-f"><b>' + label + '</b> ' + value + '</span>';
  };
  // A tilemap word is vhopppcccccccccc — the same layout render.ts decodes.
  var word = function (w) {
    return '$' + hex4(w) + ' <span class="rs-note">chr ' + (w & 0x3ff)
      + ', pal ' + ((w >> 10) & 7) + (w & 0x2000 ? ', priority' : '')
      + (w & 0x4000 ? ', flipX' : '') + (w & 0x8000 ? ', flipY' : '') + '</span>';
  };
  return '<div class="rs-mt-detail">'
    + field('#' + _mtSelected, 'id $' + id.toString(16).toUpperCase())
    + field('canopy', word(e[1]))
    + field('terrain', word(e[2]))
    + field('collision', '$' + hex4(e[3]))
    + field('placed', e[4] + '×')
    + '</div>';
}

function renderMetatilePalette() {
  var body = document.getElementById('rs-mt-body');
  var note = document.getElementById('rs-mt-note');
  var p = _mtPalette;
  if (!body || !p) return;
  if (note) { note.textContent = metatilePaletteSummary(p); note.classList.remove('rs-err'); }
  var composer = document.getElementById('rg-compose');
  body.innerHTML = metatilePaletteControls(p)
    + '<div class="rs-mt-sheet" style="--mt-sheet:url(' + p.imageUri + ');--mt-cell:' + p.cell + 'px">'
    + metatileCells(p) + '</div>'
    + metatileDetail(p);
  // The composer lives inside this section, so it has to survive a redraw.
  if (composer) { body.appendChild(composer); if (typeof renderComposer === 'function') renderComposer(); }
}

/** One delegated listener for the whole section. */
function bindMetatilePalette(panel, room) {
  var sec = panel.querySelector('#rs-mt');
  if (!sec) return;
  sec.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t) return;
    if (t.id === 'rs-mt-load' || t.dataset.mtReload) { requestMetatilePalette(room, _mtLayer); return; }
    if (t.dataset.mtLayer) { _mtLayer = t.dataset.mtLayer; requestMetatilePalette(room, _mtLayer); return; }
    if (t.dataset.mtFilter) { _mtFilter = t.dataset.mtFilter; renderMetatilePalette(); return; }
    if (t.dataset.mtIndex) {
      var index = Number(t.dataset.mtIndex);
      _mtSelected = index;
      // In edit mode a stamp click is a brush change, or a composer source
      // when one is armed. editOnStampPicked owns that choice.
      if (typeof editOnStampPicked === 'function') editOnStampPicked(index);
      renderMetatilePalette();
    }
  });
}
