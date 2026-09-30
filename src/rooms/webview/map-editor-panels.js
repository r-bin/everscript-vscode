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
// Owns: _panelOpen, _tileAnchorFam.

/**
 * Which collapsible sections are open. TILE FAMILIES and LIKELY NEIGHBORS
 * start **closed** (§8e): the tile list is what the Tile tab is for, and the
 * two cards above it are refinements you open when you want them. Remembered
 * by the host (`uiPrefs`, key `panelOpen`) once you change them.
 */
var _panelOpen = {
  families: false, neighbours: false, errors: true,
};
var PANEL_OPEN_PREF = 'panelOpen';

/** The host's remembered UI state arrived (bootstrap.js, `uiPrefs`). */
function applyUiPrefs(prefs) {
  if (prefs && (prefs.collisionMode === 'tiles' || prefs.collisionMode === 'outline')
    && typeof _collisionMode !== 'undefined') _collisionMode = prefs.collisionMode;
  if (prefs && typeof prefs.widgetsVanilla === 'boolean' && typeof _widgetsVanilla !== 'undefined') {
    _widgetsVanilla = prefs.widgetsVanilla;
  }
  var saved = prefs && prefs[PANEL_OPEN_PREF];
  if (saved && typeof saved === 'object') {
    Object.keys(saved).forEach(function (k) { _panelOpen[k] = !!saved[k]; });
  }
  if (editActive()) renderEditPanels();
}

/** Open or close a section, and remember it. */
function panelToggle(key) {
  _panelOpen[key] = _panelOpen[key] === false;
  if (typeof vs !== 'undefined' && vs) {
    vs.postMessage({ command: 'saveUiPref', key: PANEL_OPEN_PREF, value: _panelOpen });
  }
  renderEditPanels();
}

/**
 * The family whose group a click just landed in, so the redraw that click
 * causes keeps *that* group where it was on screen. Set by the tile click
 * handler, consumed (and cleared) by renderEditPanels.
 */
var _tileAnchorFam = null;

/**
 * Where the list is scrolled, as "this group, this far from the top" — not
 * a raw scrollTop, which is wrong the moment a group above changes size or
 * moves (a family adopted into a slot jumps to the top of the list).
 */
function panelScrollAnchor(body) {
  if (!body) return null;
  var top = body.getBoundingClientRect().top;
  var el = _tileAnchorFam !== null
    ? body.querySelector('[data-group-fam="' + _tileAnchorFam + '"]') : null;
  if (!el) {
    var groups = body.querySelectorAll('[data-group-fam]');
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].getBoundingClientRect().bottom > top) { el = groups[i]; break; }
    }
  }
  return { scrollTop: body.scrollTop, fam: el ? el.dataset.groupFam : null,
    offset: el ? el.getBoundingClientRect().top - top : 0 };
}

function panelRestoreScroll(body, anchor) {
  if (!body || !anchor) return;
  body.scrollTop = anchor.scrollTop;
  var el = anchor.fam !== null ? body.querySelector('[data-group-fam="' + anchor.fam + '"]') : null;
  if (el) body.scrollTop += (el.getBoundingClientRect().top - body.getBoundingClientRect().top) - anchor.offset;
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
  // Not a check: "no brush selected" was listed here, but it says nothing
  // about whether the draft encodes, and the pencil's badge already says it.
  var d = editDraft();
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
  // The head stays put; only the tile list scrolls (`#rg-tile-scroll`).
  return '<div class="rg-tile-head">' + strandedBannersHtml()
    + familiesSectionHtml()
    + tileFilterRowHtml()
    + neighbourCardHtml() + '</div>'
    + '<div class="rg-tile-scroll" id="rg-tile-scroll">' + tilesPanel() + '</div>';
}

/** The box that scrolls on this tab: the tile list on the Tile tab, else the whole body. */
function panelScroller(body) {
  if (!body) return null;
  return body.querySelector('#rg-tile-scroll') || body;
}

/**
 * Info tab, as the design mock lays it out: CAPACITY — a label, `used/max ·
 * pct%` in mono and a thin bar per ceiling — then CHECKS, a dot and a line
 * each.
 *
 * Only real ceilings get a bar: seven families (the loader clamps), 264
 * graphics (what a tilemap word can name) and the 32 KB WRAM window. The
 * mock's "Meta tiles /128" and "triggers /16" are its placeholders — no such
 * limit is attested (the stamp dictionary has no field limit, trigger tables
 * are byte-length prefixed) — so those are counts with no bar, not invented
 * denominators. Families are the draft's own, so this agrees with the Tile tab.
 */
