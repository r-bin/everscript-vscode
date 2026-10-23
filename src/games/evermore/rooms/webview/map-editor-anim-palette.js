// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Palette Animation sub-tab (Tile > Animation > Palette).
// Shows tiles whose colours shift over time via Section 4.3 CGRAM cycles.
// Mirrors the Tile Animation tab with per-instance rows, pattern letters,
// card expansion, frame swatches, editable timing, and pencil placing.

/** The open/selected palette-animated tile key ('tileId:cycleIdx'), or null. */
var _paletteAnimSel = null;
/** First cell ('x,y') of the open instance row, or null. */
var _paletteAnimSelPart = null;
/** Selected state frame index inside the open card. */
var _paletteAnimFrame = 0;
/** Whether the open card is playing on the map. */
var _paletteAnimPlaying = false;
/** The palette-animated tileId armed for pencil placement, or null. */
var _paletteAnimPlace = null;

function paletteAnimPlural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

/** Finds the anim entry for stamp index i, or null. */
function paletteAnimEntryOfStamp(anim, stampIdx) {
  if (!anim || !anim.entries) return null;
  for (var r = 0; r < anim.entries.length; r++) {
    if (anim.entries[r][0] === stampIdx) return { row: r, delays: anim.entries[r][1] };
  }
  return null;
}

/** Active Section 4.3 colour-cycle descriptors in the room, lettered A, B, C… */
function editPaletteActiveCycles(p) {
  var out = [];
  if (!p || !p.paletteCycles) return out;
  p.paletteCycles.forEach(function (c, idx) {
    if (c.paletteIndex >= 1 && c.paletteIndex <= 7 && c.span > 1 && c.rate !== 0) {
      var letter = typeof ANIM_LETTERS !== 'undefined' ? ANIM_LETTERS[out.length] || 'A' : String.fromCharCode(65 + out.length);
      var mask = (((1 << c.span) - 1) << c.colorStart) & 0xfffe;
      out.push({ c: c, idx: idx, letter: letter, mask: mask });
    }
  });
  return out;
}

function paletteAnimMatchWord(p, word, isLayer1, cycles) {
  if (word == null || (isLayer1 && word === editBlankCanopy(p))) return null;
  var pal = (word >> 10) & 7;
  if (pal < 1 || pal > 7) return null;
  var slot = animWordSlot(word);
  var graphic = editSlotGraphicId(p, slot);
  if (graphic == null) return null;
  var tMask = p.tileColorMasks && p.tileColorMasks[graphic] !== undefined ? p.tileColorMasks[graphic] : 0xfffe;
  for (var i = 0; i < cycles.length; i++) {
    if (cycles[i].c.paletteIndex === pal && (tMask & cycles[i].mask) !== 0) {
      return { graphic: graphic, pal: pal, match: cycles[i] };
    }
  }
  return null;
}

/**
 * Lists every contiguous instance of a palette-cycling tile on the map,
 * clustered the same way `editAnimsListed` clusters tile animations.
 */
function editPaletteAnimsListed(p) {
  var cycles = editPaletteActiveCycles(p);
  if (!cycles.length) return [];

  var cellInfo = {};
  var keys = [];
  var W = p.widthTiles || 0, H = p.heightTiles || 0;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var sIdx = editCellAt(p, x, y);
      if (sIdx < 0) continue;
      var w = editStampWords(p, sIdx);
      if (!w) continue;
      var hit = paletteAnimMatchWord(p, w.layer2, false, cycles) || paletteAnimMatchWord(p, w.layer1, true, cycles);
      if (!hit) continue;
      var ck = x + ',' + y;
      cellInfo[ck] = { graphic: hit.graphic, pal: hit.pal, match: hit.match, sIdx: sIdx };
      keys.push(ck);
    }
  }
  if (!keys.length) return [];

  var joins = function (a, b) {
    return cellInfo[a].graphic === cellInfo[b].graphic && cellInfo[a].match.idx === cellInfo[b].match.idx;
  };
  var clusters = typeof animClusters === 'function' ? animClusters(keys, joins) : [keys];
  var partsOf = {};
  var out = [];

  clusters.forEach(function (c) {
    var info = cellInfo[c[0]];
    var key = info.graphic + ':' + info.match.idx;
    partsOf[key] = (partsOf[key] || 0) + 1;
    var d = Math.max(1, Math.abs(info.match.c.rate)) * 3;
    var delays = [];
    for (var k = 0; k < info.match.c.span; k++) delays.push(d);
    var animHit = paletteAnimEntryOfStamp(p.anim, info.sIdx);
    out.push({
      key: key,
      tileId: info.graphic,
      family: p.tileFamilies && p.tileFamilies[info.pal - 1],
      paletteIndex: info.pal,
      cycle: info.match.c,
      cycleIndex: info.match.idx,
      letter: info.match.letter,
      cells: c,
      part: partsOf[key] - 1,
      parts: 1,
      stampIdx: info.sIdx,
      animRow: animHit ? animHit.row : -1,
      span: info.match.c.span,
      rate: info.match.c.rate,
      delays: delays
    });
  });
  out.forEach(function (x) { x.parts = partsOf[x.key]; });
  return out;
}

