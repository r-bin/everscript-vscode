// Ownership: Widget Editor Mode — editing one of the user's own widgets on
// its own W×H canvas, with every tool the map has (the design mock's screen
// 7: "Editing widget: <name>", "← Back to map").
//
// A widget session *is* a custom map, one the rail never lists: a blank room
// the widget's size, drawn with the default donor's graphics, which
// map-editor-custom.js opens, renders and resizes like any other. Two things
// differ. It saves into the widget (widgetFromSession, on every save the
// map would make) rather than into custom-maps/; and it starts by stamping
// the widget at 0,0, triggers and objects included.
//
// What a widget keeps (map-editor-constructs.js's portable cells):
//   - each painted cell, a layer that is the blank floor's own word left
//     `null` — "keep whatever the widget lands on";
//   - its triggers (B and step-on, with their scripts) and its objects.
//
// Owns: _widgetEdit (the session, shaped like a `_customMaps` entry plus
// `widget: id`), _widgetBack (where "Back to map" goes).

var _widgetEdit = null;
var _widgetBack = null;

var WIDGET_BORROW = 0x34;

function widgetEditing(id) {
  return !!_widgetEdit && (id === undefined || _widgetEdit.widget === id);
}

/** Open a widget on its own canvas. */
function widgetEditOpen(id) {
  var w = widgetFind(id);
  if (!w) return;
  if (!_widgetEdit) {
    _widgetBack = _customActive ? { custom: _customActive }
      : (typeof _editPanelRoom !== 'undefined' && _editPanelRoom ? { room: _editPanelRoom } : null);
  } else if (_customActive === _widgetEdit.key) {
    customStash();
  }
  _widgetEdit = {
    key: 'widget-' + id.slice(2), widget: id, name: w.name, borrow: WIDGET_BORROW,
    w: w.w, h: w.h, saved: null, history: null, created: w.created, pending: w,
  };
  customOpen(_widgetEdit.key);
  if (typeof _editActiveTab !== 'undefined') _editActiveTab = 'tile';
  editNote('editing the widget “' + w.name + '” — draw with every tool; it saves as you go');
}

/** A new, empty widget, opened for editing. */
function widgetEditNew(w, h) {
  var widget = { id: widgetNewId(), name: widgetNextName(), w: w || 2, h: h || 2, cells: [],
    attachments: { bTrigger: [], stepOn: [], objects: [] } };
  widgetStore(widget);
  widgetEditOpen(widget.id);
}

/** "Done": save, and go back to the map the session was opened from. */
function widgetEditClose() {
  if (!_widgetEdit) return;
  var back = _widgetBack;
  _widgetBack = null;
  if (_customActive === _widgetEdit.key) customStash();
  _widgetEdit = null;
  if (back && back.custom && customFind(back.custom)) customOpen(back.custom);
  else if (back && back.room && typeof renderRoomDetail === 'function') renderRoomDetail(back.room);
  else if (typeof customShowNothing === 'function') customShowNothing();
  if (typeof _editActiveTab !== 'undefined') _editActiveTab = 'widgets';
  if (typeof renderEditChrome === 'function' && editDraft()) renderEditChrome();
}

/** The blank canvas arrived (customNoteBlank): a session's first one gets the widget stamped in. */
function widgetEditBlank(m) {
  if (!m || !m.pending) return;
  var w = m.pending;
  m.pending = null;
  var d = editDraft();
  if (!d || !_mtPalette || !w.cells.length && !widgetHasAttachments(w)) return;
  var got = editConstructWrites(_mtPalette, widgetConstruct(w), 0, 0);
  editApply(got.writes);
  editStampedConstruct(widgetConstruct(w), 0, 0);
  // Opening is not an edit: undo starts from the widget as it was.
  d.undo = [];
  d.redo = [];
  if (got.problems.length) editNote(got.problems.join(' · '));
  requestComposedPreview();
  renderEditChrome();
}

