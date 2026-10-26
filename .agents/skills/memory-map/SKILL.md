---
name: memory-map
description: Use for any Secret of Evermore address — ROM file offset vs SNES bus address, which banks hold what, the 4th MB and ExHiROM, WRAM layout and endianness. Where address facts are written down.
---

# Evermore memory map: ROM on the bus, and WRAM

Names and meanings of individual addresses are **knowledge entries**
(`src/games/evermore/localizations/knowledge/{ram,rom}/`, the `game-knowledge` skill; live view:
`soe://ram/`, `soe://rom/`). This skill is the map they sit on. Never guess an address.

## ROM on the bus (HiROM, map mode `$31`)

A vanilla ROM is 3 MB (`0x000000–0x2FFFFF`); our builds extend it to 4 MB or 8 MB (ExHiROM).
Every 64 KB file bank *n* appears twice: whole at `$(C0+n):0000–FFFF`, upper half also at
`$(80+n):8000–FFFF` (FastROM). Shared helpers: `src/platform/snes/hirom.ts`.

| File offset | Bus | Holds |
|---|---|---|
| `0x000000–0x037FFF` | `$C0:0000–$C3:7FFF` | strings (lower halves only) |
| `0x11D000–0x11F32D` | `$91:D000` | string key table: 3002 × 3 bytes, bit 23 = compressed |
| `0x128000–0x1BFFFF` | `$92:8000–$9B:FFFF` | script bytecode (upper halves) |
| `0x1FFDE7` | `$9F:FDE7` | map pointer table (`map-format` skill) |
| `0x300000–0x307FFF` | `$F0:0000–7FFF` | our extended strings (`$B0:0000–7FFF` is WRAM/I-O, not ROM) |
| `0x308000–0x30FFFF` | `$B0:8000–FFFF` | our extended script code |

- **Execution address:** SoE's code runs from the `$8x` copy (every function the CDL recorded is
  upper-half code in `$80`, `$8C–$92`; `JSL`/`JML` operands use `$8x`). Put code labels at the
  execution address: `off & 0x8000 ? 0x800000 + off : 0xC00000 + off`; dedupe by file offset.
  Ghidra maps only `$C0–$FF`: add `$80–$BF:8000–FFFF` as file-backed blocks (`ghidra-analysis` skill).
- **Bank boundaries:** code and bytecode never straddle a 64 KB bank without a long jump; the
  everscript linker splits allocations per bank (`compiler/linker.py`, `_split_by_bank`), text
  into lower halves, scripts into upper halves (`docs/table-hack.md` §1).
- **The 4th MB is not free:** `$80:D113` reads `$B0:E653–E6D1` (file `0x30E653`), past the 3 MB
  ROM (`knowledge/rom/80d113.md`). The answer depends on the hardware or emulator (cartridge:
  `0x20E653`; bundled snes9x: `0x00E653`; Mesen2: `$FF`s). Never write there.
- **ExHiROM (8 MB):** `tools/exhirom/convert.js`; layout and proof in `docs/exhirom/port.md`. New
  space is `0x400000–0x7FFFFF` (bus `$40–$7D`); `$00–$3F:8000+` is no longer the first 4 MB, so
  new code goes at `$80+`/`$C0+`.
- PAL releases move things: US addresses do not apply to them (`docs/evermore-releases.md`).

## WRAM (`$7E0000–$7FFFFF`, 128 KB)

| Range | Role |
|---|---|
| `$7E0000–01FF` | direct page, scratch, frame counters (`$0100`) |
| `$7E0200–0FFF` | system state, input (`$0104`), ring menu, character stats (Boy `$0A35+`, Dog `$0A7F+`) |
| `$7E1000–1FFF` | entity and sprite tables |
| `$7E2210–2257` | character names |
| `$7E2258–23FF` | story and room flags (saved to SRAM) |
| `$7E2400–27FF` | markets, alchemy ingredients, weapon levels; `$2200–$27FF` persists across rooms |
| `$7E2834–28FF` | compiler TEMP RAM, cleared on room load |
| `$7E2900–FFFF` | tilemap cache, decompression scratch, script VM stack; entity records `$7E3DE5 + n·$8E` |
| `$7F0000–FFFF` | room metatile grid and table (`$7F:0000`), tile palette (`$7F:C300`), graphics and sound buffers |

- `$0000–$1FFF` in banks `$00–$3F`/`$80–$BF` mirror `$7E0000–1FFF` (so code writes `LDA $0A35`).
- Little-endian: a word's low byte comes first (`999` at `$0A35` is `E7 03`). Flags are bits of a
  byte; Everscript reads them as `<addr, bit>`, words and bytes as `<addr>`.
- Measured layout (not assumed): the CDL export (`cdl-recorder` skill) — `structs.json` (record
  bases, strides, fields), `enums.json` (values written), `ram.asm` (readers and writers),
  `functions.json` (ranges each routine touches). Only what was played is recorded.
- WRAM that the recorded play never touched (~47 KB, best block `$7E:ADFE–FFFD`), and why it is
  not yet proven free: `docs/unused-wram.md`.
