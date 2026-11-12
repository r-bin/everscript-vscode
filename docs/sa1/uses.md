# What to use the SA-1 for: 50 uses, effort vs benefit

Status: **ranked list, not built.** Stage C1 ([port.md](port.md)) gives an 8 MB SA-1 image that plays
cycle-identically with the SA-1 CPU held in reset. This page lists what that image could be used for, scores each
use, and names the Evermore code or data each one touches. Nothing here has been tried.

Labels as in [port.md](port.md): *(repo)* = read in our docs/code/ROM export, *(hardware)* = generic SA-1
knowledge, *(estimate)* = our guess, *(to verify)* = check before relying on it. Every effort and benefit score is
an *(estimate)*.

How public SA-1 hacks of other games use the chip, and what that changes in this list (C2 as a whole-WRAM remap,
the SA-1 as master CPU, a speed cap): [other-hacks.md](other-hacks.md) §4.

---

## 1. What the SA-1 gives, and the catch

| Resource | What it is *(hardware)* | Who can use it |
|---|---|---|
| SA-1 CPU | a second 65C816 at 10.74 MHz; it waits when it and the S-CPU want ROM or BW-RAM in the same cycle, and the S-CPU always goes first | runs code from ROM, I-RAM, BW-RAM |
| I-RAM | 2 KB at `$3000–$37FF` (S-CPU) and `$0000–$07FF` / `$3000–$37FF` (SA-1); fastest shared memory | both |
| BW-RAM | up to 256 KB, battery-backed; `$40–$4F` and an 8 KB window at `$6000–$7FFF`; the SA-1 also sees it as a 2bpp/4bpp packed-pixel bitmap at `$60–$6F` | both (S-CPU at slow speed, *to verify*) |
| Super MMC | 8 MB in four 1 MB windows (`$2220–$2223`); C1 already uses it | S-CPU |
| Math unit | 16×16 signed multiply, 16/16 divide with remainder, 40-bit multiply-accumulate (`$2250–$2254` → `$2306–$230B`) | **SA-1 only** |
| Bit-stream reader | variable-length bit fetch from ROM/BW-RAM (`$2258–$225B` → `$230C`) | **SA-1 only** |
| Character conversion DMA | turns a packed-pixel bitmap into SNES planar tiles on the way to VRAM | set up by the SA-1, used by the S-CPU's DMA |
| Normal DMA | ROM / BW-RAM / I-RAM copies, no WRAM | SA-1 |
| Messages, IRQs, timers | `$2200` / `$2209` mailboxes, IRQ each way, an H/V or linear timer, replaceable S-CPU NMI/IRQ vectors (`$220C–$220F`) | both |

The catch, in order of how much it costs:

1. **The SA-1 can't see WRAM** *(hardware)*. Everything Evermore keeps (entities, collision, script threads, the
   RNG) is in `$7E/$7F`. Any SA-1 job first needs its inputs copied or moved to I-RAM/BW-RAM: the C2 step
   ([port.md](port.md) §7). The S-CPU can copy WRAM to BW-RAM/I-RAM with DMA through the `$2180` port (WRAM is on
   the B-bus, BW-RAM and I-RAM on the A-bus), which avoids moving variables for read-only inputs (use 4).
2. **Speed is unmeasured.** The only cycle profile is the title and intro, where 85.6 % of cycles are the
   wait-for-NMI spin at `$80:858C` ([layout-options.md](../exhirom/layout-options.md) §5). In the intro the NMI hit
   entity and collision code (`$8F:98xx`, `$8F:A3xx`, `$90:9DE8`) when it didn't hit the spin
   ([c-to-rom.md](../reverse-engineering/c-to-rom.md) §7a). Fights and big rooms have not been recorded. **Every
   speed score below assumes busy scenes are CPU-bound, not DMA/VBlank-bound.** Use 1 checks that first; if it
   says otherwise, the speed section drops a point or two across the board.
3. **Offloading ends frame-identity.** The engine time-slices, so any change in S-CPU cycles changes WRAM for
   good (c-to-rom §7a). From the first offload on, ROMs are compared by game event, not frame by frame
   (`reference-emulators` skill, rule 4). Uses that only add data or run code vanilla never reaches keep lockstep.
