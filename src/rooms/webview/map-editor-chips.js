// Ownership: the Tile tab's TILE FAMILIES section — the seven families this
// draft has loaded, and the ~320 others it could adopt.
//
// A family id is not a name. The old picker made you choose one out of a
// paged list of 329 numbers before it would show you anything; a card shows
// its most-placed tiles first, so the art is the label. Cards also do the
// filtering: select some and the tile list narrows to them, select none and
// it is unfiltered.
//
// **Two groups, never interleaved** (Phase 8a, docs/map-editor-redesign-plan.md).
// Before this phase one flat list mixed "the seven I am working with" with
// "the three hundred I could add", each carrying a different action (× vs +),
// which is most of why the panel read as noise. Now the palette's own seven
// are the section, and the candidates sit behind an "add a family"
// disclosure with the search that scopes them.
//
// Two states, like the mock: collapsed is a strip of seven slots (art plus
// graphic count, empty slots dashed), expanded is the card grid. The collapse
// rides `_panelOpen.families` and `data-panel`, the same mechanism every other
// section uses — this one just draws something when it is shut.
//
// The adjacency model that used to live here is map-editor-relations.js.
//
// Owns: _chipSel, _chipPreviews, _chipFilter, _chipPage, _famAddOpen.
//
// See docs/map-format/map-editor-window.md §4.

/** familyId -> true for every family currently filtering the tile list. */
var _chipSel = {};
/** The two-tiles-per-family sheet, once fetched. */
var _chipPreviews = null;
var _chipFilter = '';
/** Is the "add a family" disclosure open? Candidates are hidden until asked for. */
var _famAddOpen = false;

/**
 * Ask for every family's chip art.
 *
 * Two tiles each, and that is a host constraint rather than a taste one:
 * `buildFamilyPreviews` (room-draft.js) caps the sheet at 40 families unless
 * `columns <= CHIP_TILES` (2), and all 329 have to fit one PNG. So a card
 * shows two swatches where the mock draws three.
 */
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

/** Every family, adopted ones first (in slot order), then by how much art they have. */
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

/** How many candidate families to show before asking. */
var CHIP_PAGE = 24;
var _chipPage = CHIP_PAGE;

function chipArtStyle(familyId) {
  var pv = _chipPreviews;
  if (!pv || pv === 'pending') return '';
  var row = pv.families.indexOf(familyId);
  if (row < 0) return '';
  return 'background-image:url(' + pv.imageUri + ');background-position:0 -' + (row * pv.cell) + 'px';
}

/** The catalogue entry for a family, or null — a slot can hold an id it never knew. */
function chipMeta(familyId) {
  var all = _famCatalogue || [];
  for (var i = 0; i < all.length; i++) if (all[i].id === familyId) return all[i];
  return null;
}

/** Everything a sentence used to say about one family, as its tooltip. */
function chipTitle(familyId, slot) {
  var f = chipMeta(familyId);
  return escH('Family ' + familyId
    + (f ? ' — ' + f.tiles + ' graphics' : '')
    + (f && f.areas.length ? '\n' + f.areas.join(', ') : '')
    + (f && f.names.length ? '\n' + f.names.slice(0, 3).join('\n') : '')
    + (slot >= 0 ? '\nin palette slot ' + (slot + 1)
      : '\nnot loaded — placing one of its tiles adopts it')
    + '\nClick to filter the tiles below to it; click again to show everything.');
}

// ---------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------

/** Collapsed: the seven slots as art, with what each one buys. */
function familyStripHtml(fams) {
  var html = '<div class="rg-fam-strip">';
  for (var i = 0; i < 7; i++) {
    var id = fams[i];
    if (id === undefined) {
      html += '<button class="rg-fam-slot empty" data-fam-add="1"'
        + ' title="' + escH('Palette slot ' + (i + 1) + ' is free — click to add a family') + '">+</button>';
      continue;
    }
    var meta = chipMeta(id);
    html += '<button class="rg-fam-slot' + (_chipSel[id] ? ' sel' : '') + '"'
      + ' data-chip="' + id + '" title="' + chipTitle(id, i) + '">'
      + '<i class="rg-chip-art" style="' + chipArtStyle(id) + '"></i>'
      + '<span class="rg-fam-n">' + (meta ? meta.tiles : '?') + '</span></button>';
  }
  return html + '</div>';
}

/** One card: art, id, where it is from, how much art it has, and its action. */
function familyCardHtml(f, slot) {
  return '<div class="rg-fam-card' + (_chipSel[f.id] ? ' sel' : '')
    + (slot >= 0 ? ' adopted' : '') + '">'
    + '<button class="rg-fam-body" data-chip="' + f.id + '" title="' + chipTitle(f.id, slot) + '">'
    + '<i class="rg-chip-art" style="' + chipArtStyle(f.id) + '"></i>'
    + '<span class="rg-fam-meta"><b>' + f.id + '</b>'
    + (f.tiles ? '<span class="rg-fam-n">' + f.tiles + '</span>' : '') + '</span>'
    + '<span class="rg-fam-where">' + escH(f.areas[0] || 'unused') + '</span>'
    + '</button>'
    + (slot >= 0
      ? '<button class="rg-fam-x" data-chip-drop="' + slot + '"'
        + ' title="' + escH('Free palette slot ' + (slot + 1)
          + '. Cells already drawn in family ' + f.id + ' go invalid until it comes back.') + '">×</button>'
      : '<button class="rg-fam-x rg-fam-plus" data-chip-adopt="' + f.id + '"'
        + ' title="' + escH('Load family ' + f.id + ' into a free palette slot') + '">+</button>')
    + '</div>';
}

