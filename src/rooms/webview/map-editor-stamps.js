// Ownership: the stamp dictionary — composing and deduplicating the draft's
// own metatile combinations, and adopting graphics into Block 1 so a word
// can name one it did not start with.
//
// Split out of map-editor.js, which was pushing 400 lines once Phase 4's
// trigger-selection undo support landed (docs/map-editor-redesign-plan.md):
// this is a coherent slice — "what a stamp is made of and how one gets
// added" — with no undo-stack logic of its own. Everything here still reads
// and writes `_edit` (via `editDraft()`), the same way map-editor-special.js
// and map-editor-families.js already do without owning `_edit` themselves.

/** How many stamps exist for this room, the room's own plus composed ones. */
function editStampCount(palette) {
  return (palette ? palette.count : 0) + (_edit ? _edit.added.length : 0);
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
 *
 * `animUid` is the animation group the slot must move with, or null/absent
 * for a still slot (map-editor-animations.js): a slot animates for every
 * cell naming it, so a still frame and an animated copy of the same graphic
 * need a slot each.
 */
function editAdoptGraphic(palette, graphicId, animUid) {
  if (!_edit || !palette || !palette.tiles) return -1;
  var want = animUid == null ? null : animUid;
  var moves = function (slot) {
    var g = typeof editAnimOfSlot === 'function' ? editAnimOfSlot(palette, slot) : null;
    return g ? g.uid : null;
  };
  var slots = palette.tiles.slots;
  for (var i = 0; i < palette.tiles.count; i++) {
    if (slots[i][2] === graphicId && moves(i) === want) return i;
  }
  for (var j = 0; j < _edit.addedGraphics.length; j++) {
    if (_edit.addedGraphics[j] === graphicId && moves(palette.tiles.count + j) === want) return palette.tiles.count + j;
  }
  _edit.addedGraphics.push(graphicId);
  var slot = palette.tiles.count + _edit.addedGraphics.length - 1;
  // A slot pruned and taken again keeps no binding from before; an animated one is bound
  // now (frame 0 held throughout until its frames are set), so the next cell finds it.
  (_edit.anims || []).forEach(function (g) {
    if (g.uid !== want) delete g.channels[slot];
    else g.channels[slot] = g.delays.map(function () { return graphicId; });
  });
  return slot;
}

/**
 * Turn a picked tile into a brush.
 *
 * This is the inverted flow's smallest step: click a grass tile, get
 * something you can immediately stamp. The metatile is created here rather
 * than composed by hand, and **the other two words start empty** — a bare
 * graphic says nothing about what is drawn over it or what is solid, so
 * inventing either would be a guess. They are set later, by painting over an
 * existing terrain or by editing the collision.
 *
 * Which word the tile becomes decides how `editResolve` will treat it later
 * (map-editor-phases.js, §8a.2): a graphic that lands in the canopy word
 * paints as a decoration over whatever is already there; one that lands in
 * the terrain word paints as the ground, replacing the cell outright.
 *
 * `prefer` is `'canopy'`/`'terrain'`/undefined — `_layerForce`'s explicit
 * override, or `editLayerPreference`'s reading of how vanilla draws this
 * graphic (map-editor-families.js), whichever the caller has. With neither
 * (a graphic with no vanilla placement data at all, picked with
 * `_layerForce` at `'auto'`) this lands on the *ground*: the same bias
 * `editReset`'s own former default phase (`'room'`) already gave an
 * unlabelled pick, and this file's own "draw the room, then fill it with
 * deco" ordering — not a new threshold invented for this case.
 */
function editBrushFromTile(palette, word, prefer, collision) {
  if (!_edit || word == null) return -1;
  var blank = editBlankCanopy(palette);
  var canopy = prefer === 'canopy';
  var cw = collision == null ? EMPTY_COLLISION : collision;
  var stamp = canopy
    ? { layer1: word, layer2: blank, collision: cw }
    : { layer1: blank, layer2: word, collision: cw };
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

// Moved from map-editor.js (400-line limit): pruning is the dictionary's own
// housekeeping, called by editUndo/editRedo there.
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
  // What the map shows, stamped groups included (map-editor-groups.js).
  var shown = typeof editBakedCells === 'function' ? editBakedCells(palette) : _edit.cells;
  Object.keys(shown).forEach(function (k) { used[shown[k]] = true; });
  Object.keys(_edit.cells).forEach(function (k) { used[_edit.cells[k]] = true; });
  // The cuttable layer's stamps are just as placed (map-editor-cutlayer.js).
  Object.keys(_edit.cut || {}).forEach(function (k) { used[_edit.cut[k]] = true; });
  // So are an object's tiles (map-editor-objects.js).
  if (typeof editObjectStamps === 'function') editObjectStamps().forEach(function (i) { used[i] = true; });
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
 * All three stairs are drift-style writes too (bit 13 + nibble 1, 2 or 0).
 * Entrance carries no ROM effect at all (see map-editor-special.js and
 * docs/map-editor-redesign-plan.md §5.1): it is a room-metadata placement
 * helper with no confirmed encoder field to write into.
 *
 * `removedTriggers` is the Select tool's counterpart to `attachments`: a
 * base trigger this draft hid (deleted, or moved — a move hides the base one
 * and adds a new `attachments` entry for the moved position). Soft-deleted
 * `placed` entries (`removed: true`, from deleting a placed trigger — see
 * map-editor-trigger-select.js) are dropped here rather than exported as
 * attachments nobody asked for.
 */
function editExport(palette) {
  if (!_edit) return null;
  var base = palette ? palette.baseMetatile : 0;
  var count = palette ? palette.count : 0;
  var cells = [];
  // Stamped groups are kept apart from the map; the export bakes them in.
  var shown = typeof editBakedCells === 'function' ? editBakedCells(palette) : _edit.cells;
  Object.keys(shown).forEach(function (k) {
    var p = k.split(',');
    // Cells past a shrunk map's edge are kept, not exported.
    if (palette && palette.widthTiles && !editInBounds(palette, Number(p[0]), Number(p[1]))) return;
    cells.push({ x: Number(p[0]), y: Number(p[1]), metatileId: base + shown[k] * 8 });
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
    attachments: _edit.placed.filter(function (p) { return !p.removed && p.roomObject == null; }),
    // The room's own objects as the draft has them (map-editor-objects.js's
    // editSeedRoomObjects) — already in the ROM, so not new attachments.
    roomObjects: _edit.placed.filter(function (p) { return p.roomObject != null; }),
    removedTriggers: (_edit.removedTriggers || []).slice(),
    // Header fields set on the Info tab, over the room's own (map-editor-info.js).
    header: _edit.header ? JSON.parse(JSON.stringify(_edit.header)) : null,
    // Collision shapes set by hand, over the cells' own (map-editor-collision-tab.js).
    collisionOverrides: typeof editCollisionPayload === 'function' ? editCollisionPayload() : [],
  };
}

/**
 * A history entry for a cell: its stamp index, plus the stamp's words when
 * it is one the draft added. Undo prunes added stamps nobody uses, and the
 * history is kept for good (docs/map-format/custom-map-files.md §3), so an
 * entry must be able to bring its stamp back rather than trust the index.
 */
function editStampRef(x, y, index, layer) {
  var ref = { x: x, y: y, index: index, layer: layer };
  if (layer === 'coll' || layer === 'collDraw') return ref; // a code or a drawing, not a stamp
  var words = editAddedWords(index);
  if (words) ref.words = words;
  return ref;
}

function editAddedWords(index) {
  if (index == null || typeof _mtPalette === 'undefined' || !_mtPalette || index < _mtPalette.count) return null;
  var w = typeof editStampWords === 'function' ? editStampWords(_mtPalette, index) : null;
  return w ? { layer1: w.layer1, layer2: w.layer2, collision: w.collision } : null;
}

/** The index to write for a history entry: its own, or its stamp added again. */
function editStampResolve(index, words) {
  if (index == null || !words || typeof _mtPalette === 'undefined' || !_mtPalette) return index;
  var w = editStampWords(_mtPalette, index);
  if (w && w.layer1 === words.layer1 && w.layer2 === words.layer2 && w.collision === words.collision) return index;
  return editAddStamp(_mtPalette, words);
}
