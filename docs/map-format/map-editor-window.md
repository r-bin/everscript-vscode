# The map editor as a window

> **What this changes.** The editor currently lives as a docked column inside
> the Radar panel's Rooms tab, which opens *beside* the code. It is a sidebar
> that happens to contain an editor. This document turns it into a **window**:
> its own command, its own full-width tab, a canvas you can resize by dragging,
> and a tile picker organised by the two things the ROM can actually tell you
> about a tile — which family it belongs to, and which tiles it is placed next
> to.
>
> Status: **built** in 0.49.0, except where §7 says otherwise. Every number
> below was measured against the ROM by the probes in §9. Where a claim is a
> judgement rather than a measurement, it says so.

---

## 1. What is wrong today

Five complaints, each traced to a cause before anything is redesigned.

| Complaint | Cause | Verified how |
|---|---|---|
| "the X doesn't work" | `×` carries `data-fam-add`, which *opens the picker to swap the family*. It never clears the slot. `editClearFamily` exists but is only reachable from a "leave the slot empty" button inside the picker. | Clicked `[data-fam-add="2"]` in a browser: families went `[35,187,58,165,149,59,166]` → unchanged, `_famPicking` → `2`. |
| "the families should not scroll, the whole sidebar should" | Three nested scroll containers: `.rg-fam-list` (`max-height:140px`), `.rs-mt-sheet` (`340px`), `.rg-group-sheet` (`180px`). | Enumerated every `overflow-y:auto` node inside `#rg-panels`; three matched, all with their own `max-height`. |
| "it opens in the right side bar" | `createWebviewPanel(..., vscode.ViewColumn.Beside)`, and the editor then docks a ~320 px column inside that. At that width the picker's own header truncates mid-sentence. | Rendered the real panel markup at 330 px: "Filling slot 1 — 329 families, showing 1–12, most art first." wraps to three lines before any art. |
| "the graphics are broken" | **Not reproduced as a rendering fault.** The preview sheet is a correct 128×192 PNG of 12 rows × 8 real tiles, and in a browser the strip cells measure exactly 16 px at background offsets `0, -16 … -112`. What *is* true: at 16 px, in a 320 px column, a strip of eight mostly-dark tiles is unreadable — so the art is there and tells you nothing. | Dumped the sheet PNG and inspected it; measured all eight cells' `getBoundingClientRect` and `background-position`. |
| "the sidebar does not look like I expected" | It is organised around *the seven slots you have already chosen*. Nothing answers "what could I use, and what goes with what". | — |

The last two are the real brief. The picker is not broken so much as **pointed
the wrong way**: it makes you choose a family id before showing you anything,
when what you have is a picture in your head and no idea what "family 166" is.

---

## 2. The relationship index

The one genuinely new measurement this rebuild needs.

> *"if they are never placed next to each other they have a low relationship
> value. if they are directly placed next to each or above each other they have
> a high relationship value"*

Walk every vanilla room's grid. For each cell, resolve both layer words to
graphic ids. For each **4-neighbour edge** (right and down, which covers every
adjacency once), count the pair on each layer separately.

```
rooms 127 · adjacency edges 693079 · distinct graphics 5629
distinct neighbour pairs   49374
neighbours per graphic     median 9 · p90 39 · max 996
build time                 127 ms   (folded into the existing index pass)
size                       ~0.8 MB
```

### 2.1 Raw counts are the wrong score — Jaccard is the right one

Raw adjacency counts rank by *how common the neighbour is*, not by how related
it is. Three candidate scores, on graphic `3736` (the gourd body's top-left
canopy tile in room `0x34`):

| Score | Top neighbours |
|---|---|
| raw `count` | 3737 (63), 3740 (63), **3455 (27), 1674 (25)** — floor and wall |
| `count / min(a, b)` | 3737 (1.00), 3740 (1.00), **5749 (0.50 on a single placement)** |
| **`count / (a + b − count)`** (Jaccard) | **3737 (1.00), 3740 (1.00)**, then 3741 (0.04) |

Jaccard puts the other two pieces of the same gourd at exactly **1.00** — they
are always adjacent and never apart — and drops the ubiquitous floor tile to
noise. `min` has a degenerate case: a graphic placed twice, both times next to
the query, scores 1.00 on two placements. Jaccard does not.

So: **relationship(a, b) = adjacent(a, b) / (placed(a) + placed(b) − adjacent(a, b))**,
a 0…1 number where 1 means "these two are only ever seen together".

### 2.2 Relationship and family are different axes, and that is the point

