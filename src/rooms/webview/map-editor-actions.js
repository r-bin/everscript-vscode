// Ownership: the editor's toolbar actions — undo, discard, compose, save a
// construct, draft a room, hand the draft over.
//
// Split out of map-editor-input.js, which owns the pointer gestures, to keep
// both inside the 400-line limit. One `act` string per button.

function editAction(act) {
  var d = editDraft();
  if (!d) return;
  if (act === 'undo') { editUndo(_mtPalette); requestComposedPreview(); renderEditChrome(); return; }
  if (act === 'redo') { editRedo(_mtPalette); requestComposedPreview(); renderEditChrome(); return; }
  if (act === 'clear') {
    var fresh = editReset(d.roomId);
    fresh.on = true;
    // Discarding a custom map's drawing keeps the map: its identity, its
    // blank grid and its one Boy (map-editor-rules §5).
    if (d.customKey) { fresh.customKey = d.customKey; fresh.blank = d.blank; fresh.start = d.start; }
    _editSel = null; _editClip = null; _editComposed = null;
    renderEditChrome(); renderComposer();
    return;
  }
  if (act === 'compose-brush') {
    // The shortest path to a working stamp: take one that already works and
    // change the one word you care about.
    var pick = d.brush >= 0 ? d.brush : _mtSelected;
    var w = pick >= 0 ? editStampWords(_mtPalette, pick) : null;
    if (!w) { editNote('select a stamp first — “from brush” copies the selected one'); return; }
    _editCompose.layer1 = w.layer1;
    _editCompose.layer2 = w.layer2;
    _editCompose.collision = w.collision;
    _editCompose.armed = false;
    renderComposer();
    return;
  }
  if (act === 'compose-swap') {
    var src = _editCompose.layer2 != null ? editFindCollisionFor(_editCompose.layer2) : null;
    if (src == null) { editNote('no stamp in this room draws that terrain word yet'); return; }
    _editCompose.collision = src;
    renderComposer();
    return;
  }
  if (act === 'compose-add') {
    if (_editCompose.layer1 == null || _editCompose.layer2 == null) {
      editNote('a stamp needs both a canopy and a terrain word');
      return;
    }
    var coll = _editCompose.collision != null ? _editCompose.collision
      : (editFindCollisionFor(_editCompose.layer2) || 0);
    d.brush = editAddStamp(_mtPalette, {
      layer1: _editCompose.layer1, layer2: _editCompose.layer2, collision: coll,
    });
    requestComposedPreview();
    renderEditChrome(); renderComposer();
    return;
  }
  if (act === 'save-construct') {
    if (!_editSel) { editNote('drag a region with copy or move first'); return; }
    var made = editSaveConstruct(_mtPalette, _editSel, null);
    if (!made) { editNote('nothing in that selection to save'); return; }
    _editConstruct = d.constructs.length - 1;
    d.tool = 'stamp';
    var a = made.attachments;
    var extra = a.objects.length + a.bTrigger.length + a.stepOn.length;
    editNote('saved ' + made.name + ' — ' + made.cells.length + ' cells'
      + (extra ? ' and ' + extra + ' attachment' + (extra === 1 ? '' : 's') : ', metatiles only'));
    renderComposer();
    renderEditPanels();
    return;
  }
  if (act === 'new-room') { editNewRoom(); return; }
  if (act === 'new-room-go') { editNewRoomGo(); return; }
  if (act === 'new-room-cancel') { _newRoomOpen = false; renderEditChrome(); return; }
  if (act === 'export') editCopyDraft();
  if (act === 'export-rom') editExportRom();
  if (act === 'play-rom') editPlayRom();
}

/** The collision word the room already uses with this terrain word. */
function editFindCollisionFor(layer2Word) {
  if (!_mtPalette) return null;
  for (var i = 0; i < _mtPalette.count; i++) {
    if (_mtPalette.entries[i][2] === layer2Word) return _mtPalette.entries[i][3];
  }
  return null;
}

/** Hand the draft over as JSON — nothing writes to the ROM yet. */
function editCopyDraft() {
  var json = JSON.stringify(editExport(_mtPalette), null, 2);
  var note = document.getElementById('rg-edit-count');
  if (navigator && navigator.clipboard) {
    navigator.clipboard.writeText(json).then(function () {
      if (note) note.textContent = 'draft copied to the clipboard';
    }, function () { if (note) note.textContent = 'could not copy'; });
  }
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'mapEditDraft', draft: editExport(_mtPalette) });
}
