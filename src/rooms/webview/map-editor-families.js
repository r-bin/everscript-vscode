// Ownership: choosing the seven tile families, and browsing the art each
// one would buy.
//
// The inverted flow starts here: a family is not a palette id to look up,
// it is a decision about what the room can look like. So a slot can be
// cleared, a family can be picked from the whole catalogue with its tiles
// previewed first, and picking a *tile* pulls its family in behind it.
//
// Owns: _famCatalogue, _famFilter, _famSheets, _famPicking.
//
// See docs/map-format/building-a-room-from-a-picture.md §5.1.

/** `[familyId, graphics, rooms]` for every attested family; null until asked. */
var _famCatalogue = null;
var _famFilter = '';
/** familyId -> its rendered sheet, once fetched. */
var _famSheets = {};
/** The graphic+family currently armed as the brush, for the selected ring. */
var _brushTile = null;
/** Which slot the browser is filling, or -1 when it is closed. */
var _famPicking = -1;
/** The picker's page, and the strip sheet for the families on it. */
var _famPage = 0;
var _famPreviews = null;
var _famPreviewKey = '';

/** The families the draft is working with — the room's own until changed. */
function editFamilies() {
  var d = editDraft();
  if (!d) return [];
  if (!d.families) d.families = ((_mtPalette && _mtPalette.tileFamilies) || []).slice(0, 7);
  return d.families;
}

function requestFamilyCatalogue() {
  if (_famCatalogue || typeof vs === 'undefined' || !vs) return;
  vs.postMessage({ command: 'requestFamilyCatalogue' });
}

function applyFamilyCatalogue(msg) {
  if (!msg || msg.error || !msg.families) return;
  _famCatalogue = msg.families;
  renderEditPanels();
}

/** Fetch a family's sheet unless it is already in hand. */
function ensureFamilySheet(family) {
  if (family === undefined || _famSheets[family] || typeof vs === 'undefined' || !vs) return;
  _famSheets[family] = 'pending';
  vs.postMessage({ command: 'requestFamilySheet', family: family, borrowFrom: _mtRoomId });
}

function applyFamilySheet(msg) {
  if (!msg || msg.error || !msg.sheet) return;
  _famSheets[msg.sheet.family] = msg.sheet;
  noteLayerHints(msg.sheet.slots, 4, 5, 2);
  renderEditPanels();
}

/** Remember how vanilla splits each graphic between the two layers. */
function noteLayerHints(rows, canopyAt, terrainAt, idAt) {
  if (!rows) return;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r || r[canopyAt] === undefined) continue;
    _famLayerHint[r[idAt]] = [r[canopyAt], r[terrainAt]];
  }
}

/**
 * Put a family in a slot.
 *
 * Seven is a hard ceiling — the loader clamps to it at `$90D037` — so a
 * slot is *replaced*, never appended past the end.
 */
function editSetFamily(slot, family) {
  var fams = editFamilies();
  if (slot < 0 || slot > 6) return;
  while (fams.length <= slot) fams.push(undefined);
  fams[slot] = family;
  ensureFamilySheet(family);
}

function editClearFamily(slot) {
  var fams = editFamilies();
  if (slot >= 0 && slot < fams.length) fams[slot] = undefined;
}

/**
 * Bring in the family a graphic needs, and say what it cost.
 *
 * This is "pick a tile, which adds the family". If the family is already
 * in a slot there is nothing to do; if a slot is free it takes the first
 * one; if all seven are taken the tile cannot be drawn as vanilla draws it
 * and the caller is told rather than left with a silent wrong colour.
 */
function editAdoptFamilyFor(graphicSlotOrFamily) {
  var family = graphicSlotOrFamily;
  var fams = editFamilies();
  if (family === undefined || family === null) return { ok: false, why: 'no family known for that tile' };
  if (fams.indexOf(family) >= 0) return { ok: true, added: false, slot: fams.indexOf(family) };
  for (var i = 0; i < 7; i++) {
    if (fams[i] === undefined) {
      editSetFamily(i, family);
      return { ok: true, added: true, slot: i };
    }
  }
  return { ok: false, why: 'all seven palette slots are taken — clear one to make room for family ' + family };
}