function widgetHasAttachments(w) {
  var a = w.attachments || {};
  return !!((a.bTrigger || []).length || (a.stepOn || []).length || (a.objects || []).length);
}

/** Save a session back into its widget (called where a custom map would save). */
function widgetFromSession(m) {
  var d = editDraft();
  var w = widgetFind(m.widget);
  if (!w || !d || d.customKey !== m.key || !_mtPalette || m.pending) return;
  var floor = d.blank && d.blank.floor;
  var blankCanopy = editBlankCanopy(_mtPalette);
  var cells = [];
  Object.keys(d.cells).forEach(function (k) {
    var p = k.split(',').map(Number);
    if (p[0] >= m.w || p[1] >= m.h) return;
    var words = editStampWords(_mtPalette, d.cells[k]);
    if (!words) return;
    var keepCanopy = words.layer1 === blankCanopy || (floor && words.layer1 === floor.layer1);
    var keepTerrain = floor && words.layer2 === floor.layer2;
    cells.push({
      dx: p[0], dy: p[1],
      canopy: keepCanopy ? null : editPartFromWord(_mtPalette, words.layer1),
      terrain: keepTerrain ? null : editPartFromWord(_mtPalette, words.layer2),
      collision: words.collision,
    });
  });
  cells.sort(function (a, b) { return a.dy - b.dy || a.dx - b.dx; });
  var next = Object.assign({}, w, {
    name: m.name, w: m.w, h: m.h, cells: cells,
    attachments: widgetPlacedIn(d, { x1: 0, y1: 0, x2: m.w - 1, y2: m.h - 1 }),
  });
  if (JSON.stringify(next) === JSON.stringify(w)) return;
  widgetStore(next);
}

/** Triggers and objects the draft placed that overlap `sel`, relative to its corner. */
function widgetPlacedIn(d, sel) {
  var out = { bTrigger: [], stepOn: [], objects: [] };
  (d.placed || []).forEach(function (p) {
    if (p.removed || p.x > sel.x2 || p.x + p.w - 1 < sel.x1 || p.y > sel.y2 || p.y + p.h - 1 < sel.y1) return;
    var rel = { dx: p.x - sel.x1, dy: p.y - sel.y1, w: p.w, h: p.h };
    if (p.kind === 'bTrigger' || p.kind === 'stepOn') out[p.kind].push(Object.assign(rel, { scriptId: p.scriptId }));
    else if (p.kind === 'object') out.objects.push(Object.assign(rel, { states: p.states || 1, cells: widgetObjectCells(p) }));
  });
  return out;
}

/** An object's changed look as portable cells, for keeping in a widget. */
function widgetObjectCells(o) {
  return Object.keys(o.layer || {}).map(function (k) {
    var p = k.split(',').map(Number);
    var w = editStampWords(_mtPalette, o.layer[k]);
    return w ? { dx: p[0], dy: p[1], canopy: editPartFromWord(_mtPalette, w.layer1),
      terrain: editPartFromWord(_mtPalette, w.layer2), collision: w.collision } : null;
  }).filter(Boolean);
}

/** Rename the widget being edited. */
function widgetEditRename(name) {
  if (!_widgetEdit) return;
  _widgetEdit.name = String(name || '').slice(0, 80) || 'widget';
  customSaveSoon();
}

/** The banner over the dock while a widget is open. */
function widgetEditBannerHtml() {
  if (!_widgetEdit) return '';
  return '<div class="rg-widget-banner">Editing widget: '
    + '<input id="rg-widget-name" class="rg-widget-name" value="' + escH(_widgetEdit.name) + '" aria-label="Widget name"/>'
    + '<span class="rs-note">' + _widgetEdit.w + '×' + _widgetEdit.h + ' · drag the corner to resize</span>'
    + '<button class="rdf" data-widget-act="delete" title="Delete this widget">Delete</button>'
    + '<button class="rdf on" data-widget-act="done" title="Save, and go back to the map">← Back to map</button>'
    + '</div>';
}
