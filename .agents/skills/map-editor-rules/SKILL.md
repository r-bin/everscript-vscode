---
name: map-editor-rules
description: Use before changing the Rooms map editor (rooms/webview/map-editor*): the ROM budgets, tilemap and collision word layouts, stamps, and never inventing data the ROM does not have.
applyTo: "src/games/evermore/rooms/webview/map-editor*,src/games/evermore/rooms/rendering/room-draft.js,src/games/evermore/rooms/rendering/vanilla-index.js"
---

# Map Editor Rules

The editor draws into a format with hard ceilings and a specific word layout. Most of
the bugs that have shipped in it were not logic errors — they were a control offering
something the format cannot do, or a number invented to fill a gap in what the ROM
actually attests. This is the list of what is true, so neither happens again.

Format detail lives in `map-format` and `docs/map-format/`. This skill is what the
*editor* has to honour.

---

## 1. Budgets — every one of these is a hard ceiling

| Budget | Limit | What spends it |
|---|---|---|
| **Tile families** | **7** | A palette slot. The loader takes seven at a time, from entry `MAP_PALETTE` (`$7E2437`, 0 on load): entries past the seventh are **alternate sets** a script switches to (22 vanilla rooms). The draft keeps only the first set; the Info tab's Header sub-tab previews the others (map-editor-family-sets.js) as a **view**: nothing written, nothing on the history |
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
  to adopt into, so candidates are noise.
- **While a slot is free and the map is unlocked**, the Tile tab lists every other
  family too; a **locked** map (a vanilla room opens locked) lists only its own
  families — it cannot adopt one, and listing ~330 more there was the "tiles aren't
  limited to the 7 families" report. The free slot's `+` scrolls to the others.
  A custom map starts at 0/7.
- Adoption is implicit: clicking a tile from an unadopted family pulls that family in
  behind it.
- The others are **every** family with **all** its art, lazily,
  never behind a pager or a collapse. And a click must not move what was clicked:
  groups keep their place in the list when their family is adopted, and the scroll
  position survives the redraw.
- Freeing a slot **strands** every placed cell whose word names it. The word still says
  "palette slot N" and slot N is now something else. Say so (`editStrandedCells`), and
  offer to re-adopt or clear — never silently recolour.

---

## 2. Words, custom maps, what the editor writes

The detail is `docs/map-format/map-editor-reference.md`; the rules a change must keep:
- **Two different 16-bit words.** Tilemap word: `chr` 0–9, palette 10–12 (family slot + 1), bit 13
  priority, 14/15 flips — a flip is geometry, free of a graphics slot. Collision word: geometry 3..0
  (drift when bit 13 is set), plane 5..4, see-through 6, gate 11..8, bits 12/14/15
  (`map_collision_mechanics.md`, whose §8 lists what we once got wrong).
- **A custom map** is its own room: one screen (16×14) minimum, a donor only for graphics and
  families, no donor content, exactly one Boy start (`_edit.start`, never erasable). Resizing never
  deletes cells. Saved by the host as `map.json` + `history.json`.
- **One write path**: Export ROM (`maps/custom-room.ts`) writes grid, dictionary, Block 1, cuttable
  table, animated tiles and objects (each descriptor is state s+1 XOR state s), no triggers or
  scripts yet; its check decodes the result again — extend both together.
- **One undo history** for every kind of edit, one step per gesture, saved with the map; wrap
  multi-write operations in `editBegin`/`editEnd`. Never a second stack.
- **Groups and layers are stored apart** (widgets, cuttable, object looks, hand-set collision):
  never written into `_edit.cells`; read the map as shown through `editCellAt` / `editBakedCells`.
- **An animated tile is one channel** (a Section 2 slot); never decide "it animates" from the
  graphic. **An object steps** through its states, each held `o.holds[s]` ticks.