/**
 * The candidates, behind a disclosure.
 *
 * Shut by default: three hundred families you have not chosen are a
 * reference, not a workspace. The filter input only exists while it is open,
 * which the focus-restore block in map-editor-panels.js already tolerates.
 */
function familyAddHtml(fams, free) {
  var rest = chipList().filter(function (f) { return fams.indexOf(f.id) < 0; });
  var total = (_famCatalogue || []).length - fams.filter(function (f) { return f !== undefined; }).length;
  var html = '<button class="rg-fam-add' + (_famAddOpen ? ' on' : '') + '" data-fam-add="1"'
    + ' title="' + escH(free
      ? free + ' of the seven palette slots are free'
      : 'All seven slots are taken — remove one before adding another') + '">'
    + (_famAddOpen ? '▾ ' : '+ ') + 'add a family <span class="rg-fam-n">' + total + '</span></button>';
  if (!_famAddOpen) return html;

  html += '<div class="rg-fam-menu">'
    + '<input class="rg-fam-filter" id="rg-chip-filter" value="' + escH(_chipFilter)
    + '" placeholder="an act, a room, or a family id" />';
  if (!free) {
    html += '<div class="rg-fam-note">All seven slots are taken. Remove one above first — '
      + 'adopting is what a tile click does, and it needs a free slot.</div>';
  }
  if (!rest.length) {
    html += '<div class="rg-fam-note">No family matches that.</div>';
  } else {
    html += '<div class="rg-fam-grid">';
    for (var i = 0; i < Math.min(rest.length, _chipPage); i++) html += familyCardHtml(rest[i], -1);
    html += '</div>';
    if (rest.length > _chipPage) {
      html += '<button class="rg-fam-more" data-chip-more="1">'
        + (rest.length - _chipPage) + ' more</button>';
    }
  }
  return html + '</div>';
}

/**
 * The whole section: its own header, then one of the two states.
 *
 * The header is unconditional — including before the catalogue arrives. A
 * section that is simply absent for the first second reads as a missing
 * feature, and the count is the one thing that is knowable without the
 * catalogue at all (it is the draft's own `families` array).
 */
function familiesSectionHtml() {
  if (!_famCatalogue) requestFamilyCatalogue();
  else requestChipPreviews();

  var fams = editFamilies();
  var used = 0;
  for (var i = 0; i < 7; i++) if (fams[i] !== undefined) used += 1;
  var open = _panelOpen.families !== false;

  var html = '<div class="rg-fam-sec">'
    + '<div class="rg-sec-h" data-panel="families" title="' + escH(used + ' of the seven palette '
      + 'slots are in use. A family is a colour set a tilemap word names by slot; clicking one '
      + 'filters the tiles below, and nothing selected shows everything.') + '">'
    + '<span class="rg-panel-caret">' + (open ? '▾' : '▸') + '</span>'
    + '<span class="rg-sec-name">tile families</span>'
    + '<span class="rg-sec-count' + (used >= 7 ? ' full' : '') + '">' + used + '/7 active</span>'
    + '</div>';

  if (!_famCatalogue) {
    return html + '<div class="rg-fam-note">loading the families…</div></div>';
  }

  html += open
    ? '<div class="rg-fam-grid">'
      // A slot can hold an id the catalogue never listed (a drafted room
      // borrowing one, say) — it still gets a card, so the palette is never
      // silently one slot short. Only the art and count are missing.
      + fams.map(function (id, slot) {
        if (id === undefined) return '';
        return familyCardHtml(chipMeta(id) || { id: id, tiles: 0, areas: [], names: [] }, slot);
      }).join('')
      + '</div>' + familyAddHtml(fams, 7 - used)
    : familyStripHtml(fams);

  var picked = Object.keys(_chipSel).length;
  if (picked) {
    html += '<button class="rg-fam-clear" data-chip="clear">showing ' + picked + ' famil'
      + (picked === 1 ? 'y' : 'ies') + ' — show all</button>';
  }
  return html + '</div>';
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Toggle a family's place in the tile-list filter. */
function chipToggle(id) {
  if (id === 'clear') { _chipSel = {}; renderEditPanels(); return; }
  var key = Number(id);
  if (_chipSel[key]) delete _chipSel[key];
  else _chipSel[key] = true;
  renderEditPanels();
}

/** Put a family in a free slot, from a candidate card's `+`. */
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
 * and the Tile tab's invalid-family banner (map-editor-stranded.js) picks up
 * whatever that invalidated.
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
