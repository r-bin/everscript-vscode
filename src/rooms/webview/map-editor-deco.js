// Ownership: the deco library — vanilla's own objects, as things to stamp —
// and its section of the Widgets tab (decoLibraryHtml, under the user's own
// widgets: map-editor-widgets.js's widgetsTabHtml).
//
// Section 3 objects are the game's deco widgets: room 0x51 is 25 gourds and
// pots, room 0x25's 4x3 objects are fire pits. 655 distinct ones, so this
// is a picker, not a list.
//
// **The ROM stores no names.** An object is a rectangle of metatiles and an
// id; nothing in it says "gourd". So an entry is found by its picture, its
// size and the room it comes from, and nothing here invents a label.
//
// The Widgets tab (docs/map-editor-redesign-plan.md Phase 5) is this file's
// content filed under its own tab (map-editor-tabs.js decides which tab is
// showing; map-editor-panels.js's renderEditPanels() calls widgetsTabHtml()
// when it is Widgets) rather than a new subsystem — the picker, its filters
// and the arm-and-stamp flow (applyDecoCells) already existed before this
// phase and are unchanged; only where they render moved.
//
// The list scrolls, it is not paged: every card is drawn at its final size
// and its thumbnail is asked for as it nears the view (decoLazyObserve), a
// chunk at a time. The vanilla entries are generated — cut automatically
// out of vanilla rooms, so whether one is any good is luck — and are shown
// only while the Widgets tab's `vanilla` toggle is on; the user's own
// widgets are map-editor-widgets.js.
//
// Owns: _deco, _decoFilter, _decoArt, _decoPick, _decoSaveWanted.

var _deco = null;          // the catalogue, once fetched
var _decoFilter = '';
/** id -> `{uri, x, y}`: each thumbnail's place in the sheet it arrived in. */
var _decoArt = {};
/** ids asked for and not arrived yet. */
var _decoAsked = {};
var _decoPick = -1;        // the entry whose cells are being fetched
/** The entry whose cells are being fetched to be saved as the user's own widget, or -1. */
var _decoSaveWanted = -1;
/** Which of the four questions below are being asked of the library. */
var _decoFlags = { fits: false, works: false, front: false, open: false };
/** Thumbnails per request — the host renders at most 48 to a sheet. */
var DECO_CHUNK = 24;
var _decoObserver = null;
var _decoLazyTimer = null;
var _decoLazyWant = [];

function requestDeco() {
  if (_deco || typeof vs === 'undefined' || !vs) return;
  vs.postMessage({ command: 'requestDeco' });
}

function applyDecoLibrary(msg) {
  if (!msg || msg.error || !msg.deco) return;
  _deco = msg.deco;
  renderEditPanels();
}

/** A sheet of thumbnails arrived: remember where each one is, and draw them in place. */
function applyDecoPreviews(msg) {
  var pv = msg && msg.previews;
  if (!pv || !pv.ids) return;
  var art = msg.mine ? (typeof _widgetArt !== 'undefined' ? _widgetArt : null) : _decoArt;
  if (!art) return;
  pv.ids.forEach(function (id, i) {
    delete _decoAsked[(msg.mine ? 'w:' : '') + id];
    art[id] = { uri: pv.imageUri, x: (i % pv.columns) * pv.cell, y: Math.floor(i / pv.columns) * pv.cell };
  });
  // In place: rebuilding the tab for every chunk would jump the scroll.
  var body = document.getElementById('rg-tab-body');
  if (!body || _editActiveTab !== 'widgets') return;
  pv.ids.forEach(function (id) {
    var sel = msg.mine ? '[data-widget-art="' + id + '"]' : '.rg-deco[data-deco="' + id + '"] .rg-deco-art';
    var els = body.querySelectorAll(sel);
    for (var k = 0; k < els.length; k++) {
      var fn = (els[k].classList.contains('rg-widget-var-thumb') && typeof widgetArtStyle === 'function')
        ? widgetArtStyle : decoArtStyle;
      els[k].setAttribute('style', fn(art[id], Number(els[k].dataset.w), Number(els[k].dataset.h), 30));
    }
  });
}

function decoArtStyle(a) {
  return a ? 'background-image:url(' + a.uri + ');background-position:-' + a.x + 'px -' + a.y + 'px' : '';
}

