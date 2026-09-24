// Ownership: the map editor's **state** — what has been drawn, what has
// been composed, and the undo stack. No DOM, no markup: map-editor-ui.js
// draws it and map-editor-paint.js drives it.
//
// Nothing here writes to the ROM. An edit lives in this draft until it is
// exported; see docs/map-format/map_editor_ui.md §6 for where the draft
// plugs into the verified Python encoder.
//
// Owns: _edit. Only this file assigns to it.

/**
 * The draft for the room on screen.
 *
 * `cells` is keyed `"x,y"` in metatile coordinates (a metatile is 16px,
 * two units of the map's 8px grid). `added` are stamps the composer has
 * made: their index continues past the room's own dictionary, so index
 * `count + n` is `added[n]`, which is exactly how they would be appended to
 * Block 3.
 */
var _edit = null;

/** A fresh draft for a room. Discards whatever was being edited. */
function editReset(roomId) {
  _edit = {
    roomId: roomId,
    cells: {},        // "x,y" -> metatile index
    added: [],        // {layer1, layer2, collision}
    undo: [],
    redo: [],
    tool: 'paint',    // paint | pick | rect | copy | move | erase
    brush: -1,        // selected metatile index, -1 = none
    on: false,        // edit mode
    /**
     * The Special tab's own overlay: "x,y" -> a special id from
     * map-editor-special.js's catalog (e.g. "gate-dog", "entrance-n").
     *
     * Cosmetically independent of `brush`/`cells` — picking a tile does not
     * clear this, and picking a special does not clear the brush (the
     * mock's own note). Gate and drift picks *also* modify the cell's
     * stamp (a real collision-word write, see map-editor-special.js); this
     * map is what draws the glyph and is never exported — see editExport.
     */
    specialCells: {},
    /** The special armed for painting, or null. Set directly, like `tool`/`phase`/`brush`. */
    currentSpecialId: null,
    // Which question a stroke is answering. 'room' lays out the place
    // itself and writes all three words; 'deco' puts things *on* it and
    // keeps the floor that is already there. See editResolve.
    phase: 'room',
    /** Saved multi-cell constructs — see editSaveConstruct. */
    constructs: [],
    /**
     * Graphics the draft has pulled in that Block 1 did not load.
     *
     * Appended after the room's own list, so a graphic's slot is
     * `tiles.count + i` and its `chr` follows from that. Each one costs a
     * graphics slot, which is what the budget meter is counting.
     */
    addedGraphics: [],
    /**
     * What placed constructs owe the room beyond their metatiles.
     *
     * A gourd is art **plus** an object record plus a B-trigger pointing at
     * a script. Stamping only the art gives a picture of a gourd; these are
     * the other two, kept so the export can write them.
     */
    placed: [],
    /** A blank room being drafted instead of a ROM room, or null. */
    blank: null,
  };
  return _edit;
}

function editActive() { return !!(_edit && _edit.on); }
function editDraft() { return _edit; }
function editKey(x, y) { return x + ',' + y; }

/** How many stamps exist for this room, the room's own plus composed ones. */
function editStampCount(palette) {
  return (palette ? palette.count : 0) + (_edit ? _edit.added.length : 0);
}

/**
 * Apply a list of `{x, y, index}` writes as one undoable step, optionally
 * batched with a list of `{x, y, id}` writes to the Special tab's overlay
 * (`specialCells`).
 *
 * Batched rather than per-cell so a rectangle fill or a paste undoes in one
 * go, which is what makes "move the window back" a single keystroke — and
 * so that a single paint click carrying both a tile and a special (see
 * map-editor-special.js) undoes as one click too, not two.
 */