4. **Patches must write both copies.** Code in `$80–$BF` exists twice in the image (LoROM view, blocks 2–3;
   linear view, blocks 4–7). Tools that patch the ROM need to know that (use 9).

---

## 2. Scores

**Effort** (one person, existing tooling): 1 = days, 2 = 1–2 weeks, 3 = about a month, 4 = several months,
5 = a large rewrite.
**Benefit** (to players or hack authors): 1 = cosmetic or niche, 3 = clearly felt, 5 = changes what Evermore can be.
**Needs**: what must exist first. `R` = the offload runtime (use 2), `C2` = the inputs moved or mirrored out of
WRAM, `D1` = full pointer symbolisation ([layout-options.md](../exhirom/layout-options.md) §4), `prof` = the
busy-scene profile (use 1). **ExHiROM?** says whether ExHiROM ([../exhirom/port.md](../exhirom/port.md)) gives
the same thing without the SA-1.

### A. Groundwork (what the rest stands on)

| # | Use | Evermore detail | Eff | Ben | Needs | ExHiROM? |
|---|---|---|---|---|---|---|
| 1 | **Busy-scene cycle profile**: record fights, big rooms, many entities, Mode 7 | CDL `functions.json` already has `cycles` per function and SA-1 blockers *(repo)*; only title/intro recorded | 1 | 5 | — | — |
| 2 | **Offload runtime**: release the SA-1 (`$2200`), a job queue and mailbox in I-RAM, IRQ on completion, a "wait for job" for the S-CPU | the SA-1's reset vector goes in block 0, next to the boot block's data | 3 | 5 | — | no |
| 3 | **WRAM→BW-RAM/I-RAM variable map (C2)** per variable, from the WRAM map | [`wram-map.md`](../disassembly/engine-core/wram-map.md), `wram-map-7f.md`; 805 of 987 functions touch only WRAM ([other-hacks.md](other-hacks.md) §5.1) | 4 | 5 | D1 for moved variables | no |
| 4 | **DMA snapshots instead of moves**: the S-CPU DMAs a WRAM struct through `$2180` into BW-RAM/I-RAM for the SA-1 to read, and back | avoids rewriting every reader of a variable; costs DMA time on the S-CPU | 2 | 4 | R | no |
| 5 | **Event-based comparison** for offloaded ROMs (room, HP, flags, script trace per game event) | replaces per-frame CRCs once lockstep ends; replays from `tools/` | 2 | 4 | — | — |
| 6 | **Second emulator and hardware**: ares by hand, bsnes, an FXPak-class flashcart | open in [port.md](port.md) §6; FastROM on SA-1 ROM *(to verify)* | 2 | 4 | — | — |
| 7 | **Reclaim the duplicates (C1c)**: free-space map in the ROM tab | block 0 needs ~3 KB of its view; block 1 free; code in blocks 2–3 that runs only from `$8x` | 2 | 3 | — | — |
| 8 | **SA-1 in the CDL recorder** | `docs/reverse-engineering/cdl.md` row 7: snes9x2005's SA-1 core is unhooked; a core change, so propose first | 3 | 3 | owner OK | — |
| 9 | **Layout-aware patching**: Asar, the table hack and the Everscript compiler write both copies and know the free blocks | table hack: `tools/table-hack/`; the compiler: sibling `everscript` repo | 2 | 4 | — | partly |
| 10 | **SA-1 math in offloaded code**: replace S-CPU multiply/divide (`$4202`/`$4204` → wait → `$4214`/`$4216`) | ~140 sites read `$4216` in the Asar export *(repo)*; only helps code already on the SA-1 | 1 | 2 | R | no |

### B. Speed: moving engine work to the SA-1