/**
 * The host sent an entry: turn it into a construct and arm it.
 *
 * Reusing the construct machinery rather than inventing a second placement
 * path — a deco entry and a saved selection are the same thing, a
 * rectangle of portable cells to drop on the map. The object record and the
 * B-trigger ride along as attachments, so the gourd that gets stamped is
 * the working gourd and not a picture of one.
 */
function applyDecoCells(msg) {
  var d = editDraft();
  if (!d || !msg || !msg.entry) return;
  var entry = msg.entry;
  var name = entry.w + '×' + entry.h + ' from ' + (entry.roomName || ('room 0x' + entry.room.toString(16)));
  // ☆ on a card: it becomes one of the user's own widgets, not a stamp.
  if (_decoSaveWanted === entry.id && typeof widgetSaveFromDeco === 'function') {
    _decoSaveWanted = -1;
    widgetSaveFromDeco(entry, name);
    return;
  }

  d.constructs.push({
    name: name,
    w: entry.w,
    h: entry.h,
    cells: entry.cells,
    attachments: {
      bTrigger: entry.trigger ? [entry.trigger] : [],
      stepOn: [],
      objects: [{ dx: 0, dy: 0, w: entry.w, h: entry.h, states: entry.states, cells: entry.stateCells || [] }],
    },
  });
  _editConstruct = d.constructs.length - 1;
  // The pencil, which on the Widgets tab stamps it — not the Stamp tool,
  // which would keep stamping on every other tab too.
  d.tool = 'paint';

  // What it will cost is knowable before the click, and a refusal after
  // seven families are already spent is a worse place to learn it.
  var fams = editFamilies();
  var need = (entry.families || []).filter(function (f) { return fams.indexOf(f) < 0; });
  var free = 0;
  for (var i = 0; i < 7; i++) if (fams[i] === undefined) free += 1;

  editNote('armed ' + name + ' — ' + entry.cells.length + ' cell'
    + (entry.cells.length === 1 ? '' : 's')
    + (entry.trigger ? ', B-trigger on script 0x' + entry.trigger.scriptId.toString(16) : ', no trigger')
    + (need.length
      ? ' — needs ' + need.length + ' new famil' + (need.length === 1 ? 'y' : 'ies')
        + (need.length > free ? ' but only ' + free + ' slot(s) are free; clear one first' : '')
      : '')
    + '. Click the map to place it.');
  requestComposedPreview();
  renderEditChrome();
}

/** Ask for the entry's cells; `applyDecoCells` finishes the job. */
function decoUse(id) {
  if (typeof vs === 'undefined' || !vs) return;
  _decoPick = id;
  vs.postMessage({ command: 'requestDeco', cells: id });
}

/** Families this entry would have to bring in, given the seven you have. */
function decoNewFamilies(d) {
  var fams = editFamilies();
  return (d.families || []).filter(function (f) { return fams.indexOf(f) < 0; });
}

/**
 * The four questions worth asking of 532 nameless objects.
 *
 * Together they are "a working, foreground gourd out of my own families",
 * which is a set of 27 in room 0x34 — findable, where 532 is not.
 */
var DECO_FLAGS = {
  // 93 of the 532 cost room 0x34 nothing: its families already draw them.
  fits: [function (d) { return decoNewFamilies(d).length === 0; },
    'only what your seven families already draw'],
  // The 68 that come with a B-trigger script — the ones that *do* something.
  works: [function (d) { return d.scriptId !== null; },
    'only the ones that come with a script'],
  // 352 draw on the canopy alone: pure foreground over whatever it lands on.
  front: [function (d) { return d.front; },
    'only the ones that are foreground alone, over any floor'],
  open: [function (d) { return d.states > 1; },
    'only the ones with more than one state'],
};

function filterDeco(all, query, flags) {
  var on = flags || _decoFlags;
  var out = all;
  Object.keys(DECO_FLAGS).forEach(function (k) {
    if (on[k]) out = out.filter(DECO_FLAGS[k][0]);
  });
  // Words are ANDed, so "fire eyes" and "ivor 3x4" both narrow the way you
  // would expect rather than the first word winning.
  var terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  terms.forEach(function (term) {
    out = out.filter(function (d) { return decoMatches(d, term); });
  });
  return out;
}

function decoMatches(d, term) {
  if (DECO_FLAGS[term]) return DECO_FLAGS[term][0](d);
  if (term === 'states') return d.states > 1;
  if (term === 'trigger') return d.scriptId !== null;
  var size = term.match(/^(\d+)x(\d+)$/);
  if (size) return d.w === Number(size[1]) && d.h === Number(size[2]);
  return d.area.toLowerCase().indexOf(term) >= 0 || d.roomName.toLowerCase().indexOf(term) >= 0;
}

