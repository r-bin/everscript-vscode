# Making Evermore trivially extendable: layout, fast ROM, dynamic resources

Status: **exploration (2026-11-18), nothing built.** This page asks four questions:

- What does it take until adding content to Evermore is trivial?
- Which memory map should the linked ROM use?
- How do the hot parts get the fast ROM?
- Which resources can become dynamic? The map editor is the worked example.

It builds on [README.md](README.md), [symbolic-export.md](symbolic-export.md) and [tool.md](tool.md). Labels:
*(repo)*, *(hardware)*, *(estimate)*, *(to verify)*, *(owner's call)*.

---

## 1. What "trivial" means

**Adding a resource is trivial when all four hold:**

1. **No address.** You add a folder (a room, a song, an enemy). Nobody types or picks an address, a bank or a free
   range.
2. **No engine code.** The new item is reached through the same tables and opcodes as vanilla items, by id.
3. **Limits checked at build time.** A violated limit (ids, a room's 7 palette families, audio RAM) fails the link
   with the item's path and the reason. It never fails in the game.
4. **Vanilla unharmed.** The stored playbacks still replay identically (G2), so the addition broke nothing else.

**The test:** a person who has never seen a hex address adds a room with a door to it, from the map editor, and
plays it.

---

## 2. Three layers to get there

| Layer | What it removes | Done once or per item? | Where |
|---|---|---|---|
| **1. Relocate** | fixed addresses: every item is a label, every table is generated, the linker places everything | once (the symbolic export + the linker) | [symbolic-export.md](symbolic-export.md), [tool.md](tool.md) P0–P3 |
| **2. Unlock** | engine limits that are not addresses: 8-bit ids, bank-bound pools, per-bank tables | **once per limit**, as an *extension pack*: a small set of engine patches, each proven on its own | §5, new: `mods/engine/` |
| **3. Author** | the bytes themselves: codecs and editors write folders | per kind (a codec), then free per item | [tool.md](tool.md) §6, §9 |

**Layer 1 alone already gives the vanilla limits for free.** For example 256 rooms instead of 127, 1024 palette
families instead of 365, 256 enemy types instead of 143 ([extension-tables.md](../extension-tables.md)). Most
first projects fit inside those.

**Layer 2 is where engine changes live,** and they are kept apart from content:

- Every unlock is one file in the extension pack.
- Each unlock has its own G2 proof.
- Each unlock is optional.

A mod that does not need 257 rooms does not carry the room-id patch, and its vanilla timing is untouched where
the pack is not used.

---

## 3. Which memory map

### 3.1 The fact that decides it: fast ROM is 4 MB everywhere

FastROM (3.58 MHz) applies only to banks `$80–$FF`, once `$420D` bit 0 is set (Evermore sets it at `$80:810A`)
*(hardware; repo: [../sa1/port.md](../sa1/port.md) §3)*. Banks `$00–$7F` are always slow (2.68 MHz). So:

| Layout | Total | **Fast** | Slow | Free for us *(repo: [../table-hack.md](../table-hack.md) §1, [../exhirom/port.md](../exhirom/port.md))* |
|---|---|---|---|---|
| **HiROM 3 MB (vanilla)** | 3 MB | 3 MB (`$C0–$EF`, `$80–$AF` upper halves) | — | none |
| **HiROM 4 MB** | 4 MB | 4 MB | — | the 4th MB, about half already claimed by everscript hacks (`$F0`, `$FC–$FF`) |
| **ExHiROM 8 MB** | ~7.9 MB | the same 4 MB | ~3.9 MB at `$40–$7D` (+ upper halves at `$00–$3F`) | 4th MB + all the slow space |
| **SA-1 8 MB (our dual view)** | 8 MB image | 4 MB linear at `$C0–$FF` + the code view; fast for the S-CPU in MesenCE, **on hardware *(to verify)*** | — | 1 MB unused block (`0x100000`); the 4th MB inside the HiROM copy; more only by switching 1 MB windows at run time |

ExHiROM and SA-1 don't add fast space; they add slow space (ExHiROM) or a second CPU (SA-1).

### 3.2 Recommendation

1. **Target-neutral layout.** `link` reads a *layout descriptor* per target: regions with bus mapping, size,
   speed, halves, reserved ranges. The same tree builds into any of them (`--map hirom4|exhirom|sa1`,
   [tool.md](tool.md) §12.4).
2. **ExHiROM as the default target for content.**
   - It keeps all 4 fast MB where they are.
   - It adds ~3.9 MB of slow space, which is ideal for data the CPU barely touches (§4).
   - It is already proven ([../exhirom/port.md](../exhirom/port.md)) and needs only 1 read site and 4 edges as
     seen *(repo: `bus.md`)*.
   - It runs on any flashcart that supports ExHiROM *(to verify: which ones)*, and in our snes9x core.
3. **HiROM 4 MB as the compatibility target**, for mods small enough to fit in what is left of the 4th MB, or
   where ExHiROM is not wanted.
4. **SA-1 when the goal needs the second CPU**: offloading routines, BW-RAM, the Mana combo
   ([../combo/README.md](../combo/README.md)). Its space story is worse:
   - Our dual view uses most of the 8 MB for two copies of the same game.
   - Growing beyond that means window switching, which is a run-time cost and new code.

   Keep SA-1 a target of the same tree, not the default *(owner's call)*.

---

## 4. Giving fast ROM to what needs it

### 4.1 What the speed changes

- **CPU instruction fetches and CPU reads** from ROM cost 6 master clocks per byte in fast banks, 8 in slow ones
  *(hardware; repo: [../sa1/port.md](../sa1/port.md) §3: "fetch 8 or 6 per byte")*.
- **DMA** moves a byte in 8 master clocks whatever the bank's speed *(hardware, to verify in MesenCE)*. Graphics
  that only ever go ROM → DMA → VRAM therefore lose nothing in slow ROM.
- **Data the CPU unpacks** does pay: map tiles, room blobs, compressed strings, the sound package upload.
  - map tiles: [../map-format/map_tile_graphics_decompression.md](../map-format/map_tile_graphics_decompression.md)
  - room blobs: LZSS/Markov
  - the sound package: the CPU writes every byte to the APU ports. How much of that time is handshake wait,
    and how much ROM read, is *(to verify)*.

### 4.2 Measure the heat, don't guess it

The CDL library already has the inputs, per ROM byte *(repo: `cdl-recorder` skill)*:

| Stream | Gives |
|---|---|
| `rom-hits.bin` | how often the CPU executed or read each byte (summed over all recordings) |
| `rom-cycles.bin` | master cycles per instruction: what code costs (leave out the wait-for-NMI spin, 85.6 % of all cycles) |
| `rom.cdl` / `EXT_DMA` | bytes that went through DMA, and bytes the CPU read |
| `bus.cdl` | the bank form each byte was read or run through (fast `$80+`/`$C0+` or slow) |

From these, `split` writes a **heat class** into each manifest item ([tool.md](tool.md) §3):

| Class | Rule | Placement |
|---|---|---|
| `hot-code` | executed, high cycles per byte | fast, required |
| `hot-data` | CPU-read often per byte | fast, required |
| `warm` | CPU-read, rarely (per room load, per menu) | fast if room, else slow; reported |
| `dma` | only DMA | slow is free |
| `cold` | never touched | slow; pinned until its readers are known (§4.2 of [symbolic-export.md](symbolic-export.md)) |

New items get the class of their kind, for example a new room gets the class vanilla rooms have. An item may
override it in `item.json`.

### 4.3 Placement policy

1. **Vanilla items keep their speed.** A vanilla item the CPU reads never moves to slow ROM, or vanilla timing
   breaks ([README.md](README.md) §4.5).
2. **`dma` items may move to slow ROM without a timing change**, if §4.1 holds. That is the one move that frees
   fast space and still passes G1. The CDL saw 174 KB of DMA bytes *(repo: STEPS.md, 2026-11-16)*. How much of
   that is DMA-only, never CPU-read, is the first thing to measure.
3. **New items: fast space by heat density.** CPU accesses per byte, measured on the vanilla items of the same
   kind, decide the order. Code first, then hot tables, then warm data. Whatever does not fit goes slow, and the
   link report lists it.
4. **A budget per target.** The report shows fast space used and free after every link, so a mod sees when it
   starts pushing warm data into slow ROM.

### 4.4 What this buys, roughly

Fast space for new code and hot data:

- **HiROM 4 MB:** the free part of the 4th MB.
- **ExHiROM:** the same, plus everything freed by moving vanilla `dma` items out *(estimate: tens to low hundreds
  of KB, to measure)*, plus new warm/cold content needing none of the fast space at all.

---

## 5. Which resources can become dynamic

Two meanings of "dynamic":

- **ROM-dynamic:** found through a table by id, and placed by the linker. Layer 1 gives this.
- **Engine-dynamic:** no fixed ceiling beyond hardware. Layer 2 unlocks give this, where possible.

Runtime budgets (VRAM, CGRAM, WRAM, audio RAM, entity slots) stay. But most of them are **per room**, so global
content can grow while every room stays within its own budget.

| Resource | Today bound by *(repo: [../extension-tables.md](../extension-tables.md) unless noted)* | Layer 1 (relocate) gives | Layer 2 (unlock) needed for more | Runtime budget that stays |
|---|---|---|---|---|
| **rooms** | map table in bank `$9F`, 127 | 256 | room id through the 8×8 multiply of the enter-script lookup → 16-bit multiply or a 16-bit table index | WRAM `$7F` grid ~32–40 KB; room blob ≤ 32 KB, one upper half |
| **room enter scripts** | `$92801B`, 127 | 256, with the rooms | same unlock | — |
| **map tile graphics** | `$EE0000`, 6,688 | ~21,800 *(to verify)* | none expected | **256 graphics slots per room**, VRAM |
| **palette families** | `$9CC322`, 365 (proven moved) | 1024 | none | **7 per room** (Mode 1 BG palettes, *hardware*) |
| **map objects** | per room, in the blob | per room | none | WRAM object state, ~45 per room ([../map-format/map_editor_architecture_and_limitations.md](../map-format/map_editor_architecture_and_limitations.md) §3) |
| **strings** | key table, 3,002 | ~10,900 | a second key table / bank to pass one 32 KB half | — |
| **trigger / NPC scripts** | script pointer table, 1,917 | ~21,800 | — | script bytecode never crosses a bank (linker rule) |
| **global script functions** | 256 slots, all exist | 256 | wider `call_id` operand (custom opcode) | — |
| **enemy types** | index 143, records in bank `$8E` | 256 types, 254 records | records beyond one bank → bank-aware record pointers | entity slots per room |
| **sprite graphics blocks** | `$EC0000`, `$D80000` (proven moved) | 10,922 each | none | VRAM per scene |
| **sprite palettes** | bank `$90`, full | — | the palette hook, or the bank `$90` readers taking a bank *(the hook drifts RNG)* | 8 sprite palettes in CGRAM *(hardware)* |
| **animations** | records bank-bound to `$C4`; ids 212 | 26 more groups (the pool); 2048 ids | records in a second bank → bank-aware readers | — |
| **projectiles** | movement table `$90:D986`, in full bank `$90` | — (bank full) | the table moved out of bank `$90` (readers to census) | entity slots |
| **music** | `$8C:8442` (byte offset) → `$81:9903` packages, 71 | 128 (the byte operand) | `0x33` with a 16-bit operand (custom opcode) | **audio RAM per package** |
| **sound effects** | `$8C:8362` translation table, 54 *(repo: soe://rom/assets/audio/)* | *(to verify)* | *(to verify)* | audio RAM, SFX arbitration |
| **alchemy formulas** | blocks bound to bank `$91`, 35 | — | readers untraced | — |
| **items / ring icons** | `$CE8000`, offsets inside bank `$CE`, 162 | — | bank-aware readers | — |

**Pattern:** the remaining ceilings come in three kinds:

- an 8-bit id: rooms via the multiply, songs, global functions
- a table or pool locked to one bank: records, animations, palettes, icons, alchemy
- a full bank that holds the reader's table: projectiles, sprite palettes

Each kind has one standard unlock:

- widen the operand, through a custom opcode
- make the reader take a bank along with the offset
- move the table, once its readers are known

Every unlock changes engine code, so each is a separate, proven patch in the extension pack.

---

## 6. Worked example: the map editor

### 6.1 Today

The map editor's **Export ROM…** ([../map-format/rom-export.md](../map-format/rom-export.md)) *(repo)*:

- grows the ROM to 4 MB
- writes **one** custom room at a fixed `$BD:8000`
- points **room `0x15`'s** table entry at it (Brian's test ground is sacrificed)
- writes a fixed enter script at `$BC:8000`
- patches the intro to jump there

Consequences:

- one room per ROM
- its graphics are limited to what the donor room's set plus adopted vanilla graphics allow
- no new families
- no doors from vanilla rooms to it
- `$BC`/`$BD` can collide with everscript hacks, as that page says itself

### 6.2 With layers 1 and 3

The editor saves a room as a folder, `mods/assets/maps/128-<slug>/`:

| File | Content | Linked into |
|---|---|---|
| `room.json` | size, header fields, family slots, Block 1 graphics list | the room blob (`encode.ts`, `own-room.ts`) |
| `layers/*.png` + `cells.bin` | layer 1, layer 2, collision words | the blob's grid and dictionary |
| `objects.json` | Section 3 objects | the blob |
| `enter.evs` | the enter script | everscript → the enter-script table entry 128 |
| `graphics/*.png` *(optional)* | new 16×16 map tiles | appended to the map tile graphics table |
| `families/*.json` *(optional)* | new palette families | appended to the map palette table (proven moved, 1024) |

**Doors.** A door into the new room is a script in another room (`load_map(128, x, y)`, opcode `0x22`, 16-bit
id). The editor writes it as a mod of that room's script, and the id comes from the folder name. Nobody types
an address.

**Link** (with the per-room budgets the editor already checks, `map-editor-rules` skill):

- encodes the blob (≤ 32 KB, any upper half, warm class)
- grows the map table and the enter-script table
- appends the graphics and the families
- places everything

**What still needs layer 2:**

- a 257th room: the multiply unlock
- an 8th family in one room: impossible, it is the hardware palette count
- more than ~45 objects in one room: WRAM, beyond the editor's reach

### 6.3 What it needs, in order

1. [tool.md](tool.md) P0–P3: the linker, generated map and enter-script tables. Both tables are already proven
   movable.
2. The room codec as a folder codec (P4). The encoder exists; the folder format is new.
3. Reader census for the map tile graphics table `$EE0000`. `8C:C88C` and `90:A23D` are known; more are expected.
4. The everscript compiler's reserved range for `enter.evs` ([tool.md](tool.md) §7).
5. The editor's save target switched from "Export ROM" to "save to folder" (after promotion, [tool.md](tool.md)
   §10.4). Export ROM stays as a quick test until then.

---

## 7. The order, all together

1. **Measure first** *(cheap, no build)*: from the CDL library,
   - the heat classes of §4.2
   - the DMA-only bytes (§4.3.2)
   - a check in MesenCE that DMA from slow ROM costs the same as from fast (§4.1)
2. **Layer 1**: [tool.md](tool.md) P0–P3, with the layout descriptor for `hirom4` and `exhirom` from the start.
3. **Layer 3 for rooms** (§6.3): the first kind that becomes trivial, because its encoder and editor exist.
4. **Layer 3 for songs, then enemies** ([tool.md](tool.md) P5–P6).
5. **Layer 2 unlocks, when a mod needs them**:
   - the room multiply (rooms 257+)
   - `0x33` widened (songs 129+)
   - bank-aware records (enemies, animations)
   - the projectile table out of bank `$90`

   Each one is a patch in the extension pack with its own playback proof.

---

## 8. Open questions

1. **Default target.** ExHiROM (proposed) or HiROM 4 MB? *(owner's call)*
2. **The extension pack.**
   - Is it part of our repo (engine patches are our own code), opt-in per mod?
   - Or do some unlocks become always-on once proven?
3. **DMA timing** (§4.1). Confirm in MesenCE before relying on free moves of `dma` items.
4. **SA-1 S-CPU speed on hardware** ([../sa1/port.md](../sa1/port.md) §6). It decides whether SA-1 could ever be
   the default.
5. **Room ids in saves.** The current room is saved. If it is saved as one byte, rooms 256+ also need a save
   format change *(to verify where and how wide)*.
