// Ownership: the family chips, and what vanilla draws beside what.
//
// A family id is not a name. The old picker made you choose one out of a
// paged list of 329 numbers before it would show you anything; a chip shows
// its two most-placed tiles first, so the art is the label. Chips also do
// the filtering: select some and the tile list narrows to them, select none
// and it is unfiltered.
//
// Owns: _chipSel, _chipPreviews, _chipFilter, _related, _relatedTop,
// _relatedKey, _layerForce.
//
// See docs/map-format/map-editor-window.md §4.

/** familyId -> true for every chip currently filtering the tile list. */
var _chipSel = {};
/** The two-tiles-per-family sheet, once fetched. */
var _chipPreviews = null;
var _chipFilter = '';

/** graphic -> 0..100, how well it goes with what is already in the map. */
var _related = {};
/** The same thing ranked, for the recommended-neighbours strip. */
var _relatedTop = [];
/** The seed the two above were computed for, so a redraw does not refetch. */
var _relatedKey = null;

/**
 * Force the next placement onto a layer, or null to follow vanilla.
 *
 * "You can draw all tiles in the foreground or background" is literally
 * true of the format — a tilemap word does not care which of the two layer
 * slots it is written into — so this is an override, not a filter.
 */
var _layerForce = null;

/** Ask for every family's chip art. Two tiles each, so 329 fit one sheet. */
function requestChipPreviews() {
  if (_chipPreviews || !_famCatalogue || typeof vs === 'undefined' || !vs) return;
  _chipPreviews = 'pending';
  vs.postMessage({
    command: 'requestFamilyPreviews', tiles: 2,
    families: _famCatalogue.map(function (f) { return f.id; }),
  });
}

function applyChipPreviews(msg) {
  _chipPreviews = msg.previews;
  renderEditPanels();
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

/** The graphic a tilemap word names, or undefined if this room cannot say. */
function editGraphicOfWord(word) {
  if (word == null || !_mtPalette) return undefined;
  var chr = word & 0x3ff;
  return editGraphicAtSlot(_mtPalette, Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2));
}

/**
 * What is actually in play, as a seed for "what goes with this".
 *
 * The draft's own cells plus the armed brush — not the whole room, whose
 * hundreds of graphics would average out to no signal at all. The blank
 * canopy is skipped: "what gets drawn next to nothing" is every tile.
 */
function editPlacedGraphics() {
  var d = editDraft();
  if (!d || !_mtPalette) return [];
  var blank = editBlankCanopy(_mtPalette);
  var seen = {};
  var out = [];
  var add = function (g) {
    if (g === undefined || g === null || seen[g]) return;
    seen[g] = 1; out.push(g);
  };
  if (_brushTile) add(_brushTile.graphic);
  Object.keys(d.cells).forEach(function (k) {
    var w = editStampWords(_mtPalette, d.cells[k]);
    if (!w) return;
    if (w.layer1 !== blank) add(editGraphicOfWord(w.layer1));
    if (w.layer2 !== blank) add(editGraphicOfWord(w.layer2));
  });
  // Enough to characterise what is being built; past this it is noise.
  return out.slice(0, 24);
}

/** Refetch the relationship lookup when what is in play has changed. */
function ensureRelated() {
  if (typeof vs === 'undefined' || !vs) return;
  var seed = editPlacedGraphics();
  var key = seed.join(',');
  if (key === _relatedKey) return;
  _relatedKey = key;
  if (!seed.length) { _related = {}; _relatedTop = []; return; }
  vs.postMessage({ command: 'requestRelated', graphics: seed });
}

function applyRelatedTiles(msg) {
  if (!msg || msg.error || !msg.related) return;
  _related = {};
  _relatedTop = msg.related;
  for (var i = 0; i < msg.related.length; i++) _related[msg.related[i][0]] = msg.related[i][1];
  renderEditPanels();
}

/** How well this graphic goes with what is placed, 0..100. */
function relatedScore(graphic) {
  var s = _related[graphic];
  return s === undefined ? 0 : s;
}

// ---------------------------------------------------------------------------
// The chips
// ---------------------------------------------------------------------------

/** Every family, adopted ones first, then by how much art they have. */
function chipList() {
  if (!_famCatalogue) return [];
  var fams = editFamilies();
  var q = String(_chipFilter || '').trim().toLowerCase();
  var out = _famCatalogue.filter(function (f) {
    if (!q) return true;
    if (String(f.id).indexOf(q) === 0) return true;
    var where = f.areas.concat(f.names).join(' ').toLowerCase();
    return where.indexOf(q) >= 0;
  });
  return out.sort(function (a, b) {
    var ai = fams.indexOf(a.id), bi = fams.indexOf(b.id);
    if ((ai >= 0) !== (bi >= 0)) return ai >= 0 ? -1 : 1;
    if (ai >= 0 && bi >= 0) return ai - bi;
    return b.tiles - a.tiles || a.id - b.id;
  });
}

/** How many unadopted chips to show before asking. */
var CHIP_PAGE = 24;