/**
 * Pick a tile out of a family's art and make it the brush.
 *
 * Three things have to happen for a graphic the room never loaded: its
 * family needs a palette slot, the graphic needs a Block 1 slot, and the
 * two combine into the word a metatile can name. Each is a budget cost,
 * and each is reported rather than done silently.
 */
function editUseFamilyTile(graphicId, family) {
  var d = editDraft();
  if (!d) return;
  var got = editAdoptFamilyFor(family);
  if (!got.ok) { editNote(got.why); renderEditPanels(); return; }

  var slot = editAdoptGraphic(_mtPalette, graphicId);
  if (slot < 0) { editNote('no tile sheet loaded yet'); return; }
  // The palette field is 1..7 and matches the slot the family sits in.
  var word = (editSlotChr(slot) | ((got.slot + 1) << 10)) & 0xffff;
  var prefer = editLayerPreference(graphicId);
  var index = editBrushFromTile(_mtPalette, word, d.phase, prefer);

  // Which swatch is armed has to be visible on the swatch, not only in a
  // line of text \u2014 clicking with no confirmation reads as a dead control.
  _brushTile = { graphic: graphicId, family: family };
  _mtSlot = -1;
  editArmBrush();

  editNote('brush: graphic ' + graphicId + ' in family ' + family
    + (got.added ? ' (family added to slot ' + (got.slot + 1) + ')' : '')
    + ' \u2014 stamp #' + index
    + (prefer === 'canopy' ? ', drawn over what it is painted on'
      : prefer === 'terrain' ? ', as ground'
        : d.phase === 'deco' ? ', drawn over what it is painted on' : ', as ground')
    + (prefer ? ' (how vanilla draws it)' : '')
    + '. Paint on the map.');
  requestComposedPreview();
  renderEditChrome();
}

/** The seven slots, each clearable, plus a way to fill an empty one. */
function familySlotsPanel() {
  var fams = editFamilies();
  var html = '<div class="rg-fam-slots">';
  for (var i = 0; i < 7; i++) {
    var fam = fams[i];
    var open = _famPicking === i;
    if (fam === undefined) {
      html += '<button class="rdf rg-fam-empty' + (open ? ' on' : '') + '" data-fam-add="' + i + '"'
        + ' title="' + escH('Palette slot ' + (i + 1) + ' is empty — pick a family for it') + '">'
        + (i + 1) + ': +</button>';
    } else {
      html += '<span class="rg-fam-slot' + (open ? ' on' : '') + '">'
        + '<button class="rdf" data-fam-slot="' + i + '"'
        + ' title="' + escH('Family ' + fam + ' in palette slot ' + (i + 1)
          + '. A tilemap word with pal ' + (i + 1) + ' draws in these colours.'
          + '\nClick to preview its art.') + '">' + (i + 1) + ': ' + fam + '</button>'
        + '<button class="rdf rg-fam-x" data-fam-add="' + i + '"'
        + ' title="' + escH('Free this slot, or swap the family in it') + '">×</button>'
        + '</span>';
    }
  }
  html += '</div>';

  if (_famPicking >= 0) html += familyBrowserHtml();
  else if (_famOpen >= 0 && fams[_famOpen] !== undefined) html += familyStrip(fams[_famOpen]);
  return html;
}

/** How many families the picker shows at once, with previews. */
var FAM_PAGE = 12;

/**
 * The catalogue, filtered, with every family's art shown before it is picked.
 *
 * A family id is a terrible name. What makes one choosable is the art and
 * the places it is used, so each row is a strip of its tiles plus the acts
 * and rooms it appears in — "220, Omnitopia, Reactor room" is a choice,
 * "220" is a lottery ticket.
 */
