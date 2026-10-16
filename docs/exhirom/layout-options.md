# Evermore ROM layout: stay HiROM, ExHiROM, or SA-1?

Status: **comparison and recommendation, nothing built.** Companion to
[port.md](port.md). Labels: *(repo)* = read in our code/docs/ROM,
*(core source)* = read in the bundled snes9x2005 core, *(hardware)* = generic SNES knowledge,
*(estimate)* = my effort guess, not a measurement, *(to verify)* = check on the running game
before relying on it.

---

## 1. Evermore's ROM map today

Unheadered, 3 MB (`0x000000–0x2FFFFF`), header at file `0x00FFC0`, map mode `$31` (FastROM
HiROM) *(repo: ROM header; `docs/map-format/rom-map.md` §1)*. Every byte has two or three bus
addresses: `$Cx` (full bank), `$8x` (upper half, FastROM), `$00–$3F:8000+` and `$40–$7D`
(slow mirrors).

| File range | Bus (execution address) | Content | Room to grow |
|---|---|---|---|
| `0x000000–0x03FFFF` | `$C0–$C3`, code in `$80`, `$8C+` | engine entry, string tables, vectors, header | none |
| `0x080000–0x1BFFFF` | `$88–$9B`, `$8C–$A8` | engine core, script VM, script bytecode, room blobs | none |
| `0x1C0000–0x2FFFFF` | `$9C–$AD` | more room blobs and scripts | none |
| `0x300000–0x3FFFFF` | `$B0`, `$F0–$FF` | **free** in vanilla; claimed by expansions (2P patch `$F0`/`$FE`, debug menu `$FE`, our extension region `$B0:8000`) | ≈ 1 MB, contested |
| above `0x400000` | — | **does not exist** under HiROM | ExHiROM or SA-1 only |

The rows are coarse; the authoritative per-bank breakdown is the generated ROM tab
(`src/games/evermore/rom`, `docs/map-format/rom-map.md`). Do not read this table as exact bank boundaries.

Two repo facts drive everything below:

- All 449 recorded function entries are upper-half code in banks `$80`, `$8C–$92`; JSL/JML
  operands use `$8x` *(repo: `memory-map` skill)*.
- Scripts, string pointers and tables hold **24-bit pointers with `$8x`–`$Bx` banks** *(repo:
  `memory-map` skill)*. Whatever layout changes what `$8x` means must rewrite them.

---

## 2. The options

| | **A. Stay HiROM** | **B. ExHiROM** | **C. SA-1** |
|---|---|---|---|
| Header map mode | `$31` (today) | `$35` (`$25` slow) at file `0x40FFC0` | `$23`, SA-1 chip declared, header at file `0x7FC0` (LoROM-style position) |
| Max ROM | 4 MB (1 MB free) | ~7.9 MB flat (`$40–$7D` + `$3E/$3F`; `$7E/$7F` are WRAM) | 8 MB, but seen through **1 MB windows** set by mapper registers |
| How the S-CPU sees ROM | `$C0–$FF` linear, `$8x–$Bx` upper halves of the same 64 KB banks | `$C0–$FF` and `$80–$BF` as A (first 4 MB), `$00–$7D` show the second 4 MB | `$C0–$FF` linear windows (like HiROM), but `$00–$3F`/`$80–$BF:8000+` are **32 KB-packed LoROM-style** — `$80:802D` is file `0x20002D`, not `0x00802D` *(repo: evermore-sa1 findings)* |
| Does `$8x` code still work? | yes | **yes** (unchanged) | **no** — every `$8x`/`$9x`/`$Bx` reference must become `$Cx` (same bytes, linear window) |
| Vectors / header | file `0x00FFxx` | new copy at file `0x40FFxx` + stubs | file `0x7FC0–0x7FFF`, which today holds string data that must move |
| CPU speed | S-CPU, FastROM | S-CPU; 2nd half slow ROM | S-CPU **plus** a 10.74 MHz second 65816 *(hardware)*; S-CPU ROM speed vs today's FastROM *(to verify)* |
| RAM | WRAM 128 KB, SRAM 8 KB | same | adds I-RAM 2 KB and BW-RAM (typ. 64–256 KB, battery-backable). **SA-1 cannot see the S-CPU's WRAM**, so anything it shares must live in BW-RAM/I-RAM *(hardware; repo: sa1_no_low_hanging_fruit)* |
| Extras | — | none | hardware multiply/divide, character-conversion DMA, bitmap BW-RAM |
| Combo ROM (2nd game) | no | **yes** — the SMZ3 shape | no known precedent *(to verify)* |
| Emulators in our stack | all | bundled core has the mapper *(core source: `TalesROMMap`)* | bundled core has an SA-1 core *(core source: `sa1.c`)*, accuracy vs bsnes/Mesen2 *(to verify)* |
| Real hardware | any flashcart | any flashcart | flashcarts with SA-1 (FXPak Pro class) *(to verify)* |
| Recomp (`snesrecomp`) | works | canonical `$40–$7D` handled by our exporter *(repo)*; host *(to verify)* | no SA-1 support in our pipeline; the recomp would model only the S-CPU |

