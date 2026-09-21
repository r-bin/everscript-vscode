// Ownership: the editor's information panels — the tile list, the stamps the
// draft still needs, and anything that would stop it encoding.
//
// These are read-outs over state owned elsewhere: the draft is
// map-editor.js, the palette is metatile-palette.js, the family choice is
// map-editor-families.js. Nothing here writes any of them.
//
// Owns: _famOpen, _panelOpen, _tileSource.

/** Which family slot's art is expanded under the slots, -1 for none. */
var _famOpen = -1;
var _panelOpen = { families: true, tiles: true, needed: true, errors: true };
/**
 * Where the tile list draws from.
 *
 * `families` is the default because it answers the question the flow asks:
 * given the seven I have chosen, what can I draw? `room` is the 92 this
 * room actually loaded, and `groups` keeps the co-occurrence view.
 */
var _tileSource = 'families';

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
 * The tile list, from whichever source is selected.
 *
 * `families` is the one that matters: it draws each chosen family's art
 * **in that family**, which is the only way to see what a graphic will
 * actually look like. A graphic carries no colours of its own, so a tile
 * shown in the wrong palette is a different picture.
 */
function tilesPanel(p) {
  var html = '<div class="rd-filters">';
  [['families', 'my families', 'The art of the seven families chosen above, each in its own colours'],
   ['room', 'this room', 'The 92 graphics Block 1 actually loaded'],
   ['groups', 'by usage', 'This room’s graphics grouped by which rooms draw them together']]
    .forEach(function (s) {
      html += '<button class="rdf' + (_tileSource === s[0] ? ' on' : '') + '" data-tile-source="' + s[0]
        + '" title="' + escH(s[2]) + '">' + s[1] + '</button>';
    });
  html += '</div>';

  if (_tileSource === 'groups') return html + tileGroupsPanel(p);
  if (_tileSource === 'room') return html + roomTilesHtml(p);

  var fams = editFamilies().filter(function (f) { return f !== undefined; });
  if (!fams.length) return html + '<div class="rs-note">No families chosen yet — add one above.</div>';
  html += '<div class="rs-note">Clicking a tile here adopts its family if you do not have it.</div>';
  for (var i = 0; i < fams.length; i++) html += familyStrip(fams[i], false);
  return html;
}

/** The room's own loaded graphics, flat, in the palette the tab is showing. */
function roomTilesHtml(p) {
  var t = p.tiles;
  if (!t) return '<div class="rs-note">no tile sheet</div>';
  var html = '<div class="rs-mt-sheet rg-group-sheet" style="--mt-sheet:url(' + t.imageUri
    + ');--mt-cell:' + t.cell + 'px"><div class="rs-mt-grid">';
  for (var i = 0; i < t.count; i++) {
    var s = t.slots[i];
    var x = (i % t.columns) * t.cell;
    var y = Math.floor(i / t.columns) * t.cell;
    html += '<i class="rs-mt-cell' + (s[3] ? ' anim' : '') + (i === _mtSlot ? ' sel' : '')
      + '" data-mt-slot="' + i + '"'
      + ' title="' + escH('graphic #' + i + ' — tile id $' + hex4(s[2])) + '"'
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
  var chosen = editFamilies().filter(function (f) { return f !== undefined; });
  host.innerHTML = budgetBar(p)
    + panel('errors', 'checks', errorsPanel(p), errs.length ? errs.length + ' to look at' : 'clear')
    + panel('families', 'tile families', familySlotsPanel(), chosen.length + ' of 7')
    + panel('tiles', 'tiles', tilesPanel(p), _tileSource === 'groups'
      ? (p.graphicGroups || []).length + ' groups'
      : _tileSource === 'room' ? (p.tiles ? p.tiles.count : 0) + ' loaded'
        : chosen.length + ' families')
    + panel('needed', 'new metatiles', neededPanel(p),
      need.added.length ? need.added.length + ' needed' : 'none');
  // The filter keeps focus across the redraw it causes, or typing a second
  // character would put the caret back at the start.
  var filter = document.getElementById('rg-fam-filter');
  if (filter && _famPicking >= 0) {
    filter.focus();
    filter.setSelectionRange(filter.value.length, filter.value.length);
  }
}