function infoTabHtml(p) {
  var d = editDraft();
  var b = p.budget || {};
  var fams = editFamilies().filter(function (f) { return f !== undefined; }).length;
  var added = d ? d.added.length : 0;
  var graphics = b.graphics ? b.graphics.used + (d ? d.addedGraphics.length : 0) : null;
  var wram = b.wram ? b.wram.used + editNeededStamps(p).bytes : null;
  var html = '<div class="rg-info-sec"><div class="rg-info-h">Capacity</div>'
    + infoCapRow('Tile families', fams, 7, 'A palette slot per family; the loader clamps to seven')
    + (graphics == null ? '' : infoCapRow('Graphics', graphics, b.graphics.max,
      'Block 1 slots — what a tilemap word can name. Vanilla’s highest is ' + b.graphics.vanilla))
    + (wram == null ? '' : infoCapRow('WRAM', wram, b.wram.max,
      'The grid plus the stamp dictionary share one 32 KB window. Vanilla’s fullest room uses ' + b.wram.vanilla))
    + infoCountRow('Stamps', (b.stamps ? b.stamps.used : 0) + added, 'no field limit',
      'Distinct {front, ground, collision} combinations — 8 bytes each, counted in WRAM above')
    + infoCountRow('Room size', p.widthTiles + '×' + p.heightTiles, 'metatiles', 'Counted in WRAM above: two bytes a cell')
    + infoCountRow('Step-on triggers', editTriggerList('step').length, 'no confirmed limit',
      'The table is byte-length prefixed; no count ceiling is attested')
    + infoCountRow('B-triggers', editTriggerList('b').length, 'no confirmed limit',
      'The table is byte-length prefixed; no count ceiling is attested')
    + (b.attested != null ? '<div class="rg-info-foot" title="Graphics other rooms draw in this room’s families">'
      + b.attested + ' graphics attested in these families</div>' : '')
    + '</div>';
  var errs = editErrors(p);
  html += '<div class="rg-info-sec"><div class="rg-info-h">Checks</div>';
  if (!errs.length) html += infoCheckRow('ok', 'Nothing blocking — this draft would encode');
  errs.forEach(function (e) { html += infoCheckRow(e[0] === 'hard' ? 'error' : 'warning', e[1]); });
  return html + '</div>';
}

/** A ceiling: label, `used/max · pct%`, and a bar that warns when full and errs when over. */
function infoCapRow(label, used, max, title) {
  var pct = max ? used / max * 100 : 0;
  var state = used > max ? ' over' : used >= max ? ' full' : '';
  return '<div class="rg-cap" title="' + escH(title) + '"><div class="rg-cap-h"><span class="rg-cap-l">' + escH(label)
    + '</span><span class="rg-cap-v">' + used + '/' + max + ' · ' + Math.round(pct) + '%</span></div>'
    + '<div class="rg-cap-track"><i class="rg-cap-fill' + state + '" style="width:' + Math.min(100, pct).toFixed(1)
    + '%"></i></div></div>';
}

/** A count with no attested ceiling: no bar, and says so. */
function infoCountRow(label, value, note, title) {
  return '<div class="rg-cap" title="' + escH(title) + '"><div class="rg-cap-h"><span class="rg-cap-l">' + escH(label)
    + '</span><span class="rg-cap-v">' + escH(String(value)) + ' <span class="rg-cap-n">' + escH(note) + '</span></span></div></div>';
}

function infoCheckRow(status, text) {
  return '<div class="rg-check"><i class="rg-check-dot rg-check-' + status + '"></i><span>' + escH(text) + '</span></div>';
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
  } else if (_editActiveTab === 'object') {
    body = objectTabHtml();
  } else if (_editActiveTab === 'widgets') {
    body = widgetsTabHtml();
  } else if (!p) {
    body = '<div class="rs-note">loading the tile palette…</div>';
  } else if (_editActiveTab === 'info') {
    body = infoTabHtml(p);
  } else {
    body = tileTabHtml(p);
  }
  // The scroll box is rebuilt below, so its position is carried across —
  // without this every click, and every lazily arriving sheet, threw the
  // list back to the top ("show more jumps to the top", tiles "jumping").
  var oldBody = document.getElementById('rg-tab-body');
  var anchor = oldBody && oldBody.dataset.tab === _editActiveTab ? panelScrollAnchor(panelScroller(oldBody)) : null;
  _tileAnchorFam = null;
  // The widget's name keeps its caret across the redraws its own saves cause.
  var named = document.activeElement && document.activeElement.id === 'rg-widget-name'
    ? document.activeElement.selectionStart : -1;
  host.innerHTML = (typeof widgetEditBannerHtml === 'function' ? widgetEditBannerHtml() : '')
    + buildEditTabStripHtml() + '<div class="rg-tab-body" id="rg-tab-body" data-tab="'
    + _editActiveTab + '">' + body + '</div>';
  var nameEl = named >= 0 && document.getElementById('rg-widget-name');
  if (nameEl) { nameEl.focus(); nameEl.setSelectionRange(named, named); }
  var newBody = document.getElementById('rg-tab-body');
  panelRestoreScroll(panelScroller(newBody), anchor);
  if (_editActiveTab === 'tile') tileLazyObserve();
  if (_editActiveTab === 'widgets' && typeof decoLazyObserve === 'function') decoLazyObserve();
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
