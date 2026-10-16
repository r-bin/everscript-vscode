# Map editor reference

The detail behind the `map-editor-rules` skill (`.agents/skills/map-editor-rules/SKILL.md`): the two
16-bit words, custom maps, everything the editor writes and how, and a vanilla room in the editor.
The skill holds the rules; this file holds what they mean in the code. Keep the two in step.

## 1. The two 16-bit words, which are not the same word

A common and expensive confusion. **Bit 13 means different things in each.**

### Tilemap word (what a stamp's `layer1`/`layer2` hold)

```
15  14  13  12 11 10  9 ............ 0
 V   H   pr  [ palette ]  [    chr    ]
```
- **bits 0..9** — `chr`, the character index. `chr → Block 1 slot` is
  `floor(chr/0x20)*8 + floor((chr%0x20)/2)`; `editSlotChr` is that inverted.
- **bits 10..12** — palette, i.e. **which of the room's seven family slots**, stored as
  `slot + 1`. Zero is the HUD's.
- **bit 14 (`0x4000`)** — horizontal flip. **bit 15 (`0x8000`)** — vertical flip.
  `renderVramLayer` reads these back per word, so a mirrored word needs no second
  render path. Mirroring is **geometry, not identity**: it costs one dictionary entry
  and **no graphics slot**, because the graphic id is unchanged. Free art against a
  ceiling of seven families — worth offering.

### Collision word (a stamp's third value)

```
 ?  AW   ?  [ entity gate ]  0  PT [pln] [geometry]
15  13      11 .......... 8      6  5..4   3..0
```
- **bits 3..0** — sub-tile geometry, **or a drift direction when bit 13 is set**.
- **bits 5..4** — elevation plane, 0..3. **bit 6** — plane-transparent.
- **bits 11..8** — entity gate, active when bit 8 is set.
- **bit 13 (AW)** — always-walkable; the low nibble becomes drift instead of geometry.

`docs/map-format/map_collision_mechanics.md` is the authority and its §8 lists what an
earlier version of this codebase got *wrong* — read it before adding a collision
feature.


## 2. A custom map: its own room, empty, with exactly one Boy

`+ New Map` makes a **custom map**: a new row under Custom rooms, with its own name
and its own draft (`_edit.customKey`, map-editor-custom.js), one SNES screen (16×14
tiles) to start. It is never a draft laid over a ROM room, and never selects one in
the Vanilla list: *only a vanilla room is in the vanilla list.*

It borrows a donor room (`0x34`) for its graphics list and families (rule 7.1: a
room with no Block 1 renders black), and **nothing else**:
- The donor is `_edit.roomId`, the key the host's tile requests use. It is not the
  room on screen: the detail panel's name, header and rail row are the custom map's,
  and `requestRoomTileOverlay` refuses a custom room, so the donor's picture is
  never rendered under it.
- No donor *content*. The grid is `emptyStamp`, and `editClearDonorScenery`
  removes the donor's NPCs, doors, triggers and markers from the canvas. Any new
  overlay svg-builder draws for a room belongs in its `DONOR_SCENERY` list.
- **Exactly one Boy start** (`_edit.start`), always inside the map. It is
  placed on arrival, clamped on resize, and moved only by `editMoveStart` (an
  undo step). It is never a `specialCells` entry, and erase must never reach
  it. ROM rooms have no start marker; their entrances are their doors.

**A room is never smaller than one screen (16×14).** Below that the game draws it scrambled: the engine's first tilemap upload reads outside the grid, while every check on the blob still passes (rom-export.md). So the resize grip stops at 16×14, the host drafts nothing smaller (`MIN_WIDTH`/`MIN_HEIGHT`, blank-room.ts; an older smaller map opens grown, cells kept), and the encoder refuses one. **A widget's canvas is exempt**: it is never a room, so it still goes down to 1×1 (`minTiles: 1`).

**Resizing a custom map never deletes cells.** Past a smaller map's edge they stay in `_edit.cells`, undrawn and not encoded (the ROM export reads the grid; `editExport` skips them), so growing it again brings them back. A ROM room does not resize at all: its dictionary starts right after the grid.

---

A custom map is saved by the host as its own folder — `map.json` (draft *data*:
cells, stamps, graphics, families, start, groups, level) and `history.json` — in the
extension's global storage (docs/map-format/custom-map-files.md). Not in `uiPrefs` any
more; old maps there are migrated. `+ New Map` reopens an untouched map rather than
making another. The webview is
rebuilt whenever the active document changes, and a map lost with it was never a map.