- **A vanilla room uses the same editor**, opened `locked`; a step-on box needs collision bit 14
  under it; trigger records count from the header origin with an exclusive far edge; while editing,
  the render leaves out what the editor draws itself.

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
Widgets tab's widget. Info keeps the last tab's. The Trigger tab's **Enter** tab only shows the enter script: it has no box, so choosing it never arms the pencil (`_triggerEnterView`, not `_editTriggerKind`). Arming a widget selects the *pencil*,
never the old Stamp tool: Stamp stamps on every tab. The eraser follows the
same choice. A click never carries two drawables. **What a click would do is shown
before it is done** (map-editor-preview.js): the pencil's, stamp's and eraser's
hover ghosts, and a resize drag's new outline. A preview must never write — no
`editAddStamp`, no family or graphic adopted — so a widget's ghost is rendered by
the host from its portable cells, not by stamping and undoing. Before this rule, an armed stairs
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
Which layer it takes is the Tile tab's `auto | front | ground` (`editEraseLayers`):
front takes only front art, ground only the ground (front art over it stays), and
auto the top-most layer the bottom bar shows — front art first, then the painted
tile. A stroke with nothing on the chosen layer writes nothing, and one gesture
erases each cell **once** (`_eraseSeen`): the stroke runs on down, move and up, and a
second pass on a layered cell put a vanilla cell straight back.

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
  carries them, and the direction follows the art's H flip (`src/games/evermore/maps/vanilla-stairs.ts`).
  **Vertical stairs are bit 13 + nibble 0** (walkable, no drift, the level kept): the
  word vanilla puts under its step art. An earlier version of this codebase mistook
  plane-transparency (bit 6) for a stairs test; that is still wrong.
- **See-through is bit 6, elevation change is not a bit.** The Special tab's
  *See-through* (Level group) sets bit 6: open from any other plane, and standing
  on it keeps your plane (§3) — the overlay's purple wash. The overlay's amber
  "elevation change" rungs are *derived*: an ordinary walkable cell beside one
  on another plane (`planeTransitionTiles`). Make one by painting levels; never
  offer it as a special.
- **Adjacency comes in two kinds, and they are not interchangeable.**
  `relatedGraphics`/`relatedTiles` is **undirected** ("drawn beside, any side") and
  drives the tile list's % badges — **not its order**: the list is in placement order
  and never moves once a tile is used. Since §8b the same walk (`src/games/evermore/maps/vanilla-adjacency.ts`) also
  counts **per side and per layer** — a right pair is `b` east of `a` and `a` west of
  `b`, a down pair `b` south / `a` north — and `directionalNeighbours`/`neighbourTiles`
  answer N/E/S/W for one graphic. Only the directional data may be drawn as a compass
  direction; a side it leaves empty stays empty, never filled from the undirected
  score. The two layers never mix (a canopy piece is on top of the floor, not beside
  it). Under H/V the sides swap (H: e↔w, V: n↔s) and candidates are drawn and armed
  with the same mirror — the whole pair mirrored is still a pair vanilla attests.
  What counts as "next to" — every object state and animation frame, never only
  state 0 — and what counts as unused is `map-construction` §3–§4.
- **Family names.** Families are ROM ids with an area, not `GRASS`/`STONE`. Do not
  invent friendly names to match a mock.
- **Ceilings.** The Info tab bars only attested ones: 7 families, 264 graphics, the
  32 KB WRAM window. The mock's "Meta tiles /128" and "triggers /16" are its
  placeholders — stamps and triggers are counts, with no bar. Trigger tables are
  16-bit byte-length prefixed and `$8FAC84` walks them with a 16-bit index
  (`LDY #$0000 … CPY $12`); what is 8-bit is each box's coordinates (`SEP #$20`
  before the compares), so a box reaches 0..255 cells from the origin.
- **The header.** Origin and size come from the map. The PPU designations (TM/TS),
  colour math (CGADSUB/CGWSEL), effect variant and the 16-bit parameter at bytes
  9–10 do not, so the Info tab edits them (`_edit.header`, overrides only, one undo
  step each) and both exports carry them (`applyHeaderOverrides`).
- **Tile flags come from most placements, not any.** A collision word belongs to the
  cell, so one gated placement says nothing about the art (the empty canopy sits
  over every gated cell). `specialFlagsOf` needs a majority on a layer, and
  `deflect` is the Special tab's Deflect (gate nibble 1), not every bit-8 word.
- **Room groupings.** The catalogue groups by area, which is the game's own structure —
  not by act.

And the UI corollary: **do not render a control for something that does not exist.** A
dead button is worse than an honest gap — say so in the plan doc instead.

---
