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

function filterDeco(all, query) {
  var q = String(query || '').trim().toLowerCase();
  if (!q) return all;
  if (q === 'open' || q === 'states') return all.filter(function (d) { return d.states > 1; });
  // The 68 entries that come with a script are the ones that *do* something
  // — gourds, chests, market stalls — which is the filter people want first.
  if (q === 'works' || q === 'trigger') return all.filter(function (d) { return d.scriptId !== null; });
  var size = q.match(/^(\d+)x(\d+)$/);
  if (size) {
    return all.filter(function (d) { return d.w === Number(size[1]) && d.h === Number(size[2]); });
  }
  return all.filter(function (d) {
    return d.area.toLowerCase().indexOf(q) >= 0 || d.roomName.toLowerCase().indexOf(q) >= 0;
  });
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

  var html = '<div class="rs-note">' + _deco.length + ' distinct objects from the ROM, '
    + 'cut out of the floor they stood on. The ROM stores no names, so pick by sight — '
    + 'filter by act, room, a size like <b>4x3</b>, <b>works</b> for the ones that come '
    + 'with a script, or <b>open</b> for the ones with more than one state.</div>'
    + '<input class="rg-fam-filter" id="rg-deco-filter" value="' + escH(_decoFilter)
    + '" placeholder="act, room, 2x2, works, or open" />'
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
    html += '<button class="rg-deco' + (_editConstruct >= 0 && _decoPick === d.id ? ' on' : '')
      + (d.scriptId !== null ? ' rg-deco-live' : '')
      + '" data-deco="' + d.id + '"'
      + ' title="' + escH(d.w + '×' + d.h + ' — ' + d.roomName + ' (' + d.area + ')'
        + '\nplaced ' + d.count + ' time' + (d.count === 1 ? '' : 's') + ' in vanilla'
        + '\ndraws ' + d.cells + ' of its ' + (d.w * d.h) + ' cells; the rest keeps your floor'
        + '\ncosts ' + d.families + ' famil' + (d.families === 1 ? 'y' : 'ies')
        + ' and ' + d.graphics + ' tile' + (d.graphics === 1 ? '' : 's')
        + (d.scriptId !== null
          ? '\nB-trigger on script 0x' + d.scriptId.toString(16) + ' — it works when placed'
          : '\nno trigger: art and collision only')
        + (d.states > 1 ? '\n' + d.states + ' states — it opens, breaks or burns' : '')) + '">'
      + '<i class="rg-deco-art" style="' + style + '"></i>'
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