| # | Use | Evermore detail | Eff | Ben | Needs | ExHiROM? |
|---|---|---|---|---|---|---|
| 11 | **Tile collision on the SA-1** | `eval_tile_collision` `$90:9DE8`, 723,906 calls in 8,414 intro frames (~86 a frame) *(repo)*; needs the collision grid in BW-RAM | 3 | 4 | R, C2, prof | no |
| 12 | **OAM built by the SA-1** in I-RAM, DMA'd straight to OAM | OAM mirror `$7E:ABDE–ADFD` *(repo: unused-wram.md)*; I-RAM is on the A-bus, so no WRAM step | 3 | 4 | R, C2 | no |
| 13 | **Entity/AI update loop in parallel** | `$8F:98xx`, `$8F:A3xx`; entity records `$4E89+`, `$5018+` *(repo)*; the engine's biggest worker, and the most tangled | 5 | 5 | R, C2, D1, prof | no |
| 14 | **Room decompression on the SA-1** into BW-RAM, then DMA | LZSS dispatcher `$8C:988D`, window `$7F:A000` ([lzss-decompression.md](../disassembly/engine-core/lzss-decompression.md)); shorter room loads | 3 | 4 | R | no |
| 15 | **Sprite tile decompression** into an I-RAM staging buffer | `obj_tile_decompress_4bpp` `$80:A55E`, staging `$7E:6C91` ([obj-tile-allocator.md](../disassembly/entities/obj-tile-allocator.md)) | 3 | 3 | R, C2 | no |
| 16 | **Tilemap streaming** for scrolling: the SA-1 builds the next row/column in I-RAM | field scroll in big rooms; the S-CPU only DMAs it | 3 | 3 | R, C2 | no |
| 17 | **Mode 7 matrices and HDMA perspective tables** with the 16×16 multiplier | `$80:BC00–F982`, matrix `$7E:1498–149E`, VBlank upload `$80:D8AA` ([mode7-overworld-engine.md](../disassembly/engine-core/mode7-overworld-engine.md)) | 3 | 3 | R | no |
| 18 | **Entity-vs-entity and projectile hit tests** (broadphase) | part of the entity loop; can be split out before use 13 | 3 | 3 | R, C2 | no |
| 19 | **RNG precomputed into an I-RAM ring**: the same generator, the same order, read instead of run | `random_number_generator` `$80:859B`, 23,509 calls in the intro *(repo)*; reseeds must flush the ring | 2 | 2 | R | no |
| 20 | **Palette fades and screen flashes** computed on the SA-1 | [screen-flash.md](../disassembly/engine-core/screen-flash.md), weather palette dispatcher `$80:9741` | 2 | 2 | R | no |
| 21 | **Weather/sky HDMA gradients** | `$80:A1B4–A330` ([weather-blending.md](../disassembly/engine-core/weather-blending.md)); runs on preset changes only | 2 | 1 | R | no |
| 22 | **Dialogue decoding ahead of the window** | `$8C:CD84`, output ring `$7F:DC1E` ([dialogue-digraph-huffman.md](../disassembly/ui/dialogue-digraph-huffman.md)); text is not slow today | 2 | 1 | R, C2 | no |
| 23 | **Bit-stream reader for decompressors** on the SA-1 | pairs with 14/15; the reader does the shift-and-test loops | 2 | 2 | 14 or 15 | no |
| 24 | **Script VM threads on the SA-1**: pure-compute opcodes run there | [docs/scripts/](../scripts/); every opcode touches WRAM state | 5 | 3 | R, C2, D1 | no |
| 25 | **Speculative next-frame work** while the S-CPU spins in `wait_for_nmi` | `$80:858C`; only for work whose inputs are already final | 4 | 3 | R, C2, prof | no |

### C. Space and memory (the mapper and BW-RAM)

