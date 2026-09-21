// Ownership: constructs — a saved rectangle of map, with whatever triggers
// and objects sat inside it, in a form that survives being moved.
//
// A tilemap word is **room-relative**: its low ten bits index that room's
// Block 1 and its palette bits index that room's seven families. Storing
// the word and replaying it elsewhere reinterprets both, which is why a
// stamped gourd came out as rubble. So a cell stores `{graphic, family,
// flags}` per layer and the word is rebuilt at the destination, adopting
// the graphic and the family it needs.
//
// A layer may also be `null`, meaning *keep whatever is there*. That is how
// a construct stays agnostic of the background: vanilla's object rectangles
// are 83.4% floor, and the floor belongs to the room, not to the gourd.
//
// See docs/map-format/building-a-room-from-a-picture.md §9.

/** The graphic in a Block 1 slot, the room's own or one the draft adopted. */
function editGraphicAtSlot(palette, slot) {
  if (!palette || !palette.tiles || slot < 0) return undefined;
  var base = palette.tiles.count;
  if (slot < base) {
    var s = palette.tiles.slots[slot];
    return s ? s[2] : undefined;
  }
  var d = editDraft();
  return d ? d.addedGraphics[slot - base] : undefined;
}

/**
 * Split a word into the parts that mean the same thing in any room.
 *
 * A word this room cannot explain — a slot past Block 1, or palette 0,
 * which is the HUD's — is kept verbatim as `{word}`. That is exactly right
 * where the construct stays in the room it was cut from, and it is the only
 * honest answer anywhere else.
 */
function editPartFromWord(palette, word) {
  if (word == null) return null;
  var chr = word & 0x3ff;
  var graphic = editGraphicAtSlot(palette, Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2));
  var pal = (word >> 10) & 0x07;
  var family = pal >= 1 ? editFamilies()[pal - 1] : undefined;
  if (graphic === undefined || family === undefined) return { word: word };
  return { graphic: graphic, family: family, flags: word & 0xe000 };
}

/**
 * Rebuild the word a part needs *here*, pulling in what the room lacks.
 *
 * Both costs are real and both are reported: a family takes one of seven
 * palette slots, a graphic takes one of ~264 Block 1 slots. Returning an
 * error rather than a wrong word is the point — a silently reinterpreted
 * word is exactly the bug this replaces.
 */
function editWordFromPart(palette, part) {
  if (!part) return null;
  if (part.word !== undefined) return { word: part.word };
  var got = editAdoptFamilyFor(part.family);
  if (!got.ok) return { error: got.why };
  var slot = editAdoptGraphic(palette, part.graphic);
  if (slot < 0) return { error: 'no tile sheet loaded yet' };
  return { word: (editSlotChr(slot) | ((got.slot + 1) << 10) | (part.flags || 0)) & 0xffff };
}

/**
 * Save a rectangle of the map as a reusable construct.
 *
 * Triggers and objects whose rectangle overlaps the selection come with it
 * — that is the difference between a gourd, which is metatiles plus a
 * B-trigger plus an object, and a hide, which is only metatiles.
 */
function editSaveConstruct(palette, sel, name) {
  if (!_edit || !sel || !palette) return null;
  var cells = [];
  for (var y = sel.y1; y <= sel.y2; y++) {
    for (var x = sel.x1; x <= sel.x2; x++) {
      var idx = editCellAt(palette, x, y);
      var w = idx >= 0 ? editStampWords(palette, idx) : null;
      if (!w) continue;
      cells.push({
        dx: x - sel.x1, dy: y - sel.y1,
        canopy: editPartFromWord(palette, w.layer1),
        terrain: editPartFromWord(palette, w.layer2),
        collision: w.collision,
      });
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

/**
 * Picking a tile means painting with it.
 *
 * The stamp tool places the armed *construct* and ignores the brush
 * entirely, so arming a widget and then clicking a tile left the click
 * going to the widget — "I'm not allowed to stamp a gourd tile" was the
 * editor still holding the last construct. Choosing a tile is choosing to
 * paint, so it says so.
 */
function editArmBrush() {
  var d = editDraft();
  if (!d) return;
  if (d.tool === 'stamp') d.tool = 'paint';
  _editConstruct = -1;
}

/**
 * Record what a placement owes the room beyond its metatiles.
 *
 * A gourd is art **plus** an object record **plus** a B-trigger pointing at
 * a script — 68 of the 532 library entries carry one. Keeping them here is
 * what makes a stamped gourd a working gourd rather than a picture of one.
 *
 * The script id is vanilla's, copied along with the art. That is what makes
 * the copy work the moment it is placed, and it is also why the note says
 * so: two copies of the same entry run the same script and therefore share
 * its "already opened" flag until one is pointed at a new one.
 */
function editStampedConstruct(construct, x, y) {
  if (!_edit) return;
  var a = construct.attachments || { bTrigger: [], stepOn: [], objects: [] };
  var extras = [];
  ['bTrigger', 'stepOn'].forEach(function (kind) {
    (a[kind] || []).forEach(function (t) {
      _edit.placed.push({
        kind: kind, x: x + t.dx, y: y + t.dy, w: t.w, h: t.h, scriptId: t.scriptId,
      });
      extras.push(kind === 'bTrigger'
        ? 'B-trigger on script 0x' + Number(t.scriptId).toString(16)
        : 'step-on trigger');
    });
  });
  (a.objects || []).forEach(function (o) {
    _edit.placed.push({
      kind: 'object', x: x + o.dx, y: y + o.dy, w: o.w, h: o.h, states: o.states || 1,
    });
    extras.push('an object record' + (o.states > 1 ? ' with ' + o.states + ' states' : ''));
  });

  editNote('placed ' + construct.name + ' at ' + x + ',' + y
    + (extras.length
      ? ' — with ' + extras.join(' and ')
        + '. The script is vanilla’s, so two copies share its flag.'
      : ' — metatiles only.'));
}

/**
 * The writes that stamp a construct with its top-left at (x, y).
 *
 * `{ writes, problems }`: a cell whose family cannot be found a slot is
 * skipped and named, because seven is a hard ceiling and half a gourd in
 * the wrong colours is worse than a refusal you can act on.
 */
function editConstructWrites(palette, construct, x, y) {
  var out = { writes: [], problems: [] };
  if (!construct) return out;
  var blank = editBlankCanopy(palette);
  var seen = {};

  for (var i = 0; i < construct.cells.length; i++) {
    var c = construct.cells[i];
    var cx = x + c.dx;
    var cy = y + c.dy;
    if (!editInBounds(palette, cx, cy)) continue;

    var here = editCellAt(palette, cx, cy);
    var under = here >= 0 ? editStampWords(palette, here) : null;
    var canopy = editWordFromPart(palette, c.canopy);
    var terrain = editWordFromPart(palette, c.terrain);
    var bad = (canopy && canopy.error) || (terrain && terrain.error);
    if (bad) {
      if (!seen[bad]) { seen[bad] = true; out.problems.push(bad); }
      continue;
    }

    out.writes.push({
      x: cx, y: cy,
      index: editAddStamp(palette, {
        // A null layer keeps the destination's own — the floor stays the
        // room's floor, which is what "agnostic of the background" means.
        layer1: canopy ? canopy.word : (under ? under.layer1 : blank),
        layer2: terrain ? terrain.word : (under ? under.layer2 : blank),
        collision: c.collision,
      }),
    });
  }
  return out;
}
