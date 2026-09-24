// Ownership: the editor's information panels — what the draft still needs
// and anything that would stop it encoding — plus which tab's content is
// assembled into the docked panel column.
//
// These are read-outs over state owned elsewhere: the draft is
// map-editor.js, the palette is metatile-palette.js, the families are
// map-editor-families.js, the tile browser is map-editor-tiles.js, the
// trigger tables are tables-builder.js, the Special tab's own content is
// map-editor-special.js's specialTabHtml. Nothing here writes any of them.
// Which tab is active is map-editor-tabs.js's state (_editActiveTab); this
// file only reads it to decide what renderEditPanels() builds.
//
// Owns: _panelOpen.

var _panelOpen = { families: true, tiles: true, deco: false, needed: false, errors: true, compose: false };

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
  // A family that has been freed leaves the cells drawn in it naming an
  // empty palette slot. The room would still encode; it just would not look
  // like what is on screen, which is worse than not encoding.
  var stranded = typeof editStrandedCells === 'function' ? editStrandedCells() : [];
  if (stranded.length) {
    out.push(['hard', stranded.length + ' placed cell' + (stranded.length === 1 ? '' : 's')
      + ' use a family that is no longer loaded — add it back to a slot, or replace them']);
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

/** Tile tab: families, tiles, deco, new metatiles, compose & constructs. */
function tileTabHtml(p) {
  var need = editNeededStamps(p);
  var chosen = editFamilies().filter(function (f) { return f !== undefined; });
  var picked = Object.keys(_chipSel).length;
  return panel('families', 'tile families', familyChipsHtml(), chosen.length + ' of 7')
    + panel('tiles', 'tiles', tilesPanel(p),
      picked ? picked + ' famil' + (picked === 1 ? 'y' : 'ies') + ' selected' : 'all')
    + panel('deco', 'deco', decoPanel(), _deco ? _deco.length + ' objects' : '')
    + panel('needed', 'new metatiles', neededPanel(p),
      need.added.length ? need.added.length + ' needed' : 'none')
    + panel('compose', 'compose & constructs', '<div id="rg-compose"></div>',
      (editDraft() && editDraft().constructs.length) ? editDraft().constructs.length + ' saved' : '');
}

/** Info tab: the budget bars, then the checks that would stop this draft encoding. */
function infoTabHtml(p) {
  var errs = editErrors(p);
  return budgetBar(p)
    + panel('errors', 'checks', errorsPanel(p), errs.length ? errs.length + ' to look at' : 'clear');
}

/**
 * Trigger tab: a mirror of the entity tables detail-renderer.js already
 * renders unconditionally above the map (tables-builder.js's
 * buildEntityTablesHtml), so the dock has something while editing rather
 * than nothing.
 *
 * Deliberately a duplicate, not a move: the always-visible copy outside
 * edit mode is what a room shows while just browsing, and this phase does
 * not touch it. Real select/drag-move/copy-paste interactions (Phase 4 —
 * see docs/map-editor-redesign-plan.md) replace this placeholder with the
 * dock's own authoritative rendering.
 */
function triggerTabHtml() {
  var room = _editPanelRoom;
  var c = (room && room.content) || {};
  var trigOff = c.trigOffset || null;
  var html = buildEntityTablesHtml(c, trigOff);
  return html || '<div class="rs-note">Nothing to show yet — this mirrors the tables above the map.</div>';
}

/** Redraw the panel column: the tab strip, then whichever tab is active. */
function renderEditPanels() {
  var host = document.getElementById('rg-panels');
  if (!host) return;
  var p = _mtPalette;
  var body;
  if (_editActiveTab === 'trigger') {
    body = triggerTabHtml();
  } else if (_editActiveTab === 'special') {
    body = specialTabHtml();
  } else if (!p) {
    body = '<div class="rs-note">loading the tile palette…</div>';
  } else if (_editActiveTab === 'info') {
    body = infoTabHtml(p);
  } else {
    body = tileTabHtml(p);
  }
  host.innerHTML = buildEditTabStripHtml() + '<div class="rg-tab-body" id="rg-tab-body">' + body + '</div>';
  if (_editActiveTab !== 'tile') return;
  if (p && _panelOpen.compose !== false) renderComposer();
  // The filter keeps focus across the redraw it causes, or typing a second
  // character would put the caret back at the start.
  [['rg-chip-filter', _chipFilter], ['rg-deco-filter', _decoFilter]].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el && pair[1] && el.value === pair[1] && document.activeElement !== el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });
}
