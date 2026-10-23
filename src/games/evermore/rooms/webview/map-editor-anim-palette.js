// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Palette Animation sub-tab (Tile > Animation > Palette).
// Shows tiles whose colours shift over time via Section 4.3 CGRAM cycles.
// Mirrors the Tile Animation tab with row previews, card expansion,
// editable timing, and pencil placing.

/** The open/selected palette-animated tileId, or null. */
var _paletteAnimSel = null;
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

/** Lists distinct tiles on the map that use cycling palette colours. */
function editPaletteAnimsListed(p) {
  if (!p || !p.paletteCycles || !p.paletteCycles.length) return [];
  var cycles = p.paletteCycles.filter(function (c) {
    return c.paletteIndex >= 1 && c.paletteIndex <= 7 && c.span > 1 && c.rate !== 0;
  });
  if (!cycles.length) return [];

  var cycleByPal = {};
  cycles.forEach(function (c, idx) {
    if (!cycleByPal[c.paletteIndex]) cycleByPal[c.paletteIndex] = { c: c, idx: idx };
  });

  var byTile = {};
  var order = [];
  var W = p.widthTiles || 0, H = p.heightTiles || 0;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var sIdx = editCellAt(p, x, y);
      if (sIdx < 0) continue;
      var w = editStampWords(p, sIdx);
      if (!w) continue;
      var pal1 = (w.layer1 >> 10) & 7;
      var pal2 = (w.layer2 >> 10) & 7;

      var match = cycleByPal[pal2] || (w.layer1 !== editBlankCanopy(p) ? cycleByPal[pal1] : null);
      if (!match) continue;

      var pal = match.c.paletteIndex === pal2 ? pal2 : pal1;
      var word = pal === pal2 ? w.layer2 : w.layer1;
      var slot = animWordSlot(word);
      var graphic = editSlotGraphicId(p, slot);
      if (graphic == null) continue;

      var key = graphic + ':' + match.c.paletteIndex;
      if (!byTile[key]) {
        var delays = [];
        var d = Math.max(1, Math.abs(match.c.rate));
        for (var k = 0; k < match.c.span; k++) delays.push(d);
        var animHit = paletteAnimEntryOfStamp(p.anim, sIdx);
        byTile[key] = {
          tileId: graphic,
          family: p.tileFamilies && p.tileFamilies[pal - 1],
          paletteIndex: pal,
          cycle: match.c,
          cycleIndex: match.idx,
          cells: [],
          stampIdx: sIdx,
          animRow: animHit ? animHit.row : -1,
          span: match.c.span,
          rate: match.c.rate,
          delays: delays
        };
        order.push(key);
      }
      var cellKey = x + ',' + y;
      if (byTile[key].cells.indexOf(cellKey) < 0) byTile[key].cells.push(cellKey);
    }
  }

  return order.map(function (k) { return byTile[k]; });
}

function paletteAnimFindByTile(tileId) {
  var list = editPaletteAnimsListed(_mtPalette);
  for (var i = 0; i < list.length; i++) if (list[i].tileId === tileId) return list[i];
  return null;
}