function editApply(writes, specialWrites) {
  if (!_edit) return 0;
  writes = writes || [];
  specialWrites = specialWrites || [];
  if (!writes.length && !specialWrites.length) return 0;
  var before = [];
  var changed = 0;
  for (var i = 0; i < writes.length; i++) {
    var w = writes[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.cells, k) ? _edit.cells[k] : null;
    if (was === w.index) continue;
    before.push({ x: w.x, y: w.y, index: was });
    _edit.cells[k] = w.index;
    changed += 1;
  }
  var specialBefore = [];
  for (var s = 0; s < specialWrites.length; s++) {
    var sw = specialWrites[s];
    var sk = editKey(sw.x, sw.y);
    var wasSpecial = Object.prototype.hasOwnProperty.call(_edit.specialCells, sk) ? _edit.specialCells[sk] : null;
    if (wasSpecial === sw.id) continue;
    specialBefore.push({ x: sw.x, y: sw.y, id: wasSpecial });
    if (sw.id === null) delete _edit.specialCells[sk];
    else _edit.specialCells[sk] = sw.id;
    changed += 1;
  }
  if (!changed) return 0;
  // The mark is how many attachments existed before this step, so undoing
  // a stamped gourd takes its object and its B-trigger with it.
  _edit.undo.push({ cells: before, special: specialBefore, placed: _edit.placed.length, dropped: [] });
  _edit.redo.length = 0;
  return changed;
}

/** Put a batch of `{x, y, index}` back, where `index === null` clears. */
function editRestore(batch) {
  var inverse = [];
  for (var i = 0; i < batch.length; i++) {
    var w = batch[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.cells, k) ? _edit.cells[k] : null;
    inverse.push({ x: w.x, y: w.y, index: was });
    if (w.index === null) delete _edit.cells[k];
    else _edit.cells[k] = w.index;
  }
  return inverse;
}

/** The `specialCells` counterpart to editRestore, where `id === null` clears. */
function editRestoreSpecial(batch) {
  var inverse = [];
  for (var i = 0; i < batch.length; i++) {
    var w = batch[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.specialCells, k) ? _edit.specialCells[k] : null;
    inverse.push({ x: w.x, y: w.y, id: was });
    if (w.id === null) delete _edit.specialCells[k];
    else _edit.specialCells[k] = w.id;
  }
  return inverse;
}

function editUndo(palette) {
  if (!_edit || !_edit.undo.length) return false;
  var step = _edit.undo.pop();
  var inverse = editRestore(step.cells);
  var specialInverse = editRestoreSpecial(step.special || []);
  // Everything the step attached, set aside so redo can put it back.
  _edit.redo.push({ cells: inverse, special: specialInverse, placed: step.placed, dropped: _edit.placed.splice(step.placed) });
  editPruneAdded(palette);
  return true;
}

function editRedo(palette) {
  if (!_edit || !_edit.redo.length) return false;
  var step = _edit.redo.pop();
  var inverse = editRestore(step.cells);
  var specialInverse = editRestoreSpecial(step.special || []);
  for (var i = 0; i < step.dropped.length; i++) _edit.placed.push(step.dropped[i]);
  _edit.undo.push({ cells: inverse, special: specialInverse, placed: step.placed, dropped: [] });
  editPruneAdded(palette);
  return true;
}

/**
 * Drop metatiles the draft no longer needs.
 *
 * Undoing the cells that used a composed stamp has to undo the stamp too,
 * or the dictionary keeps growing with entries nothing references and the
 * budget lies. Only the **tail** is dropped: an index is a position, so
 * removing from the middle would silently repoint every cell above it.
 *
 * The current brush is kept even when unplaced — you armed it on purpose,
 * and it is one entry.
 */
function editPruneAdded(palette) {
  if (!_edit) return;
  var base = palette ? palette.count : 0;
  var used = {};
  Object.keys(_edit.cells).forEach(function (k) { used[_edit.cells[k]] = true; });
  while (_edit.added.length) {
    var index = base + _edit.added.length - 1;
    if (used[index] || _edit.brush === index) break;
    _edit.added.pop();
  }
  if (_edit.brush >= base + _edit.added.length) _edit.brush = -1;
  editPruneGraphics(palette);
}

