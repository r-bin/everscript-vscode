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
var _mtView = 'stamps';   // 'stamps' = the dictionary, 'tiles' = Block 1 graphics
var _mtBgPalette = 1;     // which tile family the tile sheet is drawn in
var _mtSlot = -1;         // the selected graphic, in the tiles view
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
  // A selection is an index into one room's dictionary; it means something
  // else in the next room.
  if (_mtRoomId !== id) { _mtSelected = -1; _mtSlot = -1; }
  _mtRoomId = id;
  _mtRoomName = room && room.name;
  _mtLayer = layer || _mtLayer;
  var note = document.getElementById('rs-mt-note');
  if (note) note.textContent = 'loading…';
  vs.postMessage({ command: 'requestRoomMetatiles', roomId: id, mapName: _mtRoomName,
                   layer: _mtLayer, bgPalette: _mtBgPalette,
                   header: typeof infoRenderHeader === 'function' ? infoRenderHeader(id) : null });
}

/** Host reply: keep it and draw. */
function applyMetatilePalette(msg) {
  if (!msg || msg.roomId !== _mtRoomId) return;
  if (msg.error) {
    var n = document.getElementById('rs-mt-note');
    if (n) { n.textContent = msg.error; n.classList.add('rs-err'); }
    return;
  }
  // A header edit (map-editor-info.js) redraws the stamps' pictures and nothing else:
  // the palette in hand may be a custom map's own (its grid, size and families).
  if (msg.atlasOnly) {
    if (_mtPalette && msg.palette) {
      _mtPalette.imageUri = msg.palette.imageUri;
      renderMetatilePalette();
      if (typeof renderEditLayer === 'function') renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    }
    return;
  }
  _mtPalette = msg.palette;
  if (_mtPalette && _mtPalette.roomId == null && msg.roomId != null) _mtPalette.roomId = msg.roomId;
  // vanilla[] rows are [family, %, alts, collision, %, canopyUses, terrainUses]
  // and the tile sheet's slots are parallel to the room's graphics list.
  if (typeof noteLayerHints === 'function' && msg.palette.vanilla && msg.palette.tiles) {
    var rows = [];
    for (var i = 0; i < msg.palette.tiles.count; i++) {
      var v = msg.palette.vanilla[i];
      if (v) rows.push([0, 0, msg.palette.tiles.slots[i][2], 0, v[5], v[6]]);
    }
    noteLayerHints(rows, 4, 5, 2);
  }
  renderMetatilePalette();
  // A ROM room's objects join its draft now that they are known.
  // The dock was drawn while this was on its way, so it still says
  // "loading the tile palette…" until something redraws it — do that here.
  // Not for a custom map: newMapPaletteReady turns this palette into the
  // map's own first, and redraws then.
  var d = typeof editDraft === 'function' ? editDraft() : null;
  if (d && !d.customKey && typeof editSeedRoomObjects === 'function') {
    editSeedRoomObjects();
    if (d.on && typeof renderEditChrome === 'function') renderEditChrome();
  }
  // `new map` cannot draft anything until the dictionary it borrows from is
  // in hand, so it waits here rather than racing the request.
  if (typeof newMapPaletteReady === 'function') newMapPaletteReady();
  if (typeof customCopyMapReady === 'function') customCopyMapReady();
}

/**
 * How many distinct stamps the room defines, how many it uses, and what the
 * dictionary is built out of. The spare count is the interesting one: a slot
 * nothing places is a free combination for a new metatile.
 */
function metatilePaletteSummary(p) {
  if (_mtView === 'tiles' && p.tiles) {
    var fam = (p.tileFamilies || [])[_mtBgPalette - 1];
    return p.tiles.count + ' graphics this room can draw'
      + (p.animatedCount ? ' (' + p.animatedCount + ' animated)' : '')
      + ' · shown in ' + (fam === undefined ? 'palette ' + _mtBgPalette : 'family ' + fam);
  }
  var used = p.count - p.spare;
  return p.count + ' metatiles — ' + used + ' placed, ' + p.spare + ' spare'
    + ' · ' + p.tileFamilies.length + ' tile famil' + (p.tileFamilies.length === 1 ? 'y' : 'ies')
    + ' · ' + p.paletteCount + ' tile ids'
    + (p.animatedCount ? ' + ' + p.animatedCount + ' animated' : '');
}

