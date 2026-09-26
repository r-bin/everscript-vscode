---
name: map-editor-rules
description: The hard rules the map editor must obey — the seven tile-family slots and the other ROM budgets, the tilemap-word and collision-word layouts, what a stamp is and what painting/erasing does to one, and the "never invent data the ROM does not have" rule that several shipped bugs came from breaking. Read before changing anything under src/rooms/webview/map-editor*.
applyTo: "src/rooms/webview/map-editor*,src/rooms/rendering/room-draft.js,src/rooms/rendering/vanilla-index.js"
---

# Map Editor Rules

The editor draws into a format with hard ceilings and a specific word layout. Most of
the bugs that have shipped in it were not logic errors — they were a control offering
something the format cannot do, or a number invented to fill a gap in what the ROM
actually attests. This is the list of what is true, so neither happens again.

Format detail lives in `rom-map-data` and `docs/map-format/`. This skill is what the
*editor* has to honour.

---

## 1. Budgets — every one of these is a hard ceiling

| Budget | Limit | What spends it |
|---|---|---|
| **Tile families** | **7** | A palette slot. The loader clamps to seven; an eighth never loads |
| Graphics (Block 1) | 264 slots | Adopting a graphic the room did not already load |
| Stamp dictionary | 8 bytes per stamp | Every *distinct* `{canopy, terrain, collision}` combination |
| Grid + dictionary | 32768-byte WRAM window | Both together — a big grid leaves less dictionary |
| Step / B triggers | 6 bytes per entry | Each trigger, in its own table |

**The seven families are the constraint the UI has to respect everywhere**, not just
report. A palette field in a tilemap word is `1..7` and indexes *that room's* slots, so
a family is not a global id the editor can hand out freely — it is one of seven
decisions about what the room can look like.

Consequences that have already come up:
- With all seven slots full, **do not offer families outside them.** There is no slot
  to adopt into, so candidates are noise. Show them only when a slot is free.
- Adoption is implicit: clicking a tile from an unadopted family pulls that family in
  behind it. An explicit "add a family" browser is redundant with that.
- While a slot is free, the Tile tab lists **every** family with **all** its art,
  lazily, never behind a pager or a collapse. And a click must not move what was
  clicked: groups keep their place in the list when their family is adopted, and
  the scroll position survives the redraw. A custom map starts at 0/7.
- Freeing a slot **strands** every placed cell whose word names it. The word still says
  "palette slot N" and slot N is now something else. Say so (`editStrandedCells`), and
  offer to re-adopt or clear — never silently recolour.

---

## 2. The two 16-bit words, which are not the same word

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

---

## 3. A stamp, and what a stroke does to one

A stamp is `{layer1: canopy, layer2: terrain, collision}` — one dictionary entry.

- **The blank canopy is derived, never hardcoded.** `editBlankCanopy` takes the room's
  most-placed canopy word. It is `$A800` in every room measured, and it is still
  derived, because "no decoration here" is a fact about the room.
- **Reuse before appending.** `editAddStamp` is find-or-create: an identical combination
  already in the room costs nothing. An editor that appends per click turns a 500-entry
  dictionary into thousands.
- **The dictionary is implicit.** Stamps are created as a byproduct of painting; do not
  make the user manage them. A manual "new metatiles" list and a hand-composer were
  both removed for this reason.

**The pencil draws the open tab's pick, and only that** (`map-editor-drawable.js`):
the Tile tab's tile, the Special tab's special, a new trigger box on the Trigger tab
(B first), on the Object tab a new object's area or the selected object's tiles, the
Widgets tab's widget. Info keeps the last tab's. Arming a widget selects the *pencil*,
never the old Stamp tool: Stamp stamps on every tab. The eraser follows the
same choice. A click never carries two drawables. Before this rule, an armed stairs
special rode along with every tile stroke.

**What a stroke writes is read off the brush, not a mode toggle** (there is no `phase`
field — §8a.2 removed it):

| The brush | Meaning | A paint stroke |
|---|---|---|
| real art in `layer1`, blank `layer2` | a **front**/decoration pick | keeps the cell's existing terrain, replaces canopy + collision |
| blank `layer1`, real art in `layer2` | a **ground**/floor pick | replaces all three words outright |

Which of the two a picked tile becomes is the Tile tab's `auto | front | ground`
selector (`_layerForce`), falling back to what vanilla does with that graphic
(`editLayerPreference`, ≥60% one-sided). **A tile badged `front` must not land in the
terrain** — the badge and the brush are two readings of the same decision and may never
disagree. Note `_layerForce` is module-level: set it in a test and reset it, or it
leaks into every later layer decision.

**Erase** reads the *cell*, not the brush: if the canopy is already blank there is
nothing to erase; otherwise the canopy goes back to blank and the collision back to
whatever the room does on bare ground of that terrain (`editFloorCollisionFor`).
Removing a decoration must take its collision with it, or a removed gourd leaves a hole
you still cannot walk through.

---

## 4. Never invent data the ROM does not attest

This is the rule with the worst track record when broken, because the invented version
*looks* fine and is wrong in a way only the ROM can contradict.

