// Ownership: the editor's information panels — what the draft still needs
// and anything that would stop it encoding — plus which tab's content is
// assembled into the docked panel column.
//
// These are read-outs over state owned elsewhere: the draft is
// map-editor.js, the palette is metatile-palette.js, the families are
// map-editor-families.js, the tile browser is map-editor-tiles.js, the
// trigger tables are tables-builder.js, the Special tab's own content is
// map-editor-special.js's specialTabHtml, the Widgets tab's own content is
// map-editor-deco.js's widgetsTabHtml. Nothing here writes any of them.
// Which tab is active is map-editor-tabs.js's state (_editActiveTab); this
// file only reads it to decide what renderEditPanels() builds.
//
// Owns: _panelOpen.

var _panelOpen = {
  families: true, neighbours: true, errors: true,
};

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
      + ' use a family that is no longer loaded — the Tile tab’s banner can put it '
      + 'back or clear them']);
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

/**
 * Tile tab, top to bottom: anything broken, the palette's seven families,
 * the two brush modifiers, what goes next to what, then the tiles.
 *
 * Phase 8a (docs/map-editor-redesign-plan.md §8a) unwrapped the tile groups
 * from their own `panel()`: the per-family headers are the structure, and a
 * collapsible box titled "tiles" around the tab's whole reason for existing
 * was chrome with nothing to say. `_panelOpen.tiles` is gone with it. The
 * families section draws its own header (it has two states, and `panel()`
 * renders nothing at all when shut), so it keeps `data-panel="families"`
 * without using `panel()`.
 *
 * §8a.2 dropped the "new metatiles" read-out and the "compose & constructs"
 * panel: a composed stamp is calculated dynamically the moment a paint
 * stroke needs one (`editAddStamp`'s find-or-create in editResolve), so a
 * manual list of them and a by-hand composer were surfacing internals the
 * user never asked to see. `editSaveConstruct`/`editConstructWrites` and the
 * stamp tool that places a saved construct are untouched — only this tab's
 * explicit browse/compose UI is gone.
 */
function tileTabHtml(p) {
  ensureRelated();
  return strandedBannersHtml()
    + familiesSectionHtml()
    + tileFilterRowHtml()
    + neighbourCardHtml()
    + tilesPanel();
}

/** Info tab: the budget bars, the trigger counts, then the encoding checks. */
function infoTabHtml(p) {
  var errs = editErrors(p);
  return budgetBar(p) + triggerCapacityHtml()
    + panel('errors', 'checks', errorsPanel(p), errs.length ? errs.length + ' to look at' : 'clear');
}

/**
 * Trigger tab: the dock's own authoritative trigger list — select, move,
 * delete, copy/paste (map-editor-trigger-select.js, map-editor-gestures.js),
 * rendered by map-editor-trigger-panel.js's triggerTabPanelHtml.
 *
 * Phase 4 (docs/map-editor-redesign-plan.md) replaced this tab's earlier
 * placeholder, which only mirrored the read-only entity tables
 * detail-renderer.js renders unconditionally above the map
 * (tables-builder.js's buildEntityTablesHtml) — that copy is still there for
 * browsing outside edit mode; this tab no longer duplicates it.
 */
function triggerTabHtml() {
  return triggerTabPanelHtml();
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
  } else if (_editActiveTab === 'widgets') {
    body = widgetsTabHtml();
  } else if (!p) {
    body = '<div class="rs-note">loading the tile palette…</div>';
  } else if (_editActiveTab === 'info') {
    body = infoTabHtml(p);
  } else {
    body = tileTabHtml(p);
  }
  host.innerHTML = buildEditTabStripHtml() + '<div class="rg-tab-body" id="rg-tab-body">' + body + '</div>';
  // §8a.2 removed the Tile tab's "compose & constructs" panel and the
  // `#rg-compose` host it rendered into, so there is nothing left to
  // refresh here — renderComposer() (map-editor-input.js) is only reached
  // now from the composer's own actions (map-editor-actions.js), which have
  // no button left to trigger them either; see the plan doc §8a.2 item 1.
  if (_editActiveTab !== 'tile' && _editActiveTab !== 'widgets') return;
  // The filter keeps focus across the redraw it causes, or typing a second
  // character would put the caret back at the start. Only the Widgets search
  // is left since §8a.2 removed the Tile tab's family filter; it is simply
  // not found when that tab is not on screen, and the pair is skipped.
  [['rg-deco-filter', _decoFilter]].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el && pair[1] && el.value === pair[1] && document.activeElement !== el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });
}