function metatilePaletteControls(p) {
  // Two different questions: which stamps the room has already defined, and
  // which raw graphics it loaded that a new stamp could be built from.
  var html = '<div class="rd-filters rs-mt-bar">';
  [['stamps', 'stamps \u00b7 ' + p.count, 'The metatile dictionary \u2014 the combinations this room already defines'],
   ['tiles', 'tiles \u00b7 ' + (p.tiles ? p.tiles.count : 0),
    'Every 16x16 graphic this room loaded \u2014 the raw material a new stamp is built from']]
    .forEach(function (v) {
      html += '<button class="rdf' + (_mtView === v[0] ? ' on' : '') + '" data-mt-view="' + v[0]
        + '" title="' + escH(v[2]) + '">' + v[1] + '</button>';
    });
  html += '<span class="rs-mt-gap"></span>';

  if (_mtView === 'tiles') {
    // A graphic carries no colours of its own; the tilemap word picks one of
    // the room's tile families (a 16-colour palette at $9CC322 + id*32). Same
    // picture, one tab per family the room loaded.
    var fams = p.tileFamilies || [];
    for (var i = 1; i <= (p.tiles ? p.tiles.paletteCount : 7); i++) {
      var fam = fams[i - 1];
      html += '<button class="rdf' + (_mtBgPalette === i ? ' on' : '') + '" data-mt-bgpal="' + i + '"'
        + ' title="' + escH(fam === undefined
          ? 'Background palette ' + i + ' \u2014 this room lists no family here'
          : 'Tile family ' + fam + ', loaded into background palette ' + i
            + ' \u2014 a word with pal ' + i + ' draws in these colours') + '">'
        + (fam === undefined ? '\u2014' : fam) + '</button>';
    }
  } else {
    [['composite', 'both'], ['layer2', 'terrain'], ['layer1', 'canopy']].forEach(function (l) {
      html += '<button class="rdf' + (_mtLayer === l[0] ? ' on' : '') + '" data-mt-layer="' + l[0]
        + '" title="Draw the stamps from this layer only">' + l[1] + '</button>';
    });
    html += '<span class="rs-mt-gap"></span>';
    [['all', 'all'], ['used', 'placed'], ['spare', 'spare']].forEach(function (f) {
      html += '<button class="rdf' + (_mtFilter === f[0] ? ' on' : '') + '" data-mt-filter="' + f[0] + '">'
        + f[1] + '</button>';
    });
  }
  html += '<span class="rs-mt-gap"></span>';
  html += '<button class="rdf" data-mt-reload="1" title="Re-read the dictionary from the ROM">reload</button>';
  return html + '</div>';
}

/** The tilemap word that draws graphic slot `i` in the palette on screen. */
function tileSlotWord(p, i) {
  var t = p && p.tiles;
  if (!t || i < 0 || i >= t.count) return null;
  return (t.slots[i][1] | (t.palette << 10)) & 0xffff;
}

/** One cell per Block 1 graphic, with the chr value a word needs to name it. */
function tileSheetCells(p) {
  var t = p.tiles;
  if (!t) return '<div class="rs-note">no tile sheet</div>';
  var html = '<div class="rs-mt-grid">';
  for (var i = 0; i < t.count; i++) {
    var s = t.slots[i];
    var x = (i % t.columns) * t.cell;
    var y = Math.floor(i / t.columns) * t.cell;
    var tip = 'graphic #' + s[0] + '  tile id $' + hex4(s[2])
      + '\nword $' + hex4(tileSlotWord(p, i)) + ' draws this (chr ' + s[1] + ', pal ' + t.palette + ')'
      + (s[3] ? '\nanimated \u2014 the ROM swaps its pixels every few frames' : '');
    html += '<i class="rs-mt-cell' + (s[3] ? ' anim' : '') + (i === _mtSlot ? ' sel' : '')
      + '" data-mt-slot="' + i + '"'
      + ' title="' + escH(tip) + '" style="background-position:-' + x + 'px -' + y + 'px"></i>';
  }
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
  var tiles = _mtView === 'tiles' && p.tiles;
  var sheetUri = tiles ? p.tiles.imageUri : p.imageUri;
  var sheetCell = tiles ? p.tiles.cell : p.cell;
  body.innerHTML = metatilePaletteControls(p)
    + '<div class="rs-mt-sheet" style="--mt-sheet:url(' + sheetUri + ');--mt-cell:' + sheetCell + 'px">'
    + (tiles ? tileSheetCells(p) : metatileCells(p)) + '</div>'
    + (tiles ? tileSheetDetail(p) : metatileDetail(p))
    + budgetBar(p);
}

/**
 * What the room's graphics list is \u2014 and, once one is picked, the word that
 * draws it, which is the thing an editor actually needs to write.
 */
