// Ownership: the deco library — vanilla's own objects, as things to stamp.
//
// Section 3 objects are the game's deco widgets: room 0x51 is 25 gourds and
// pots, room 0x25's 4x3 objects are fire pits. 655 distinct ones, so this
// is a picker, not a list.
//
// **The ROM stores no names.** An object is a rectangle of metatiles and an
// id; nothing in it says "gourd". So an entry is found by its picture, its
// size and the room it comes from, and nothing here invents a label.
//
// Owns: _deco, _decoFilter, _decoPage, _decoPreviews, _decoPick.

var _deco = null;          // the catalogue, once fetched
var _decoFilter = '';
var _decoPage = 0;
var _decoPreviews = null;
var _decoPreviewKey = '';
var _decoPick = -1;        // the entry whose cells are being fetched
/** Which of the four questions below are being asked of the library. */
var _decoFlags = { fits: false, works: false, front: false, open: false };

/** Entries per page. Each is a 48px thumbnail, so this is two rows of six. */
var DECO_PAGE = 12;

function requestDeco() {
  if (_deco || typeof vs === 'undefined' || !vs) return;
  vs.postMessage({ command: 'requestDeco' });
}

function applyDecoLibrary(msg) {
  if (!msg || msg.error || !msg.deco) return;
  _deco = msg.deco;
  renderEditPanels();
}

function applyDecoPreviews(msg) {
  if (!msg || !msg.previews) return;
  _decoPreviews = msg.previews;
  renderEditPanels();
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

  d.constructs.push({
    name: name,
    w: entry.w,
    h: entry.h,
    cells: entry.cells,
    attachments: {
      bTrigger: entry.trigger ? [entry.trigger] : [],
      stepOn: [],
      objects: [{ dx: 0, dy: 0, w: entry.w, h: entry.h, states: entry.states }],
    },
  });
  _editConstruct = d.constructs.length - 1;
  d.tool = 'stamp';

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

function ensureDecoPreviews(ids) {
  if (typeof vs === 'undefined' || !vs || !ids.length) return;
  var key = ids.join(',');
  if (_decoPreviewKey === key) return;
  _decoPreviewKey = key;
  vs.postMessage({ command: 'requestDeco', previews: ids });
}

/** The picker: thumbnails, with where each one comes from. */
function decoPanel() {
  if (!_deco) { requestDeco(); return '<div class="rs-note">loading the deco library…</div>'; }
  var list = filterDeco(_deco, _decoFilter);
  var shown = list.slice(_decoPage * DECO_PAGE, _decoPage * DECO_PAGE + DECO_PAGE);
  ensureDecoPreviews(shown.map(function (d) { return d.id; }));

  var html = '<div class="rs-note">' + list.length + ' of ' + _deco.length
    + ' objects, cut out of the floor they stood on. The ROM stores no names, so pick '
    + 'by sight.</div>'
    + decoFlagsHtml()
    + '<input class="rg-fam-filter" id="rg-deco-filter" value="' + escH(_decoFilter)
    + '" placeholder="an act, a room, or a size like 2x2" />'
    + '<div class="rg-deco-grid">';

  var pv = _decoPreviews;
  for (var i = 0; i < shown.length; i++) {
    var d = shown[i];
    var at = pv ? pv.ids.indexOf(d.id) : -1;
    var style = '';
    if (at >= 0) {
      style = 'background-image:url(' + pv.imageUri + ');background-position:-'
        + ((at % pv.columns) * pv.cell) + 'px -' + (Math.floor(at / pv.columns) * pv.cell) + 'px';
    }
    var need = decoNewFamilies(d);
    html += '<button class="rg-deco' + (_editConstruct >= 0 && _decoPick === d.id ? ' on' : '')
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
      + (need.length ? '<span class="rg-deco-cost">+' + need.length + '</span>' : '')
      + '<span class="rg-deco-tag">' + d.w + '×' + d.h
      + (d.scriptId !== null ? ' ·⚡' : '')
      + (d.states > 1 ? ' · ' + d.states + 'st' : '') + '</span>'
      + '</button>';
  }
  html += '</div>';

  if (list.length > DECO_PAGE) {
    var last = Math.ceil(list.length / DECO_PAGE) - 1;
    html += '<div class="rd-filters">'
      + '<button class="rdf" data-deco-page="' + Math.max(0, _decoPage - 1) + '">‹ back</button>'
      + '<span class="rs-note">page ' + (_decoPage + 1) + ' of ' + (last + 1) + '</span>'
      + '<button class="rdf" data-deco-page="' + Math.min(last, _decoPage + 1) + '">more ›</button>'
      + '</div>';
  }
  return html;
}