Only **38.1%** of neighbour pairs share a dominant family (53.7% among pairs
seen 20+ times). Family says *what colours this can be drawn in*; relationship
says *what the artists actually put beside it*. Grouping by one and ranking by
the other is not redundant — it is two independent signals, which is why the
picker uses both.

---

## 3. The window

### 3.1 `> everscript new map`

A new command, `everscript.newMap`, titled **"Everscript: New Map"** so it
matches the `> ever` prefix the palette is searched with. It:

1. opens the editor panel in the **active** column, not `Beside`;
2. selects the Rooms tab;
3. turns edit mode on and drafts a blank 24×16 room, borrowing graphics from
   room `0x34` — small, a plain walkable floor, seven families that between
   them attest 157 graphics;
4. waits for the borrowed dictionary before drafting, because a blank room
   is drawn out of it and the fetch is asynchronous.

The radar needs a document to detect a scope from. A new map does not care
which one — its content comes from the ROM — so an **empty in-memory
document** stands in when nothing is open, rather than the editor refusing to
appear because no `.evs` file happens to be up.

The seven slots start with room `0x34`'s families rather than empty. They
have to: a blank room cannot invent a Block 1 (rule 7.1 — a synthetic
one-entry list renders black), so it borrows one, and the families are what
colour it. The slots being full is not a restriction on what you can pick,
because the tile list is unfiltered by default and placing a tile from any
family adopts it (§4.2).

### 3.2 Full width, one scroll container

The panel opens in `ViewColumn.Active`. The editor lays out as canvas-left /
sidebar-right, the sidebar a fixed 360–420 px with the map taking the rest.

**Every inner `max-height` + `overflow` pair is removed.** The sidebar is the
only thing that scrolls. A panel that is open is as tall as its content; if
that makes the sidebar long, the sidebar scrolls — which is what scrolling is
for. This costs nothing but restraint, and it is the single biggest reason the
current picker feels like looking through a letterbox.

### 3.3 Resizing the canvas like a window

A drag handle at the bottom-right corner of the map. Dragging it reports a live
size in tiles; releasing it commits.

The format constraint that makes this more than a CSS change:

```
baseMetatile === widthTiles * heightTiles * 2
```

The dictionary begins immediately after the grid in WRAM, so **changing the size
renumbers every metatile id in the room**. That is survivable here only because
the draft stores cells as dictionary *indices* and converts to ids at export —
so a resize recomputes `baseMetatile` and every id follows. A design that had
stored ids would have to rewrite the whole grid.

Consequences the UI must show, not discover later:

- the WRAM meter moves immediately: `w*h*2 + stamps*8`, against the 32768-byte
  window (fullest vanilla room: 32680);
- shrinking **discards** cells outside the new bounds — confirm before losing
  work, and make it one undo step;
- growing fills new cells with metatile 0, which is also what rule 7.2 requires
  of cell (0,0).

---

## 4. The sidebar

### 4.1 Families become chips, not a paged catalogue

A family id is not a name. What makes one choosable is *what it looks like*, so
every family is a chip carrying its **two most-placed tiles** as its icon, plus
its id and the act it belongs to:

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│ ▨▨ 35      │  │ ▨▨ 166     │  │ ▨▨ 58   ×  │
│ Prehistoria│  │ Prehistoria│  │ Prehistoria│
└────────────┘  └────────────┘  └────────────┘
```

All 329 attested families fit in one preview sheet: 8 tiles each costs 74 ms
and ~340 KB; two tiles each is a quarter of that. It is sent once.

Chips do three things, and each is a separate click target so none of them is a
surprise:

| Click | Does |
|---|---|
| the chip | **filters the tile list** to that family; multi-select; clearing the selection shows everything again |
| `×` on an adopted chip | **removes the family from its slot** — the thing the current `×` does not do |
| `+` in the search results | adopts a family into a free slot |

### 4.2 The tile list is the primary control

A new map shows **all attested tiles**, grouped by family, each group ordered by
relationship. Selecting family chips filters it; no selection means no filter.

Placing a tile **adopts its family** into a slot, so the seven fill themselves
as a consequence of drawing rather than as a prerequisite for it. This is the
inversion the whole editor is built on, applied to the one control that was
still the wrong way round.

Within a group, order is:

1. **relationship to what is already in the map**, descending — once you have
   placed one gourd tile, the rest of the gourd is at the top;
2. placements in vanilla, as the tiebreak and the ordering for an empty map.

### 4.3 Foreground / background, decided by vanilla and overridable

Already measured: **4822 of 5628 graphics are drawn ≥90% on one layer**. Each
tile shows which, as a badge, and a picked tile lands on that layer
automatically above a 90% share. Below that the current phase breaks the tie.

Two toggles sit above the list — **front** / **ground** — that force the next
placement onto a layer regardless. "You can draw all tiles in the foreground or
background" is literally true of the format: a tilemap word does not care which
of the two layer slots it is written into.

### 4.4 Recommended neighbours

When a tile is selected, a strip under it shows its highest-relationship
neighbours with their scores, drawn in the selected family. This is the
discovery tool: the gourd's other pieces score 1.00 and appear first, and they
are one click from being placed.

### 4.5 Removing a family invalidates tiles, and says so

Removing a family from a slot does not silently recolour anything. Every placed
tile whose word names that palette slot becomes **invalid**, and the checks
panel says exactly that:

```
family 166 removed — 14 placed tiles were drawn in it.
  · add family 166 back to a slot, or
  · replace those 14 tiles