/**
 * Drop adopted graphics no surviving stamp names.
 *
 * Same tail-only rule, and for the same reason: a graphic's slot is its
 * position in the list, so the words already written would point at the
 * wrong picture if one were removed from the middle.
 */
function editPruneGraphics(palette) {
  if (!_edit || !palette || !palette.tiles) return;
  var base = palette.tiles.count;
  var highest = -1;
  for (var i = 0; i < _edit.added.length; i++) {
    var a = _edit.added[i];
    for (var j = 0; j < 2; j++) {
      var chr = (j ? a.layer2 : a.layer1) & 0x3ff;
      var slot = Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2);
      if (slot >= base && slot - base > highest) highest = slot - base;
    }
  }
  _edit.addedGraphics.length = highest + 1;
}

/**
 * Add a composed stamp, or return the index of an identical one.
 *
 * Reuse first, because a dictionary entry is not free: an editor that
 * appends on every click turns a 500-entry dictionary into thousands. The
 * room's own spare slots are offered separately by the UI; this only
 * deduplicates within the draft.
 */
function editAddStamp(palette, draft) {
  if (!_edit) return -1;
  var base = palette ? palette.count : 0;
  for (var i = 0; i < _edit.added.length; i++) {
    var a = _edit.added[i];
    if (a.layer1 === draft.layer1 && a.layer2 === draft.layer2 && a.collision === draft.collision) {
      return base + i;
    }
  }
  // An exact match already in the room costs nothing at all.
  if (palette) {
    for (var j = 0; j < palette.count; j++) {
      var e = palette.entries[j];
      if (e[1] === draft.layer1 && e[2] === draft.layer2 && e[3] === draft.collision) return j;
    }
  }
  _edit.added.push({ layer1: draft.layer1, layer2: draft.layer2, collision: draft.collision });
  return base + _edit.added.length - 1;
}

/** The three words of a stamp, whether it is the room's or the draft's. */
function editStampWords(palette, index) {
  var base = palette ? palette.count : 0;
  if (index >= base) {
    var a = _edit && _edit.added[index - base];
    return a ? { layer1: a.layer1, layer2: a.layer2, collision: a.collision, added: true } : null;
  }
  var e = palette && palette.entries[index];
  return e ? { layer1: e[1], layer2: e[2], collision: e[3], added: false } : null;
}

/**
 * The `chr` a tilemap word needs to name Block 1 slot `slot`.
 *
 * `renderVramLayer` resolves chr to a slot with
 * `floor(chr/0x20)*8 + floor((chr%0x20)/2)`; this is that inverted.
 */
function editSlotChr(slot) {
  return (slot >> 3) * 0x20 + (slot & 7) * 2;
}

/**
 * Make sure a graphic is in reach, and say which slot it landed in.
 *
 * A graphic the room never loaded cannot be named by any word, so picking
 * one out of a family's art has to add it to Block 1 first. Already-loaded
 * graphics cost nothing and keep their slot.
 */
function editAdoptGraphic(palette, graphicId) {
  if (!_edit || !palette || !palette.tiles) return -1;
  var slots = palette.tiles.slots;
  for (var i = 0; i < palette.tiles.count; i++) {
    if (slots[i][2] === graphicId) return i;
  }
  var already = _edit.addedGraphics.indexOf(graphicId);
  if (already >= 0) return palette.tiles.count + already;
  _edit.addedGraphics.push(graphicId);
  return palette.tiles.count + _edit.addedGraphics.length - 1;
}

/**
 * Turn a picked tile into a brush.
 *
 * This is the inverted flow's smallest step: click a grass tile, get
 * something you can immediately stamp. The metatile is created here rather
 * than composed by hand, and **the other two words start empty** — a bare
 * graphic says nothing about what is drawn over it or what is solid, so
 * inventing either would be a guess. They are set later, by painting in
 * deco phase or by editing the collision.
 *
 * Which word the tile becomes follows the phase, so the brush works with
 * `editResolve` rather than against it: laying out a room puts the tile on
 * the ground, decorating puts it over whatever ground is already there.
 */
