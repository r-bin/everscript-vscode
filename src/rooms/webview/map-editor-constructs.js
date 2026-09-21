// Ownership: constructs — a saved rectangle of map, with whatever triggers
// and objects sat inside it.
//
// Split out of map-editor.js to keep it under the 400-line limit. Stamps
// are stored as *words*, not indices, so a construct survives being placed
// in a room with a different dictionary.
//
// See docs/map-format/building-a-room-from-a-picture.md §9.

/**
 * Save a rectangle of the map as a reusable construct.
 *
 * The stamps are stored as *words*, not indices, so the construct survives
 * being stamped into a room with a different dictionary. Triggers and
 * objects whose rectangle overlaps the selection come with it — that is the
 * difference between a gourd, which is metatiles plus a B-trigger plus an
 * object, and a hide, which is only metatiles.
 */
function editSaveConstruct(palette, sel, name) {
  if (!_edit || !sel || !palette) return null;
  var cells = [];
  for (var y = sel.y1; y <= sel.y2; y++) {
    for (var x = sel.x1; x <= sel.x2; x++) {
      var idx = editCellAt(palette, x, y);
      var w = idx >= 0 ? editStampWords(palette, idx) : null;
      if (!w) continue;
      cells.push({ dx: x - sel.x1, dy: y - sel.y1, layer1: w.layer1, layer2: w.layer2, collision: w.collision });
    }
  }
  if (!cells.length) return null;
  var construct = {
    name: name || ('construct ' + (_edit.constructs.length + 1)),
    w: sel.x2 - sel.x1 + 1,
    h: sel.y2 - sel.y1 + 1,
    cells: cells,
    attachments: editAttachmentsIn(palette, sel),
  };
  _edit.constructs.push(construct);
  return construct;
}

/** Triggers and objects whose rectangle overlaps this selection. */
function editAttachmentsIn(palette, sel) {
  var a = palette && palette.attachments;
  var out = { bTrigger: [], stepOn: [], objects: [] };
  if (!a) return out;
  var overlaps = function (x1, y1, x2, y2) {
    return x1 <= sel.x2 && x2 >= sel.x1 && y1 <= sel.y2 && y2 >= sel.y1;
  };
  ['bTrigger', 'stepOn'].forEach(function (kind) {
    (a[kind] || []).forEach(function (t) {
      if (overlaps(t[0], t[1], t[2], t[3])) {
        out[kind].push({ dx: t[0] - sel.x1, dy: t[1] - sel.y1, w: t[2] - t[0], h: t[3] - t[1], scriptId: t[4] });
      }
    });
  });
  (a.objects || []).forEach(function (o) {
    if (overlaps(o[0], o[1], o[0] + o[2] - 1, o[1] + o[3] - 1)) {
      out.objects.push({ dx: o[0] - sel.x1, dy: o[1] - sel.y1, w: o[2], h: o[3], objectIndex: o[4] });
    }
  });
  return out;
}

/** The writes that stamp a construct with its top-left at (x, y). */
function editConstructWrites(palette, construct, x, y) {
  var writes = [];
  if (!construct) return writes;
  for (var i = 0; i < construct.cells.length; i++) {
    var c = construct.cells[i];
    var cx = x + c.dx;
    var cy = y + c.dy;
    if (!editInBounds(palette, cx, cy)) continue;
    writes.push({
      x: cx, y: cy,
      index: editAddStamp(palette, { layer1: c.layer1, layer2: c.layer2, collision: c.collision }),
    });
  }
  return writes;
}