```

This is a `hard` check: the room would still encode, but it would not look
like what is on screen, which is worse. Outlining the stranded cells on the
canvas is the obvious next step and is not built yet — the count and the
advice are.

---

## 5. What this does not change

- **The draft model.** `_edit` still owns cells, the undo stack and the export
  shape. Nothing here writes to the ROM.
- **Portability.** Constructs and deco entries keep the `{graphic, family,
  flags}` form from §9 of
  [building-a-room-from-a-picture.md](building-a-room-from-a-picture.md) —
  a word is room-relative and cannot be replayed verbatim.
- **The seven-slot ceiling.** `$90D037` clamps CGRAM to seven families. Chips
  make the choice easier; they do not make it larger.

---

## 6. What this deliberately leaves out

- **The 14-family rooms.** 18 rooms list two complete sets of seven, swapped at
  runtime. The chips model one set.
- **Writing back.** Still an export, still needs the confirmation/backup flow
  and a free-space map — see [map_editor_ui.md](map_editor_ui.md) §6.
- **Naming families.** The ROM has none. A chip shows art and an act; it does
  not invent "jungle".

---

## 7. Build order

| Phase | What | State |
|---|---|---|
| **1** | Relationship index in `src/maps/`, folded into the existing vanilla pass, with parity tests | **done** (0.49.0) |
| **2** | `everscript.newMap` + open in the active column | **done** (0.49.0) |
| **3** | One scroll container: delete the inner `max-height`/`overflow` pairs | **done** (0.49.0) |
| **4** | Family chips, with a working `×` | **done** (0.49.0) |
| **5** | Tile list: grouped, relationship-ordered, fg/bg badges + overrides | **done** (0.49.0) |
| **6** | Recommended-neighbour strip | **done** (0.49.0) |
| **7** | Canvas resize handle, with the `baseMetatile` renumber | **done** (0.49.0) — drafts only |
| **8** | Removed-family invalidation, as a `hard` check | **done** (0.49.0) — the canvas outline is not drawn yet |

---

## 8. Risks

- **Payload.** All-tiles-grouped is 11028 (graphic, family) pairs across 329
  families. Chips are one sheet; a family's *tiles* stay lazy, fetched when the
  family is first shown. If that proves slow, the fallback is to render the
  chips' families only.
- **Relationship on a blank map.** With nothing placed there is nothing to be
  related to, so the first ordering is placements-descending. That is a real
  cold start, not a bug, and the UI should not pretend otherwise.
- **Resize on a ROM room.** Legal, but it moves `baseMetatile` and so rewrites
  every id on export. Phase 7 must show the WRAM delta before committing.

---

## 9. How the numbers here were measured

All probes decode the 127 rooms with `maps.decodeRoom` and resolve tilemap words
through `charIndexToSlot(word & 0x3ff)` into `tilePalette.concat(animatedTiles)`.

| Claim | Probe |
|---|---|
| 693079 edges, 49374 pairs, degree median 9 | count right- and down-neighbour pairs per layer over every room's grid |
| Jaccard vs raw vs min on graphic 3736 | score that graphic's neighbour list three ways and compare the top 8 |
| 38.1% / 53.7% of pairs share a family | `suggestFamily` on both ends of every pair, and of every pair with count ≥ 20 |
| 4822/5628 graphics ≥90% one-sided | the index's `layers` map, already pinned in `map-parity.test.js` |
| 329 families, 11028 pairs, median family 24 tiles | `buildFamilyCatalogue` |
| chip sheet 74 ms / ~340 KB at 8 tiles | `buildFamilyPreviews` for 40 families, timed and extrapolated |
| `×` does not clear a slot | click `[data-fam-add="2"]` in Playwright, diff `editFamilies()` |
| three nested scrollers | enumerate `overflow-y` of every node under `#rg-panels` |
| the preview sheet is not broken | dump the PNG; measure all eight strip cells' box and `background-position` |
