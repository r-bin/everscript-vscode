---
name: map-construction
description: How a Secret of Evermore map is put together, from grid cell down to graphic, and what the user means by "tile", "used" and "next to each other" — adjacency is counted over every object state and every animation frame, never just what the room loads with, and a tile no state or frame ever shows is unused. Also what animation groups are (inferred, not stored) and what the vanilla census says about their timing. Read before writing anything that counts, ranks, suggests or groups vanilla tiles (src/maps/vanilla-*.ts) or that seeds a ROM room's objects or animations into the editor.
applyTo: "src/maps/vanilla-*.ts,src/maps/objects.ts,src/maps/object-stamps.ts,src/maps/animation.ts,src/rooms/webview/map-editor-animations.js,src/rooms/webview/map-editor-objects.js"
---

# How a Map Is Constructed

The byte format is `rom-map-data`'s, and the editor's limits are `map-editor-rules`'.
This skill is the model between them: what a map *shows*, over time and over its
objects' states, and the words the user uses for it.

---

## 1. From cell to pixels

```
grid cell ──► metatile id ──► dictionary entry (a "stamp", 8 bytes)
                               ├─ layer1  tilemap word (canopy, BG1)
                               ├─ layer2  tilemap word (terrain, BG2)
                               └─ collision word
tilemap word ──► chr (bits 0..9) ──► slot ──► graphic id   (Block 1 list, then Section 2 frame 0s)
             └─► palette (bits 10..12) ──► one of the room's 7 families
```

- **A graphic** is a 16×16 piece of art, a global id. **A stamp** is one dictionary
  entry. **A cell** is a grid position. When the user says *tile* they mean the
  **graphic** (in a family), unless they say otherwise.
- The two layers of one cell are **on top of each other, not beside each other**.
  Canopy pairs only with canopy, terrain only with terrain.
- Slots past the Block 1 list are animated: slot `len(Block 1) + i` is channel `i`
  (`map_animated_tiles.md` §4). That is the only link from the grid to Section 2.

## 2. A map is not one picture

What a room loads with is one moment of it. Two things change it while it runs:

| Changer | What it does | Where |
|---|---|---|
| **Object state** | XORs metatile ids into the grid: descriptor `s` turns state `s` into `s+1`; state 0 is the grid as decoded. Changes stamps, so art *and* collision *and* which channel drives a cell | Section 3, `object-stamps.ts`, `applyObjectStates` |
| **Animation frame** | Swaps the graphic in one slot on a timer. Every cell naming the slot changes together; the grid never changes | Section 2, `animation.ts` |

They compose: an object state can move a cell onto a different channel (room 0x25's
firepit runs channels 6–9 unlit and 0–3 burning). **92 channels in 17 rooms are named
by no cell until an object changes state.**

## 3. "Next to each other" means in any state, at any frame

**The user's rule:** two tiles are next to each other if the room ever shows them side
by side. That holds whatever the objects' states or the animations' frames are, so
**every tile in every object state and every animation frame counts**. Adjacency read
off the state-0, frame-0 grid alone is incomplete. It misses the open gourd beside its
floor and the burning firepit beside its stones.

Counting it:
- **Objects:** every state of every object (cumulative deltas `0..s-1`), not only the
  state the room loads with.
- **Animations:** every frame of a channel stands where frame 0 stands. Two neighbours
  on channels with the **same timing** (identical initial countdown and delays) are in
  lockstep forever, so frame *i* is beside frame *i* only. Neighbours with different
  timings drift through every combination, so any frame is beside any frame.
- The rules that already hold still hold: layers never pair across, a tile beside a
  copy of itself is not a pair, and under H/V mirroring the sides swap
  (`map-editor-rules` §4).

## 4. Used and unused

A tile (graphic or stamp) is **used** if some state at some frame shows it:
- placed in the grid (`uses > 0`), or
- reached by some object state's deltas (`applyObjectStates`), or
- a frame of a channel that some cell, in some object state, names, or
- what cutting grass reveals (`noteGrass`).

**Anything else is unused, and an unused tile is never placed on a map.** It is not
evidence. It gets no family, no neighbours, no layer or collision vote and no place in
any list, however objects and animations are arranged. The ROM has plenty of these:
7591 of 75203 dictionary entries are never placed, and **8 channels are named by no
cell in any state**.

## 5. Animation groups are inferred, never stored

The ROM has channels, not groups. A group (`_edit.anims`) is a reading of channels
that belong together.

- **Lockstep is exact.** Every channel starts at room load, so channels with identical
  `(init, delays)` show the same frame index at every tick.
- **"One thing" is a judgement.** Since v0.112.0 the editor does not make it: seeding
  (`editSeedRoomAnims`) lists **every channel as its own animated tile**, locked to its
  frames and keeping its own timing, and the Animation tab shows one row per channel.

The census, over every object state of all 127 rooms (1020 channels, 2761 touching
channel pairs, stacked layers included):

| Touching pair | Count |
|---|---|
| identical timing | 1365 |
| same period, different delays (15 of them the same delays reordered) | 61 |
| different period | 1335 |

By touch alone, 64 of 157 multi-channel clusters mix timings. **So no: neighbouring
animations do not all share a timing.** Some of that is two different things side by
side (water beside a torch). Some is one thing run deliberately out of step: one cycle
beside itself at another timing in 28 side pairs, e.g. 0x29's `5,5,5,5,3` against
`1,5,5,5,3`, and 0x6b running cycle 6434 at three delay patterns side by side. In the
other direction, identical timing does not prove one thing, since `12,12,12` is common.
**Never flatten a ROM room's channels to one timing per cluster.** Its timings are
data.

## 6. Where the code falls short of this (as of v0.111.0)

- `walkAdjacency` (`vanilla-index.ts`) walks only the decoded grid: state 0, frame 0.
  Neither object states nor later frames take part in `relatedGraphics` or
  `directionalNeighbours`.
- `buildVanillaIndex` treats **every** `uses === 0` entry as object-placed. Only
  entries an object state reaches are (§4). The rest are leftovers voting on families,
  layers and collision.
- `editSeedRoomAnims` reads `palette.grid` (state 0) for each channel's layer and word
  bits. The 92 channels that appear only in a later object state are seeded with none,
  and list no cells until that state is drawn.

Fix these with the §3/§4 rule. Do not loosen the rule to fit the code.