function editBrushFromTile(palette, word, phase, prefer) {
  if (!_edit || word == null) return -1;
  var blank = editBlankCanopy(palette);
  // The phase is the user's intent, but the art has an opinion too: a
  // graphic with transparent pixels is meant to have something show
  // through it. 4822 of 5628 vanilla graphics are drawn on one layer at
  // least 90% of the time, so where that is known it decides, and the
  // phase only breaks the tie.
  var canopy = prefer ? prefer === 'canopy' : phase === 'deco';
  var stamp = canopy
    ? { layer1: word, layer2: blank, collision: EMPTY_COLLISION }
    : { layer1: blank, layer2: word, collision: EMPTY_COLLISION };
  var index = editAddStamp(palette, stamp);
  _edit.brush = index;
  return index;
}

/**
 * The collision a freshly made stamp starts with.
 *
 * Zero is "plane 0, geometry open" — walkable, no gates, no drift. It is
 * the honest empty: the format's do-nothing value rather than a guess at
 * what this tile ought to block.
 */
var EMPTY_COLLISION = 0x0000;

/**
 * The stamps this draft needs that the room does not already define.
 *
 * The "metatiles calculated to be needed by the creation" — every composed
 * stamp, plus what it costs. Placing the same construct twice adds nothing,
 * because `editAddStamp` deduplicates first.
 */
function editNeededStamps(palette) {
  if (!_edit) return { added: [], bytes: 0 };
  var base = palette ? palette.count : 0;
  return {
    added: _edit.added.map(function (a, i) {
      return { index: base + i, layer1: a.layer1, layer2: a.layer2, collision: a.collision };
    }),
    bytes: _edit.added.length * 8,
  };
}

/**
 * The draft as the shape `rebuild_model` wants.
 *
 * Cell writes are grid coordinates and metatile **ids**, because that is
 * what `layer1_metatile_ids` holds; composed stamps are appended to the
 * Block 3 slices in order. Nothing here applies it — this is the handover
 * format, and the write itself needs a confirmation the extension does not
 * have yet.
 *
 * `specialCells` is deliberately absent. A gate or drift pick already made
 * its real effect here — it modified the cell's stamp, which is exactly
 * what `cells`/`appendMetatiles` already carry — so `specialCells` itself
 * is only the glyph overlay, never a second source of truth for it.
 * Stairs and entrance carry no ROM effect at all (see map-editor-special.js
 * and docs/map-editor-redesign-plan.md §5.1): entrance is a room-metadata
 * placement helper with no confirmed encoder field to write into, and
 * stairs has no attested collision encoding. Both stay visual-only until
 * one of those is confirmed.
 */
function editExport(palette) {
  if (!_edit) return null;
  var base = palette ? palette.baseMetatile : 0;
  var count = palette ? palette.count : 0;
  var cells = [];
  Object.keys(_edit.cells).forEach(function (k) {
    var p = k.split(',');
    cells.push({ x: Number(p[0]), y: Number(p[1]), metatileId: base + _edit.cells[k] * 8 });
  });
  cells.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  return {
    roomId: _edit.roomId,
    baseMetatile: base,
    originalMetatileCount: count,
    cells: cells,
    appendMetatiles: _edit.added.map(function (a) {
      return { layer1: a.layer1, layer2: a.layer2, collision: a.collision };
    }),
    // Graphics Block 1 has to gain for the words above to resolve, and the
    // objects and triggers the stamped constructs need to actually work.
    appendGraphics: _edit.addedGraphics.slice(),
    // The draft's own copy, not `editFamilies()`: this file owns `_edit` and
    // reaching into the families panel from here would invert that.
    families: (_edit.families || []).slice(),
    attachments: _edit.placed.slice(),
  };
}
