// Ownership: what the pencil draws. The pencil is one tool, and the dock
// tab decides what it puts down:
//
//   Tile     the armed tile (on the cuttable layer while that is on)
//   Special  the armed special: stairs, drift, gate, entrance, the Boy
//   Trigger  a new trigger: drag out its box (B-trigger or step, B first)
//   Object   a new object's area, or the selected object's tiles (map-editor-objects.js)
//   Widgets  the armed construct or vanilla object
//
// Only one of them at a time — before, a click carried the armed tile *and*
// the armed special together, so a stairs pick also painted whatever tile was
// still armed. Info draws nothing of its own, so it keeps the last tab's.
// The eraser follows the same choice (map-editor-gestures.js).
//
// The pill shows which drawable is live as a badge on the pencil (and on
// the eraser, what it takes off), and the tab's own pick is highlighted
// there with the one armed look every tab shares (`.rg-armed`, the selected
// tile's accent ring). On the Trigger tab the section headings are the
// picks: B-triggers (first, the default) or step-on triggers.
//
// Owns: _editDrawTab, _editTriggerKind, _triggerDraw.

var _editDrawTab = 'tile';
/** Which trigger the Trigger tab's pencil draws: 'b' or 'step'. */
var _editTriggerKind = 'b';
/** `{x1, y1, x2, y2}` while a trigger box is being dragged out, else null. */
var _triggerDraw = null;

var EDIT_DRAW_TABS = { tile: true, special: true, trigger: true, object: true, widgets: true };

/** The Trigger tab's pencil choices, in order — the first is the default. */
var EDIT_TRIGGER_KINDS = [
  ['b', 'B-trigger', 'B', 'Runs its script when the Boy presses B facing it — a sign, a chest, a person'],
  ['step', 'Step trigger', 'S', 'Runs its script when the Boy walks onto it — a door, a cutscene zone'],
];

/** The tab whose drawable the pencil uses. */
function editDrawKind() {
  if (typeof _editActiveTab !== 'undefined' && EDIT_DRAW_TABS[_editActiveTab]) _editDrawTab = _editActiveTab;
  return _editDrawTab;
}

function editTriggerKindDef(kind) {
  for (var i = 0; i < EDIT_TRIGGER_KINDS.length; i++) if (EDIT_TRIGGER_KINDS[i][0] === kind) return EDIT_TRIGGER_KINDS[i];
  return EDIT_TRIGGER_KINDS[0];
}

/** `{kind, glyph, label, ready}`: what the pencil would put down now. */
function editDrawable() {
  var d = editDraft();
  var kind = editDrawKind();
  if (kind === 'special') {
    var def = d && d.currentSpecialId && typeof editSpecialById === 'function' ? editSpecialById(d.currentSpecialId) : null;
    return def ? { kind: kind, glyph: def.glyph, label: 'special: ' + def.label, ready: true }
      : { kind: kind, glyph: '◇', label: 'a special — pick one in the Special tab', ready: false };
  }
  if (kind === 'trigger') {
    var t = editTriggerKindDef(_editTriggerKind);
    return { kind: kind, glyph: t[2], label: t[1] + ' — drag out its box', ready: true };
  }
  if (kind === 'object') {
    var o = typeof editObjectFind === 'function' ? editObjectFind(_objectSel) : null;
    return o ? { kind: kind, glyph: '◆', label: 'the selected object’s tiles — with the Tile tab’s brush', ready: d && d.brush >= 0 }
      : { kind: kind, glyph: '◆', label: 'an object — drag out its area', ready: true };
  }
  if (kind === 'widgets') {
    var c = d && typeof _editConstruct !== 'undefined' && _editConstruct >= 0 ? d.constructs[_editConstruct] : null;
    return c ? { kind: kind, glyph: '❖', label: 'widget: ' + c.name, ready: true }
      : { kind: kind, glyph: '❖', label: 'a widget — pick one in the Widgets tab', ready: false };
  }
  var cut = typeof editCutLayerOn === 'function' && editCutLayerOn();
  return d && d.brush >= 0
    ? { kind: 'tile', glyph: '▦', label: 'tile #' + d.brush + (cut ? ' on the cuttable layer' : ''), ready: true }
    : { kind: 'tile', glyph: '▦', label: 'a tile — pick one in the Tile tab', ready: false };
}

/** What the eraser takes off on the open tab, for its badge and tooltip. */
function editEraseTarget() {
  var kind = editDrawKind();
  if (kind === 'special') return { kind: kind, glyph: '◇', label: 'every special on a cell: stairs, drift, gate, glyph', ready: true };
  if (kind === 'trigger') return { kind: kind, glyph: '▭', label: 'the trigger under the cursor', ready: true };
  if (kind === 'object') return { kind: kind, glyph: '◆', label: 'a tile of the selected object', ready: true };
  var cut = typeof editCutLayerOn === 'function' && editCutLayerOn();
  return { kind: 'tile', glyph: '▦', label: cut ? 'the cuttable tile' : 'the tile, by the layers shown', ready: true };
}

