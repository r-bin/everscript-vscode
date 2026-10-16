# Porting Evermore to ExHiROM — why and how

Status: **built and proven (v0.216.0)** — `tools/exhirom/convert.js` turns a clean ROM into an 8 MB
ExHiROM image; §6 says how, §7 how it was proven. §1–§5 are the original plan, kept for the reasoning.
Facts below are marked *(core source)* when read from the
bundled snes9x2005 core (`src/emulator/core/snes9x2005-wasm/source/memmap.c`), *(repo)* when
read from our own code/docs, *(hardware)* for generic SNES facts, and *(to verify)* when they
must be checked on the running game before relying on them.

Compared with staying HiROM and with an SA-1 port (mutually exclusive as a final ROM, shared first steps): [layout-options.md](layout-options.md).

Related: [combo-rom.md](combo-rom.md) (a second game on the cartridge), `.agents/skills/memory-map/SKILL.md`
(today's HiROM layout), `docs/patches/README.md` (the 4 MB squeeze).

---

## 1. Why

Secret of Evermore is HiROM, FastROM (header map mode `$31`), 3 MB. HiROM can address at most
4 MB (banks `$C0–$FF`). ExHiROM (map mode `$25`/`$35`) addresses up to 8 MB, and it is the mapping
SMZ3 (the Super Metroid + A Link to the Past combo ROM) is the public example of for putting
several games on one cartridge.

| Reason | What it buys | Honest weight |
|---|---|---|
| **Room to grow** | Today's free space is `$F0–$FF` (1 MB). Public patches already fight for it: the 2-player patch claims `$F0`/`$FE`, the debug menu claims `$FE` *(repo: `docs/patches/README.md`)*. ExHiROM gives up to ~4 MB more. | Real, but 1 MB is plenty for scripts alone. Matters for the Mana port (maps, tiles, sprites, samples, music). |
| **Combo ROM** | SoE next to a second game on one cartridge ([combo-rom.md](combo-rom.md)). Impossible in plain HiROM: no room, and a second game needs its own bank-`$00` code. | The reason ExHiROM exists in this plan. |
| **Mana content port** | Secret of Mana rooms/art need budget (`docs/todo/romhacks-and-ports.md` §1). | Only if the 1 MB runs out. |

**Not** a reason: speed or features. ExHiROM adds no hardware; the second half of the ROM is
*slower* (see §2). If the goal is only "a bit more room", expand within HiROM first (the
existing 4 MB expansions) and port only when the 1 MB is gone or a second game is wanted.

---

## 2. What changes on the bus

File offsets are for an unheadered ROM.

| Bus range | HiROM (today) | ExHiROM |
|---|---|---|
| `$C0–$FF:0000–FFFF` | file `0x000000–0x3FFFFF` (FastROM) | same |
| `$80–$BF:8000–FFFF` | upper halves of file `0x000000–0x3FFFFF` (FastROM) | same, first 4 MB only |
| `$40–$7D:0000–FFFF` | slow mirror of `$C0–$FD` | **new**: file `0x400000–0x7DFFFF` (slow) |
| `$00–$3F:8000–FFFF` | slow mirror of the first 4 MB | **new**: upper halves of file `0x400000–0x7FFFFF` (slow) |
| header | file `0x00FFC0` (bus `$C0:FFC0`) | file `0x40FFC0` = bus `$00:FFC0` |
| CPU vectors | file `0x00FFE0` (read via `$00:FFE0`) | file `0x40FFE0` (read via `$00:FFE0`) |

*(core source: `TalesROMMap`; repo: `src/platform/cdl/rom-map.js` `busToRom` already implements
exactly this mapping, `src/platform/snes/rom-header-model.js` already looks for the header at
`0x40FFC0`.)*

Consequences, in order of importance:

1. **Everything SoE reads through `$00–$3F:8000+` or `$40–$7D` changes meaning.** Today those
   are mirrors of the first 4 MB; in ExHiROM they are *different bytes*. Code that runs from
   `$8x` and reads data through `$Cx`/`$8x` is untouched. The CDL says all 449 recorded function
   entries live in banks `$80`, `$8C–$92` *(repo: `memory-map` skill)* — good news, but the
   CDL stores file offsets, so it does **not** record which mirror a read used. §4 step 1 closes
   that gap.
2. **Vectors and the reset path move.** The CPU always reads vectors from bus `$00:FFE0+`;
   after the port that is file `0x40FFE0`. A new vector table is needed there. The handlers it
   points to run in bank `$00` first, i.e. at file `0x408000+` — put tiny stubs there that
   `JML` to the real `$80:xxxx` handlers (the same trick the current vectors play, *to verify*
   against the actual vector targets before writing it).
3. **The second half is slow ROM.** FastROM (3.58 MHz) only applies to banks `$80+` *(hardware)*,
   and the `$80–$BF` mirror covers the first 4 MB only. Code and hot tables stay in the first
   4 MB; put bulk data (graphics, music, maps, text, script bytecode that is not time-critical)
   in the second half.
4. **WRAM and SRAM are unaffected.** `$7E/$7F` are WRAM in both layouts, so the top 128 KB of
   an 8 MB image is only reachable through the `$3E/$3F` upper halves; SRAM stays at
   `$20–$3F:6000–7FFF` (`$A0–$BF`), unless a combo ROM relocates it (§5).
5. **Size byte, checksum, map mode.** Header at `0x40FFC0`: map mode `$35` (ExHiROM+FastROM),
   ROM-size byte for 8 MB (`$0D`), SRAM fields as today, and the complement/checksum pair
   recomputed over the whole padded file. Today's header (`$31`, size `$0C`) stays at
   `0x00FFC0` as ordinary bytes.
6. **Emulator detection.** The bundled core picks `TalesROMMap` (its ExHiROM mapper) when the
   map byte (masked with `~0x10`) is `$25` *and* the file is larger than 4 MB
   *(core source: `memmap.c`, `Memory.CalculatedSize > 0x400000` → `ExtendedFormat`)*. So the
   header must be right and the file must really exceed 4 MB (pad it). **Trap found while building
   it:** with a file over 4 MB the core scores the headers at `0xFFC0` and `0x40FFC0` and uses
   `0x40FFC0` only when it scores *at least as high*. Map mode `$35` scores 2 lower than `$31`
   (`(mode & 0xF) < 4` earns +2), so if the old header is left alone the image boots as plain HiROM.
   The build therefore writes the same ExHiROM header in both places (6 bytes change at `0xFFC0`).
   Any emulator that scores headers then reaches the same answer.

---

## 3. The SMZ3 model

SMZ3 shows the shape of a multi-game ExHiROM image: each game keeps its code where it already
runs, a small shared front end (reset/NMI/IRQ vectors and a dispatcher) chooses a game, each
game gets its own SRAM region, and game switching is a save-and-reload through the front end,
not a live handover of WRAM. We take only that architecture; **no code, tables or layouts are
copied** (AGENTS.md rule 0.1). Its exact bank assignments are *to verify* from public
documentation before we rely on them — [combo-rom.md](combo-rom.md) §4 records what we currently
believe, which is not yet checked.

For SoE this means: SoE stays at `$C0–$EF`/`$80–$AF` exactly as now (that is the cheapest,
lowest-risk placement), and the *other* game, the dispatcher and the vectors live in the new
bank-`$00` area.

---

## 4. How — order of work

Each step ends in something checkable. Keep the first 4 MB **byte-identical** to the current
ROM until step 5, so every existing tool (CDL, recomp seeds, patches) keeps working.

1. **Find every mirror use — the CDL does it now (v0.212.1).** The recorder keeps, per ROM byte,
   which bus forms (`$C0–$FF`, `$80–$BF`, `$00–$3F`, `$40–$7D`) executed or read it, plus the
   instruction that read through each form (`bus.cdl`, `bus-sites.bin`; export `bus.md` /
   `bus.json`, "ExHiROM audit"). Control flow keeps its bank in `edges.bin`. Record a long
   playthrough instead of building a trap image. A trap image (vanilla 4 MB followed by 4 MB of
   recognisable bytes, header at `0x40FFC0`, a hook logging reads that resolve to file
   `≥ 0x400000`) stays useful as an independent cross-check before shipping.
   **First result** (6000 headless frames, title and intro only): the only mirror-executed code is
   17 bytes in bank `$00` — the 13-byte reset entry and the 4-byte NMI `JML` (first written down as
   "17 bytes of the NMI handler", corrected in v0.216.0); the only mirror data read is the NMI vector.
   **Full result** (v0.216.0, §7): the same, plus one read the intro never makes — `$80:D113` reads
   `$B0:E653+`, past the end of the 3 MB ROM.
2. **Fix the hits** in an Asar patch (`patches/`, `snes-asm-asar-patching` skill) using
   the `exhirom` mapper (`src/platform/cdl/asar-export.js` already emits it). Re-run step 1 until
   zero hits across a full playthrough route and the intro/attract loop.
3. **Header + vectors + stubs** at `0x40FFC0`, `0x40FFE0`, `0x408000+`. Boot headless
   (`reference_headless_boot` method: bundled core under node) and compare against the original
   ROM frame by frame; the lockstep tooling (`npm run recomp:lockstep`, snes9x reference) is the
   oracle.
4. **Teach the repo about the new layout.** `soe://rom/` (`src/games/evermore/resources/rom-files.js`
   reads the header at `0xFFC0` only), the ROM tab, the map/script decoders' size and bank checks,
   and the "clean ROM" checks (3 MB, checksum) must accept 8 MB ExHiROM. The CDL pieces already
   handle ExHiROM — verify rather than assume. Update `memory-map` skill.
5. **Use the space.** Only now move or add data in `0x400000+`: new Everscript regions, Mana
   assets, a second game. Every new region is recorded in the ROM map generator and
   `map-editor-rules` budgets.
6. **(Combo only)** dispatcher, SRAM segregation, and the transition routine from
   [combo-rom.md](combo-rom.md) §5.

Milestone for the whole port: the converted ROM plays the same as the original under the
lockstep comparison, with the second half still empty. Everything after is ordinary content.

---

## 5. Risks and open questions

- **Hidden mirror reads** (step 1) are the whole risk. Reads that only happen in rare
  events (a specific boss, a menu) are missed by short runs — use the broadest recorded
  route available.
- **Existing patches** (2-player, debug menu, Ninakoru, etc.) assume HiROM addresses; stacking
  them on an ExHiROM base needs the same step-1 audit per patch.
- **Third-party tools**: some emulators/flashcarts mis-detect 4–8 MB ExHiROM when the old
  header at `0x00FFC0` also scores well. Test the target emulators (the bundled core, snes9x,
  Mesen2, bsnes) and real-hardware flashcart behaviour before promising compatibility.
- **SRAM** relocation only matters for a combo ROM; one game alone keeps its 8 KB where it is.
- **Recomp**: `snesrecomp` seeds and `functions.json` use canonical `$C0+` addresses
  *(repo: `rom-map.js` `canonical`)*; the exporter must keep the canonical address of
  second-half bytes at `$40–$7D` — already handled there, *to verify* in the generated host.
- **Do not guess SMZ3's or any other game's layout**; check public documentation and our own
  runs, and write the result down.
