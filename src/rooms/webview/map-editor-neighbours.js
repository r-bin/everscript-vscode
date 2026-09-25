// Ownership: the LIKELY NEIGHBORS card — the mock's plus-shaped mini grid
// (docs/map-editor-redesign-plan.md §8b). The armed brush sits in the
// centre, and each side shows what vanilla draws on that side of it.
//
// Rendering and the card's own gestures only. The model — the host's
// per-side answer, which candidate each side is on, which side is focused —
// is map-editor-relations.js's; the brush and its layer/mirror are
// map-editor-families.js's and map-editor-tiles.js's.
//
// Interaction, from the design handoff's README §2:
// - click a side to focus it; click it again, or scroll over it, to cycle
//   its candidates. The focused side's candidate is spelled out under the
//   grid with a `use` button that arms it as the brush. (The mock's "click
//   cycles" alone would leave no way to *use* the neighbour you found, and
//   a first click that cycled would skip vanilla's best one.)
// - click the centre to switch the brush between front and ground.
//
// Owns: _nbWheel.

/** Wheel travel per step. A mouse notch is ~100px, a trackpad flick far more. */
var NB_WHEEL_STEP = 60;
/** Accumulated wheel travel, so a trackpad does not spin through the list. */
var _nbWheel = 0;

var NB_SIDE_NAME = { n: 'north', e: 'east', s: 'south', w: 'west' };

/** A score as its badge: whole percent, and `<1` rather than a false `0`. */
function nbPct(row) {
  return row[1] ? row[1] + '%' : '<1%';
}

/**
 * One graphic's art, cropped from its family sheet at 2x.
 *
 * The same sheet and offsets `tileGroupHtml` crops swatches from, scaled with
 * `background-size` rather than a transform, so the cell's box is the art's
 * box and the mirror classes can use `transform` on their own.
 */
function nbArtHtml(graphic, family, flipCls) {
  var s = family === null || family === undefined ? null : _famSheets[family];
  if (!s) { if (family !== null) ensureFamilySheet(family); return '<span class="rg-nb-art rg-nb-wait">…</span>'; }
  if (s === 'pending') return '<span class="rg-nb-art rg-nb-wait">…</span>';
  var at = -1;
  for (var i = 0; i < s.slots.length; i++) if (s.slots[i][2] === graphic) { at = i; break; }
  // The sheet is the family's most-used art only (MAX_FAMILY_TILES); a
  // graphic past that has no picture here, so it gets its id, not a guess.
  if (at < 0 || !s.imageUri) return '<span class="rg-nb-art rg-nb-id">' + graphic + '</span>';
  var x = (at % s.columns) * s.cell * 2;
  var y = Math.floor(at / s.columns) * s.cell * 2;
  // The sheet's own size when the host sent it; otherwise what its grid implies.
  var w = s.imageWidth || s.columns * s.cell;
  var h = s.imageHeight || Math.ceil(s.slots.length / s.columns) * s.cell;
  return '<span class="rg-nb-art' + flipCls + '" style="background-image:url(' + s.imageUri + ');'
    + 'background-size:' + w * 2 + 'px ' + h * 2 + 'px;'
    + 'background-position:-' + x + 'px -' + y + 'px"></span>';
}

/** The brush's mirror, as the classes its art and its candidates' art carry. */
function nbFlipCls() {
  return (_brushFlip.h ? ' rg-flip-h' : '') + (_brushFlip.v ? ' rg-flip-v' : '');
}

/** One side of the plus: the candidate it is on, or an honest empty cell. */
function nbSideHtml(side, layerName) {
  var list = nbCandidates(side);
  var row = nbShown(side);
  var name = NB_SIDE_NAME[side];
  if (!row) {
    return '<span class="rg-nb-side rg-nb-' + side + ' rg-nb-empty" title="'
      + escH('Vanilla never draws anything ' + name + ' of this on the ' + layerName + ' layer.') + '"></span>';
  }
  var fam = nbFamilyFor(row);
  var mirrored = nbSourceSide(side) !== side;
  var title = 'graphic ' + row[0] + (fam.family !== null ? ' in family ' + fam.family : '')
    + '\n' + nbPct(row) + ' — drawn ' + (mirrored ? NB_SIDE_NAME[nbSourceSide(side)] + ' of the unmirrored tile' : name + ' of it')
    + ' ' + row[2] + ' time' + (row[2] === 1 ? '' : 's') + ' in vanilla (' + layerName + ' layer)'
    + (mirrored ? '\nshown mirrored, because the brush is' : '')
    + (fam.usable ? '' : '\ncannot be used: ' + fam.why)
    + '\n' + (_nbCycle[side] % list.length + 1) + '/' + list.length
    + ' — click to pick, click again or scroll to cycle';
  return '<button class="rg-nb-side rg-nb-' + side + (_nbFocus === side ? ' on' : '')
    + (fam.usable ? '' : ' rg-nb-off') + '" data-nb-side="' + side + '" title="' + escH(title) + '">'
    + nbArtHtml(row[0], fam.family, nbFlipCls())
    + '<b class="rg-nb-pct">' + nbPct(row) + '</b></button>';
}