---

## 3. Mutually exclusive?

**As the final cartridge: yes.** A cartridge declares one mapper. ExHiROM is a plain mapping
(no chip); with SA-1 the S-CPU sees ROM only *through the SA-1's own mapper*, so an
ExHiROM header and an SA-1 header cannot both be real. You cannot have SA-1 and the `$00–$7D`
flat 8 MB view.

**As work: mostly no.** Both need the same first two steps:

1. **De-mirror audit** — find and rewrite every read/execution that relies on a mirror
   ([port.md](port.md) §4 steps 1–2). For ExHiROM that is only the `$00–$3F:8000+`/`$40–$7D` users;
   for SA-1 it is *all* `$8x–$Bx` users too, a superset.
2. **Symbolise every pointer form** so code and data can move (the "shiftable disassembly",
   `docs/reverse-engineering/asm-to-c-port.md` §4, §8.1). The byte-identical Asar export from the
   CDL exists; full symbolisation of pointer tables does not.

What is **not** reusable between B and C: the ExHiROM header/vector/stub block, and any data
placed in the second 4 MB (SA-1 needs window switching to reach it).

---

## 4. Effort and benefit

Effort figures are *(estimate)*, for one person with the existing tooling (CDL, Asar export,
headless boot, lockstep). "Boots and plays identically" means the converted ROM matches the
original under `npm run recomp:lockstep`.

| Work item | Effort | Needed for | Gives |
|---|---|---|---|
| A0. Compress / dedupe to free space inside HiROM | days | A | a few hundred KB, no layout risk |
| D0. De-mirror audit with the trap-image test | 1–2 weeks | B, C | a list of mirror users with evidence; also helps recomp |
| D1. Full pointer symbolisation (shiftable disassembly) | 1–3 months | C (and big moves in B) | code and data can move; also unblocks mashups (G5) |
| **B. ExHiROM boots and plays identically** | **+1–2 weeks after D0** | B | header, vectors, stubs; 2nd half empty but usable |
| B-content. Use the extra space (Mana assets, new regions) | per feature | B | up to ~4 MB more, slow ROM |
| B-combo. Dispatcher, SRAM split, transitions | 1–3 months | B | a second game on the cartridge |
| **C1. SA-1 boots and plays identically (S-CPU does everything)** | **+2–4 months after D1** | C | SA-1 mapper, 8 MB windows, BW-RAM; **no speed gain yet** |
| C2. Move state the SA-1 will touch from WRAM to BW-RAM/I-RAM | 1–3 months | C | prerequisite for any offload; touches the whole engine |
| C3. Offload chosen routines to the SA-1 (per routine) | days–weeks each | C | real speed; start with the 12 blocker-free functions and the ~190 WRAM-only ones from `functions.json` *(repo: cdl-recorder §148)*; cycle counts per function are not recorded yet |

The earlier `evermore-sa1` investigation concluded "not feasible as a patch" and "years" for a
full conversion *(repo: `../evermore-sa1/README.md`)*. Its blocker analysis is right (header
position, LoROM-style `$8x` windows, WRAM invisibility). The estimate above is shorter because
the CDL, the byte-identical Asar export and headless lockstep did not exist then, and because
C1 only needs `$8x → $Cx` plus moving a few KB at file `0x7FC0`, not a new engine. It is still
the largest item in this document.

### Benefits compared

