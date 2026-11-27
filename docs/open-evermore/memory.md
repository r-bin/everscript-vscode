# Open Evermore: every memory by name

Status: **strategy (2026-11-27)**. WRAM is under way ([wram.md](wram.md), tracker
[../todo/wram-allocation.md](../todo/wram-allocation.md) W0-W10). This page covers every memory the game lays out
(WRAM, VRAM, CGRAM, OAM, ARAM, SRAM), what we know about each, how to write them down without one file per entry,
and what implode must generate before each can move. Back to [README.md](README.md).

Goal (owner, 2026-11-27): every memory is **dynamic**. Its layout is named data that implode places and that every
reader is generated from, the same way ROM resources work. Then the whole game can change: a 36th formula, a bigger
sprite cache, a longer echo, a fifth save slot.

This page decides three things:

- **What to document:** five memories beyond WRAM, each with its size, who lays it out and what must be generated
  before it can move (§1, with what vanilla uses in §2 and what the docs claim in §3).
- **How to write it down:** one map per memory plus about 30 region files, instead of one file per entry (§4).
- **The order of work:** WRAM, then SRAM, ARAM, CGRAM, VRAM; OAM only as a named limit (§5, steps M0-M6).

## 1. The memories

| Memory | Size | Laid out by | What reaches into it (what implode must generate) | Known | Dynamic means |
|---|---|---|---|---|---|
| **WRAM** `$7E-$7F` | 128 KiB | the engine's operands, all fixed | code operands (abs/long/dp), pointers built from immediates, DMA sources, script operands, data words holding WRAM addresses, the save blocks | 1,148-row map + 1,560 entries; `wram` kind (W1) | variables move and grow: tables of per-id state, slot counts |
| **VRAM** | 64 KiB (32 K words) | PPU base registers (BGnSC, BGnNBA, OBSEL) written from immediates per screen mode; DMA destinations (immediates, tables such as `$80:9539`); the allocators' slot tables | register immediates, DMA destination words, slot tables, tile numbers in tilemaps (relative to a char base) | scattered across ~25 docs, no map; measured occupancy (§2) | per screen mode: regions (maps, BG chars, OBJ chars, glyph and HUD areas, sprite caches) sized and placed by name |
| **CGRAM** | 512 B (256 colours) | palette roles: BG palettes 0-7 per room family, OBJ palettes 8-15 (Boy, Dog, pool) | palette numbers in tilemap entries and OAM attributes, palette upload destinations (queue `$7E:1292`, opcode `0x97`), cycle targets (`$7E:1372`), the WRAM mirrors (`$7E:6187`, `$7E:61A7`) | allocator docs, partly contradicting (§3) | roles reassigned by name; the 256 colours cannot grow |
| **OAM** | 544 B (128 sprites) | rebuilt every frame from a WRAM buffer | nothing outside the frame build | buffer cursor `$7E:1438`, `$7E:15D0` | nothing to place: the buffer is a WRAM variable; the sprite count is a limit to name |
| **ARAM** | 64 KiB | the sound driver (`$0700`), package records `[len][src][dest]` | package destinations (ROM data), the driver's own constants (DIR page, echo ESA/EDL, table addresses: SPC700 code) | driver, directory, tables, echo (§2) | packages relocatable, echo length and sample space traded by name |
| **SRAM** | 8 KiB (`$30:6000-$7FFF`) | the save routine: 2-byte header, 4 slots of `$331` B, checksum seeded `$043F` | slot base pointer `$7E:0B37`, the six WRAM save blocks it copies, the checksum length | [save-system.md](../disassembly/engine-core/save-system.md), [growable-items.md](../todo/growable-items.md) | the save format follows the WRAM save blocks (W8); slot count and size by name |

Not memories to lay out: the CPU and PPU registers (`$21xx`, `$42xx`, `$43xx`) and the DSP registers are hardware,
named once in `src/platform/snes/` for every game. Direct page and the stack live inside WRAM and are WRAM entries
(their readers are the hardest blocker class, [wram.md](wram.md) §2). The SA-1 port's BW-RAM and I-RAM belong to that
build ([../exhirom/README.md](../exhirom/README.md)), not to vanilla.

## 2. What the game uses: measured

In both playbacks **4 KiB of VRAM is never written** (bytes `$1800-$1BFF`, `$3000-$3BFF`) and **ARAM's 10 KiB echo
buffer holds data in only 6 % of samples**: the first free space to claim, once field play confirms it (M2).