/** The four questions as buttons, because nobody should have to type them. */
function decoFlagsHtml() {
  var html = '<div class="rd-filters rg-deco-flags">';
  Object.keys(DECO_FLAGS).forEach(function (k) {
    html += '<button class="rdf' + (_decoFlags[k] ? ' on' : '') + '" data-deco-flag="' + k
      + '" title="' + escH(DECO_FLAGS[k][1]) + '">' + k + '</button>';
  });
  return html + '</div>';
}

/**
 * A second, plainer-worded control over the same `works` flag the "works"
 * chip above already owns — not a second piece of state. The mock's own
 * spec never defines "ready" precisely; `d.scriptId !== null` ("comes with
 * a script that does something on placement") is the closest existing
 * semantic, so this reads and writes `_decoFlags.works` through the exact
 * same `data-deco-flag="works"` click key (map-editor-input.js's
 * EDIT_CLICK_KEYS), rather than inventing a `_decoReady` boolean that could
 * drift out of sync with the chip.
 */
function decoReadyToggleHtml() {
  return '<button class="rdf rg-deco-ready' + (_decoFlags.works ? ' on' : '') + '" data-deco-flag="works" '
    + 'title="Only vanilla objects that come with a B-trigger script — the ones that do something '
    + 'the moment they are placed.">Ready only</button>';
}

/** Ask for the thumbnails of `ids` not yet here or on their way, a chunk at a time. */
function ensureDecoPreviews(ids) {
  if (typeof vs === 'undefined' || !vs) return;
  var want = ids.filter(function (id) { return !_decoArt[id] && !_decoAsked[id]; });
  for (var i = 0; i < want.length; i += DECO_CHUNK) {
    var chunk = want.slice(i, i + DECO_CHUNK);
    chunk.forEach(function (id) { _decoAsked[id] = true; });
    vs.postMessage({ command: 'requestDeco', previews: chunk });
  }
}

/** ☆ on a vanilla card: fetch its cells, and save them as the user's own widget. */
function decoSaveAsMine(id) {
  if (typeof vs === 'undefined' || !vs) return;
  _decoSaveWanted = id;
  vs.postMessage({ command: 'requestDeco', cells: id });
}

/**
 * Thumbnails load as their cards near the view: every card is drawn at its
 * final size, so a loading one moves nothing. Rebuilt on every render, like
 * the Tile tab's (map-editor-tile-lazy.js).
 */
function decoLazyObserve() {
  if (_decoObserver) { _decoObserver.disconnect(); _decoObserver = null; }
  var body = document.getElementById('rg-tab-body');
  if (!body) return;
  var cards = body.querySelectorAll('.rg-deco[data-deco]');
  var missing = [];
  for (var i = 0; i < cards.length; i++) if (!_decoArt[cards[i].dataset.deco]) missing.push(cards[i]);
  if (!missing.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    ensureDecoPreviews(missing.slice(0, DECO_CHUNK).map(function (c) { return Number(c.dataset.deco); }));
    return;
  }
  _decoObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      _decoObserver.unobserve(e.target);
      _decoLazyWant.push(Number(e.target.dataset.deco));
    });
    // One request for everything that came into view together.
    if (_decoLazyTimer) return;
    _decoLazyTimer = setTimeout(function () {
      _decoLazyTimer = null;
      var ids = _decoLazyWant;
      _decoLazyWant = [];
      ensureDecoPreviews(ids);
    }, 30);
  }, { root: typeof panelScroller === 'function' ? panelScroller(body) : body, rootMargin: '600px 0px' });
  missing.forEach(function (c) { _decoObserver.observe(c); });
}

/**
 * The three groups the Widgets tab cards it into.
 *
 * `front`/`back` are computed server-side (deco-catalogue.js's `decoIndex`)
 * from the same per-cell canopy/terrain split that already backs the
 * "front" filter flag — there is no ROM category to read out, so this is
 * derived, not invented: an entry that draws only on the canopy is
 * Foreground, one that draws only on the terrain is Background, and
 * anything else (both, or an edge case where a cell is pure bounding-box
 * filler) is Misc.
 */
var DECO_CATEGORIES = [
  ['front', 'Foreground', 'sits over any floor'],
  ['back', 'Background', 'is the floor itself'],
  ['misc', 'Misc', 'both, or something in between'],
];

