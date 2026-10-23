// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Palette Animation sub-tab (Tile > Animation > Palette).
// Shows tiles whose colours shift over time via Section 4.3 CGRAM cycles.
// Mirrors the Tile Animation tab with per-instance rows, pattern letters,
// card expansion, frame swatches, editable timing, and pencil placing.

var _paletteAnimSel = null, _paletteAnimSelPart = null;
var _paletteAnimFrame = 0, _paletteAnimPlaying = false, _paletteAnimPlace = null;

function paletteAnimPlural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

function paletteAnimEntryOfStamp(anim, stampIdx) {
  if (!anim || !anim.entries) return null;
  if (typeof editStampAnimOf === 'function') return editStampAnimOf({ anim: anim }, stampIdx);
  for (var r = 0; r < anim.entries.length; r++) {
    if (anim.entries[r][0] === stampIdx) return { row: r, delays: anim.entries[r][1] };
  }
  return null;
}

function editPaletteActiveCycles(p) {
  var out = [];
  if (!p || !p.paletteCycles) return out;
  p.paletteCycles.forEach(function (c, idx) {
    if (c.paletteIndex >= 1 && c.paletteIndex <= 7 && c.span > 1 && c.rate !== 0) {
      var letter = typeof ANIM_LETTERS !== 'undefined' ? ANIM_LETTERS[out.length] || 'A' : String.fromCharCode(65 + out.length);
      out.push({ c: c, idx: idx, letter: letter, mask: (((1 << c.span) - 1) << c.colorStart) & 0xfffe });
    }
  });
  return out;
}

function paletteAnimMatchWord(p, word, isLayer1, cycles) {
  if (word == null || (isLayer1 && word === editBlankCanopy(p))) return null;
  var pal = (word >> 10) & 7, graphic = pal >= 1 && pal <= 7 ? editSlotGraphicId(p, animWordSlot(word)) : null;
  if (graphic == null) return null;
  var tMask = p.tileColorMasks && p.tileColorMasks[graphic] !== undefined ? p.tileColorMasks[graphic] : 0xfffe;
  for (var i = 0; i < cycles.length; i++) {
    if (cycles[i].c.paletteIndex === pal && (tMask & cycles[i].mask) !== 0) return { graphic: graphic, pal: pal, match: cycles[i] };
  }
  return null;
}

var _paletteAnimListMemo = { ref: null, sig: null, out: [] };
var _paletteAnimOpenMemo = { sig: null, stamps: {} };

function paletteAnimListSig(p) {
  if (!p) return null;
  var d = typeof editDraft === 'function' ? editDraft() : null, step = d && d.txn && d.txn.step;
  var comp = typeof _editComposed !== 'undefined' ? _editComposed : null;
  var cycSig = (p.paletteCycles || []).map(function (c) { return c.paletteIndex + ':' + c.colorStart + ':' + c.span + ':' + c.rate; }).join(',');
  var e0 = p.entries && p.entries[0] ? p.entries[0].join(',') : '', g0 = p.grid && p.grid[0] ? p.grid[0].join(',') : '';
  return [
    p.roomId, p.count, p.anim && p.anim.entries ? p.anim.entries.length : -1,
    comp ? comp.count : -1, comp && comp.anim && comp.anim.entries ? comp.anim.entries.length : -1,
    d ? d.undo.length : -1, d ? d.redo.length : -1, step ? step.cells.length : -1,
    d && d.groups ? d.groups.length : 0, d && d.cells ? Object.keys(d.cells).length : 0,
    typeof editAnims === 'function' ? editAnims().length : 0, cycSig, e0, g0
  ].join('|');
}

function editPaletteAnimsListed(p) {
  if (!p) return [];
  var sig = paletteAnimListSig(p);
  if (_paletteAnimListMemo.ref === p && _paletteAnimListMemo.sig === sig) return _paletteAnimListMemo.out;
  var out = paletteAnimBuildList(p);
  _paletteAnimListMemo = { ref: p, sig: sig, out: out };
  return out;
}

