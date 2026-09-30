# Building a room from a picture

> **The inversion.** [building-a-room-from-scratch.md](building-a-room-from-scratch.md)
> goes forwards: here are the fields, fill them in, get a room. This page
> goes **backwards** — you know what the room should look like, and the
> editor works out the tile families, the graphics list, the metatile
> dictionary and the collision words that produce it, while telling you what
> each decision costs against the hardware budgets.
>
> Status: **design + a measured index.** Every number below was measured
> against the ROM by the probes described in §11, not estimated. Where the
> data says a suggestion will be weak, this page says so rather than
> promising a guess.

---

## 1. What actually changes

Today the Rooms tab answers *"what can I place?"* — 175 stamps, 92 graphics,
7 families. Fine once you know the format, useless when what you have is a
picture in your head.

The inversion turns each of those into a **derived** quantity:

| Forwards (today) | Backwards (this page) |
|---|---|
| Here are 7 families; the tile list follows | I want *these things* in the room → which 7 families do I need? |
| Here are 92 graphics; pick one | I want a gourd → which graphics are the gourd, and what do they cost? |
| Type a collision word | Place the art → get the collision vanilla uses for it, change it if wrong |
| Find out you overflowed when it breaks | Every action shows its cost before you commit it |

The thing that makes this possible is that **the vanilla ROM is a labelled
training set**. 127 rooms already answer "which family does this graphic
belong to" and "what collision goes under this art" — 779 752 placements'
worth. The editor does not need to guess; it needs to *look it up*.

---

## 2. The vanilla index

One pass over all 127 rooms, ~64 ms, cached. For every metatile the room
actually places, resolve both layer words to a graphic id and a family, and
attribute the stamp's collision word to its terrain graphic.

```
rooms 127 · placements 779752
distinct (graphic, family) pairs   11028
distinct graphics with a family     5628
distinct families attested          329   (365 are listed by some room)
```

### 2.1 Family lookup is strong

How many families does a single graphic ever appear in?

| Families per graphic | Graphics |
|---|---|
| **1** | **3236** (57.5%) |
| 2 | 1289 |
| 3 | 525 |
| 4 | 248 |
| 5+ | 330 |

And weighted by how often it is actually drawn:

- **3503 of 5628** graphics (62.2%) have one family carrying **≥90%** of their placements
- **4073** (72.4%) have one carrying **≥75%**

So for roughly three graphics in five, "which family does this belong to"
has exactly one answer, and for another one in ten there is a clear
favourite. **This is the lookup that removes most of the work** — you pick
the art, the family follows.

### 2.2 Collision lookup is weaker — and the UI must admit it

Same question for collision, attributed to the terrain graphic:

| | Graphics |
|---|---|
| exactly one collision word ever | **1296** of 3065 (42.3%) |
| one word ≥90% of placements | 1569 (51.2%) |

Half the time the art does *not* determine the collision, which is exactly
what you would expect: the same grass is walkable in one room and blocked at
a map edge in another. So collision is **suggested, never assumed**, and the
suggestion is shown with its evidence:

```
collision  $101F   suggested — 94.1% of vanilla placements of graphic 4191
           $901F   ...
```

Changing it is a first-class action, and §5.3 covers what it costs.

### 2.3 The master table is ordered by art group

`$EE0000` is not a shuffled bag. Graphics that belong to one object sit in a
contiguous run. Rendering ids 3728–3775 in family 166 shows gourd tops,
gourd bodies, vegetation and wall pieces — one coherent art set, in order.

That makes **"show me the neighbours of this graphic"** a real discovery
tool, and it is cheaper than any search: if you found one piece of the thing
you want, the rest is within a few ids either side.

---

## 3. What an object really costs

The worked example is the gourd in Strongheart's Hut (room `0x34`), because
it is the case that prompted this page.

### 3.1 The measurement

The gourd occupies **2 cells wide × 3 tall**, not 2×2 — the top row is the
tent wall showing above it:

| cell | stamp | canopy | terrain | collision | graphics |
|---|---|---|---|---|---|
| 5,4 | 10 | `$A800` | `$0C2C` | `$101F` | 1674 (f187), 4190 (f58) |
| 6,4 | 11 | `$A800` | `$0C2E` | `$101F` | 1674 (f187), 4191 (f58) |
| 5,5 | 40 | `$1D22` | `$0C2E` | `$901F` | 3736 (f166), 4191 (f58) |
| 6,5 | 41 | `$1D24` | `$0C02` | `$901F` | 3737 (f166), 4177 (f58) |
| 5,6 | 52 | `$1D2C` | `$0C46` | `$9019` | 3740 (f166), 4195 (f58) |
| 6,6 | 53 | `$1D2E` | `$0C4A` | `$901A` | 3741 (f166), 4197 (f58) |