function paletteAnimRowHtml(entry, locked, open, many) {
  var p = _mtPalette;
  var svgSize = 30;
  var prevCell = editStampSvg(p, _editComposed, entry.stampIdx, 0, 0, 'rg-anim-prev-cell');
  var prevSvg = '<svg class="rg-anim-sw" width="' + svgSize + '" height="' + svgSize + '" viewBox="0 0 '
    + EDIT_UNITS + ' ' + EDIT_UNITS + '">' + prevCell + '</svg>';

  var html = '<div class="rg-object-card rg-anim-card' + (open ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (open ? ' on' : '') + '" data-pal-anim-sel="' + entry.tileId + '" title="'
    + escH('Palette ' + entry.paletteIndex + ' · ' + entry.span + ' colours cycling\nclick to ' + (open ? 'close' : 'open it')) + '">'
    + animWhereSvg(entry.cells, many) + prevSvg
    + '<span class="rg-trigger-label">' + entry.tileId
    + '<span class="rg-trigger-what">' + entry.span + ' frames · ' + paletteAnimPlural(entry.cells.length, 'cell') + '</span></span>'
    + '<span class="rg-anim-badge" title="Palette ' + entry.paletteIndex + ': ' + entry.span + ' colours at rate '
    + (entry.rate > 0 ? '+' : '') + entry.rate + '">Pal ' + entry.paletteIndex + '</span>'
    + '<button class="rdf rdf-xs' + (_paletteAnimPlace === entry.tileId ? ' on' : '') + '" data-pal-anim-act="place" data-pal-anim-tile="' + entry.tileId
    + '" title="' + (_paletteAnimPlace === entry.tileId ? 'Stop placing it' : 'Place it with the pencil, like a tile') + '">place</button>'
    + '<span class="rg-object-caret">' + (open ? '▾' : '▸') + '</span>'
    + '</div>';

  if (open) {
    html += '<div class="rg-anim-open"><div class="ro-chips">';
    var ticks = Math.max(1, Math.abs(entry.rate));
    var dis = locked ? ' disabled' : '';
    for (var k = 0; k < entry.span; k++) {
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
        + '<div class="ro-chip" title="State ' + k + ' of ' + entry.span + '">'
        + swatch + '<span class="ro-lbl">' + k + '</span></div>'
        + '<input type="number" class="rg-anim-ticks" min="1" value="' + ticks + '" data-pal-anim-cycle="' + entry.cycleIndex
        + '" aria-label="State ' + k + ' hold in ticks" title="Hold in 60 Hz ticks per shift step"' + dis + '/>'
        + '</div>';
    }
    html += '</div><div class="rg-anim-bar">'
      + '<span>Cycle: ' + entry.span + ' colours, rate ' + (entry.rate > 0 ? '+' : '') + entry.rate + '</span>'
      + '</div></div>';
  }

  html += '</div>';
  return html;
}

/** The Palette Animation tab HTML. */
function paletteAnimTabHtml() {
  var p = _mtPalette;
  if (!p) return '<div class="rs-note">loading the tile palette…</div>';
  if (!p.paletteCycles || !p.paletteCycles.length) {
    return '<div class="rs-note">This room has no palette cycles. The water and scenery use static palettes.</div>';
  }

  var listed = editPaletteAnimsListed(p);
  var locked = editLocked();
  var html = '<div class="rs-note">An animated palette cycles colors over time without changing tile graphics; '
    + 'every tile using those colors shifts in place. The preview reflects in-game shifting palettes.</div>'
    + '<div class="rg-anim-head"><button class="rdf rdf-xs' + (_animOff ? '' : ' on') + '" data-anim-act="toggle-off" aria-pressed="' + !_animOff + '"'
    + ' title="Animation on the whole map: off shows every animated tile on its first frame">Animation: ' + (_animOff ? 'off' : 'on') + '</button>'
    + '<span class="rg-anim-budget">' + paletteAnimPlural(p.paletteCycles.length, 'cycle') + '</span></div>'
    + '<div class="rg-trigger-list rg-anim-list">';

  if (!listed.length) {
    html += '<div class="rs-note">No tiles using cycling palettes are placed on this map yet.</div>';
  } else {
    listed.forEach(function (x) { html += paletteAnimRowHtml(x, locked, x.tileId === _paletteAnimSel, listed.length > 12); });
  }

  html += '</div>';
  return html;
}

function paletteAnimClick(t) {
  var ds = t.dataset;
  if (ds.palAnimSel) {
    var tid = Number(ds.palAnimSel);
    _paletteAnimSel = _paletteAnimSel === tid ? null : tid;
    animRedraw();
    return true;
  }
  if (ds.palAnimAct === 'place') {
    var pt = Number(ds.palAnimTile);
    _paletteAnimPlace = _paletteAnimPlace === pt ? null : pt;
    if (_paletteAnimPlace != null) {
      _paletteAnimSel = pt;
      var e = paletteAnimFindByTile(pt);
      if (e) editAdoptGraphic(_mtPalette, pt, null);
      editNote('the pencil places it — painted cells will animate with this palette');
    }
    animRedraw();
    return true;
  }
  return false;
}

function paletteAnimInputChange(t) {
  if (t.dataset.palAnimCycle !== undefined) {
    var cIdx = Number(t.dataset.palAnimCycle);
    var p = _mtPalette;
    if (p && p.paletteCycles && p.paletteCycles[cIdx]) {
      var c = p.paletteCycles[cIdx];
      var val = Math.max(1, Number(t.value) || 1);
      c.rate = (c.rate < 0 ? -1 : 1) * val;
      if (p.anim && p.anim.entries) {
        for (var i = 0; i < p.anim.entries.length; i++) {
          var delays = p.anim.entries[i][1];
          if (delays && delays.length === c.span) {
            for (var k = 0; k < delays.length; k++) delays[k] = val;
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
      var p = _mtPalette;
      var sIdx = editCellAt(p, cell.x, cell.y);
      if (sIdx >= 0) {
        var w = editStampWords(p, sIdx);
        if (w) {
          var list = editPaletteAnimsListed(p);
          for (var i = 0; i < list.length; i++) {
            if (list[i].cells.indexOf(cell.x + ',' + cell.y) >= 0) {
              _paletteAnimSel = list[i].tileId;
              renderEditChrome();
              return true;
            }
          }
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