Both stored playbacks (`intro-2m20`, 8,414 frames; `attract-loop`, 6,224), vanilla US, every 4th frame, per block:
*used* = the block held a non-zero byte, *churn* = it changed since the last sample (`node tools/open-evermore/memory-probe.mts <rom> <movie>`, debugger
core `_getSpacePtr`, 2026-11-27). Intro and attract only: field play, menus and Mode 7 flight still need their own run (tracker M2).

**VRAM** (byte offsets; a VRAM word address is half):

| Bytes | Used | Churn | Reading |
|---|---|---|---|
| `$0000-$17FF` | 70-99 % | 6-11 % | tilemaps (BG scroll seams write here every few frames) |
| `$1800-$1BFF` | **never** | 0 | free in both playbacks |
| `$1C00-$2FFF` | 28-48 % | ~1 % | loaded per scene |
| `$3000-$3BFF` | **never** | 0 | free in both playbacks |
| `$3C00-$A7FF` | 91-99 % | <1 % (`$5800`, `$6400`, `$8000`: 6-10 %) | character data, mostly static |
| `$A800-$B3FF` | 90 % | **22-47 %** | the hottest area: streamed sprite tiles |
| `$B400-$FFFF` | 32-73 % | 1-4 % | loaded per scene |

The BG3/BG4 base shadow `$7E:010C` read `$04` (BG3 characters at word `$4000`) in 92 % of samples, `$06` in 8 %.

**CGRAM**: BG palettes 0-7 always loaded; OBJ palettes 8-10 used in under 10 % of samples, 11 in 11 %, 12 in ~65 %,
13 in 42 %, 14-15 in 96 %. The intro's actors take the top OBJ palettes; field play will differ.

**OAM**: the low table's first `$C0` bytes (48 sprites) churn, the rest almost never: these scenes draw fewer than
50 sprites.

**ARAM**: `$0000-$07FF` churns (driver zero page and stack, port work), `$1800-$1BFF` 30 % (driver state), `$FC00-$FFFF`
75-80 % (above the echo buffer); `$D400-$FBFF` is written in only 4-5 % of samples (the echo buffer, EDL 5, written
only while echo is on). Static between song changes: everything else. Known layout, as written down so far:

| ARAM | What | Source |
|---|---|---|
| `$0000-$01FF` | driver direct page, stack | measured churn |
| `$0200` | room for an IPL helper (the combo POC's 32-byte routine) | [../combo/poc.md](../combo/poc.md) |
| `$0700` (+6,112 B) | the driver, uploaded at boot from `$81:80DC` | [akao-vs-wolfgang.md](../disassembly/audio/akao-vs-wolfgang.md) |
| `$1F00+` | sample directory, 4 B per sample (DIR page `$1F`) | same |
| `$2000-$2350` | instrument and SFX pointer tables | same |
| `$2400-$3ABF` | unused by every package (5.8 KB) | `dump_spc.py` budget, 2026-10-08 |
| `$2E00+` | a pointer the package sets | akao-vs-wolfgang.md |
| samples, sequence | above, the sequence near the top of the sample area | same |
| `$D400-$FBFF` | echo buffer (ESA `$D4`, EDL 5 = 10 KiB) | same, measured |
| `$FFC0-$FFFF` | IPL ROM (hardware) | SNES fact |

Budget: 9-36 KB free per music, median 17 KB; largest package 27,738 B of 36,674 B.

## 3. What the docs say and must be checked

The VRAM and CGRAM facts sit in ~25 disassembly docs, many machine-written; some disagree. Before any becomes a map
row it needs a trace or a register read:

- `nmi-vblank.md` calls `$7E:0106` the INIDISP shadow; the WRAM map has `JOYPAD1_TRIGGERED` there.
- OBSEL: `$03` (sprite base word `$6000`, `$8C:B769`), `$63` (field set-up) and `$02` (Mode 7) are all quoted; each may
  be right for its screen, none is tied to a screen mode yet.
- BG3 in the field: tilemap at word `$0800` (`field-hud.md`) with the HUD gauge tile `$3E9` at word `$1F48` (base 0),
  while the intro/attract shadow reads BG3 characters at `$4000` (§2).
- Sprite palettes: `palette-allocator.md` gives 8 OBJ slots (`$7E:0DE0`, Boy 0, Dog 1); `WEAPON_PALETTE`/`DOG_PALETTE`
  hold CGRAM byte offsets `$40-$C0`, which are BG palettes 2-6 if read literally.
- VRAM addresses: some docs give word addresses, some byte offsets, often without saying which (`$0800` is both
  "BG2 at `$0800`" and "BG3SC `$08`" = word `$0800`). **A VRAM address in a map row is always a word address** and
  says so (`w$0800`); our probes report bytes.

## 4. How to write it down: one map per memory, not one file per entry

Today WRAM is written three times: 1,560 knowledge files (`knowledge/wram/*.md`), the 1,148-row WRAM map
(`data/wram-map.md`, plus its parity copy in `docs/disassembly/engine-core/`), and 1,216 `wram/<NAME>.json` files in an
exploded tree. Most of it is thin: **1,344 of the 1,560 knowledge files have at most two lines of body** and 959 carry only
`evidence: ["cdl", "disasm"]`; **~560 are numbered repeats of ~90 patterns** (`ENTITY_SLOT_N_HP` for 11 slots,
`WINDOW_N_*` for 10, `cgram_queue_slot_N` ×32). One file per entry costs reads, makes renames touch hundreds of files and
says nothing a row would not. The strategy separates the two jobs the files do:

### 4.1 Knowledge (what vanilla does): a map per memory, prose only where there is prose

- **One map per memory** in `src/games/evermore/localizations/data/`: `wram-map.md` and `wram-map-7f.md` (exist),
  `vram-map.md`, `cgram-map.md`, `aram-map.md`, `sram-map.md` (new, rows from §2 and checked §3 facts). A row is the
  whole entry for a thin fact: address, name, type, lifetime, tags, confidence, one-line summary, evidence.
- **A knowledge file only for an entry with prose**: notes, a `Previously believed`, bits, per-room layouts (the ~216
  entries with a real body). A row links to it; a thin file folds into its row (its one line becomes the summary, its
  evidence the row's).
- **Types, not copies**: a struct or a repeated record is one type in `data/types.json` (fields with offsets, sizes, names)
  and one row `ENTITY_SLOTS` of type `Entity[11]`; a field is reached as `ENTITY_SLOTS[3].hp`. The 110 entity-slot
  files (`ENTITY_SLOT_<n>_*`), 232 window files (`WINDOW_<n>_*`) and 32 queue-slot files become 3 rows and 3 types. `soe://ram/<addr>` resolves an address
  inside to the element and field, as `end:` does now.
- **Per screen mode** (VRAM, CGRAM): a map has a section per mode (field, menu, dialogue overlay, Mode 7 flight, title)
  because the same bytes mean different things there; a row says which mode.

### 4.2 Layout (where a build puts it): a few region files per memory in the exploded tree

The exploded tree holds what implode reads: names, sizes, order, constraints. Not one file per variable:

```
memory/
  types.json                 structs and enums the regions use (Entity, Window, CgramQueueEntry, AlchemyEffect)
  wram/<region>.json         one file per region of the WRAM map's areas: system, input, rng, entities, windows,
                             save/<block>, room_scratch, …  (~30 files instead of 1,216)
  vram/<mode>.json           field, menu, flight, title: the regions of each mode
  cgram/<mode>.json          palette roles per mode
  aram.json                  driver, directory, tables, samples, echo
  sram.json                  header, slots, checksum
```

A region file is an ordered list from a base; each address follows from the order and the sizes, as in a linker script or
a C struct:

```json
{ "format": "open-evermore/memory", "version": 1, "space": "wram", "base": "$7E:0100", "life": "boot",
  "items": [
    { "name": "PPU_FRAME_COUNTER", "type": "u32" },
    { "name": "JOYPAD1_HELD", "type": "JoypadButtons" },
    { "name": "JOYPAD1_TRIGGERED", "type": "JoypadButtons" },
    { "gap": 3 },
    { "name": "RNG_SEED", "size": 8, "pin": true },
    { "name": "ENTITY_SLOTS", "type": "Entity", "count": 11 }
  ] }
```

- `gap` is bytes nothing is known to use (named `unknown_<addr>` when something does use them, unnamed). A gap is free
  space only once a run says so (§2 for VRAM and ARAM).
- `pin` keeps a variable at its vanilla address until every reader can be generated (W2); at first every item is pinned
  and implode refuses a change of place (`wram-moved`, as today). An item leaves `pin` when its reader census is complete.
- `count` and `size` are where growth happens: `"count": 36` on the formulas' arrays once W10 rewrites their readers.
- Vanilla addresses are per release (US and PAL builds differ, [../evermore-releases.md](../evermore-releases.md)): the
  region files carry none; `evermore/map/<release>.json` holds each release's vanilla bases ([mapping.md](mapping.md)),
  and `--strict` checks the files against them.
- The other kinds keep naming WRAM by name (`wram/DOG_BISCUIT`), now also by field (`wram/ENTITY_SLOTS[0].hp`); VRAM,
  CGRAM and ARAM regions get typed links the same way (`vram/field/sprite_cache`, `cgram/field/boy`).

**Built for WRAM (v0.474.0, [wram.md](wram.md) §0):** 7 regions, not ~30: a cut must not split a WRAM map entry, and the
map's `areas` do (the weather buffer runs from `$2110` past `$2200`, `MAP_ANIM_FRAMES` past `$5000`). So the regions are
the cuts where the engine's reach changes (direct page, low mirror, data bank `$7E`, long) plus the save area and temp[].
The format is `open-evermore/memory` (`space`, `region`, `items`), no `base` (the mapping file has it), no `pin` (every item
is pinned until W2), the types in `wram/_types.json`. VRAM, ARAM, CGRAM and SRAM get the same files under their own
folder once their maps exist (M3-M6), with their regions in the mapping file's `memory.<space>`.

The region files are generated from the maps (owner's W1b: "generate the wram/ folder from the wram map"): explode
writes them from `data/*-map.md` and `types.json`, never from a list of its own.

## 5. What dynamic needs, per memory, in order

1. **WRAM** (most value, most started): W1b (one source, the map), then the region files (M1), then W2-W10. Everything
   below references WRAM buffers, so it goes first.
2. **SRAM** (small, follows WRAM): once the save blocks are regions with a `save` life (W8), the save format is generated
   from them: block order, slot size (`$331` today), slot count, checksum length. A save from one layout does not load in
   another: the manifest names the save format.
3. **ARAM** (self-contained, big payoff): the package records' destinations are ROM data, so implode can already generate
   them from `aram.json`; the driver's constants (DIR page `$1F`, ESA `$D4`, EDL, table bases `$2000`/`$2E00`) are SPC700
   immediates found by reading the driver once. Then: a shorter echo buys up to 10 KiB of samples; `$2400-$3ABF` is free.
4. **CGRAM** (roles, not growth): name the roles per mode first (which palette is the Boy's, which are the pool), then
   generate the role numbers where they are immediates. Tilemap palette bits are room data (maps kind) and follow the
   room's palette family.
5. **VRAM** (hardest: per mode, many writers): measure per mode (M2), name the regions, then generate the base register
   immediates and DMA destinations. The sprite caches (`$7E:1288` 3-slot cache, the 16×16 macro-tile LRU at
   `$7E:AB18`/`$80:9539`) are where growth pays: a bigger cache means fewer streamed tiles.
6. **OAM**: only the limit (128 sprites, the buffer's size) as a named constant.

Every step proves itself the WRAM way: `--strict` builds vanilla, a moved region plays the stored playbacks in step
([wram.md](wram.md) §2), and a probe of the space (§2) shows the new layout in use.

The steps, one line each (detail and state in the tracker, [../todo/wram-allocation.md](../todo/wram-allocation.md)):

| Step | What | State |
|---|---|---|
| M0 | Measure what vanilla writes in VRAM, CGRAM, OAM, ARAM (intro and attract) | ✅ v0.473.1 |
| M1 | One map per memory, thin entries folded into rows, repeated slots as types; region files; vanilla bases per release (needs W1b) | 🟡 WRAM's region files (7) and bases (`memory.wram`), v0.474.0 |
| M2 | The probe per screen mode, PPU base registers read from the core; settle §3 | 🔴 |
| M3 | SRAM map and `sram.json`, generated from the save blocks once W8 lands | 🔴 |
| M4 | ARAM map and `aram.json`: driver constants, generated package destinations, a shorter echo as the proof | 🔴 |
| M5 | CGRAM map and `cgram/<mode>.json`: roles per mode, role numbers generated | 🔴 |
| M6 | VRAM map and `vram/<mode>.json` (word addresses): regions, registers, DMA destinations, cache slot tables; a bigger sprite cache | 🔴 |

## 6. Open questions for the owner

- **Next step:** the format change (M1, after W1b) or the per-mode measurement (M2)? M1 changes the knowledge loader,
  the map checker and `soe://ram/`; M2 changes no format and settles §3 first.
- **Addresses in region files:** assumed none (each release's bases only in its mapping file); the alternative is an
  `at` per region for reading.