```
real cost:  6 metatiles · 10 distinct graphics · 3 families (187, 58, 166)
```

Note the shape of it: the gourd body is in the **canopy** layer (so the
character walks *behind* it) and the tent floor continues underneath in the
terrain layer. An object is not a sprite pasted on top — it is a pair of
layer words per cell.

### 3.2 The cost model is marginal, not absolute

The 6/10/3 above is what the object costs **in an empty room**. In a room
that already loaded family 58 and the floor graphics, the same gourd costs
far less. So the editor computes:

```
cost(object, room) = {
  families : |object.families  \ room.families|
  graphics : |object.graphics  \ room.graphics|
  stamps   : |object.stamps    \ room.stamps|      // exact (l1,l2,coll) matches reuse
  wram     : stamps * 8
}
```

The stamp term uses the **find-or-create** rule the composer already
implements: an identical `(canopy, terrain, collision)` triple costs nothing
at all. Placing the *same* object a second time is therefore free — it is
only grid cells.

### 3.3 Vanilla has no object library, and that is the finding

The obvious plan is "harvest objects from vanilla automatically". It does
not work, and it is worth knowing why before building it.

Room `0x34` has three gourds. Their stamps and their **graphics** are
disjoint:

| gourd | stamps | graphics |
|---|---|---|
| A (green) | 40,41 / 52,53 | 3736, 3737, 3740, 3741, 4177, 4191, 4195, 4197 |
| B (brown) | 35,36 / 45,46 | 1674, 3867, 4177, 4178, 4190, 4191, 4246, 4247 |
| C (green) | 58,59 / 71,72 | 1674, 3736, 3870, 3871, 4195, 4197, 4200, 4205 |

They are three different pieces of art that happen to be the same kind of
thing. SoE's artists authored each placement separately; nothing in the ROM
marks "this is a gourd".

Repeated blocks do exist — every one of the 126 named rooms contains at least
one repeated 2×2 stamp block, 30 574 distinct ones in total, most of them in
room `0x4b` (1353 of 4746). But those are **fields and walls**, the tiling
background. The gourd block occurs exactly **once**.

So: the object library is **user-built**, seeded by selection (`select a
region → save as object`). Harvesting repeated blocks would produce a
catalogue of grass, not of gourds. What the editor can do automatically is
the *other* half — once you have selected a region, it can name its
graphics, its families and its marginal cost without being told.

---

## 4. The budget

Four ceilings, all measured against the ROM:

| Resource | Ceiling | Fullest vanilla room | Headroom |
|---|---|---|---|
| **Graphics slots** | ~264 | **255** — room `0x08` (237 Block 1 + 18 animated) | **9 slots** |
| **Tile families** | 7 loaded at once | 7 (74 rooms), 14 listed (18 rooms, swapped) | — |
| **Metatile stamps** | no field limit | 2131 — room `0x37` | WRAM-bound |
| **WRAM window** | ~32768 B | **32680 B** — room `0x65` (80×99, 2105 stamps) | **88 bytes** |

WRAM is `width * height * 2 + stamps * 8`, grid and dictionary sharing the
buffer at `$7F0000`.

> **Correction to [building-a-room-from-scratch.md](building-a-room-from-scratch.md) §4.2.**
> That table gives the graphics high-water mark as 246. That is Block 1
> alone (room `0x37`). Counting the animated graphics that share the same
> slot space, the real maximum is **255** in room `0x08`, leaving nine
> slots against the ~264 ceiling — a much tighter margin than 246 suggests.

For scale, the room this page keeps using:

```
room 0x34   graphics 92/264   stamps 175   wram 2048/32768
```

Strongheart's Hut is a small room. It has room for roughly 27 more gourds
before the graphics list fills.

### 4.1 How the budget is displayed

Not as a number in a corner. Every action that spends budget shows what it
spends **before** it is committed, and the meter moves when you hover an
object in the library:

```
graphics  ████████░░░░░░░░░░░░░░░░  92 / 264      + 10  →  102
families  ███████                    7 / 7        + 1   →  OVER
stamps    ░░░░░░░░░░░░░░░░░░░░░░░░ 175            + 6   →  181
wram      █░░░░░░░░░░░░░░░░░░░░░░░ 2048 / 32768   + 48  →  2096
```

The family row is the one that bites first, and it is the only hard
ceiling of the four — the loader clamps to 7 (`$90D037`).

---

## 5. The flow

### 5.1 Choose the families first

