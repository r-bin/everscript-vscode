// Ownership: an object's timing — how long it holds each state while a script
// steps it through them — and playing that on the map.
//
// A script setting an object's state (`object[5] = 0x7e`, clamped to its last
// state) does not jump there: the engine takes one state per step. The first
// step lands on the next tick; after each one it loads byte 0 of the descriptor
// for the state it just reached into a countdown (`$90A46B`/`$90A48E` →
// `$111E,X`) and takes the next step when that runs out (`$90A429`). Going back
// down reads the same bytes. So `holds[s]` is how many 60 Hz ticks state s
// stays up on the way through — a bridge extending, a boss segment moving.
// State 0 and the last state are only ever where it starts or stops, and are
// never held: descriptor 0's byte is never read, and the last state has none.
// 0 and 1 both mean "the next tick".
//
// (A script value with bit 15 set takes a second path, `$90A3AC`, that steps
// without these waits. The Object tab shows the timed one.)
//
// The frames are map-editor-objects.js; this keeps `o.holds` in step with them.
//
// Owns: _objectPlay (the object being played, and its timer).

var OBJECT_HOLD_DEFAULT = 1, OBJECT_HOLD_MAX = 255, OBJECT_TICK_MS = 1000 / 60.0988;
var _objectPlay = null;

/** `o.holds`, one per descriptor (states 0..N-1), filled out with the defaults. */
function objectHolds(o) {
  var n = editObjectFrames(o).length;
  if (!Array.isArray(o.holds)) o.holds = [];
  for (var s = o.holds.length; s < n; s++) o.holds.push(s === 0 ? 0 : OBJECT_HOLD_DEFAULT);
  if (o.holds.length > n) o.holds.length = n;
  return o.holds;
}

/** State `f` was removed: its hold goes with it. */
function objectHoldsRemoved(o, f) {
  if (Array.isArray(o.holds) && f < o.holds.length) o.holds.splice(f, 1);
  objectHolds(o);
}

/** States `a` and `b` swapped places: so do their holds. */
function objectHoldsSwapped(o, a, b) {
  if (!Array.isArray(o.holds)) o.holds = [];
  var top = Math.max(a, b);
  while (o.holds.length <= top) o.holds.push(o.holds.length === 0 ? 0 : OBJECT_HOLD_DEFAULT);
  var t = o.holds[a]; o.holds[a] = o.holds[b]; o.holds[b] = t;
  objectHolds(o);
}

/** A state the engine holds: one between the first and the last. */
function objectStateHeld(o, s) {
  return s >= 1 && s < editObjectFrames(o).length;
}

/** Ticks from state 0 to the last (or back): the first step, then every hold on the way. */
function objectRunTicks(o) {
  var holds = objectHolds(o), n = holds.length;
  if (!n) return 0;
  var t = 1;
  for (var s = 1; s < n; s++) t += Math.max(1, holds[s]);
  return t;
}

/** The tick box under state `s`'s chip — or a spacer, for a state never held. */
function objectHoldCellHtml(o, s) {
  if (!objectStateHeld(o, s)) return '<span class="rg-object-hold-none" title="'
    + (s === 0 ? 'State 0 is where it starts or stops — never held' : 'The last state is where it stops — never held') + '"></span>';
  var t = objectHolds(o)[s], dis = editLocked() ? ' disabled' : '';
  return '<input type="number" class="rg-anim-ticks rg-object-hold" min="0" max="' + OBJECT_HOLD_MAX + '" value="' + t
    + '" data-object-hold="' + s + '" data-object-uid="' + o.uid + '" aria-label="State ' + s + ' hold in ticks"'
    + ' title="Held ' + Math.max(1, t) + ' tick' + (Math.max(1, t) === 1 ? '' : 's') + ' (' + Math.round(Math.max(1, t) * OBJECT_TICK_MS)
    + ' ms) on the way through — 0 and 1 are both the next tick"' + dis + '/>';
}

/** Play, and how long a run takes. Only for an object with something to step through. */
function objectTimingHtml(o) {
  var n = editObjectFrames(o).length;
  if (!n) return '';
  var playing = _objectPlay && _objectPlay.uid === o.uid, t = objectRunTicks(o);
  return '<div class="rg-anim-bar">'
    + '<button class="rdf rdf-xs' + (playing ? ' on' : '') + '" data-object-play="' + o.uid + '" title="'
    + (playing ? 'Stop where it is' : 'From state 0, step it to state ' + n + ' as a script setting it to 0x7e would') + '">'
    + (playing ? '■ Stop' : '▶ Play') + '</button>'
    + '<span title="from state 0 to state ' + n + ', or back">' + t + ' tick' + (t === 1 ? '' : 's')
    + ' · ' + Math.round(t * OBJECT_TICK_MS) + ' ms</span></div>';
}

function objectShowState(o, s) {
  var frames = editObjectFrames(o);
  o.activeFrame = s;
  o.layer = s >= 1 ? (frames[s - 1] || {}) : {};
  if (o.uid === _objectSel) _objectActiveFrame = s;
}

function objectStopPlay() {
  if (!_objectPlay) return;
  clearTimeout(_objectPlay.timer);
  _objectPlay = null;
}

/**
 * What `object[n] = 0x7e` does: from state 0, step to the last state, holding
 * each state on the way. Once, never looping; it stays on the last state.
 */
function objectPlay(uid) {
  if (_objectPlay && _objectPlay.uid === uid) { objectStopPlay(); renderEditChrome(); return; }
  objectStopPlay();
  var o = editObjectFind(uid);
  if (!o) return;
  var last = editObjectFrames(o).length;
  if (!last) return;
  objectShowState(o, 0);
  var target = last, dir = 1;
  var play = _objectPlay = { uid: uid, timer: null };
  var step = function () {
    if (_objectPlay !== play) return;
    var cur = editObjectFind(uid);
    if (!cur) { _objectPlay = null; return; }
    var s = (cur.uid === _objectSel ? _objectActiveFrame : (cur.activeFrame || 0)) + dir;
    objectShowState(cur, s);
    if (s === target) _objectPlay = null;
    else play.timer = setTimeout(step, Math.max(1, objectHolds(cur)[s]) * OBJECT_TICK_MS);
    renderEditChrome();
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  };
  play.timer = setTimeout(step, OBJECT_TICK_MS);
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** Set state `s`'s hold. One undo step. */
function objectSetHold(uid, s, ticks) {
  var o = editObjectFind(uid);
  if (!o || objectLocked(uid) || !objectStateHeld(o, s)) return;
  var v = Math.max(0, Math.min(OBJECT_HOLD_MAX, Math.round(Number(ticks) || 0)));
  if (objectHolds(o)[s] === v) return;
  editBegin();
  objectHolds(o)[s] = v;
  editEnd();
  editNote('state ' + s + ' held ' + Math.max(1, v) + ' tick' + (Math.max(1, v) === 1 ? '' : 's'));
  renderEditChrome();
}

/** A tick box's change (map-editor-input.js). */
function objectHoldInputHandler(ev) {
  var t = ev && ev.target;
  if (!t || !t.dataset || t.dataset.objectHold == null) return false;
  if (ev.type !== 'change') return true;
  if (editLocked()) { editNote('this map is locked — unlock it to change its objects'); renderEditChrome(); return true; }
  objectSetHold(Number(t.dataset.objectUid), Number(t.dataset.objectHold), t.value);
  return true;
}
