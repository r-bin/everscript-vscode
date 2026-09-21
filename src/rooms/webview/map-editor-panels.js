// Ownership: the editor's information panels — the seven family slots, the
// tile list grouped by which rooms use tiles together, the stamps the draft
// still needs, and anything that would stop it encoding.
//
// These are read-outs over state owned elsewhere: the draft is
// map-editor.js, the palette is metatile-palette.js. Nothing here writes
// either. See docs/map-format/building-a-room-from-a-picture.md §5.
//
// Owns: _famOpen, _famSheet, _panelOpen.

var _famOpen = -1;        // which family slot's sheet is showing, -1 = none
var _famSheet = null;     // the sheet the host sent for it
var _panelOpen = { families: true, tiles: true, needed: true, errors: true };

/** Ask the host for every graphic vanilla draws in this family. */
function requestFamilySheet(family, borrowFrom) {
  if (typeof vs === 'undefined' || !vs) return;
  _famSheet = null;
  vs.postMessage({ command: 'requestFamilySheet', family: family, borrowFrom: borrowFrom });
}

function applyFamilySheet(msg) {
  if (!msg || msg.error || !msg.sheet) return;
  if (_famOpen < 0) return;
  _famSheet = msg.sheet;
  renderEditPanels();
}

/** A collapsible section, so four panels fit in one sidebar. */
function panel(key, title, body, note) {
  var on = _panelOpen[key] !== false;
  return '<div class="rg-panel' + (on ? ' open' : '') + '">'
    + '<div class="rg-panel-h" data-panel="' + key + '">'
    + '<span class="rg-panel-caret">' + (on ? '▾' : '▸') + '</span> ' + title
    + (note ? ' <span class="rs-note">' + note + '</span>' : '')
    + '</div>'
    + (on ? '<div class="rg-panel-b">' + body + '</div>' : '')
    + '</div>';
}

/**
 * The seven background palette slots.
 *
 * A slot is not a number, it is a decision: the family in it is what all
 * seven graphics-worth of art in that slot will be coloured by. Clicking
 * one shows every graphic vanilla has ever drawn in it, which is what makes
 * the choice reviewable rather than a guess at a palette id.
 */
function familySlotsPanel(p) {
  var fams = p.tileFamilies || [];
  var html = '<div class="rd-filters rg-fam-slots">';
  for (var i = 0; i < 7; i++) {
    var fam = fams[i];
    var open = _famOpen === i;
    html += '<button class="rdf' + (open ? ' on' : '') + '" data-fam-slot="' + i + '"'
      + ' title="' + escH(fam === undefined
        ? 'Palette slot ' + (i + 1) + ' — this room lists no family here'
        : 'Palette slot ' + (i + 1) + ' holds family ' + fam
          + '. A tilemap word with pal ' + (i + 1) + ' is drawn in these colours.') + '">'
      + (i + 1) + ': ' + (fam === undefined ? '—' : fam) + '</button>';
  }
  html += '</div>';

  if (fams.length > 7) {
    html += '<div class="rs-note">' + fams.length + ' families listed — the loader holds '
      + 'seven at a time and swaps the rest in at runtime.</div>';
  }

  if (_famOpen >= 0) {
    var fam = fams[_famOpen];
    if (fam === undefined) {
      html += '<div class="rs-note">Slot ' + (_famOpen + 1) + ' is empty in this room.</div>';
    } else if (!_famSheet || _famSheet.family !== fam) {
      html += '<div class="rs-note">loading family ' + fam + '…</div>';
    } else {
      html += familySheetHtml(_famSheet);
    }
  }
  return html;
}

/** Everything vanilla has drawn in one family, as a sheet. */
function familySheetHtml(s) {
  if (!s.count) {
    return '<div class="rs-note">Family ' + s.family + ' — no room draws anything in it.</div>';
  }
  var html = '<div class="rs-note">family ' + s.family + ' — ' + s.total + ' graphic'
    + (s.total === 1 ? '' : 's') + ' across ' + s.roomCount + ' room' + (s.roomCount === 1 ? '' : 's')
    + (s.count < s.total ? ', showing the ' + s.count + ' most placed' : '') + '</div>'
    + '<div class="rs-mt-sheet" style="--mt-sheet:url(' + s.imageUri + ');--mt-cell:' + s.cell + 'px">'
    + '<div class="rs-mt-grid">';
  for (var i = 0; i < s.count; i++) {
    var slot = s.slots[i];
    var x = (i % s.columns) * s.cell;
    var y = Math.floor(i / s.columns) * s.cell;
    html += '<i class="rs-mt-cell" data-fam-tile="' + slot[2] + '"'
      + ' title="' + escH('graphic ' + slot[2] + ' — ' + slot[3] + ' placements in vanilla'
        + '\nnot loaded by this room; adding it costs a graphics slot') + '"'
      + ' style="background-position:-' + x + 'px -' + y + 'px"></i>';
  }
  return html + '</div></div>';
}

/**
 * The room's own graphics, grouped by the rooms that draw them together.
 *
 * A flat sheet of 92 tiles hides its own structure. Graphics that appear in
 * exactly the same rooms were put there for the same scene, so grouping by
 * that signature separates the walls from the floor from the one-offs
 * without anyone having labelled anything.
 */