Seven slots. Picking them decides what the room can look like, so it is the
first screen, not a dropdown buried in a header editor.

Each slot offers:

- **the family's colours** — the 16 swatches
- **example tiles drawn in it, from vanilla** — the index knows which
  graphics appear with this family and how often, so it can show the eight
  most-placed as a thumbnail strip
- **which rooms use it** — "family 58: 92 graphics across 4 rooms"

Measured shape of the catalogue: **365 distinct families** are listed by at
least one room, and **329** have at least one graphic attested in them. The
biggest are f32 (210 graphics across 13 rooms) and f220 (201 across 13); the
median family has 24 graphics; many have exactly 1.

### 5.2 The tile list filters itself

Once seven families are chosen, the graphics list shows what the index has
**actually seen drawn** in one of them. For room `0x34`'s set
(`35, 187, 58, 165, 149, 59, 166`) that is **157 graphics** — against ~264
loadable slots.

So the filter narrows the 6202 game-wide graphics to 157 candidates, which
is the point. But note it is *not* the binding constraint: 157 < 264, so the
family choice, not the slot budget, is what limits a room's vocabulary in
practice.

Two escape hatches, because 157 is a floor and not a law:

- **"show unattested"** — any graphic can be drawn with any family; the
  index only records what vanilla *did*, not what is legal. Unattested
  combinations are shown greyed, with a warning that nobody has seen the
  colours.
- **"neighbours of this graphic"** (§2.3) — walk the master table around a
  known id, regardless of family.

### 5.3 Collision comes last, and changing it forks the stamp

Place the art, and each cell gets the collision the index suggests (§2.2)
with its confidence. Overriding it is the operation from
[building-a-room-from-scratch.md](building-a-room-from-scratch.md) §6
Level 2 — *same picture, different behaviour* — and it has a cost:

> A stamp is the triple `(canopy, terrain, collision)`. Changing the
> collision of a placed cell cannot edit the existing stamp, because other
> cells share it. It **forks**: find-or-create a stamp with the same two
> layer words and the new collision word.

The UI has to say that out loud, because it is the one edit whose cost is
invisible in the picture:

```
cell (7,12)  collision $101F → $001F
             no stamp has that combination → +1 stamp (+8 B WRAM)
```

If a matching stamp already exists, the same edit is free — and in a room
with spare slots (room `0x34` has 12 stamps defined but never placed) it may
cost nothing even when new.

---

## 6. Computing the metatiles from a picture

The end state the title promises. Given a target image and a chosen family
set:

1. **Cut** the image into 16×16 cells.
2. **Match** each cell against the candidate graphics rendered in each of
   the seven families — a cell is `(canopy, terrain)`, so the match is over
   *pairs*, with the empty canopy as the common case.
3. **Deduplicate** the resulting triples into a dictionary — this is the
   find-or-create rule again, and it is what makes the dictionary small.
4. **Suggest collision** per distinct terrain graphic from the index.
5. **Report** the four budgets, and refuse to encode if any is over.

Step 2 is the expensive one and the only one that is really new: it is a
nearest-neighbour search over ~157 graphics × 7 families × 4 flip
combinations, per cell. For a 18×18 room that is 324 cells — tractable.
For room `0x4b` (106×125 = 13 250 cells) it needs the obvious cache on
distinct cell contents.

This step is **not in the first implementation**. Everything before it —
the index, the budgets, the suggestions, the filtered list — is what makes
it possible, and is useful on its own.

---

## 7. What gets built, in order

| Phase | What | State |
|---|---|---|
| **1** | The vanilla index (§2) + budget maths (§4), pure, tested | **done** (0.40.0) |
| **2** | Budget meter and per-graphic family/collision evidence in the tab | **done** (0.40.0) |
| **3** | Family slot picker, one slot per palette, showing every graphic vanilla draws in it (§5.1) | **done** (0.41.0) |
| **4** | Tiles grouped by the rooms that use them together (§5.2) | **done** (0.41.0) |
| **5** | Construct library: select → save with its triggers and objects → stamp (§9) | **done** (0.41.0) |
| **6** | Layer phases and the eraser (§8) | **done** (0.41.0) |
| **7** | A blank room to draft in | **done** (0.41.0) |
| 8 | Collision override with fork accounting (§5.3) | next |
| 9 | Image → metatiles (§6) | next |

## 8. Layer phases: what a stroke writes

"First draw the room, then fill it with deco" is only real if the two
write different things, so they do.

| Phase | Canopy | Terrain | Collision |
|---|---|---|---|
| **room** | from the brush | from the brush | from the brush |
| **deco** | from the brush | **kept** | from the brush |
| **erase** (deco) | blank | **kept** | the room's own, for that terrain |

