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
- **"Stairs" has no attested collision encoding.** An earlier version of this codebase
  mistook plane-transparency for a stairs test. If a stairs affordance is wanted, it is
  an icon over an ordinary tile, not a bitfield.
- **Adjacency is undirected.** `relatedGraphics` scores "drawn beside", not "drawn
  above/below" — `walkAdjacency` visits right- and down-neighbours and then collapses
  both into one bucket. Do not render it as N/E/S/W unless the index has actually been
  extended to count four directions.
- **Family names.** Families are ROM ids with an area, not `GRASS`/`STONE`. Do not
  invent friendly names to match a mock.
- **Room groupings.** The catalogue groups by area, which is the game's own structure —
  not by act.

And the UI corollary: **do not render a control for something that does not exist.** A
dead button is worse than an honest gap — say so in the plan doc instead.

---

## 5. What the editor may and may not write

**There is no ROM write path in this subsystem, and adding one is not a casual change.**
`editExport()` produces a handoff shape for the sibling repo's encoder; nothing here
writes bytes. Before wiring a new kind of edit into the export, confirm the encoder
actually accepts it — entrances, for instance, are **room metadata, not tile-grid
state**, and have no slot in the export shape today.

Undo is one history for everything. Cell writes, special-glyph writes and trigger
operations all go through `editApply`/`editApplyTriggerOp` and share `_edit.undo`. Do
not add a second stack — a user pressing undo means "the last thing I did", whatever
kind of thing it was.