function editPaletteAnimOpenStamps(p) {
  var sig = paletteAnimListSig(p) + '|' + _paletteAnimSel + '|' + _paletteAnimSelPart;
  if (_paletteAnimOpenMemo.sig !== sig) {
    var map = {}, open = paletteAnimOpenEntry(editPaletteAnimsListed(p));
    if (open && open.stamps) open.stamps.forEach(function (s) { map[s] = true; });
    _paletteAnimOpenMemo = { sig: sig, stamps: map };
  }
  return _paletteAnimOpenMemo.stamps;
}

function paletteAnimBuildList(p) {
  var cycles = editPaletteActiveCycles(p);
  if (!cycles.length) return [];
  var cellInfo = {}, keys = [], W = p.widthTiles || 0, H = p.heightTiles || 0;
  var comp = typeof _editComposed !== 'undefined' ? _editComposed : null;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var sIdx = editCellAt(p, x, y);
      if (sIdx < 0) continue;
      var sheet = sIdx >= p.count ? comp : p, sheetIdx = sIdx >= p.count ? sIdx - p.count : sIdx;
      if (sheet && sheet.anim !== undefined && !paletteAnimEntryOfStamp(sheet.anim, sheetIdx)) continue;
      var w = editStampWords(p, sIdx);
      if (!w) continue;
      var hit = paletteAnimMatchWord(p, w.layer1, true, cycles) || paletteAnimMatchWord(p, w.layer2, false, cycles);
      if (!hit) continue;
      var ck = x + ',' + y;
      cellInfo[ck] = { graphic: hit.graphic, pal: hit.pal, match: hit.match, sIdx: sIdx };
      keys.push(ck);
    }
  }
  if (!keys.length) return [];
  var joins = function (a, b) { return cellInfo[a].match.idx === cellInfo[b].match.idx; };
  var clusters = typeof animClusters === 'function' ? animClusters(keys, joins) : [keys];
  var partsOf = {}, out = [];
  clusters.forEach(function (c) {
    var info = cellInfo[c[0]], graphics = [], stamps = [];
    c.forEach(function (ck) {
      var ci = cellInfo[ck];
      if (graphics.indexOf(ci.graphic) < 0) graphics.push(ci.graphic);
      if (stamps.indexOf(ci.sIdx) < 0) stamps.push(ci.sIdx);
    });
    graphics.sort(function (a, b) { return a - b; });
    var key = (graphics.length > 1 ? 'set:' + graphics.join(',') : String(info.graphic)) + ':' + info.match.idx;
    partsOf[key] = (partsOf[key] || 0) + 1;
    var d = Math.max(1, Math.abs(info.match.c.rate)) * 3, delays = [];
    for (var k = 0; k < info.match.c.span; k++) delays.push(d);
    var animHit = paletteAnimEntryOfStamp(p.anim, info.sIdx);
    out.push({
      key: key, tileId: info.graphic, graphics: graphics, stamps: stamps,
      family: p.tileFamilies && p.tileFamilies[info.pal - 1], paletteIndex: info.pal,
      cycle: info.match.c, cycleIndex: info.match.idx, letter: info.match.letter,
      cells: c, part: partsOf[key] - 1, parts: 1, stampIdx: info.sIdx,
      animRow: animHit ? animHit.row : -1, span: info.match.c.span, rate: info.match.c.rate, delays: delays
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
  for (var j = 0; j < listed.length; j++) if (listed[j].key === _paletteAnimSel) return listed[j];
  return null;
}

function paletteAnimFindByTile(tileId) {
  var list = editPaletteAnimsListed(_mtPalette);
  for (var i = 0; i < list.length; i++) if (list[i].tileId === tileId || list[i].key === tileId) return list[i];
  return null;
}

function paletteAnimDefsHtml(p, comp) {
  var defs = '';
  function addSheet(sheet, prefix) {
    if (!sheet || !sheet.imageUri) return;
    defs += '<image id="rg-pa-' + prefix + '0" href="' + sheet.imageUri + '" width="' + sheet.imageWidth
      + '" height="' + sheet.imageHeight + '" style="image-rendering:pixelated"/>';
    var sheets = sheet.anim && sheet.anim.sheets;
    if (!sheets) return;
    for (var k = 0; k < sheets.length; k++) {
      var s = sheets[k];
      if (s && s.imageUri) {
        defs += '<image id="rg-pa-' + prefix + 's' + (k + 1) + '" href="' + s.imageUri + '" width="' + s.imageWidth
          + '" height="' + s.imageHeight + '" style="image-rendering:pixelated"/>';
      }
    }
  }
  addSheet(p, 'p'); addSheet(comp, 'c');
  return defs ? '<svg width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true"><defs>' + defs + '</defs></svg>' : '';
}

function paletteAnimCropUseSvg(cls, x, y, grid, refId, i) {
  var cx = (i % grid.columns) * grid.cell, cy = Math.floor(i / grid.columns) * grid.cell;
  return '<svg class="' + cls + '" x="' + x + '" y="' + y + '" width="' + EDIT_UNITS + '" height="' + EDIT_UNITS
    + '" viewBox="' + cx + ' ' + cy + ' ' + grid.cell + ' ' + grid.cell + '"><use href="#' + refId + '"/></svg>';
}

function paletteAnimCellSvg(key, k, a, useDefs) {
  var p = _mtPalette, c = key.split(',').map(Number), idx = editCellAt(p, c[0], c[1]);
  if (idx < 0) return '';
  var comp = typeof _editComposed !== 'undefined' ? _editComposed : null;
  var isComp = idx >= p.count, sheet = isComp ? comp : p, i = isComp ? idx - p.count : idx, prefix = isComp ? 'c' : 'p';
  if (!sheet || !sheet.imageUri || i < 0 || i >= sheet.count) return '';
  if (k === 0) {
    return useDefs
      ? paletteAnimCropUseSvg('rg-anim-prev-cell', a.x, a.y, sheet, 'rg-pa-' + prefix + '0', i)
      : editCropSvg('rg-anim-prev-cell', a.x, a.y, sheet, sheet.imageUri, sheet.imageWidth, sheet.imageHeight, i, '');
  }
  if (k != null && k > 0) {
    var hit = paletteAnimEntryOfStamp(sheet.anim, i);
    var src = hit && sheet.anim && sheet.anim.sheets && sheet.anim.sheets[k - 1];
    if (!src || !src.imageUri) return paletteAnimCellSvg(key, 0, a, useDefs);
    return useDefs
      ? paletteAnimCropUseSvg('rg-anim-prev-cell', a.x, a.y, sheet.anim, 'rg-pa-' + prefix + 's' + k, hit.row)
      : editCropSvg('rg-anim-prev-cell', a.x, a.y, sheet.anim, src.imageUri, src.imageWidth, src.imageHeight, hit.row, '');
  }
  return editStampSvg(p, comp, idx, a.x, a.y, 'rg-anim-prev-cell');
}

/** Renders a 2D preview of a palette-animated cluster (or a compact 2x2/3x3 patch for large regions). */
function paletteAnimGroupSvg(entry, k, size, useDefs, open) {
  var cells = entry.cells, u = EDIT_UNITS;
  if (!cells || !cells.length) return '';
  var xyAll = cells.map(function (key) { return key.split(',').map(Number); });
  var xs = xyAll.map(function (c) { return c[0]; }), ys = xyAll.map(function (c) { return c[1]; });
  var pickedKeys = cells, pickedXy = xyAll;
  if (Math.max.apply(null, xs) - Math.min.apply(null, xs) + 1 > 3 || Math.max.apply(null, ys) - Math.min.apply(null, ys) + 1 > 3) {
    var ax = xyAll[0][0], ay = xyAll[0][1], subK = [], subXy = [];
    cells.forEach(function (ck, i) {
      if (xyAll[i][0] >= ax && xyAll[i][0] < ax + 2 && xyAll[i][1] >= ay && xyAll[i][1] < ay + 2) { subK.push(ck); subXy.push(xyAll[i]); }
    });
    if (subK.length < 2) {
      subK = []; subXy = [];
      cells.forEach(function (ck, j) {
        if (Math.abs(xyAll[j][0] - ax) <= 1 && Math.abs(xyAll[j][1] - ay) <= 1) { subK.push(ck); subXy.push(xyAll[j]); }
      });
    }
    if (subK.length) { pickedKeys = subK; pickedXy = subXy; }
  }
  var x0 = Math.min.apply(null, pickedXy.map(function (c) { return c[0]; })), y0 = Math.min.apply(null, pickedXy.map(function (c) { return c[1]; }));
  var W = Math.max.apply(null, pickedXy.map(function (c) { return c[0]; })) - x0 + 1, H = Math.max.apply(null, pickedXy.map(function (c) { return c[1]; })) - y0 + 1;
  var k1 = size / Math.max(W, H), html = '';
  var fixedStep = k != null ? k
    : (_animOff || (typeof _animPaletteOn !== 'undefined' && !_animPaletteOn)) ? 0
    : (open && !_paletteAnimPlaying) ? _paletteAnimFrame : null;
  var renderStep = function (step) {
    var stepHtml = '';
    pickedKeys.forEach(function (key, idx) {
      var c = pickedXy[idx], a = { x: (c[0] - x0) * u, y: (c[1] - y0) * u };
      stepHtml += paletteAnimCellSvg(key, step, a, useDefs);
    });
    return stepHtml;
  };
  var delays = entry.delays || [], n = delays.length;
  if (fixedStep != null || n < 2) {
    html = renderStep(fixedStep != null ? fixedStep : 0);
  } else {
    var times = [], total = 0;
    delays.forEach(function (t) { times.push(total); total += Math.max(1, t); });
    var keyTimes = times.map(function (t) { return (t / total).toFixed(4); }).join(';'), dur = (total / 60).toFixed(3) + 's';
    for (var s = 0; s < n; s++) {
      var stepCells = renderStep(s);
      if (stepCells) {
        var values = times.map(function (_, j) { return j === s ? 1 : 0; }).join(';');
        html += '<g' + (s > 0 ? ' class="rg-anim-frame"' : '') + '><animate attributeName="opacity" calcMode="discrete" begin="0s" dur="' + dur
          + '" repeatCount="indefinite" keyTimes="' + keyTimes + '" values="' + values + '"/>' + stepCells + '</g>';
      }
    }
  }
  return '<svg class="rg-anim-sw" width="' + Math.round(W * k1) + '" height="' + Math.round(H * k1) + '" viewBox="0 0 ' + W * u + ' ' + H * u + '">' + html + '</svg>';
}

function paletteAnimOpenHtml(entry, locked, useDefs) {
  var dis = locked ? ' disabled' : '', ticks = Math.max(1, Math.abs(entry.rate)) * 3;
  var cEnd = entry.cycle.colorStart + entry.span - 1;
  var html = '<div class="rg-object-expanded rg-anim-timing">'
    + '<div class="rg-anim-presets"><span class="rg-anim-timing-lbl">cycle</span>'
    + '<span class="ro-chip rg-anim-preset sel" title="' + escH('Palette ' + entry.paletteIndex + ' colours ' + entry.cycle.colorStart + '–' + cEnd) + '">' + entry.letter + '</span>'
    + '<span class="rg-anim-timing-lbl">Palette ' + entry.paletteIndex + ' · colours ' + entry.cycle.colorStart + '–' + cEnd
    + (entry.graphics && entry.graphics.length > 1 ? ' · tiles ' + entry.graphics.join(', ') : ' · tile ' + entry.tileId) + '</span></div><div class="ro-chips">';
  for (var k = 0; k < entry.span; k++) {
    html += '<div class="rg-anim-frame-col"><button class="ro-chip' + (_paletteAnimFrame === k ? ' sel' : '')
      + '" data-pal-anim-frame="' + k + '" title="Frame ' + k + ' of ' + entry.span + ' — colour shift step ' + k + '">'
      + paletteAnimGroupSvg(entry, k, 44, useDefs, true) + '<span class="ro-lbl">' + k + '</span></button></div>';
  }
  return html + '</div><div class="rg-anim-bar">'
    + '<button class="rdf rdf-xs' + (_paletteAnimPlaying ? ' on' : '') + '" data-pal-anim-act="play" title="' + (_paletteAnimPlaying ? 'Stop, and show the selected step' : 'Play it on the map') + '">'
    + (_paletteAnimPlaying ? '■ Stop' : '▶ Play') + '</button>'
    + '<label>step every <input type="number" class="rg-anim-ticks" min="1" value="' + ticks + '" data-pal-anim-cycle="' + entry.cycleIndex
    + '" aria-label="Step hold in ticks" title="Hold per colour shift step in 60 Hz ticks (' + Math.round(ticks * 1000 / 60) + ' ms)"' + dis + '/> ticks</label>'
    + '<span>' + entry.span + ' colours · rate ' + (entry.rate > 0 ? '+' : '') + entry.rate + '</span></div></div>';
}

function paletteAnimRowHtml(entry, locked, open, many, useDefs) {
  var prevSvg = paletteAnimGroupSvg(entry, null, 30, useDefs, open);
  var nTiles = entry.graphics ? entry.graphics.length : 1;
  var labelText = (nTiles > 1 ? paletteAnimPlural(nTiles, 'tile') : entry.tileId) + ', Pal ' + entry.paletteIndex;
  var cEnd = entry.cycle.colorStart + entry.span - 1;
  var html = '<div class="rg-object-card rg-anim-card' + (open ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (open ? ' on' : '') + '" data-pal-anim-sel="' + entry.key + '" data-pal-anim-part="' + (entry.cells[0] || '') + '" title="'
    + escH('Palette ' + entry.paletteIndex + ' (colours ' + entry.cycle.colorStart + '–' + cEnd + ') · locked in ROM\nclick to ' + (open ? 'close' : 'open it')) + '">'
    + animWhereSvg(entry.cells, many) + prevSvg
    + '<span class="rg-trigger-label">' + labelText + ' <span class="rg-anim-lock" aria-label="locked">🔒</span>'
    + '<span class="rg-trigger-what">' + paletteAnimPlural(entry.span, 'frame') + ' · ' + paletteAnimPlural(entry.cells.length, 'cell')
      + (entry.parts > 1 ? ' · <span title="every copy changes together: palette colours and rate are shared">' + (entry.part + 1) + ' of ' + entry.parts + '</span>' : '') + '</span></span>'
    + '<span class="rg-anim-badge" title="' + escH('pattern ' + entry.letter + ' — Palette ' + entry.paletteIndex + ': ' + entry.span + ' colours at rate ' + (entry.rate > 0 ? '+' : '') + entry.rate) + '">' + entry.letter + '</span>'
    + (locked || nTiles > 1 ? '' : '<button class="rdf rdf-xs' + (_paletteAnimPlace === entry.tileId ? ' on' : '') + '" data-pal-anim-act="place" data-pal-anim-tile="' + entry.tileId
      + '" title="' + (_paletteAnimPlace === entry.tileId ? 'Stop placing it' : 'Place it with the pencil, like a tile — every copy changes together') + '">place</button>')
    + '<span class="rg-object-caret">' + (open ? '▾' : '▸') + '</span></div>';
  if (open) html += paletteAnimOpenHtml(entry, locked, useDefs);
  return html + '</div>';
}

/** The Palette Animation tab HTML. */
function paletteAnimTabHtml() {
  var p = _mtPalette;
  if (!p) return '<div class="rs-note">loading the tile palette…</div>';
  var cycles = editPaletteActiveCycles(p);
  if (!cycles.length) return '<div class="rs-note">This room has no palette cycles. The water and scenery use static palettes.</div>';
  var listed = editPaletteAnimsListed(p), locked = editLocked(), open = paletteAnimOpenEntry(listed);
  var defsHtml = paletteAnimDefsHtml(p, typeof _editComposed !== 'undefined' ? _editComposed : null);
  var useDefs = !!defsHtml;
  var html = defsHtml
    + '<div class="rs-note">An animated palette cycles colours over time without changing tile graphics; '
    + 'every cell using those colours shifts in place. The preview reflects in-game shifting palettes.</div>'
    + '<div class="rg-anim-head"><button class="rdf rdf-xs' + (_animOff ? '' : ' on') + '" data-anim-act="toggle-off" aria-pressed="' + !_animOff + '"'
    + ' title="Animation on the whole map: off shows every animated tile on its first frame">Animation: ' + (_animOff ? 'off' : 'on') + '</button>'
    + '<span class="rg-anim-budget" title="Active Section 4.3 colour-cycle channels in this room">' + paletteAnimPlural(cycles.length, 'cycle') + '</span></div>'
    + '<div class="rg-trigger-list rg-anim-list">';
  if (!listed.length) html += '<div class="rs-note">no palette-animated tiles on this map yet</div>';
  else listed.forEach(function (x) { html += paletteAnimRowHtml(x, locked, x === open, listed.length > 12, useDefs); });
  return html + '</div>';
}

function paletteAnimRefreshUi() {
  if (typeof renderEditChrome === 'function') renderEditChrome();
  else if (typeof renderEditLayer === 'function') renderEditLayer(_mtPalette, _editComposed, _editOrigin);
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
    paletteAnimRefreshUi();
    return true;
  }
  if (ds.palAnimSel) {
    var key = ds.palAnimSel, part = ds.palAnimPart || null;
    var was = paletteAnimOpenEntry(editPaletteAnimsListed(_mtPalette));
    var wasOpen = !!was && was.key === key && (was.cells[0] || null) === part;
    _paletteAnimSel = wasOpen ? null : key;
    _paletteAnimSelPart = wasOpen ? null : part;
    _paletteAnimFrame = 0;
    _paletteAnimPlaying = false;
    paletteAnimRefreshUi();
    return true;
  }
  if (ds.palAnimFrame != null) {
    _paletteAnimFrame = Number(ds.palAnimFrame);
    _paletteAnimPlaying = false;
    paletteAnimRefreshUi();
    return true;
  }
  if (ds.palAnimAct === 'play') {
    _paletteAnimPlaying = !_paletteAnimPlaying;
    paletteAnimRefreshUi();
    return true;
  }
  return false;
}

function paletteAnimInputChange(t) {
  if (!t || !t.dataset || t.dataset.palAnimCycle === undefined) return false;
  var cIdx = Number(t.dataset.palAnimCycle), p = _mtPalette;
  if (p && p.paletteCycles && p.paletteCycles[cIdx]) {
    var c = p.paletteCycles[cIdx], ticks = Math.max(1, Number(t.value) || 3);
    c.rate = (c.rate < 0 ? -1 : 1) * Math.max(1, Math.round(ticks / 3));
    if (p.anim && p.anim.entries) {
      for (var i = 0; i < p.anim.entries.length; i++) {
        var delays = p.anim.entries[i][1];
        if (delays && delays.length === c.span) {
          for (var k = 0; k < delays.length; k++) delays[k] = ticks;
        }
      }
    }
    paletteAnimRefreshUi();
  }
  return true;
}

function paletteAnimGesture(d, cell, phase) {
  if (d.tool === 'select') {
    if (phase === 'down') {
      var list = editPaletteAnimsListed(_mtPalette), ck = cell.x + ',' + cell.y;
      for (var i = 0; i < list.length; i++) {
        if (list[i].cells.indexOf(ck) >= 0) {
          _paletteAnimSel = list[i].key;
          _paletteAnimSelPart = list[i].cells[0] || null;
          paletteAnimRefreshUi();
          return true;
        }
      }
    }
    return false;
  }
  if (d.tool === 'paint' && _paletteAnimPlace != null) {
    var entry = paletteAnimFindByTile(_paletteAnimPlace);
    if (!entry) return false;
    if (phase === 'down') editBegin();
    if (phase === 'down' || phase === 'move') {
      editApply([{ x: cell.x, y: cell.y, index: entry.stampIdx }]);
      renderEditLayer(_mtPalette, _editComposed, _editOrigin);
      return true;
    }
    if (phase === 'up') { editEnd(); animRedraw(); return true; }
  }
  return false;
}