| Benefit | A | B | C |
|---|---|---|---|
| More ROM for rooms, music, art | little | **large, flat** | large, banked |
| Second game on one cartridge | no | **yes** | unlikely |
| Faster/less slowdown in busy scenes | no | no | **yes, after C2+C3** |
| More RAM (BW-RAM) for bigger tables, saves | no | no | **yes** |
| Risk to existing patches/tools | none | low (first 4 MB identical) | high (all banks change) |
| Reversible / bisectable | n/a | yes, byte-identical first half | each step lockstep-checked, but the layout flip is one big step |

---

## 5. Staged plan: CDL → recomp → ExHiROM → SA-1

Each stage produces the input of the next and ends in something that can be checked. The
recorder (v0.212.1) now writes what stages 3 and 4 need, so recording can start before the
later stages are built.

| Stage | Input | Output | Gate (checkable) | Recorder support |
|---|---|---|---|---|
| 1. **CDL** | play the game | library: code/data, edges, rets, regs, hit counts, **bus forms, mirror read sites, cycles per instruction** | coverage of the ROM; the ExHiROM audit in `bus.md` stops changing over new play | `bus.cdl`, `bus-sites.bin`, `rom-cycles.bin` → `bus.md`, `bus.json`, `functions.json` (`cycles`, `execForms`, `readForms`) |
| 2. **Recomp** | the library | byte-identical Asar project + snesrecomp host; every pointer symbolised (shiftable) | recomp lockstep vs snes9x; rebuild is byte-identical | `functions.json`, `recomp/cfg`, tables/structs/enums |
| 3. **ExHiROM** | stage 1 audit + stage 2 project | 6–8 MB image, header/vectors/stubs, first 4 MB identical | `bus.md` ExHiROM audit empty (except vector stubs), lockstep identical | audit lists exactly what to rewrite; the NMI stub at `$00:823A` is the known item |
| 4. **SA-1** | stage 1 SA-1 audit and cycles + stage 2 shiftable project | `$8x → $Cx` rewrite, header at `0x7FC0`, BW-RAM variable map, then per-function offload | boot identical; then per-function lockstep; measured cycles drop | SA-1 audit (every non-`$C0` form), `functions.json` blockers, **cycles per function** to pick candidates |

Notes on what the first recordings already say (headless, title and intro screens only — do not
extrapolate to fights or big rooms):

- **ExHiROM is nearly free**: only the NMI handler's first 17 bytes ran through bank `$00`.
- **SA-1 is a big rewrite**: about 27,000 executed bytes, 78,000 read bytes, ~300 reading
  instructions and ~1,600 control-flow edges use `$80–$BF`, all of which become `$Cx`.
- **There is nothing to speed up there**: 85.6 % of the recorded cycles are the wait-for-NMI
  spin at `$80:858C` (`knowledge/rom/80858c.md`). One frame measures ≈ 355,000 master cycles,
  matching the 357,368 of a real frame, so the counter is trustworthy. Record busy scenes
  (fights, large rooms, many entities) before judging SA-1: if they also idle most of the frame,
  SA-1 buys little.

## 6. Recommendation

1. **Do D0 now.** It is the first step of both, small, and valuable on its own.
2. **Pick the target by the goal, not by habit:**
   - Goal is *space and/or a second game* → **B**. Cheap, safe, reversible. SA-1 gives nothing for a combo ROM.
   - Goal is *a better-performing, bigger Evermore* → **C**, which also covers the space goal
     (8 MB), so ExHiROM is wasted effort for a single-game ROM. Budget D1 first.
   - Goal is *both* → build **B** as the shippable milestone, and treat C as a separate
     fork of the same shiftable disassembly (the final ROM can only be one of them).
3. **Do not put content in the second 4 MB** until the target is decided; that is the one
   piece of work B-only data would not carry to C.
4. Before committing to C, measure: the CDL records cycles per instruction since v0.212.1
   (`functions.json` `cycles`, `bus.md` "Cycles"); record busy scenes and confirm that the engine is CPU-bound where the S-CPU
   cannot be relieved by other means. If the slowdown is DMA/VBlank bound, SA-1 will not fix it.

Orthogonal options that work with A, B or C and need no layout change: streaming music via
MSU-1 (emulator/flashcart-dependent), and the existing patch toolchain (`ips2asar`) for community
patches.