/** The focused side, spelled out, with the one action it offers. */
function nbDetailHtml() {
  var row = _nbFocus ? nbShown(_nbFocus) : null;
  if (!row) {
    return '<div class="rg-nb-detail rg-nb-hint">click a side to pick it · again or scroll to cycle'
      + ' · centre switches front/ground</div>';
  }
  var fam = nbFamilyFor(row);
  var list = nbCandidates(_nbFocus);
  return '<div class="rg-nb-detail"><span class="rg-nb-where">'
    + _nbFocus.toUpperCase() + ' ' + (_nbCycle[_nbFocus] % list.length + 1) + '/' + list.length
    + '</span><span class="rg-nb-what">' + row[0]
    + (fam.family !== null ? ' · fam ' + fam.family : '') + ' · ' + row[2] + '×</span>'
    + '<button class="rg-nb-use" data-nb-use="' + _nbFocus + '"' + (fam.usable ? '' : ' disabled')
    + ' title="' + escH(fam.usable ? 'Make it the brush' + (fam.why ? ' — ' + fam.why : '') : fam.why) + '">'
    + (fam.usable ? 'use' : 'no slot') + '</button></div>';
}

/**
 * The card. Nothing at all without an armed family tile — the mock's
 * `hasCurrentTile` gate: with no centre there is nothing to be beside.
 */
function neighbourCardHtml() {
  ensureNeighbours();
  var c = nbCentre();
  if (!c) return '';
  var open = _panelOpen.neighbours !== false;
  var layerName = c.layer === 'canopy' ? 'front' : 'ground';
  var html = '<div class="rg-nb-card"><div class="rg-sec-h" data-panel="neighbours"'
    + ' title="' + escH('What vanilla draws on each side of the armed tile, on the '
      + layerName + ' layer. Scored per side — a side vanilla never fills stays empty.') + '">'
    + '<span class="rg-panel-caret">' + (open ? '▾' : '▸') + '</span>'
    + '<span class="rg-sec-name">likely neighbors</span>'
    + '<span class="rg-sec-count">' + layerName + '</span></div>';
  if (!open) return html + '</div>';
  if (!_nbAnswer) return html + '<div class="rg-nb-detail rg-nb-hint">reading vanilla…</div></div>';
  if (_nbAnswer.error) return html + '<div class="rg-nb-detail rg-nb-hint">' + escH(_nbAnswer.error) + '</div></div>';

  html += '<div class="rg-nb-plus">'
    + '<button class="rg-nb-centre" data-nb-centre="1" title="' + escH('graphic ' + c.graphic
      + ' in family ' + c.family + ', the brush — drawn as ' + layerName
      + '\nClick to draw it as ' + (c.layer === 'canopy' ? 'ground' : 'front') + ' instead') + '">'
    + nbArtHtml(c.graphic, c.family, nbFlipCls()) + '</button>';
  for (var i = 0; i < 4; i++) html += nbSideHtml('nesw'.charAt(i), layerName);
  return html + '</div>' + nbDetailHtml() + '</div>';
}

/** A click on a side: focus it first, cycle it once it is focused. */
function nbSideClick(side) {
  if (_nbFocus !== side) { _nbFocus = side; renderEditPanels(); return; }
  nbCycleSide(side, 1);
}

/** Arm the focused side's candidate, mirrored as it is shown. */
function nbUse(side) {
  var row = nbShown(side);
  if (!row) return;
  var fam = nbFamilyFor(row);
  if (!fam.usable) { editNote('graphic ' + row[0] + ': ' + fam.why); return; }
  // editUseFamilyTile ORs in `_brushFlip`, the same mirror the cell was
  // drawn with, so what gets painted is the pair vanilla attests.
  editUseFamilyTile(row[0], fam.family);
}

/**
 * Scroll over a side to cycle it. Bound once, by bindEditControls, on the
 * same panel node as the click delegation (webview-dom-safety §1).
 */
function neighbourWheel(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-nb-side]') : null;
  if (!t) return;
  e.preventDefault();
  _nbWheel += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
  if (Math.abs(_nbWheel) < NB_WHEEL_STEP) return;
  var step = _nbWheel > 0 ? 1 : -1;
  _nbWheel = 0;
  nbCycleSide(t.dataset.nbSide, step);
}
