// Ownership: the user's own widgets — the library every map shares (on the
// host: `<globalStorage>/widgets.json`, rooms/data/widget-store.js) and the
// Widgets tab that lists them first.
//
// The tab is one scrolling list:
//   - My widgets: yours, each with ✎ to edit it on its own canvas
//     (map-editor-widget-edit.js), plus "+ New widget" and "+ From
//     selection" (the copy tool's region or a selected stamped object);
//   - Vanilla (map-editor-deco.js), only while the `vanilla` toggle is on:
//     532 objects cut automatically out of vanilla rooms. Generated, so hit
//     and miss — ☆ keeps a good one as your own.
//
// A widget is portable (map-editor-constructs.js): cells as `{graphic,
// family, flags}` per layer, `null` for "keep the floor", with the
// collision, triggers and objects that come with it. Clicking one arms the
// Widgets pencil; each stamp is one object on the map (map-editor-groups.js)
// on the level of the floor it lands on.
//
// Two views, a tab each: Library (the above) and Placed — the widgets
// stamped on this map, in draw order (map-editor-placed-list.js).
//
// Owns: _widgets (null until loaded), _widgetArt, _widgetsVanilla, _widgetsView.

var _widgets = null;
var _widgetsAsked = false;
/** id -> `{uri, x, y}` in a thumbnail sheet (map-editor-deco.js applyDecoPreviews). */
var _widgetArt = {};
/** Show the generated vanilla library too. Off by default; remembered in uiPrefs. */
var _widgetsVanilla = false;
/** Which half of the tab is showing: 'library' (what you can stamp) or 'placed' (what you stamped). */
var _widgetsView = 'library';

function requestWidgets() {
  if (_widgetsAsked || typeof vs === 'undefined' || !vs) return;
  _widgetsAsked = true;
  vs.postMessage({ command: 'requestWidgets' });
}

function applyWidgets(msg) {
  if (!msg) return;
  _widgets = msg.widgets || [];
  if (msg.saved) delete _widgetArt[msg.saved];
  if (msg.deleted && widgetEditing(msg.deleted)) { _widgetEdit.pending = null; widgetEditClose(); }
  if (typeof editActive === 'function' && editActive()) renderEditPanels();
}

function widgetFind(id) {
  for (var i = 0; i < (_widgets || []).length; i++) if (_widgets[i].id === id) return _widgets[i];
  return null;
}