## 3. What the editor may and may not write

**A custom map has one ROM write path: Export ROM** (docs/map-format/rom-export.md,
`maps/custom-room.ts`). It writes the grid, the dictionary, Block 1, the cuttable
table (Section 4), animated tiles (Section 2, `maps/custom-animation.ts`) and objects
(Section 3: each descriptor is state s+1 XOR state s, never XOR state 0, since the
engine applies them one after another). It writes **no triggers or scripts** yet. Its check decodes the result again
and compares, so anything added to it must be added to the check as well. A vanilla
room's draft still only has `editExport()`, a handoff shape for the sibling repo's
encoder. Before wiring a new kind of edit into either, confirm what the format
accepts. Entrances, for instance, are **room metadata, not tile-grid state**, and
have no slot today. A vanilla trigger script is not portable either: a gourd's names
its room's object number and a shared flag.

Undo is one history for everything — cells, specials, triggers, objects, groups
(stamp, move, delete, disband), the header, the Boy, the family slots and a
resize (map-editor-history.js) — **one step per gesture** (a drag, however many
cells it crosses; a group move; a stamp), and it is **saved with the map for good**
(`history.json`, docs/map-format/custom-map-files.md §3). A history entry that names
an added stamp carries its words too (`editStampRef`), because pruning may drop the
stamp and the entry must be able to bring it back. Wrap any multi-write operation in
`editBegin`/`editEnd` rather than calling `editApply` several times. **Not** on it:
a map's or widget's name, and view choices (tool, tab, level bar, chips, which
object state is shown).

**Disbanding writes what the cells show**, the groups beneath included, and those
groups give the cells up: the map is drawn under every group, so a widget written
alone into it vanished under a pasted floor it was stamped on. A placed widget's
tiles are locked like its parts: the eraser refuses them until it is disbanded.

Every tile write lands on the **level** picked in the left bar (collision bits 5..4,
`editOnLevel`); level 1 is the default. A stamped construct or widget is a **group**
(map-editor-groups.js): moved and deleted whole, restoring what it covered. A stamp
takes the level of the **floor it lands on** (`editFloorLevel`, the covered cells'
most common level), and the bar's only on open ground. A gourd on a level-2 plateau
is a level-2 gourd.

A group is **stored apart from the map** and never written into `_edit.cells`
(`g.cells` holds its own words, null for "the map's"). What a cell shows is the
map's cell with every group there over it, in order, each over what is under it
(`editCellAt` → `editGroupOver`; the map alone
is `editBaseCellAt`), and only drawing and the exports bake it in
(`editBakedCells`). So a gourd stamped into a hut moves or deletes without
touching the hut, and its states sit on the floor under them
(`editObjectFrameIndex`). Anything new that reads "the map as it shows" must go
through `editCellAt`/`editBakedCells`, not `_edit.cells`. Those composed stamps
are made on the fly, so the preview sheet must be asked for them
(`requestComposedPreview` makes them first; `ensureComposedPreview` after each
draw) — or they draw as nothing, a gourd missing tiles. A stamped object
shows **state 0** until a state is picked (`activeFrame: 0`).

The Widgets tab has two views: **Library** (what can be stamped) and **Placed**
(map-editor-placed-list.js: `_edit.groups`, whose order is the draw order). A
placed widget's triggers and objects are **locked** to it (`editGroupLocks`):
moved and removed whole. **Disband** (`editGroupDisband`) writes it into the map
and lets its parts go.