/** The pencil's (or the eraser's) badge, inside its button (map-editor-toolbar.js). */
function editDrawBadgeHtml(erase) {
  var dr = erase ? editEraseTarget() : editDrawable();
  var sub = dr.kind === 'trigger' ? ' rg-draw-trigger-' + _editTriggerKind : '';
  return '<span class="rg-draw-badge rg-draw-' + dr.kind + sub + (dr.ready ? '' : ' idle') + '" aria-hidden="true">'
    + escH(dr.glyph) + '</span>';
}

// ── the Trigger tab's pencil ────────────────────────────────────────────────

/**
 * Everything selected on the map goes: the Boy, a group, a trigger. One
 * selection at a time — called before anything new is selected, and when
 * the tab or the tool changes, or on Escape.
 */
function editDeselectAll() {
  var d = editDraft();
  if (d) d.selectedTriggerRef = null;
  if (typeof _triggerDrag !== 'undefined') _triggerDrag = null;
  if (typeof _groupSel !== 'undefined') { _groupSel = null; _groupDrag = null; }
  if (typeof _startSel !== 'undefined') { _startSel = false; _startDrag = null; }
  if (typeof _specialSel !== 'undefined') { _specialSel = null; _specialDrag = null; }
  if (typeof _pasteFloat !== 'undefined') _pasteFloat = null;
}

/** Pick the trigger kind the pencil draws, and arm the pencil. */
function triggerKindPick(kind) {
  _editTriggerKind = editTriggerKindDef(kind)[0];
  var d = editDraft();
  if (d) d.tool = 'paint';
  editNote('pencil: drag a box on the map to add a ' + editTriggerKindDef(_editTriggerKind)[1]);
  renderEditChrome();
}

/** A pencil gesture on the Trigger tab: drag a box, release to add it. */
function editTriggerStroke(cell, phase) {
  if (phase === 'down') _triggerDraw = { ax: cell.x, ay: cell.y };
  if (!_triggerDraw) return;
  _triggerDraw.x1 = Math.min(_triggerDraw.ax, cell.x); _triggerDraw.x2 = Math.max(_triggerDraw.ax, cell.x);
  _triggerDraw.y1 = Math.min(_triggerDraw.ay, cell.y); _triggerDraw.y2 = Math.max(_triggerDraw.ay, cell.y);
  if (phase !== 'up') { renderEditLayer(_mtPalette, _editComposed, _editOrigin); return; }
  var box = _triggerDraw;
  _triggerDraw = null;
  editAddTrigger(_editTriggerKind, box);
}

/** Add a trigger over `box` (inclusive cells), select it, one undo step. */
function editAddTrigger(kind, box) {
  var d = editDraft();
  if (!d) return null;
  var before = triggerSnapshot();
  var uid = editNextPlacedUid();
  d.placed.push({ kind: triggerDataKind(kind), x: box.x1, y: box.y1,
    w: box.x2 - box.x1 + 1, h: box.y2 - box.y1 + 1, scriptId: null, uid: uid });
  editApplyTriggerOp(before, triggerSnapshot());
  var ref = { kind: kind, id: 'placed:' + uid };
  editNote(editTriggerKindDef(kind)[1] + ' added — ' + (box.x2 - box.x1 + 1) + '×' + (box.y2 - box.y1 + 1)
    + ' at ' + box.x1 + ',' + box.y1 + '; no script yet');
  triggerSelect(ref);
  return ref;
}

/** The eraser on the Trigger tab: remove the trigger under the cell. */
function editEraseTriggerAt(cell) {
  var ref = editTriggerAt(cell.x, cell.y);
  if (!ref) return false;
  var d = editDraft();
  d.selectedTriggerRef = ref;
  triggerDeleteSelected();
  return true;
}

/**
 * The placed triggers, drawn on the map with their kind's colour and letter —
 * the room's own ones are the ROM overlay's. Plus the box being dragged out.
 */
function editTriggerSvg(origin) {
  var html = '';
  ['b', 'step'].forEach(function (kind) {
    editTriggerList(kind).forEach(function (t) {
      if (t.origin !== 'placed') return;
      var a = editCellPos(origin, t.x1, t.y1);
      html += '<g class="rg-trigger-placed rg-trigger-placed-' + kind + '">'
        + '<rect x="' + a.x + '" y="' + a.y + '" width="' + ((t.x2 - t.x1 + 1) * EDIT_UNITS)
        + '" height="' + ((t.y2 - t.y1 + 1) * EDIT_UNITS) + '"/>'
        + '<text x="' + (a.x + EDIT_UNITS * 0.12) + '" y="' + (a.y + EDIT_UNITS * 0.55) + '" font-size="'
        + (EDIT_UNITS * 0.5) + '">' + editTriggerKindDef(kind)[2] + '</text></g>';
    });
  });
  if (_triggerDraw && _triggerDraw.x1 != null) {
    html += triggerOutlineSvg(_triggerDraw, _editTriggerKind, origin, 'rg-trigger-drag');
  }
  return html;
}