function tileSheetDetail(p) {
  var t = p.tiles;
  var fams = p.tileFamilies || [];
  var loaded = Math.min(7, fams.length);
  var head = '';
  if (_mtSlot >= 0 && _mtSlot < t.count) {
    var s = t.slots[_mtSlot];
    head = '<span class="rs-mt-f"><b>#' + s[0] + '</b> word $' + hex4(tileSlotWord(p, _mtSlot))
      + ' <span class="rs-note">tile id $' + hex4(s[2]) + ', chr ' + s[1] + ', pal ' + t.palette
      + (s[3] ? ', animated' : '') + '</span></span>' + vanillaEvidence(p, _mtSlot);
  }
  return '<div class="rs-mt-detail">' + head
    + '<span class="rs-mt-f"><b>graphics</b> ' + t.count + '</span>'
    + '<span class="rs-mt-f"><b>families</b> ' + fams.join(', ') + '</span>'
    + '<span class="rs-mt-f"><b>palettes</b> ' + loaded + ' of 7 background slots'
    + (fams.length > 7 ? ' (' + fams.length + ' listed \u2014 loaded 7 at a time)' : '') + '</span>'
    + '</div>';
}

/**
 * What the other 126 rooms did with this graphic.
 *
 * The family share is the strong signal (57% of graphics are only ever
 * drawn in one); the collision share is the weak one, so both are shown
 * *with* their percentage rather than as a bare answer. See
 * docs/map-format/building-a-room-from-a-picture.md \u00a72.
 */
function vanillaEvidence(p, slot) {
  var v = p.vanilla && p.vanilla[slot];
  if (!v) return '<span class="rs-mt-f rs-note">vanilla has never drawn this graphic</span>';
  var out = '';
  if (v[0] !== null) {
    out += '<span class="rs-mt-f"><b>usually</b> family ' + v[0]
      + ' <span class="rs-note">' + v[1] + '%'
      + (v[2] > 1 ? ', ' + v[2] + ' families seen' : ', only one seen') + '</span></span>';
  }
  if (v[3] !== null) {
    out += '<span class="rs-mt-f"><b>collision</b> $' + hex4(v[3])
      + ' <span class="rs-note">' + v[4] + '% of placements</span></span>';
  }
  return out;
}

/** One meter line: used against a ceiling, with what an overflow looks like. */
function budgetRow(label, line, extra) {
  var max = line.max;
  var frac = max ? Math.min(1, line.used / max) : 0;
  var over = max !== null && line.used > max;
  var bar = max
    ? '<i class="rs-bg-bar' + (over ? ' over' : (frac > 0.9 ? ' warn' : '')) + '">'
      + '<i style="width:' + (frac * 100).toFixed(1) + '%"></i></i>'
    : '';
  return '<span class="rs-mt-f" title="' + escH('vanilla\u2019s highest is ' + line.vanilla) + '">'
    + '<b>' + label + '</b> ' + line.used + (max ? '/' + max : '') + bar
    + (extra ? ' <span class="rs-note">' + extra + '</span>' : '') + '</span>';
}

/**
 * The four ceilings, always visible.
 *
 * Families is the only hard one \u2014 the loader clamps to 7 \u2014 so it is the one
 * that turns red. The others warn, because 32 KB of WRAM is inferred from
 * the fullest vanilla room rather than traced.
 */
function budgetBar(p) {
  var b = p.budget;
  if (!b) return '';
  return '<div class="rs-mt-detail rs-mt-budget">'
    + budgetRow('graphics', b.graphics)
    + budgetRow('families', b.families)
    + budgetRow('stamps', b.stamps, 'no field limit')
    + budgetRow('wram', b.wram, 'grid + dictionary')
    + '<span class="rs-mt-f" title="' + escH('Graphics the other rooms have drawn in one of '
      + 'this room\u2019s families \u2014 the vocabulary a family-filtered list would offer') + '">'
    + '<b>attested</b> ' + b.attested + ' <span class="rs-note">in these families</span></span>'
    + '</div>';
}

/** One delegated listener for the whole section. */
function bindMetatilePalette(panel, room) {
  var sec = panel.querySelector('#rs-mt');
  if (!sec) return;
  sec.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t) return;
    if (t.id === 'rs-mt-load' || t.dataset.mtReload) { requestMetatilePalette(room, _mtLayer); return; }
    if (t.dataset.mtView) { _mtView = t.dataset.mtView; renderMetatilePalette(); return; }
    if (t.dataset.mtBgpal) { _mtBgPalette = Number(t.dataset.mtBgpal); requestMetatilePalette(room, _mtLayer); return; }
    if (t.dataset.mtSlot) {
      // A raw graphic is not placeable on its own — it is a *word*, and the
      // composer is what turns a word into a stamp. So a click here feeds the
      // composer when one of its sources is armed.
      _mtSlot = Number(t.dataset.mtSlot);
      if (typeof editOnTilePicked === 'function') {
        // The graphic id as well as the word: the word says which picture and
        // which family, but `_famLayerHint` — the record of which layer
        // vanilla draws this art on — is keyed by graphic id.
        var picked = _mtPalette.tiles.slots[_mtSlot];
        editOnTilePicked(tileSlotWord(_mtPalette, _mtSlot), picked && picked[2]);
      }
      renderMetatilePalette();
      return;
    }
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