The deco row is what room `0x34` actually does: its decorations are canopy
words over an unchanged terrain word (a plain floor cell is canopy `$A800`
over terrain `$4C62`; the hide on the floor is canopy `$2C66` over the same
`$4C62`). Painting a gourd onto a floor must not replace the floor, and in
this model it cannot.

**Erase** is the inverse and needs one extra decision. Taking the picture
away must take its collision with it, or removing a gourd leaves a hole you
still cannot walk through — so the restored collision is the one the room
itself uses most often on bare ground of that terrain word. Both halves are
derived from the room, not assumed:

- the blank canopy is the room's most-placed canopy word. That is `$A800`
  in every room measured (140 placements in `0x34`, 2034 in `0x76`, 3800 in
  `0x38`), and room `0x34`'s graphic at that word has **zero**
  non-transparent pixels, so erasing to it really does erase.
- the restored collision is the most-placed stamp sharing that terrain.

## 9. Constructs: the thing, not the tiles

A construct is a saved rectangle of map plus every trigger and object whose
rectangle overlaps it. The deco library is the same structure read out of
vanilla: **532 distinct Section 3 objects**, which is where gourds, pots,
chests, market stalls and fire pits already live.

Three things have to be true for a stamp to survive the move, and the first
version of this got two of them wrong.

### 9.1 A word is room-relative

A tilemap word's low ten bits index **that room's** Block 1 and its palette
bits index **that room's** seven families. Copied verbatim into another room
the same word names a different picture in different colours — which is
exactly what a stamped gourd looked like. So a cell stores

```
{ graphic, family, flags }   per layer, plus the collision word
```

and the destination rebuilds the word: `editSlotChr(adoptGraphic(graphic))
| (familySlot + 1) << 10 | flags`. Both halves are budgeted — a family takes
one of seven palette slots, a graphic one of ~264 Block 1 slots — and a cell
that cannot get a family slot is refused by name rather than drawn wrong.
Priority and the two flips are geometry, not identity, so they ride along
untouched.

### 9.2 An object's rectangle contains the floor it stands on

Measured over the 863 candidate objects (2×2 to 6×6) in all 127 rooms:

| Property | Share |
|---|---|
| terrain words inside an object rect also used **outside** every object rect | **83.4%** |
| objects whose art is in the canopy layer | 693 / 863 |
| objects with a fully blank canopy — art in the terrain layer | 170 / 863 |
| object cells whose canopy graphic draws nothing | 36.9% |

So the terrain under an object is usually the room's own ground, and
carrying it along is carrying the place rather than the thing. A layer is
therefore stored as `null` when it is background, meaning **keep whatever is
already there**; 82.2% of the library's 4081 cells leave the ground alone. A
cell that ends up all-null *and* repeats the floor's own collision is pure
bounding box and is dropped, so a 2×3 entry whose art is two cells stamps
two cells. 22 of the 863 objects reduce to nothing this way: they are
invisible collision markers, not deco.

"Blank" is tested on the pixels, not on the word. 122 of the 127 rooms use
an all-transparent graphic as their most-placed canopy word, but `0x0e`,
`0x1e`, `0x4d`, `0x72` and `0x73` have real ceiling art there — treating
that as blank would have cut the ceiling out of every object in those rooms.

Stripping the background is also what makes deduplication work: 25 gourds in
room `0x51` standing on 25 slightly different floor patches were 25 distinct
entries before and are 22 now, and the library as a whole went from 655 to
532.

The preview follows the same rule. An entry is packed into a synthetic room
exactly `w × h` metatiles in size and composited over a **transparent**
backdrop, so the thumbnail is the object with a hole where the floor was —
the picker draws a checkerboard behind it, and what you see is what the
stamp will cover.

### 9.3 A gourd is art *plus* an object *plus* a trigger

Room `0x34`'s attachments, read straight out of the blob:

```
objects   (5,5) 2x2 #0   (12,7) 2x2 #1   (11,5) 2x2 #2     <- the three gourds
bTrigger  (8,11)-(10,13) script 1854 · (14,11)-(16,13) 1857 · (15,13)-(17,15) 1860
stepOn    (11,23)-(13,24) script 1851
```