**A collision shape set by hand is a layer too** (`_edit.coll`, the Collision tab,
map-editor-collision-tab.js): a geometry code per cell over the estimate the
tile's stamp carries. It is never baked into the stamp — erasing it brings the
estimate back — and is applied only where a word leaves the editor
(romExportPayload, editExport's `collisionOverrides`). It sets bits 3..0 and
clears bit 13 (under it the nibble is drift, not shape); level, gate,
see-through and interact stay the cell's. All 16 codes exist; "used in vanilla"
(default on, `vanillaGeometry` from the vanilla index) hides 0x04 and 0x0B, which
no room places and the engine's tables treat as open. The diagonal twins differ
in the per-code tables read after `$909DE8` — `$8FA3F8` (open compass points:
three for 0x02/0x01/0x0E/0x0D, one for 0x06/0x05/0x0A/0x09) and `$8FA418` (a
slide entry only for the three-point twin) — labelled "slides"/"stops", which is
a reading of those tables, not confirmed in game. **One pen**: the list's first entry
is the 8px pen, the default; it draws (left) and carves (right) 8px squares into the
collision the cell has *now* — the prediction or a shape set earlier — and keeps the
drawing as drawn (`_edit.collDraw`). A cell takes a code only while its quarters match
a tile (`collCodeOfQuarters`: none open, all four, two along a side, an L of three); a
lone corner or opposite corners match none — drawn with a "?", the cell keeps its own,
never rounded. A diagonal keeps the twin the cell had (`COLL_STOP`), else the sliding
one. A picked shape sets whole cells; right-click with it opens one. The eraser is
"back to the prediction". A cell holds a picked shape or a drawing, not both.
The Special tab's flags stay there: they sit on top of a shape.

**Layers over the map.** The cuttable layer (`_edit.cut`) and each object's `layer`
(its changed look, map-editor-objects.js) hold stamps drawn *on top of* the map's own
cells. They are never written into `_edit.cells`. Each is shown only while its
control is on: the Cuttable chip, or the Object tab. Every stamp either one uses
must count as in use for pruning and for the family sync.

**An object steps, it does not jump** (map-editor-object-holds.js). A script setting
a state walks the object there one state at a time, and byte 0 of each descriptor —
once read as a width, it is not one — is how many 60 Hz ticks that state is held on
the way through (`o.holds[s]`, map_objects.md §4c). State 0 to 1 is always one
tick (the countdown starts at zero), shown as a greyed-out `1`; the last state has
nothing after it, so no box. Holds travel with their state when frames are
added, moved or removed; a vanilla object's come from the ROM, a new state's is 1.
Play on the tab is `0x7e` from the start: it shows state 0, then steps to the last
state as the engine would (first step on the next tick, then each hold), once — no
loop, and never back down.

**Widgets** (map-editor-widgets.js) are portable constructs in one library file every
map shares. Their cells are `{graphic, family, flags, anim}` per layer, or `null` for "keep
the floor". Never store a raw word in a widget unless no room could explain it: a
word is room-relative. A widget is its cells: no frames and no hand-made variations.
Its colourings are **derived** (map-editor-widget-colours.js) from every family vanilla
draws any of its graphics in (`graphicFamilies`, sent by the host), never stored, and
a colouring recolours its object states too.

**An animated tile is one channel** (map-editor-animations.js, the Animation tab). A
Section 2 channel swaps the graphic in one tile slot, so every cell naming that slot
changes together and a cell has no clock of its own. A slot moves exactly while an
animated tile (`_edit.anims`, one entry per channel) names it with frame 0 equal to
the slot's graphic. Never decide "it animates" from the graphic: a frame picked on its
own (`frames` view) is a **still** tile; a ▶ swatch is the same as placing an animated
tile from the Animation tab, at its family's most-used vanilla pattern. One graphic may
sit in several slots (still, and one per animated tile). Two copies on different ticks
are two animated tiles. A new animated tile starts as empty purple frames and works —
gets a channel — only once every frame has a tile. Vanilla's patterns for a cycle are
lettered A, B, C… in one global order (most-used first); a tile's letter is the pattern
its ticks match, else `custom`; patterns are offered only for frames vanilla runs.
Vanilla animated tiles (a ROM room's, a ▶ pick's) are locked to their frames until
disbanded. Animation on/off is map-wide and saved. Animation marks are `--rg-anim`
(violet). The canvas and the ROM export both read `editAnimChannels`. No channel cap in
the UI: Section 2's count is one byte (255); vanilla runs at most 42, more is untested
in game. A frame holds at most **127 ticks** (vanilla's maximum, 40
frames at exactly 127): a longer hold is one graphic over several frames, and the tab
shows frames holding one graphic in a row as one (`editAnimRuns`). The tab lists every
**placement** (a run of touching cells showing a tile, `editAnimsListed`): a tile used
ten times is ten rows sharing one channel. A cell with no stamp (a custom map's
untouched cell) takes an animated tile as the empty stamp, blank on both layers.
A pencil rectangle on the Animation tab is a **set** (`set` on each entry,
map-editor-anim-sets.js): one animated tile — one channel — per cell, sharing ticks,
countdown and frame count, listed as one row. Vanilla's patterns come from *every*
cycle a graphic runs in (`animations.cycles`, not only `byFirst`), so a ROM room's
own channel always has its letter. The select tool drags a placement to new cells
(one undo step). Tile, Collision and Animation are sub-tabs of the `Tile` tab
(map-editor-tabs.js `EDIT_TILE_SUBTABS`); each is still its own `_editActiveTab`. The table travels with the palette (`cycles`,
vanilla-index.js `vanillaCycleTimings`), so letters never depend on which family sheets
are loaded: a vanilla channel is never `custom`. Touching animated cells running the
same pattern (same ticks, same countdown) are one row and one outline on the map,
with a dotted bounding box when the shape is not a rectangle; an edit on that row
changes every tile in it (`editAnimGroup`). A frame is one
graphic, not a stamp: the Tile tab's pencil on an unfinished tile's cell tiles a frame,
never the map beneath, and the frame being looked at is drawn over the cell
(map-editor-anim-map.js). Every animated cell carries a violet border and its pattern
letter (`*` custom) while the filter bar's `Animation` chip is on (default, saved).

 Cell writes, special-glyph writes, trigger
operations and start moves all go through `editApply`/`editApplyTriggerOp`/
`editMoveStart` and share `_edit.undo`. Do
not add a second stack — a user pressing undo means "the last thing I did", whatever
kind of thing it was.

---

## 4. A vanilla room in the editor: the same editor, not a second one

Editing a ROM room must look and behave like editing a custom map. What that
took, so none of it comes undone:

- **A palette belongs to one room.** A custom map's palette is its donor's,
  reshaped into the blank map, and keeps the donor's `roomId` — so it is marked
  `customBlank`, and `mtPaletteFits` refuses it for the donor opened as a ROM
  room. Without that, the ROM room drew with the custom map's grid, size and
  families.
- **A step-on trigger needs collision bit 14 under it.** The engine only searches
  the step-on table while the player stands on a bit-14 cell (`$8FB07B`,
  `map_collision_mechanics.md` §7.2); a box with none never fires by walking. So
  adding or moving a step-on box must set bit 14 on its cells (and moving one
  must clear the old ones). It is a special like Interact (bit 15): the Special
  tab's **Step-on** group forces it (S1/S0), the Special menu's **Step-on** chip
  overlays it (`S`), the special eraser clears it, and the Info tab's Map checks
  list every step-on box with no bit-14 cell (`editDeadStepTriggers`,
  map-editor-flag-overlays.js). Nothing sets it automatically yet.
- **Trigger records are not grid cells.** They count from the header's origin
  and their far edge is exclusive (`collision-overlay.ts`). The palette hands
  the editor inclusive map cells (`mapCellBox`); anything else reading
  `room.triggers` must convert the same way (the deco catalogue does).
- **Objects are the room's own, editable.** The host sends each object's area
  (the union of every delta's footprint — never the first one's) and its states
  as frames of dictionary indices (`editorObjects`). `editSeedRoomObjects` puts
  them in the draft once, outside any undo step, at state 0. They export as
  `roomObjects`, not as new attachments.
- **The editor draws, the render does not.** While a ROM room is edited
  (`editOnRomRoom`), the render leaves out its baked drift, gates, objects,
  triggers and labels (`romOverlayFlags`), and the editor draws the room's
  triggers, objects and — read off each cell's collision word — its specials,
  with the Special tab's own glyphs. Marks go in `#rg-edit-overlay`: a ROM room
  has a canopy picture (`#rg-fg`) above `#rg-edit` that hides anything there.
  That picture is frame 0 and still, so it must never cover what moves or what the
  draft changed: with animation on the host cuts every animated cell out of it
  (`clearAnimatedCells`, tile-overlay.js `foregroundFor`), and the editor masks it
  off every painted cell (`editCanopyMask`, map-editor-paint.js). Animation frames
  are opaque over their cells (the map's own backdrop), so frame 0 in the map
  image cannot show through a later frame. The editor's Animation on/off stops a
  ROM room's frames too (`roomAnimateOn`, rom-overlay.js).
- **The grid covers the map, not the viewBox**, counted from the map's corner.
- **Every map opens in the editor; there is no `edit` button.** The bar's `locked`
  is the one switch (`_edit.locked`, `editLocked`): a vanilla room opens locked —
  look, pick, copy and select, nothing that writes (strokes, undo, paste, delete and
  the dock's changing buttons are refused) — and unlocking lets its draft change. A
  custom map opens unlocked.
- **The bar's chips work on what the editor draws**: Triggers hides the triggers and
  their loot icons (a B-trigger's script is where the loot is), Special the glyphs,
  Interact the bit-15 overlay, Cuttable the room's own cuttable grass
  (`editRoomCutSvg`). So none of those may be baked into the render while editing.