function tileGroupsPanel(p) {
  var groups = p.graphicGroups || [];
  var t = p.tiles;
  if (!t || !groups.length) return '<div class="rs-note">no grouping available</div>';
  // The sheet URL is set once on the wrapper and inherited. Repeating it per
  // group put a 13 KB data URI in every `style` attribute — eleven groups
  // came to 150 KB of markup for one image.
  var html = '<div class="rg-groups" style="--mt-sheet:url(' + t.imageUri
    + ');--mt-cell:' + t.cell + 'px">';
  for (var g = 0; g < groups.length; g++) {
    var grp = groups[g];
    var label = grp.rooms.length
      ? grp.slots.length + ' tiles · ' + (grp.rooms.length === 1
        ? 'only room 0x' + grp.rooms[0].toString(16)
        : 'shared by ' + grp.rooms.length + ' rooms')
      : grp.slots.length + ' tiles · not attested anywhere';
    html += '<div class="rg-tile-group"><div class="rs-note">' + label + '</div>'
      + '<div class="rs-mt-sheet rg-group-sheet"><div class="rs-mt-grid">';
    for (var i = 0; i < grp.slots.length; i++) {
      var slot = grp.slots[i];
      var x = (slot % t.columns) * t.cell;
      var y = Math.floor(slot / t.columns) * t.cell;
      var s = t.slots[slot];
      html += '<i class="rs-mt-cell' + (s && s[3] ? ' anim' : '') + (slot === _mtSlot ? ' sel' : '')
        + '" data-mt-slot="' + slot + '"'
        + ' title="' + escH('graphic #' + slot + (s ? ' — tile id $' + hex4(s[2]) : '')) + '"'
        + ' style="background-position:-' + x + 'px -' + y + 'px"></i>';
    }
    html += '</div></div></div>';
  }
  return html + '</div>';
}

/**
 * What the draft would add to Block 3.
 *
 * Every stamp here is one the room does not already have, so the count is
 * the real cost of the edit — and it is why placing the same construct
 * twice is free.
 */
function neededPanel(p) {
  var need = editNeededStamps(p);
  if (!need.added.length) {
    return '<div class="rs-note">Nothing new yet. Painting with the room’s own stamps '
      + 'costs no dictionary space at all.</div>';
  }
  var html = '<div class="rs-note">' + need.added.length + ' new stamp'
    + (need.added.length === 1 ? '' : 's') + ', ' + need.bytes + ' bytes of the '
    + 'grid-plus-dictionary window</div><div class="rg-need-list">';
  for (var i = 0; i < need.added.length; i++) {
    var a = need.added[i];
    html += '<div class="rg-need"><b>#' + a.index + '</b> '
      + 'canopy $' + hex4(a.layer1) + ' · terrain $' + hex4(a.layer2)
      + ' · collision $' + hex4(a.collision) + '</div>';
  }
  return html + '</div>';
}

/**
 * Anything that would stop this draft encoding.
 *
 * Budget overflows first, because they are the ones the format cannot
 * forgive, then the structural rules an encoder checks.
 */
function editErrors(p) {
  var out = [];
  var b = p && p.budget;
  if (b) {
    if (b.families.used > b.families.max) {
      out.push(['hard', 'families ' + b.families.used + '/' + b.families.max
        + ' — the loader clamps to seven, so the extra ones never load']);
    }
    var need = editNeededStamps(p);
    if (b.graphics.used > b.graphics.max) {
      out.push(['hard', 'graphics ' + b.graphics.used + '/' + b.graphics.max
        + ' — past what a tilemap word can name']);
    }
    if (b.wram.used + need.bytes > b.wram.max) {
      out.push(['hard', 'grid plus dictionary is ' + (b.wram.used + need.bytes)
        + ' bytes, past the ' + b.wram.max + '-byte window']);
    } else if (b.wram.used + need.bytes > b.wram.vanilla) {
      out.push(['warn', 'past ' + b.wram.vanilla + ' bytes, which is more than any vanilla room uses']);
    }
  }
  var d = editDraft();
  if (d && d.brush < 0 && d.tool !== 'erase' && d.tool !== 'pick') {
    out.push(['warn', 'no brush selected — pick a stamp or a tile before painting']);
  }
  if (d && d.blank && d.blank.problems) {
    d.blank.problems.forEach(function (msg) { out.push(['hard', msg]); });
  }
  return out;
}

function errorsPanel(p) {
  var errs = editErrors(p);
  if (!errs.length) return '<div class="rg-ok">Nothing blocking. This draft would encode.</div>';
  var html = '';
  for (var i = 0; i < errs.length; i++) {
    html += '<div class="rg-err rg-err-' + errs[i][0] + '">' + escH(errs[i][1]) + '</div>';
  }
  return html;
}

/** Redraw the panel column. */
function renderEditPanels() {
  var host = document.getElementById('rg-panels');
  if (!host) return;
  var p = _mtPalette;
  if (!p) { host.innerHTML = '<div class="rs-note">loading the tile palette…</div>'; return; }
  var errs = editErrors(p);
  var need = editNeededStamps(p);
  host.innerHTML = budgetBar(p)
    + panel('errors', 'checks', errorsPanel(p), errs.length ? errs.length + ' to look at' : 'clear')
    + panel('families', 'tile families', familySlotsPanel(p),
      (p.tileFamilies || []).length + ' listed')
    + panel('tiles', 'tiles by group', tileGroupsPanel(p),
      (p.graphicGroups || []).length + ' groups')
    + panel('needed', 'new metatiles', neededPanel(p),
      need.added.length ? need.added.length + ' needed' : 'none');
}
