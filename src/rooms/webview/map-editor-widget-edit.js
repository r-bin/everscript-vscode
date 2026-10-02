// Ownership: Widget Editor Mode — editing one of the user's own widgets on
// its own W×H canvas, with every tool the map has.
// It edits the widget's own frames; colourings are derived from its art
// (map-editor-widgets.js widgetEnsureVariations), never painted. The frame
// timeline (map-editor-widget-anim.js) is off until Animation is switched on.

var _widgetEdit = null;
var _widgetBack = null;
var _widgetVarIdx = 0;
var _widgetFrameIdx = 0;

var WIDGET_BORROW = 0x34;

function widgetEditing(id) {
  return !!_widgetEdit && (id === undefined || _widgetEdit.widget === id);
}

/** The widget's own frames, as the timeline edits them (`{frames}`, shared with `w.frames`). */
function widgetCurrentVar(w) {
  if (!w) return null;
  if (!Array.isArray(w.frames) || !w.frames.length) w.frames = widgetBaseFrames(w);
  _widgetVarIdx = 0;
  return { frames: w.frames };
}

function widgetCurrentFrame(w) {
  var v = widgetCurrentVar(w);
  if (!v) return null;
  if (!Array.isArray(v.frames) || !v.frames.length) {
    v.frames = [{ cells: v.cells || [], delay: 8 }];
  }
  if (_widgetFrameIdx < 0) _widgetFrameIdx = 0;
  if (_widgetFrameIdx >= v.frames.length) _widgetFrameIdx = v.frames.length - 1;
  return v.frames[_widgetFrameIdx];
}

/** Open a widget on its own canvas. */
function widgetEditOpen(id, varIdx) {
  var w = widgetFind(id);
  if (!w) return;
  if (typeof widgetStopPlay === 'function') widgetStopPlay();
  _widgetVarIdx = 0;
  _widgetFrameIdx = 0;
  widgetCurrentVar(w);
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
    frames: [{ cells: [], delay: 8 }], animated: false,
    attachments: { bTrigger: [], stepOn: [], objects: [] } };
  widgetStore(widget);
  widgetEditOpen(widget.id);
}

/** "Done": save, and go back to the map the session was opened from. */
function widgetEditClose() {
  if (!_widgetEdit) return;
  if (typeof widgetStopPlay === 'function') widgetStopPlay();
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
  if (!d || !_mtPalette) return;
  var curFrame = widgetCurrentFrame(w);
  var cells = (curFrame && curFrame.cells) || w.cells || [];
  if (!cells.length && !editConstructHasAttachments(w)) return;
  var got = editConstructWrites(_mtPalette, { w: w.w, h: w.h, cells: cells, attachments: w.attachments }, 0, 0);
  editApply(got.writes, got.specials);
  editStampedConstruct({ name: w.name, w: w.w, h: w.h, cells: cells, attachments: w.attachments }, 0, 0);
  d.undo = [];
  d.redo = [];
  if (got.problems.length) editNote(got.problems.join(' · '));
  requestComposedPreview();
  renderEditChrome();
  if (typeof widgetSyncTimeline === 'function') widgetSyncTimeline();
}

/** Extract current canvas painted cells. */
function widgetExtractCanvasCells(m) {
  var d = editDraft();
  if (!d || !_mtPalette) return [];
  var floor = d.blank && d.blank.floor;
  var blankCanopy = editBlankCanopy(_mtPalette);
  var cells = [];
  var shown = editBakedCells(_mtPalette);
  var maxW = m ? m.w : (_widgetEdit ? _widgetEdit.w : 32);
  var maxH = m ? m.h : (_widgetEdit ? _widgetEdit.h : 32);
  Object.keys(shown).forEach(function (k) {
    var p = k.split(',').map(Number);
    if (p[0] >= maxW || p[1] >= maxH) return;
    var words = editStampWords(_mtPalette, shown[k]);
    if (!words) return;
    var keepCanopy = words.layer1 === blankCanopy || (floor && words.layer1 === floor.layer1);
    var keepTerrain = floor && words.layer2 === floor.layer2;
    var cRec = {
      dx: p[0], dy: p[1],
      canopy: keepCanopy ? null : editPartFromWord(_mtPalette, words.layer1),
      terrain: keepTerrain ? null : editPartFromWord(_mtPalette, words.layer2),
      collision: words.collision,
    };
    if (d.specialCells && d.specialCells[k]) cRec.special = d.specialCells[k];
    cells.push(cRec);
  });
  cells.sort(function (a, b) { return a.dy - b.dy || a.dx - b.dx; });
  return cells;
}

/** Save a session back into its widget (called where a custom map would save). */
function widgetFromSession(m) {
  var d = editDraft();
  var w = widgetFind(m.widget);
  if (!w || !d || d.customKey !== m.key || !_mtPalette || m.pending) return;
  var cells = widgetExtractCanvasCells(m);
  var f = widgetCurrentFrame(w);
  if (f) f.cells = cells;
  var next = Object.assign({}, w, {
    name: m.name, w: m.w, h: m.h, cells: w.frames[0].cells,
    attachments: widgetPlacedIn(d, { x1: 0, y1: 0, x2: m.w - 1, y2: m.h - 1 }),
  });
  delete next.variations;
  var was = Object.assign({}, w);
  delete was.variations;
  if (JSON.stringify(next) === JSON.stringify(was)) return;
  widgetStore(next);
}

/** Commit current canvas to the active frame and store. */
function widgetCommitCanvas() {
  if (!_widgetEdit) return;
  var w = widgetFind(_widgetEdit.widget);
  if (!w) return;
  var cells = widgetExtractCanvasCells(_widgetEdit);
  var f = widgetCurrentFrame(w);
  if (f) f.cells = cells;
  w.cells = w.frames[0].cells;
  widgetStore(w);
}