| # | Use | Evermore detail | Eff | Ben | Needs | ExHiROM? |
|---|---|---|---|---|---|---|
| 26 | **Block 1 as always-mapped space**: 1 MB at `$20–$3F:8000+` (32 KB banks), no bank switching | free in the C1 image ([port.md](port.md) §2) | 1 | 4 | 9 | yes (`$40–$7D`) |
| 27 | **Table-hack tables with room to grow** | open 🔴 in [../todo/table-hack.md](../todo/table-hack.md): sprite info space in `$CA–$D3` | 2 | 4 | 9, 26 | yes |
| 28 | **Pre-decompressed assets**: rooms stored raw in free space, dispatcher told to use method `$00` | raw copy `$8C:98B1`; speed from space, no second CPU | 2 | 3 | 7 or 26 | yes |
| 29 | **Larger battery BW-RAM** (header SRAM size from `$03` up to 256 KB) as extra work RAM | WRAM has ~47 KB untouched ([unused-wram.md](../unused-wram.md)); BW-RAM adds up to 256 KB | 1 | 4 | — | no |
| 30 | **Room cache** in BW-RAM: keep the last rooms decompressed, re-enter instantly | [room-enter.md](../disassembly/engine-core/room-enter.md) pre-roll waits for metatiles/collision | 3 | 4 | 29 | no |
| 31 | **More save slots, bigger saves** | the save is 8 KB SRAM today; BW-RAM keeps it *(port.md §6, to verify)* | 2 | 3 | 29 | no |
| 32 | **Persistent extras**: NG+, bestiary, play time, kill counts | custom opcodes idea "SRAM/NG+" ([../todo/custom-opcodes.md](../todo/custom-opcodes.md)) | 2 | 3 | 29 | no |
| 33 | **More event flags for hacks** in BW-RAM, read/written by custom opcodes | flag space in WRAM is fixed | 2 | 3 | 29 | no |
| 34 | **Bank-switched content packs**: swap a 1 MB `$C0–$FF` window per chapter or mode | CXB–FXB with bit 7 clear leave the `$8x` code views alone ([port.md](port.md) §2); vanilla data must stay mapped | 3 | 3 | 9 | partly |
| 35 | **More music and samples** from the larger ROM | sound-driver uploads; music opcodes not fully decoded ([../todo/audio-and-music.md](../todo/audio-and-music.md)) | 3 | 2 | 26 | yes |
| 36 | **I-RAM as fast scratch and direct page** for the SA-1 | 2 KB; DP-relative code runs fastest there | 1 | 2 | R | no |

### D. New graphics and gameplay

| # | Use | Evermore detail | Eff | Ben | Needs | ExHiROM? |
|---|---|---|---|---|---|---|
| 37 | **More enemies and projectiles on screen** without slowdown (more entity slots) | slot tables in WRAM; depends on 13 | 5 | 5 | 13, C2 | no |
| 38 | **Variable-width font**: the SA-1 draws text into a bitmap, character conversion DMA sends tiles | longer names, translations, denser menus; [dialogue-window.md](../disassembly/ui/dialogue-window.md) | 3 | 3 | R, 29 | no |
| 39 | **Rotated and scaled sprites** (bosses, alchemy effects) rendered into a bitmap | the SA-1's best-known trick on other carts *(hardware)*; Evermore's sprite path is the OBJ cache | 4 | 3 | R, 29 | no |
| 40 | **Smarter enemy and dog AI**: pathfinding, flanking, dodging | dog AI quirks (`secret-of-evermore-engine` skill); pathfinding over the collision grid | 4 | 4 | R, C2, 11 | no |
| 41 | **Two-player co-op** with the second hero's logic and state off the S-CPU | [soe-2player-patch-analysis.md](../soe-2player-patch-analysis.md), [plans/multiplayer-mod.md](../plans/multiplayer-mod.md) | 5 | 4 | R, C2, 13 | no |
| 42 | **Automap/minimap** drawn from the collision grid into a bitmap | collision grid per room; shown in a menu | 3 | 3 | R, 29, 38 | no |
| 43 | **Particle weather** (rain, snow, sparks) as OAM or bitmap layers | weather presets `$EC:0000` | 3 | 2 | R, 12 | no |
| 44 | **Mirror mode**: the SA-1 flips tilemaps and collision while a room loads | [mirror-romhack-idea.md](../mirror-romhack-idea.md); saves authoring flipped data | 3 | 2 | R, 14 | no |
| 45 | **Randomizer generated in the game**: shuffle loot, doors, enemies at new-game from a seed | results stored in BW-RAM; scripts read them via custom opcodes | 3 | 3 | R, 29, 33 | no |
| 46 | **Heavier alchemy and damage math** for new spells (curves, multi-target) | [alchemy-damage.md](../alchemy-damage.md); fights call it rarely, so it's about what's possible, not speed | 3 | 2 | R, 10 | no |