function familyBrowserHtml() {
  if (!_famCatalogue) { requestFamilyCatalogue(); return '<div class="rs-note">loading the catalogue\u2026</div>'; }
  var list = filterFamilies(_famCatalogue, _famFilter);
  var shown = list.slice(_famPage * FAM_PAGE, _famPage * FAM_PAGE + FAM_PAGE);
  ensureFamilyPreviews(shown.map(function (f) { return f.id; }));

  var html = '<div class="rg-fam-browse">'
    + '<div class="rs-note">Filling slot ' + (_famPicking + 1) + ' \u2014 ' + list.length
    + ' famil' + (list.length === 1 ? 'y' : 'ies')
    + (list.length > FAM_PAGE ? ', showing ' + (_famPage * FAM_PAGE + 1) + '\u2013'
      + (_famPage * FAM_PAGE + shown.length) : '') + ', most art first.</div>'
    + '<input class="rg-fam-filter" id="rg-fam-filter" value="' + escH(_famFilter)
    + '" placeholder="an act, a room name, an id, or &gt;100 tiles" />';

  for (var i = 0; i < shown.length; i++) html += familyRow(shown[i], i);

  if (list.length > FAM_PAGE) {
    var last = Math.ceil(list.length / FAM_PAGE) - 1;
    html += '<div class="rd-filters">'
      + '<button class="rdf" data-fam-page="' + Math.max(0, _famPage - 1) + '">\u2039 back</button>'
      + '<span class="rs-note">page ' + (_famPage + 1) + ' of ' + (last + 1) + '</span>'
      + '<button class="rdf" data-fam-page="' + Math.min(last, _famPage + 1) + '">more \u203a</button>'
      + '</div>';
  }
  html += '<div class="rd-filters"><button class="rdf" data-fam-pick="none">cancel</button>'
    + '<button class="rdf" data-fam-pick="clear">leave the slot empty</button></div></div>';
  return html;
}

/**
 * One family: its art, its id, and where the game uses it.
 *
 * The strip comes out of the shared preview sheet, so twelve families cost
 * one image rather than twelve.
 */
function familyRow(f, rowInSheet) {
  var pv = _famPreviews;
  var have = pv && pv.families.indexOf(f.id) >= 0;
  var row = have ? pv.families.indexOf(f.id) : -1;

  var strip = '';
  if (have) {
    strip = '<div class="rs-mt-grid">';
    for (var c = 0; c < pv.columns && c < f.tiles; c++) {
      strip += '<i class="rs-mt-cell" style="background-position:-' + (c * pv.cell)
        + 'px -' + (row * pv.cell) + 'px"></i>';
    }
    strip += '</div>';
  } else {
    strip = '<span class="rs-note">\u2026</span>';
  }

  var where = f.areas.length ? f.areas.join(', ') : 'unused';
  var rooms = f.names.length
    ? f.names.slice(0, 2).join(', ') + (f.rooms > 2 ? ' +' + (f.rooms - 2) : '')
    : '';
  return '<div class="rg-fam-row" data-fam-pick="' + f.id + '"'
    + ' title="' + escH('Family ' + f.id + ' \u2014 ' + f.tiles + ' graphics in '
      + f.rooms + ' room' + (f.rooms === 1 ? '' : 's')
      + (f.names.length ? '\n' + f.names.join('\n') : '')) + '">'
    + '<div class="rg-fam-art"' + (have ? ' style="--mt-sheet:url(' + pv.imageUri
      + ');--mt-cell:' + pv.cell + 'px"' : '') + '>' + strip + '</div>'
    + '<div class="rg-fam-meta"><b>' + f.id + '</b> <span class="rs-note">' + f.tiles + ' tiles</span>'
    + '<div class="rg-fam-where">' + escH(where) + '</div>'
    + (rooms ? '<div class="rs-note">' + escH(rooms) + '</div>' : '')
    + '</div></div>';
}

/**
 * Filter by whatever the user typed.
 *
 * Four things people actually know about a family, in the order they are
 * likely to type them: an act, a room, an id, a size. Matching an id *or* a
 * tile count in one expression was the earlier bug — typing "58" kept every
 * family with at least 58 graphics — so the size filter has its own `>`.
 */