/** Put a frame's cells onto the canvas draft. */
function widgetApplyFrameToCanvas(f) {
  var d = editDraft();
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  if (!d || !w || !_mtPalette) return;
  d.cells = {};
  d.groups = [];
  d.specialCells = {};
  var cells = (f && f.cells) || [];
  if (cells.length) {
    var got = editConstructWrites(_mtPalette, { w: w.w, h: w.h, cells: cells }, 0, 0);
    editApply(got.writes, got.specials);
  }
  requestComposedPreview();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/**
 * Animation on or off. Off, the widget is its first frame and the timeline
 * is hidden; the other frames are kept, so switching it back on restores them.
 */
function widgetToggleAnim() {
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  if (!w) return;
  if (typeof widgetStopPlay === 'function') widgetStopPlay();
  widgetCommitCanvas();
  w.animated = !w.animated;
  if (!w.animated && _widgetFrameIdx !== 0) {
    _widgetFrameIdx = 0;
    widgetApplyFrameToCanvas(widgetCurrentFrame(w));
  }
  widgetStore(w);
  renderEditHeadActs();
  renderEditChrome();
  editNote(w.animated ? 'animation on — add frames on the timeline below the canvas'
    : 'animation off — the widget is its first frame' + (w.frames.length > 1 ? '; its other ' + (w.frames.length - 1) + ' are kept' : ''));
}

/** Triggers and objects the draft placed that overlap `sel`, relative to its corner. */
function widgetPlacedIn(d, sel) {
  var out = { bTrigger: [], stepOn: [], objects: [] };
  (d.placed || []).forEach(function (p) {
    if (p.removed || p.x > sel.x2 || p.x + p.w - 1 < sel.x1 || p.y > sel.y2 || p.y + p.h - 1 < sel.y1) return;
    var rel = { dx: p.x - sel.x1, dy: p.y - sel.y1, w: p.w, h: p.h };
    if (p.kind === 'bTrigger' || p.kind === 'stepOn') out[p.kind].push(Object.assign(rel, { scriptId: p.scriptId }));
    else if (p.kind === 'object') {
      var frames = editObjectFrames(p);
      out.objects.push(Object.assign(rel, {
        states: frames.length + 1,
        cells: widgetLayerCells(frames[0] || {}),
        frames: frames.map(widgetLayerCells),
      }));
    }
  });
  return out;
}

/** Portable cells for one object frame layer. */
function widgetLayerCells(layer) {
  return Object.keys(layer || {}).map(function (k) {
    var p = k.split(',').map(Number);
    var w = editStampWords(_mtPalette, layer[k]);
    return w ? { dx: p[0], dy: p[1], canopy: editPartFromWord(_mtPalette, w.layer1),
      terrain: editPartFromWord(_mtPalette, w.layer2), collision: w.collision } : null;
  }).filter(Boolean);
}

/** An object's changed look as portable cells, for keeping in a widget. */
function widgetObjectCells(o) {
  return widgetLayerCells(o.layer);
}

/** Rename the widget being edited. */
function widgetEditRename(name) {
  if (!_widgetEdit) return;
  _widgetEdit.name = String(name || '').slice(0, 80) || 'widget';
  customSaveSoon();
}

/** The room on screen is the widget being edited. */
function widgetEditShowing(room) {
  return !!_widgetEdit && !!room && room.custom === _widgetEdit.key;
}

/** Contextual app bar: back, name, size, and the Animation switch. */
function widgetEditHeadHtml() {
  if (!_widgetEdit) return '';
  var w = widgetFind(_widgetEdit.widget);
  var anim = !!(w && w.animated);
  return '<div class="rd-head rg-appbar">'
    + '<button class="rg-appbar-back" data-widget-act="done" title="Save, and go back to the map"'
    + ' aria-label="Back to map"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">'
    + '<path d="M13 8H3.5M7.5 3.5L3 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
    + '<div class="rg-appbar-title">'
    + '<div class="rg-appbar-title-row">'
    + '<input id="rg-widget-name" class="rg-appbar-name" value="' + escH(_widgetEdit.name) + '" aria-label="Widget name"'
    + ' title="The widget’s name — saves as you type; Enter to finish"/>'
    + '<span class="rd-file" id="rg-widget-size">' + widgetEditSizeText() + '</span>'
    + '</div>'
    + '<div class="rg-widget-vars" id="rg-widget-vars">'
    + '<button class="rg-widget-var-btn' + (anim ? ' on' : '') + '" data-widget-act="anim" aria-pressed="' + anim + '"'
    + ' title="' + (anim ? 'Switch the frame timeline off: the widget is its first frame' : 'Switch on a frame timeline to animate this widget') + '">'
    + 'Animation: ' + (anim ? 'on' : 'off') + '</button>'
    + '</div>'
    + '</div>'
    + '<span class="rd-head-acts" id="rg-head-acts"></span>'
    + '</div>';
}

function widgetEditSizeText() {
  return 'editing widget · ' + _widgetEdit.w + '×' + _widgetEdit.h + ' · drag the corner to resize, down to 1×1';
}

/** The widget's own actions, where the map's ⋯ and lock are otherwise. */
function widgetEditActsHtml() {
  return '<button class="rdf rg-appbar-delete" data-widget-act="delete" title="Delete this widget">Delete</button>';
}

/** Keep the size line in step with a resize (renderEditHeadActs). */
function widgetEditHeadSync() {
  var el = _widgetEdit && document.getElementById('rg-widget-size');
  if (el) el.textContent = widgetEditSizeText();
}