function paletteAnimOpenEntry(listed) {
  if (_paletteAnimSel == null) return null;
  for (var i = 0; i < listed.length; i++) {
    if (listed[i].key === _paletteAnimSel && (!_paletteAnimSelPart || listed[i].cells[0] === _paletteAnimSelPart)) return listed[i];
  }
  for (var j = 0; j < listed.length; j++) {
    if (listed[j].key === _paletteAnimSel) return listed[j];
  }
  return null;
}

function paletteAnimFindByTile(tileId) {
  var list = editPaletteAnimsListed(_mtPalette);
  for (var i = 0; i < list.length; i++) if (list[i].tileId === tileId || list[i].key === tileId) return list[i];
  return null;
}

function paletteAnimOpenHtml(entry, locked) {
  var p = _mtPalette;
  var dis = locked ? ' disabled' : '';
  var ticks = Math.max(1, Math.abs(entry.rate)) * 3;
  var html = '<div class="rg-object-expanded rg-anim-timing">'
    + '<div class="rg-anim-presets"><span class="rg-anim-timing-lbl">pattern</span>'
    + '<span class="ro-chip rg-anim-preset sel" title="' + escH('Palette ' + entry.paletteIndex + ' colours ' + entry.cycle.colorStart + '–' + (entry.cycle.colorStart + entry.span - 1)) + '">' + entry.letter + '</span>'
    + '<span class="rg-anim-timing-lbl">Pal ' + entry.paletteIndex + ' · colours ' + entry.cycle.colorStart + '–' + (entry.cycle.colorStart + entry.span - 1) + '</span></div>'
    + '<div class="ro-chips">';

  for (var k = 0; k < entry.span; k++) {
    var on = _paletteAnimFrame === k;
    var swatch = '';
    if (p.anim && p.anim.sheets && k > 0 && k - 1 < p.anim.sheets.length && entry.animRow >= 0) {
      var sh = p.anim.sheets[k - 1];
      swatch = '<svg class="rg-anim-sw" width="44" height="44" viewBox="0 0 ' + EDIT_UNITS + ' ' + EDIT_UNITS + '">'
        + editCropSvg('rg-anim-prev-cell', 0, 0, p.anim, sh.imageUri, sh.imageWidth, sh.imageHeight, entry.animRow, '')
        + '</svg>';
    } else {
      swatch = '<svg class="rg-anim-sw" width="44" height="44" viewBox="0 0 ' + EDIT_UNITS + ' ' + EDIT_UNITS + '">'
        + editStampSvg(p, _editComposed, entry.stampIdx, 0, 0, 'rg-anim-prev-cell', null, 0) + '</svg>';
    }

    html += '<div class="rg-anim-frame-col">'
      + '<button class="ro-chip' + (on ? ' sel' : '') + '" data-pal-anim-frame="' + k + '" title="Frame ' + k + ' of ' + entry.span + ' — colour shift step ' + k + '">'
      + swatch + '<span class="ro-lbl">' + k + '</span></button>'
      + '<input type="number" class="rg-anim-ticks" min="1" value="' + ticks + '" data-pal-anim-cycle="' + entry.cycleIndex
      + '" aria-label="Frame ' + k + ' hold in ticks" title="Hold in 60 Hz ticks (' + Math.round(ticks * 1000 / 60) + ' ms)"' + dis + '/>'
      + '</div>';
  }

  html += '</div><div class="rg-anim-bar">'
    + '<button class="rdf rdf-xs' + (_paletteAnimPlaying ? ' on' : '') + '" data-pal-anim-act="play" title="' + (_paletteAnimPlaying ? 'Stop, and show the selected frame' : 'Play it on the map') + '">'
    + (_paletteAnimPlaying ? '■ Stop' : '▶ Play') + '</button>'
    + '<span>' + entry.span + ' colours · rate ' + (entry.rate > 0 ? '+' : '') + entry.rate + '</span>'
    + '</div></div>';
  return html;
}