function filterFamilies(all, query) {
  var q = String(query || '').trim().toLowerCase();
  if (!q) return all;
  if (q.charAt(0) === '>') {
    var min = Number(q.slice(1)) || 0;
    return all.filter(function (f) { return f.tiles >= min; });
  }
  return all.filter(function (f) {
    if (String(f.id).indexOf(q) === 0) return true;
    for (var i = 0; i < f.areas.length; i++) {
      if (f.areas[i].toLowerCase().indexOf(q) >= 0) return true;
    }
    for (var j = 0; j < f.names.length; j++) {
      if (f.names[j].toLowerCase().indexOf(q) >= 0) return true;
    }
    return false;
  });
}

/** Fetch the strip sheet for the families now on screen, if it changed. */
function ensureFamilyPreviews(ids) {
  if (typeof vs === 'undefined' || !vs || !ids.length) return;
  var key = ids.join(',');
  if (_famPreviewKey === key) return;
  _famPreviewKey = key;
  vs.postMessage({ command: 'requestFamilyPreviews', families: ids });
}

function applyFamilyPreviews(msg) {
  if (!msg || msg.error || !msg.previews) return;
  _famPreviews = msg.previews;
  renderEditPanels();
}

/**
 * One family's art, drawn in that family.
 *
 * The point of showing it here rather than in the room's current palette:
 * a graphic carries no colours, so "what will this look like" is only
 * answerable once a family is chosen, and this is the answer.
 */
function familyStrip(family) {
  var s = _famSheets[family];
  if (!s) { ensureFamilySheet(family); return '<div class="rs-note">loading family ' + family + '…</div>'; }
  if (s === 'pending') return '<div class="rs-note">loading family ' + family + '…</div>';
  if (!s.count) return '<div class="rs-note">family ' + family + ' — no room draws anything in it</div>';

  // Everything the host sent. It caps at 128 graphics, and *that* is worth
  // saying because it means there is more art in the family; hiding 2 of
  // 18 behind a "showing 16" was just a shorter list for no reason.
  var limit = s.count;
  var html = '<div class="rs-note">family ' + family + ' — ' + s.total + ' graphic'
    + (s.total === 1 ? '' : 's') + ' across ' + s.roomCount + ' room' + (s.roomCount === 1 ? '' : 's')
    + (s.count < s.total ? ', the ' + s.count + ' most-used shown' : '') + '</div>'
    + '<div class="rs-mt-sheet rg-group-sheet" style="--mt-sheet:url(' + s.imageUri
    + ');--mt-cell:' + s.cell + 'px"><div class="rs-mt-grid">';
  for (var i = 0; i < limit; i++) {
    var slot = s.slots[i];
    var x = (i % s.columns) * s.cell;
    var y = Math.floor(i / s.columns) * s.cell;
    var armed = _brushTile && _brushTile.graphic === slot[2] && _brushTile.family === family;
    html += '<i class="rs-mt-cell' + (armed ? ' sel' : '') + '" data-fam-tile="' + slot[2]
      + '" data-fam-of="' + family + '"'
      + ' title="' + escH('graphic ' + slot[2] + ' in family ' + family
        + ' — ' + slot[3] + ' placements in vanilla') + '"'
      + ' style="background-position:-' + x + 'px -' + y + 'px"></i>';
  }
  return html + '</div></div>';
}

/**
 * Which layer vanilla draws this graphic on, if it is one-sided enough.
 *
 * The host sends the count with each of the room's own graphics; for a
 * graphic picked out of a family sheet it comes with the sheet. Below 60%
 * there is no preference worth overriding the user's phase with.
 */
function editLayerPreference(graphicId) {
  var stats = _famLayerHint[graphicId];
  if (!stats) return null;
  var total = stats[0] + stats[1];
  if (!total) return null;
  var share = Math.max(stats[0], stats[1]) / total;
  if (share < 0.6) return null;
  return stats[0] > stats[1] ? 'canopy' : 'terrain';
}

/** graphic id -> [canopy placements, terrain placements], from the host. */
var _famLayerHint = {};