Things that are **real** and can be relied on:
- entity gates and drift directions — documented bitfields, cited above
- the flip bits
- adjacency counts — but see below
- per-graphic layer preference, where vanilla is ≥60% one-sided

Things that are **not** real, and that a design mock or a plausible-looking UI has asked
for anyway:
- **Diagonal stairs are bit 13 + drift nibble 1 or 2** (the two "shear" handlers of
  `map_collision_mechanics.md` §6), measured over every vanilla room: only stair art
  carries them, and the direction follows the art's H flip (`src/maps/vanilla-stairs.ts`).
  **Vertical stairs are bit 13 + nibble 0** (walkable, no drift, the level kept): the
  word vanilla puts under its step art. An earlier version of this codebase mistook
  plane-transparency (bit 6) for a stairs test; that is still wrong.
- **Adjacency comes in two kinds, and they are not interchangeable.**
  `relatedGraphics`/`relatedTiles` is **undirected** ("drawn beside, any side") and
  drives the tile list's % badges — **not its order**: the list is in placement order
  and never moves once a tile is used. Since §8b the same walk (`src/maps/vanilla-adjacency.ts`) also
  counts **per side and per layer** — a right pair is `b` east of `a` and `a` west of
  `b`, a down pair `b` south / `a` north — and `directionalNeighbours`/`neighbourTiles`
  answer N/E/S/W for one graphic. Only the directional data may be drawn as a compass
  direction; a side it leaves empty stays empty, never filled from the undirected
  score. The two layers never mix (a canopy piece is on top of the floor, not beside
  it). Under H/V the sides swap (H: e↔w, V: n↔s) and candidates are drawn and armed
  with the same mirror — the whole pair mirrored is still a pair vanilla attests.
- **Family names.** Families are ROM ids with an area, not `GRASS`/`STONE`. Do not
  invent friendly names to match a mock.
- **Room groupings.** The catalogue groups by area, which is the game's own structure —
  not by act.

And the UI corollary: **do not render a control for something that does not exist.** A
dead button is worse than an honest gap — say so in the plan doc instead.

---

## 5. A custom map: its own room, empty, with exactly one Boy

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

---

A custom map is saved by the host as its own folder — `map.json` (draft *data*:
cells, stamps, graphics, families, start, groups, level) and `history.json` — in the
extension's global storage (docs/map-format/custom-map-files.md). Not in `uiPrefs` any
more; old maps there are migrated. `+ New Map` reopens an untouched map rather than
making another. The webview is
rebuilt whenever the active document changes, and a map lost with it was never a map.

## 6. What the editor may and may not write

**A custom map has one ROM write path: Export ROM** (docs/map-format/rom-export.md,
`maps/custom-room.ts`). It writes the grid, the dictionary, Block 1, the cuttable
table (Section 4), and animated tiles (Section 2, `maps/custom-animation.ts`). It
writes **no triggers, objects or scripts** yet. Its check decodes the result again
and compares, so anything added to it must be added to the check as well. A vanilla
room's draft still only has `editExport()`, a handoff shape for the sibling repo's
encoder. Before wiring a new kind of edit into either, confirm what the format
accepts. Entrances, for instance, are **room metadata, not tile-grid state**, and
have no slot today. A vanilla trigger script is not portable either: a gourd's names
its room's object number and a shared flag.

Undo is one history for everything, **one step per gesture** (a drag, however many
cells it crosses; a group move; a stamp), and it is **saved with the map for good**
(`history.json`, docs/map-format/custom-map-files.md §3). A history entry that names
an added stamp carries its words too (`editStampRef`), because pruning may drop the
stamp and the entry must be able to bring it back. Wrap any multi-write operation in
`editBegin`/`editEnd` rather than calling `editApply` several times.

Every tile write lands on the **level** picked in the left bar (collision bits 5..4,
`editOnLevel`); level 1 is the default. A stamped construct or widget is a **group**
(map-editor-groups.js): moved and deleted whole, restoring what it covered. A stamp
takes the level of the **floor it lands on** (`editFloorLevel`, the covered cells'
most common level), and the bar's only on open ground. A gourd on a level-2 plateau
is a level-2 gourd.

**Layers over the map.** The cuttable layer (`_edit.cut`) and each object's `layer`
(its changed look, map-editor-objects.js) hold stamps drawn *on top of* the map's own
cells. They are never written into `_edit.cells`. Each is shown only while its
control is on: the Cuttable chip, or the Object tab. Every stamp either one uses
must count as in use for pruning and for the family sync.

**Widgets** (map-editor-widgets.js) are portable constructs in one library file every
map shares. Their cells are `{graphic, family, flags}` per layer, or `null` for "keep
the floor". Never store a raw word in a widget unless no room could explain it: a
word is room-relative.

 Cell writes, special-glyph writes, trigger
operations and start moves all go through `editApply`/`editApplyTriggerOp`/
`editMoveStart` and share `_edit.undo`. Do
not add a second stack — a user pressing undo means "the last thing I did", whatever
kind of thing it was.