function paletteAnimRowHtml(entry, locked, open, many) {
  var p = _mtPalette;
  var svgSize = 30;
  var prevCell = editStampSvg(p, _editComposed, entry.stampIdx, 0, 0, 'rg-anim-prev-cell');
  var prevSvg = '<svg class="rg-anim-sw" width="' + svgSize + '" height="' + svgSize + '" viewBox="0 0 '
    + EDIT_UNITS + ' ' + EDIT_UNITS + '">' + prevCell + '</svg>';

  var html = '<div class="rg-object-card rg-anim-card' + (open ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (open ? ' on' : '') + '" data-pal-anim-sel="' + entry.key + '" data-pal-anim-part="' + (entry.cells[0] || '') + '" title="'
    + escH('Palette ' + entry.paletteIndex + ' (colours ' + entry.cycle.colorStart + '–' + (entry.cycle.colorStart + entry.span - 1) + ') · locked in ROM\nclick to ' + (open ? 'close' : 'open it')) + '">'
    + animWhereSvg(entry.cells, many) + prevSvg
    + '<span class="rg-trigger-label">' + entry.tileId + ' <span class="rg-anim-lock" aria-label="locked">🔒</span>'
    + '<span class="rg-trigger-what">' + paletteAnimPlural(entry.span, 'frame') + ' · ' + paletteAnimPlural(entry.cells.length, 'cell')
      + (entry.parts > 1 ? ' · <span title="every copy changes together: palette colours and rate are shared">' + (entry.part + 1) + ' of ' + entry.parts + '</span>' : '') + '</span></span>'
    + '<span class="rg-anim-badge" title="' + escH('pattern ' + entry.letter + ' — Palette ' + entry.paletteIndex + ': ' + entry.span + ' colours at rate ' + (entry.rate > 0 ? '+' : '') + entry.rate) + '">' + entry.letter + '</span>'
    + (locked ? '' : '<button class="rdf rdf-xs' + (_paletteAnimPlace === entry.tileId ? ' on' : '') + '" data-pal-anim-act="place" data-pal-anim-tile="' + entry.tileId
      + '" title="' + (_paletteAnimPlace === entry.tileId ? 'Stop placing it' : 'Place it with the pencil, like a tile — every copy changes together') + '">place</button>')
    + '<span class="rg-object-caret">' + (open ? '▾' : '▸') + '</span>'
    + '</div>';

  if (open) html += paletteAnimOpenHtml(entry, locked);
  return html + '</div>';
}

/** The Palette Animation tab HTML. */
function paletteAnimTabHtml() {
  var p = _mtPalette;
  if (!p) return '<div class="rs-note">loading the tile palette…</div>';
  var cycles = editPaletteActiveCycles(p);
  if (!cycles.length) {
    return '<div class="rs-note">This room has no palette cycles. The water and scenery use static palettes.</div>';
  }

  var listed = editPaletteAnimsListed(p);
  var locked = editLocked();
  var open = paletteAnimOpenEntry(listed);
  var html = '<div class="rs-note">An animated palette cycles colours over time without changing tile graphics; '
    + 'every cell using those colours shifts in place. The preview reflects in-game shifting palettes.</div>'
    + '<div class="rg-anim-head"><button class="rdf rdf-xs' + (_animOff ? '' : ' on') + '" data-anim-act="toggle-off" aria-pressed="' + !_animOff + '"'
    + ' title="Animation on the whole map: off shows every animated tile on its first frame">Animation: ' + (_animOff ? 'off' : 'on') + '</button>'
    + '<span class="rg-anim-budget" title="Active Section 4.3 colour-cycle channels in this room">' + paletteAnimPlural(cycles.length, 'cycle') + '</span></div>'
    + '<div class="rg-trigger-list rg-anim-list">';

  if (!listed.length) {
    html += '<div class="rs-note">no palette-animated tiles on this map yet</div>';
  } else {
    listed.forEach(function (x) { html += paletteAnimRowHtml(x, locked, x === open, listed.length > 12); });
  }

  return html + '</div>';
}

function paletteAnimClick(t) {
  var ds = t.dataset;
  if (ds.palAnimAct === 'place') {
    var pt = Number(ds.palAnimTile);
    _paletteAnimPlace = _paletteAnimPlace === pt ? null : pt;
    if (_paletteAnimPlace != null) {
      var found = paletteAnimFindByTile(pt);
      if (found) { _paletteAnimSel = found.key; _paletteAnimSelPart = found.cells[0] || null; }
      editAdoptGraphic(_mtPalette, pt, null);
      editNote('the pencil places it — painted cells will animate with this palette');
    }
    animRedraw();
    return true;
  }
  if (ds.palAnimSel) {
    var key = ds.palAnimSel, part = ds.palAnimPart || null;
    var listed = editPaletteAnimsListed(_mtPalette);
    var was = paletteAnimOpenEntry(listed);
    var wasOpen = !!was && was.key === key && (was.cells[0] || null) === part;
    _paletteAnimSel = wasOpen ? null : key;
    _paletteAnimSelPart = wasOpen ? null : part;
    _paletteAnimFrame = 0;
    _paletteAnimPlaying = false;
    animRedraw();
    return true;
  }
  if (ds.palAnimFrame != null) {
    _paletteAnimFrame = Number(ds.palAnimFrame);
    _paletteAnimPlaying = false;
    animRedraw();
    return true;
  }
  if (ds.palAnimAct === 'play') {
    _paletteAnimPlaying = !_paletteAnimPlaying;
    animRedraw();
    return true;
  }
  return false;
}

function paletteAnimInputChange(t) {
  if (t && t.dataset && t.dataset.palAnimCycle !== undefined) {
    var cIdx = Number(t.dataset.palAnimCycle);
    var p = _mtPalette;
    if (p && p.paletteCycles && p.paletteCycles[cIdx]) {
      var c = p.paletteCycles[cIdx];
      var ticks = Math.max(1, Number(t.value) || 3);
      var rateMag = Math.max(1, Math.round(ticks / 3));
      c.rate = (c.rate < 0 ? -1 : 1) * rateMag;
      if (p.anim && p.anim.entries) {
        for (var i = 0; i < p.anim.entries.length; i++) {
          var delays = p.anim.entries[i][1];
          if (delays && delays.length === c.span) {
            for (var k = 0; k < delays.length; k++) delays[k] = ticks;
          }
        }
      }
      animRedraw();
    }
    return true;
  }
  return false;
}

function paletteAnimGesture(d, cell, phase) {
  if (d.tool === 'select') {
    if (phase === 'down') {
      var list = editPaletteAnimsListed(_mtPalette);
      var ck = cell.x + ',' + cell.y;
      for (var i = 0; i < list.length; i++) {
        if (list[i].cells.indexOf(ck) >= 0) {
          _paletteAnimSel = list[i].key;
          _paletteAnimSelPart = list[i].cells[0] || null;
          renderEditChrome();
          renderEditLayer(_mtPalette, _editComposed, _editOrigin);
          return true;
        }
      }
    }
    return false;
  }

  if (d.tool === 'paint' && _paletteAnimPlace != null) {
    var entry = paletteAnimFindByTile(_paletteAnimPlace);
    if (!entry) return false;
    if (phase === 'down') {
      editBegin();
      editApply([{ x: cell.x, y: cell.y, index: entry.stampIdx }]);
      renderEditLayer(_mtPalette, _editComposed, _editOrigin);
      return true;
    }
    if (phase === 'move') {
      editApply([{ x: cell.x, y: cell.y, index: entry.stampIdx }]);
      renderEditLayer(_mtPalette, _editComposed, _editOrigin);
      return true;
    }
    if (phase === 'up') {
      editEnd();
      animRedraw();
      return true;
    }
  }

  return false;
}
