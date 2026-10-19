// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the undo/redo history of one edited map, whatever the game. Steps are lists of
// changes; what a change means is the adapter's `apply(change, 'before' | 'after')`.
// Plain browser script: defines globals (and `module.exports` under Node, for the unit test).
// Imports nothing: no game's terms appear here.
//
//   var h = editHistoryCreate(function apply(change, which) { ... }, function changed() { ... });
//   h.begin(); h.record({ ... before, after }); h.end();   // one gesture = one undo step
//   h.undo(); h.redo(); h.canUndo(); h.canRedo(); h.dirty();

var EDIT_HISTORY_LIMIT = 500;

function editHistoryCreate(apply, onChange) {
  var undo = [], redo = [], open = null;
  function fire() { if (onChange) onChange(); }
  return {
    /** Start collecting a gesture; changes recorded until `end` are one undo step. */
    begin: function () { if (!open) open = []; },
    /** Record one change ({before, after, ...whatever the adapter needs}); applying is the caller's. */
    record: function (change) {
      if (!open) { open = []; open.push(change); this.end(); return; }
      open.push(change);
    },
    /** Close the gesture. An empty one leaves no step. */
    end: function () {
      var step = open; open = null;
      if (!step || !step.length) return;
      undo.push(step);
      if (undo.length > EDIT_HISTORY_LIMIT) undo.shift();
      redo.length = 0;
      fire();
    },
    undo: function () {
      var step = undo.pop();
      if (!step) return false;
      for (var i = step.length - 1; i >= 0; i--) apply(step[i], 'before');
      redo.push(step);
      fire();
      return true;
    },
    redo: function () {
      var step = redo.pop();
      if (!step) return false;
      for (var i = 0; i < step.length; i++) apply(step[i], 'after');
      undo.push(step);
      fire();
      return true;
    },
    canUndo: function () { return undo.length > 0; },
    canRedo: function () { return redo.length > 0; },
    /** True while the map differs from how it was opened (something is left to undo). */
    dirty: function () { return undo.length > 0; },
    clear: function () { undo.length = 0; redo.length = 0; open = null; fire(); },
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { editHistoryCreate: editHistoryCreate };