### E. Development, debugging and practice

| # | Use | Evermore detail | Eff | Ben | Needs | ExHiROM? |
|---|---|---|---|---|---|---|
| 47 | **Practice ROM with save states on cart**: WRAM (128 KB) + VRAM + CGRAM + OAM + PPU state into 256 KB BW-RAM | WRAM by DMA through `$2180`; restoring PPU state exactly is the hard part | 4 | 4 | 29 | no |
| 48 | **Crash and event log** in battery BW-RAM: a ring buffer the S-CPU appends to, readable after a hang | complements the soe:// logs on emulators | 2 | 3 | 29 | no |
| 49 | **In-game timer and route tracker**: splits, room times, the Routes tab's route as an overlay | Routes tab ([simulation/](../../src/games/evermore/simulation/)); hotkeys via the joypad matcher | 2 | 2 | 29 | no |
| 50 | **Hotkeys and trainer on the SA-1**: watch a mailbox, apply cheats without S-CPU cycles in the joypad path | everscript hotkey hack must be cycle-exact today; the SA-1 can't write WRAM, so it only prepares | 3 | 2 | R, 4 | no |

---

## 3. Reading the table

**Best value first** (benefit ÷ effort, then benefit):

| Rank | # | Use | Eff | Ben | Why first |
|---|---|---|---|---|---|
| 1 | 1 | Busy-scene cycle profile | 1 | 5 | decides whether section B is worth anything |
| 2 | 26 | Block 1 as always-mapped space | 1 | 4 | 1 MB free today, no CPU work, keeps lockstep |
| 3 | 29 | Larger BW-RAM | 1 | 4 | one header byte; feeds 30–33, 38, 47–49 |
| 4 | 4 | DMA snapshots instead of moves | 2 | 4 | gets jobs onto the SA-1 without C2's months |
| 5 | 9 | Layout-aware patching | 2 | 4 | every other use writes the ROM |
| 6 | 27 | Table-hack tables with room to grow | 2 | 4 | closes an open 🔴 |
| 7 | 5, 6 | Event comparison; second emulator | 2 | 4 | what makes anything after C1 checkable |
| 8 | 2 | Offload runtime | 3 | 5 | the door to sections B and D |
| 9 | 14 | Room decompression on the SA-1 | 3 | 4 | self-contained (ROM in, buffer out), felt on every door |
| 10 | 12, 11 | OAM build; tile collision | 3 | 4 | the hot paths the intro already shows |

**The big ones** (benefit 5, effort 4–5): C2 (3), the entity loop (13) and more on screen (37). They are where
"less slowdown, more enemies" comes from, and they need D1, C2 and a profile first.

**Low value**: dialogue (22) and weather gradients (21) are not slow; the RNG ring (19) saves little per call and
must handle reseeds; mirror mode (44) and particles (43) are fun but niche.

**Space vs speed.** Uses 26–28, 34 and 35 are mostly a mapper benefit, and ExHiROM gives the same space flat.
If the goal is only space, ExHiROM stays cheaper ([layout-options.md](../exhirom/layout-options.md) §6).
SA-1 earns its keep with sections B, D and the BW-RAM uses (29–33, 38, 47–48), which ExHiROM can't do.

**Not on the list, on purpose:**
- VBlank/DMA-bound work (tile and tilemap uploads themselves): the SA-1 doesn't speed up the S-CPU's DMA.
- The recomp (`snesrecomp`) models only the S-CPU; an SA-1 build is out of its scope
  ([layout-options.md](../exhirom/layout-options.md) §2).
- Anything that edits the snes9x2005 core without asking (use 8 is a proposal).

## 4. A suggested order

1. 1 (profile), then decide how much of section B to plan.
2. 26, 29, 9: space and RAM with lockstep intact; 27 and 31–33 follow cheaply.
3. 6, 5: check the image elsewhere and build the event comparison before lockstep ends.
4. 2 + 4: runtime and snapshots; first job 14 (decompression, few WRAM inputs), then 12 and 11.
5. 3 (C2) for the variables the profile names, then 13 and 37.