function widgetNewId() {
  return 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function widgetNextName() {
  var n = 1;
  (_widgets || []).forEach(function (w) {
    var k = /^Widget (\d+)$/.exec(w.name);
    if (k) n = Math.max(n, Number(k[1]) + 1);
  });
  return 'Widget ' + n;
}

/** Keep a widget: in the list now, on the host for good. */
function widgetStore(w) {
  if (!_widgets) _widgets = [];
  var at = -1;
  _widgets.forEach(function (x, i) { if (x.id === w.id) at = i; });
  if (at >= 0) _widgets[at] = w; else _widgets.push(w);
  delete _widgetArt[w.id];
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveWidget', widget: w });
}

/** A widget as the stamp machinery's construct. */
function widgetConstruct(w) {
  return { name: w.name, w: w.w, h: w.h, cells: w.cells || [],
    attachments: w.attachments || { bTrigger: [], stepOn: [], objects: [] }, widget: w.id };
}

/** Arm a widget: the Widgets pencil stamps it. */
function widgetArm(id) {
  var d = editDraft();
  var w = widgetFind(id);
  if (!d || !w) return;
  d.constructs.push(widgetConstruct(w));
  _editConstruct = d.constructs.length - 1;
  if (typeof _decoPick !== 'undefined') _decoPick = -1;
  d.tool = 'paint';
  var a = w.attachments || {};
  var extras = [];
  if ((a.bTrigger || []).length) extras.push((a.bTrigger.length === 1 ? 'a B-trigger' : a.bTrigger.length + ' B-triggers'));
  if ((a.stepOn || []).length) extras.push('step triggers');
  if ((a.objects || []).length) extras.push((a.objects.length === 1 ? 'an object' : a.objects.length + ' objects'));
  editNote('armed ' + w.name + ' — ' + w.cells.length + ' cell' + (w.cells.length === 1 ? '' : 's')
    + (extras.length ? ' with ' + extras.join(', ') : '') + '. Click the map to place it; it lands on the level of the floor there.');
  requestComposedPreview();
  renderEditChrome();
}

/** ☆ on a vanilla card, once its cells arrived (map-editor-deco.js applyDecoCells). */
function widgetSaveFromDeco(entry, name) {
  var w = {
    id: widgetNewId(), name: name, w: entry.w, h: entry.h, cells: entry.cells,
    attachments: {
      bTrigger: entry.trigger ? [entry.trigger] : [], stepOn: [],
      objects: [{ dx: 0, dy: 0, w: entry.w, h: entry.h, states: entry.states, cells: entry.stateCells || [] }],
    },
    source: { deco: entry.id, room: entry.room },
  };
  widgetStore(w);
  editNote('kept as your widget “' + name + '” — ✎ edits it');
  renderEditChrome();
}

/** "+ From selection": the selected stamped object, or the copy tool's region, as a new widget. */
function widgetSaveFromSelection() {
  var d = editDraft();
  if (!d) return;
  var g = typeof _groupSel !== 'undefined' && _groupSel != null ? editGroupFind(_groupSel) : null;
  var sel = g ? { x1: g.x, y1: g.y, x2: g.x + g.w - 1, y2: g.y + g.h - 1 } : _editSel;
  if (!sel) { editNote('select a region with the copy tool, or a stamped object, first'); renderEditChrome(); return; }
  var name = g ? g.name : widgetNextName();
  if (!_mtPalette) { editNote('metatiles still loading — try again in a moment'); renderEditChrome(); return; }
  // A stamped object keeps its own cells, not the floor it sits on.
  var c = g ? editGroupConstruct(_mtPalette, g) : editBuildConstruct(_mtPalette, sel, name);
  if (!c) { editNote('nothing painted there to keep'); renderEditChrome(); return; }
  if (!g) {
    var placed = widgetPlacedIn(d, sel);
    ['bTrigger', 'stepOn', 'objects'].forEach(function (k) { c.attachments[k] = (c.attachments[k] || []).concat(placed[k]); });
  }
  widgetStore({ id: widgetNewId(), name: name, w: c.w, h: c.h, cells: c.cells, attachments: c.attachments });
  editNote('kept ' + c.w + '×' + c.h + ' as your widget “' + name + '” — ✎ edits it');
  renderEditChrome();
  renderEditPanels();
}

function widgetHasSelection() {
  return (typeof _groupSel !== 'undefined' && _groupSel != null) || !!_editSel;
}

/** A click the Widgets tab owns (map-editor-input.js). */
function widgetClick(t) {
  if (t.dataset.widgetEdit) { widgetEditOpen(t.dataset.widgetEdit); return true; }
  if (t.dataset.widget) { widgetArm(t.dataset.widget); return true; }
  var act = t.dataset.widgetAct;
  if (act === 'library' || act === 'placed') { _widgetsView = act; renderEditPanels(); return true; }
  if (act === 'vanilla') {
    _widgetsVanilla = !_widgetsVanilla;
    if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveUiPref', key: 'widgetsVanilla', value: _widgetsVanilla });
    renderEditPanels();
    return true;
  }
  if (act === 'new') { widgetEditNew(2, 2); return true; }
  if (act === 'selection') { widgetSaveFromSelection(); return true; }
  if (act === 'done') { widgetEditClose(); return true; }
  if (act === 'delete' && _widgetEdit && typeof vs !== 'undefined' && vs) {
    vs.postMessage({ command: 'deleteWidget', id: _widgetEdit.widget, name: _widgetEdit.name });
    return true;
  }
  return false;
}

/** Thumbnails for the user's widgets that have none yet. */
function ensureWidgetPreviews() {
  if (typeof vs === 'undefined' || !vs || !_widgets) return;
  var want = _widgets.filter(function (w) { return !_widgetArt[w.id] && !_decoAsked['w:' + w.id]; });
  if (!want.length) return;
  want.forEach(function (w) { _decoAsked['w:' + w.id] = true; });
  vs.postMessage({ command: 'requestDeco', widgets: want.slice(0, 48).map(function (w) {
    return { id: w.id, w: w.w, h: w.h, cells: w.cells };
  }) });
}

function widgetCardHtml(w) {
  var a = w.attachments || {};
  var armed = _editConstruct >= 0 && editDraft() && editDraft().constructs[_editConstruct]
    && editDraft().constructs[_editConstruct].widget === w.id;
  var trig = (a.bTrigger || []).length + (a.stepOn || []).length;
  var objs = (a.objects || []).length;
  return '<button class="rg-deco rg-widget-card' + (armed ? ' on rg-armed' : '') + (trig ? ' rg-deco-live' : '')
    + '" data-widget="' + escH(w.id) + '" title="' + escH(w.name + ' — ' + w.w + '×' + w.h + ', ' + w.cells.length
      + ' cells' + (trig ? '\n' + trig + ' trigger' + (trig === 1 ? '' : 's') : '') + (objs ? '\n' + objs + ' object' + (objs === 1 ? '' : 's') : '')
      + '\nclick to arm the pencil · ✎ to edit') + '">'
    + '<i class="rg-deco-art" data-widget-art="' + escH(w.id) + '" style="' + decoArtStyle(_widgetArt[w.id]) + '"></i>'
    + '<span class="rg-deco-keep" role="button" data-widget-edit="' + escH(w.id) + '" title="Edit this widget">✎</span>'
    + '<span class="rg-deco-tag">' + escH(w.name) + '</span>'
    + '<span class="rg-deco-warn">' + w.w + '×' + w.h + (trig ? ' · ⚡' : '') + (objs ? ' · ◆' : '') + '</span>'
    + '</button>';
}

/** The Widgets tab: Library | Placed. */
function widgetsTabHtml() {
  var d = editDraft();
  var placed = ((d && d.groups) || []).length;
  var tabs = [['library', 'Library', (_widgets || []).length, 'The widgets you can stamp'],
    ['placed', 'Placed', placed, 'The widgets stamped on this map, in draw order']];
  var html = '<div class="rg-subtabs" role="tablist">' + tabs.map(function (t) {
    var on = _widgetsView === t[0];
    return '<button class="rg-subtab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-widget-act="' + t[0]
      + '" title="' + escH(t[3]) + '">' + t[1] + ' <span class="rs-note">' + t[2] + '</span></button>';
  }).join('') + '</div>';
  return html + (_widgetsView === 'placed' ? placedListHtml() : widgetsLibraryHtml());
}

/** The Library view: your widgets, and the generated vanilla ones while that is on. */
function widgetsLibraryHtml() {
  requestWidgets();
  ensureWidgetPreviews();
  var list = _widgets || [];
  var html = '<div class="rg-widget-top">'
    + '<button class="rdf' + (_widgetsVanilla ? ' on' : '') + '" data-widget-act="vanilla" aria-pressed="' + _widgetsVanilla
    + '" title="Also list the 532 widgets generated from vanilla rooms — cut out automatically, so whether one '
    + 'is any good is luck">vanilla</button>'
    + '<span class="rs-note">' + (_widgetsVanilla ? 'yours and the generated vanilla ones' : 'yours only') + '</span></div>'
    + '<div class="rg-widget-group"><div class="rg-widget-h">My widgets <span class="rs-note">— ' + list.length + '</span></div>'
    + '<div class="rg-deco-grid">'
    + '<button class="rg-deco rg-widget-add" data-widget-act="new" title="A new, empty widget on its own 2×2 canvas">'
    + '<span class="rg-widget-plus">+</span><span class="rg-deco-tag">New widget</span></button>'
    + '<button class="rg-deco rg-widget-add" data-widget-act="selection"' + (widgetHasSelection() ? '' : ' disabled')
    + ' title="Keep the copy tool\'s region, or the selected stamped object, as a widget — with its triggers and objects">'
    + '<span class="rg-widget-plus">⬚</span><span class="rg-deco-tag">From selection</span></button>'
    + list.map(widgetCardHtml).join('') + '</div>'
    + (list.length ? '' : '<div class="rs-note">none yet — make one, keep a selection, or turn on vanilla and ☆ one.</div>')
    + '</div>';
  if (_widgetsVanilla) html += '<div class="rg-widget-h rg-widget-h-vanilla">Vanilla <span class="rs-note">— generated</span></div>'
    + decoLibraryHtml();
  return html;
}