A trigger record is **not** in grid cells: it counts from the header's
origin (`0x34`'s is `(3,6)`) and its far edge is exclusive, the way
`collision-overlay.ts` draws it. So `(8,11)-(10,13)` is cells `(5,5)..(6,6)` —
exactly gourd `#0`. An earlier version compared the raw numbers with the
object's cells, took the exclusive edge for "the object's rectangle grown one
tile right and down", and matched 68 library entries. Read correctly, **188 of
the 532 library entries** carry one, 123 of them covering exactly the object.
Room `0x51`'s 25
gourds each have their own script — `0xd74`, `0xd71`, `0xd6e`, … descending
by three — which is what makes them give different things.

An entry therefore carries its object record and its B-trigger as
attachments, and stamping records them in the draft so the export can write
them. The script id is vanilla's, copied with the art: that is what makes a
stamped gourd work the moment it lands, and it is also why the editor says
so out loud, because two copies of one entry run one script and share its
"already opened" flag until one is pointed at a new one.

A selection over the hide on the floor carries neither an object nor a
trigger — hides are pure metatiles — so the library shows which is which
before you place it.

### 9.4 Four questions that make 532 findable

A nameless library is only usable if you can narrow it, and the useful
narrowings are properties the ROM already answers:

| Filter | What it keeps | Count |
|---|---|---|
| **fits** | entries every one of whose families you already have | 93 for room `0x34`'s seven |
| **works** | entries that came with a B-trigger script | 68 |
| **front** | entries that draw on the canopy alone, over any floor | 352 |
| **open** | entries with more than one state | 134 |

`fits` is the one that needed the index to change shape: an entry now
carries its **family ids**, not a count, because whether it is usable
depends on the seven the draft holds and only the editor knows those. An
entry that does not fit is dimmed and badged with how many slots it would
cost, rather than hidden — it is a decision, not an error.

All four together are "a working, foreground gourd out of my own
families": **27 entries** in room `0x34`, against 532 unfiltered.

---

## 10. What this does not solve

- **Unattested colour combinations.** The index says what vanilla drew, not
  what looks good. A graphic in a family nobody paired it with may be
  perfectly legal and perfectly ugly, and only rendering it tells you.
- **The 14-family rooms.** 18 rooms list two complete sets of 7, swapped at
  runtime. The index records both; the editor's seven-slot picker currently
  models only one set.
- **A script of its own.** A stamped gourd carries vanilla's object record
  and vanilla's B-trigger, so it works — but it runs the *same* script as
  the gourd it was copied from, and therefore shares its "already opened"
  flag. Giving a copy its own script is script-domain work, not map work.
- **Names.** The ROM stores none. An object is a rectangle of metatiles and
  an id; nothing in it says "gourd", so the picker is visual and this
  document does not invent labels either.
- **Growth.** A room whose blob gets bigger still needs somewhere to go; see
  [map_editor_ui.md](map_editor_ui.md) §6.

---

## 11. How the numbers here were measured

All probes decode the 126 rooms in `VANILLA_ROOMS` with `maps.decodeRoom`
and walk `maps.metatileTable`, counting only metatiles with `uses > 0` so
that defined-but-never-placed dictionary entries do not pollute the
statistics.

| Claim | Probe |
|---|---|
| 11028 pairs, 5628 graphics, family histogram, collision dominance | resolve both layer words per placed stamp to `(graphic, family)`; attribute `collision` to the terrain graphic |
| gourd cost 6/10/3 | cells (5..6, 4..6) of room `0x34`, stamps 10, 11, 40, 41, 52, 53 |
| three disjoint gourds | 2×2 stamp blocks at (5,5), (10,4), (11,6) of room `0x34` |
| 30574 repeated blocks; gourd occurs once | count every 2×2 stamp block per room, keep those with ≥2 occurrences |
| graphics 255 max, WRAM 32680 max | `tilePalette.length + animatedTiles.length`, and `w*h*2 + stamps*8` |
| 365 families, 157 for room `0x34`'s set | union of the index's family → graphics sets |
| master table ordered by art group | render ids 3728–3775 as a synthetic Block 1 list in family 166 |
| 83.4% of object terrain is the room's floor | mark every cell covered by a 2×2..6×6 object; collect the terrain words used **outside** that mask; test each object cell against it |
| 693/863 canopy art, 170 terrain-only | per object, does any cell have a canopy graphic with a non-zero pixel |
| 122/127 rooms have an all-transparent blank | decompress the most-placed canopy word's graphic; count non-zero palette indices |
| 99/863 objects under a B-trigger, 50 grown by one | rectangle overlap between `objects[].states[0]` and `triggers.bTrigger` |
| 532 entries, 68 with a script, 82.2% open ground | `buildDecoCatalogue`, pinned in `map-parity.test.js` |
| 352 canopy-only, 93 that fit room 0x34, 27 that are all three | filter the catalogue by `cells.every(!terrain)`, by `families` ⊆ the room's, and by `trigger` |
