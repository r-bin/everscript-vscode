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
/** Which slot the browser is filling, or -1 when it is closed. */
var _famPicking = -1;

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
  renderEditPanels();
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
  else if (_famOpen >= 0 && fams[_famOpen] !== undefined) html += familyStrip(fams[_famOpen], true);
  return html;
}

/** The whole catalogue, filtered, so a slot can take any family in the ROM. */
function familyBrowserHtml() {
  if (!_famCatalogue) { requestFamilyCatalogue(); return '<div class="rs-note">loading the catalogue…</div>'; }
  var q = _famFilter.trim();
  var list = _famCatalogue;
  if (q) {
    // Two filters, kept apart on purpose. Matching an id *or* a tile count
    // in one expression means typing "58" also keeps every family with at
    // least 58 graphics — which is most of the big ones, so the id filter
    // never narrowed anything.
    if (q.charAt(0) === '>') {
      var min = Number(q.slice(1)) || 0;
      list = list.filter(function (f) { return f[1] >= min; });
    } else {
      list = list.filter(function (f) { return String(f[0]).indexOf(q) === 0; });
    }
  }
  var shown = list.slice(0, 60);
  var html = '<div class="rg-fam-browse"><div class="rs-note">'
    + 'Filling slot ' + (_famPicking + 1) + ' — ' + _famCatalogue.length + ' families, '
    + 'biggest first. Type an id to jump to it, or &gt;100 for the big ones.'
    + '</div>'
    + '<input class="rg-fam-filter" id="rg-fam-filter" value="' + escH(_famFilter)
    + '" placeholder="family id, or &gt;100 for at least 100 tiles" />'
    + '<div class="rd-filters rg-fam-list">';
  for (var i = 0; i < shown.length; i++) {
    var f = shown[i];
    html += '<button class="rdf" data-fam-pick="' + f[0] + '"'
      + ' title="' + escH('Family ' + f[0] + ' — ' + f[1] + ' graphics across '
        + f[2] + ' room' + (f[2] === 1 ? '' : 's')) + '">'
      + f[0] + ' <span class="rs-note">' + f[1] + '</span></button>';
  }
  html += '</div>';
  if (list.length > shown.length) {
    html += '<div class="rs-note">' + (list.length - shown.length) + ' more — narrow the filter</div>';
  }
  html += '<div class="rd-filters"><button class="rdf" data-fam-pick="none">cancel</button>'
    + '<button class="rdf" data-fam-pick="clear">leave the slot empty</button></div></div>';
  return html;
}

/**
 * One family's art, drawn in that family.
 *
 * The point of showing it here rather than in the room's current palette:
 * a graphic carries no colours, so "what will this look like" is only
 * answerable once a family is chosen, and this is the answer.
 */
function familyStrip(family, expanded) {
  var s = _famSheets[family];
  if (!s) { ensureFamilySheet(family); return '<div class="rs-note">loading family ' + family + '…</div>'; }
  if (s === 'pending') return '<div class="rs-note">loading family ' + family + '…</div>';
  if (!s.count) return '<div class="rs-note">family ' + family + ' — no room draws anything in it</div>';

  var limit = expanded ? s.count : Math.min(s.count, 16);
  var html = '<div class="rs-note">family ' + family + ' — ' + s.total + ' graphic'
    + (s.total === 1 ? '' : 's') + ' across ' + s.roomCount + ' room' + (s.roomCount === 1 ? '' : 's')
    + (limit < s.count ? ', showing ' + limit : '') + '</div>'
    + '<div class="rs-mt-sheet rg-group-sheet" style="--mt-sheet:url(' + s.imageUri
    + ');--mt-cell:' + s.cell + 'px"><div class="rs-mt-grid">';
  for (var i = 0; i < limit; i++) {
    var slot = s.slots[i];
    var x = (i % s.columns) * s.cell;
    var y = Math.floor(i / s.columns) * s.cell;
    html += '<i class="rs-mt-cell" data-fam-tile="' + slot[2] + '" data-fam-of="' + family + '"'
      + ' title="' + escH('graphic ' + slot[2] + ' in family ' + family
        + ' — ' + slot[3] + ' placements in vanilla') + '"'
      + ' style="background-position:-' + x + 'px -' + y + 'px"></i>';
  }
  return html + '</div></div>';
}