function decoCategoryOf(d) {
  if (d.front) return 'front';
  if (d.back) return 'back';
  return 'misc';
}

/**
 * The warnings the mock wants as visible card text, not a hover-only
 * tooltip — the same two facts the tooltip already computes
 * (`decoNewFamilies`, `d.scriptId`), just also written where a glance
 * catches them.
 */
function decoWarningsHtml(d) {
  var need = decoNewFamilies(d);
  var bits = [];
  if (need.length) bits.push('+' + need.length + ' famil' + (need.length === 1 ? 'y' : 'ies') + ' needed');
  if (d.scriptId !== null) bits.push('1 B-trigger added');
  if (!bits.length) return '';
  return '<span class="rg-deco-warn">' + bits.map(escH).join(' · ') + '</span>';
}

/** One entry's thumbnail card, with its cost written out rather than only hinted at. */
function decoCardHtml(d) {
  var style = decoArtStyle(_decoArt[d.id]);
  var need = decoNewFamilies(d);
  return '<button class="rg-deco' + (_editConstruct >= 0 && _decoPick === d.id ? ' on rg-armed' : '')
    + (d.scriptId !== null ? ' rg-deco-live' : '')
    + (need.length ? ' rg-deco-costly' : '')
    + '" data-deco="' + d.id + '"'
    + ' title="' + escH(d.w + '×' + d.h + ' — ' + d.roomName + ' (' + d.area + ')'
      + '\nplaced ' + d.count + ' time' + (d.count === 1 ? '' : 's') + ' in vanilla'
      + '\ndraws ' + d.cells + ' of its ' + (d.w * d.h) + ' cells; the rest keeps your floor'
      + (d.front ? '\nforeground only — it sits over any floor' : '\nsome of it is ground, not canopy')
      + (need.length
        ? '\nneeds ' + need.length + ' new famil' + (need.length === 1 ? 'y' : 'ies')
          + ' (' + need.join(', ') + ') and up to ' + d.graphics + ' tile slots'
        : '\nyour families already draw it; up to ' + d.graphics + ' tile slots')
      + (d.scriptId !== null
        ? '\nB-trigger on script 0x' + d.scriptId.toString(16) + ' — it works when placed'
        : '\nno trigger: art and collision only')
      + (d.states > 1 ? '\n' + d.states + ' states — it opens, breaks or burns' : '')) + '">'
    + '<i class="rg-deco-art" style="' + style + '"></i>'
    + '<span class="rg-deco-keep" role="button" data-deco-save="' + d.id + '" title="Save to my widgets — '
    + 'then it can be renamed and edited">☆</span>'
    + (need.length ? '<span class="rg-deco-cost">+' + need.length + '</span>' : '')
    + '<span class="rg-deco-tag">' + d.w + '×' + d.h
    + (d.scriptId !== null ? ' ·⚡' : '')
    + (d.states > 1 ? ' · ' + d.states + 'st' : '') + '</span>'
    + decoWarningsHtml(d)
    + '</button>';
}

/**
 * The vanilla section of the Widgets tab (map-editor-widgets.js puts it
 * under the user's own): the generated library, filtered, in its three
 * groups, as one scrolling list.
 */
function decoLibraryHtml() {
  if (!_deco) { requestDeco(); return '<div class="rs-note">loading the vanilla library…</div>'; }
  var list = filterDeco(_deco, _decoFilter);
  var html = '<div class="rs-note">' + list.length + ' of ' + _deco.length
    + ' objects, cut automatically out of vanilla rooms and the floor they stood on — some are good, '
    + 'some are not. The ROM stores no names, so pick by sight; ☆ keeps one as your own.</div>'
    + decoReadyToggleHtml()
    + decoFlagsHtml()
    + '<input class="rg-fam-filter" id="rg-deco-filter" value="' + escH(_decoFilter)
    + '" placeholder="an act, a room, or a size like 2x2" />';

  DECO_CATEGORIES.forEach(function (cat) {
    var group = list.filter(function (d) { return decoCategoryOf(d) === cat[0]; });
    if (!group.length) return;
    html += '<div class="rg-widget-group"><div class="rg-widget-h">' + escH(cat[1])
      + ' <span class="rs-note">— ' + escH(cat[2]) + ' · ' + group.length + '</span></div>'
      + '<div class="rg-deco-grid">' + group.map(decoCardHtml).join('') + '</div></div>';
  });
  if (!list.length) html += '<div class="rs-note">nothing matches.</div>';
  return html;
}