function chipArtStyle(familyId) {
  var pv = _chipPreviews;
  if (!pv || pv === 'pending') return '';
  var row = pv.families.indexOf(familyId);
  if (row < 0) return '';
  return 'background-image:url(' + pv.imageUri + ');background-position:0 -' + (row * pv.cell) + 'px';
}

/**
 * The chips row.
 *
 * Three separate click targets, so none of them is a surprise: the chip
 * filters, `×` removes an adopted family from its slot (which the old `×`
 * did not do — it opened the picker instead), and `+` adopts one.
 */
function familyChipsHtml() {
  if (!_famCatalogue) { requestFamilyCatalogue(); return '<div class="rs-note">loading the families…</div>'; }
  requestChipPreviews();

  var fams = editFamilies();
  var list = chipList();
  var shown = list.filter(function (f) { return fams.indexOf(f.id) >= 0; })
    .concat(list.filter(function (f) { return fams.indexOf(f.id) < 0; }).slice(0, _chipPage));

  var free = 0;
  for (var i = 0; i < 7; i++) if (fams[i] === undefined) free += 1;

  var html = '<div class="rs-note">' + (7 - free) + ' of 7 slots used'
    + (free ? ' · ' + free + ' free' : ' · full — remove one to add another')
    + '. A chip filters the tiles below; nothing selected shows everything.</div>'
    + '<input class="rg-fam-filter" id="rg-chip-filter" value="' + escH(_chipFilter)
    + '" placeholder="an act, a room, or a family id" />'
    + '<div class="rg-chips">';

  for (var j = 0; j < shown.length; j++) {
    var f = shown[j];
    var slot = fams.indexOf(f.id);
    var on = !!_chipSel[f.id];
    html += '<span class="rg-chip' + (on ? ' sel' : '') + (slot >= 0 ? ' adopted' : '') + '">'
      + '<button class="rg-chip-main" data-chip="' + f.id + '"'
      + ' title="' + escH('Family ' + f.id + ' — ' + f.tiles + ' graphics'
        + (f.areas.length ? '\n' + f.areas.join(', ') : '')
        + (f.names.length ? '\n' + f.names.slice(0, 3).join('\n') : '')
        + (slot >= 0 ? '\nin palette slot ' + (slot + 1) : '\nnot loaded — placing one of its tiles adopts it')
        + '\nClick to filter the tiles below.') + '">'
      + '<i class="rg-chip-art" style="' + chipArtStyle(f.id) + '"></i>'
      + '<b>' + f.id + '</b>'
      + '<span class="rg-chip-where">' + escH(f.areas[0] || 'unused') + '</span>'
      + '</button>'
      + (slot >= 0
        ? '<button class="rg-chip-x" data-chip-drop="' + slot + '"'
          + ' title="' + escH('Free palette slot ' + (slot + 1)
            + '. Tiles already placed in family ' + f.id + ' become invalid until it comes back.') + '">×</button>'
        : '<button class="rg-chip-x rg-chip-add" data-chip-adopt="' + f.id + '"'
          + ' title="' + escH(free ? 'Load family ' + f.id + ' into a free slot'
            : 'All seven slots are taken — free one first') + '">+</button>')
      + '</span>';
  }
  html += '</div>';

  var rest = list.filter(function (f) { return fams.indexOf(f.id) < 0; }).length;
  if (rest > _chipPage) {
    html += '<div class="rd-filters"><button class="rdf" data-chip-more="1">'
      + 'more families (' + (rest - _chipPage) + ' left)</button></div>';
  }
  if (Object.keys(_chipSel).length) {
    html += '<div class="rd-filters"><button class="rdf on" data-chip="clear">'
      + 'clear the filter</button></div>';
  }
  return html;
}

var _chipPage = CHIP_PAGE;

/** Toggle a chip's place in the filter. */
function chipToggle(id) {
  if (id === 'clear') { _chipSel = {}; renderEditPanels(); return; }
  var key = Number(id);
  if (_chipSel[key]) delete _chipSel[key];
  else _chipSel[key] = true;
  renderEditPanels();
}

/** Put a family in a free slot, from the chip's `+`. */
function chipAdopt(id) {
  var got = editAdoptFamilyFor(Number(id));
  editNote(got.ok
    ? (got.added ? 'family ' + id + ' loaded into slot ' + (got.slot + 1)
      : 'family ' + id + ' is already in slot ' + (got.slot + 1))
    : got.why);
  renderEditChrome();
}

/**
 * Free a slot — and mean it.
 *
 * The old `×` carried the picker's own data attribute, so it opened the
 * browser to *swap* the family and never cleared anything. This clears it,
 * and the checks panel picks up whatever that invalidated.
 */
function chipDrop(slot) {
  var fams = editFamilies();
  var gone = fams[Number(slot)];
  editClearFamily(Number(slot));
  delete _chipSel[gone];
  var stranded = editStrandedCells().length;
  editNote('family ' + gone + ' removed from slot ' + (Number(slot) + 1)
    + (stranded ? ' — ' + stranded + ' placed cell' + (stranded === 1 ? '' : 's')
      + ' still need it' : ''));
  renderEditChrome();
}
