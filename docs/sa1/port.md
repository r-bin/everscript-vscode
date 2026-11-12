# Porting Evermore to SA-1 — progress

Status: **stage C1 built (v0.402.0): an 8 MB SA-1 image boots and plays cycle-identical to the HiROM original in
MesenCE, with the SA-1 CPU held in reset.** `tools/sa1/convert.mts` builds it, `tools/sa1/prove.mts` proves it
(§5). Nothing runs on the SA-1 yet; that is §7.

Labels: *(Mesen source)* = read in MesenCE's `Core/SNES/Coprocessors/SA1/` and `BaseCartridge.cpp`,
*(MesenCE)* = measured in a MesenCE run, *(hardware)* = generic SA-1 knowledge, *(to verify)* = not checked on a
second emulator or a cartridge.

Background and the choice between HiROM, ExHiROM and SA-1: [../exhirom/layout-options.md](../exhirom/layout-options.md).
The ExHiROM port this follows: [../exhirom/port.md](../exhirom/port.md).

---

## 1. Why the old attempt stopped, and why this one doesn't

The earlier `evermore-sa1` investigation (2025, separate repo) declared SA-1 "not feasible as a patch". Its three
blockers were real. None of them needs the code to move:

| Blocker | What it is | What the port does |
|---|---|---|
| Header position | SA-1 carts are found by a header at file `0x7FC0` (LoROM position); Evermore's is at `0xFFC0` | the image is rebuilt, so `0x7FC0` is free to hold it (§2) |
| `$8x` banks are LoROM-style | under SA-1, `$80:8000` is file `0x200000`, not `0x008000` | a second copy of the bytes, arranged the LoROM way, sits where `$80–$BF` look (§2) |
| WRAM invisible to the SA-1 | the SA-1 CPU cannot read `$7E/$7F` | irrelevant while the S-CPU does everything; it is the C2 problem (§7) |

## 2. The idea: one image, two views

The SA-1's ROM mapper ("Super MMC") shows ROM to the S-CPU in two ways *(Mesen source: `Sa1::UpdatePrgRomMappings`)*:

- `$C0–$FF:0000–FFFF`: linear 64 KB banks, like HiROM. Each 16-bank group (`$C0`, `$D0`, `$E0`, `$F0`) shows the
  1 MB block named by a register: CXB `$2220`, DXB `$2221`, EXB `$2222`, FXB `$2223` (bits 0–2).
- `$00–$1F`, `$20–$3F`, `$80–$9F`, `$A0–$BF` at `:8000–FFFF`: LoROM-style 32 KB banks. When the register's bit 7 is
  **clear**, these stay on the default blocks 0, 1, 2, 3 whatever bits 0–2 say. When it's set, they follow bits 0–2.

So with bit 7 clear, the HiROM view and the LoROM view can show **different** blocks. Evermore's code runs in the
upper halves of `$80–$AF` and reads data through `$C0–$EF`. Both views can hold exactly what HiROM showed there:

| Block | File | Bus | Holds |
|---|---|---|---|
| 0 | `0x000000` | `$00–$1F:8000+` | bank `$00`: header (map mode `$23`, type `$35` SA-1 + RAM + battery, 8 MB), the vector table, the 23 bytes of vector entries (`CPU_VECTORS.md`) |
| 1 | `0x100000` | `$20–$3F:8000+` | unused (the derived-ROM marker at its end) |
| 2 | `0x200000` | `$80–$9F:8000+` | upper halves of HiROM banks `$80–$9F`, 32 KB each, in bank order |
| 3 | `0x300000` | `$A0–$BF:8000+` | the same for `$A0–$BF`; its second half is the HiROM 4th MB (§4) and holds the boot block at `$B8:8000` |
| 4–7 | `0x400000` | `$C0–$FF` with CXB–FXB = 4–7 | the original 4 MB HiROM view, byte for byte |

LoROM bank `n:8000+o` holds HiROM file `n·0x10000 + 0x8000 + o`, so every address the game uses (code in
`$80+`, data in `$C0+`, 24-bit pointers in scripts and tables) reads the same byte as before. No code is
rewritten, nothing is symbolised. The price is 8 MB, which is the SA-1's maximum *(hardware)*, with 1.5 MB of
duplicates. Block 1 and most of block 0 (≈ 2 MB) are free.

Other things that change on the S-CPU bus, all checked as harmless for Evermore:

- `$00–$3F/$80–$BF:6000–7FFF` is an 8 KB BW-RAM window (block 0 of BW-RAM by default). Evermore's 8 KB SRAM
  becomes BW-RAM (header SRAM size `$03`). HiROM mirrored the same 8 KB across those banks.
- BW-RAM is write-protected at reset (BWPA `$FF`, SBWE off) *(Mesen source: `Sa1::Reset`, `CpuBwRamHandler`)*, so
  the boot sets SBWE `$2226` = `$80` or saves would be lost silently.
- `$40–$4F` is BW-RAM, `$3000–$37FF` I-RAM, `$2200–$23FF` SA-1 registers. Evermore reads none of them (the ExHiROM
  audit found no `$40–$7D` or `$00–$3F:8000+` reads besides the vectors).

## 3. The boot: setting the registers without spending a cycle

At reset CXB–FXB are 0–3, so `$C0–$FF` show blocks 0–3 (the wrong ones) until the game sets them. Where and how
took three tries, all in MesenCE:

1. **A stub on the reset vector** (29 bytes before the original reset entry). Every image parted from the
   original at frame 4: the reset code seeds the RNG from the PPU counters at `$80:81A1` (`RNG_SEED_0.md`,
   `reset_handler.md`), and ~60 extra cycles gave another seed.
2. **A `JSL` after the seed** (at `$80:81E6`, `$81EF`, `$81F3`). The seed matched, but WRAM parted at frame 16
   and the RNG by frame 600: this engine is busy at ~92 % of NMIs, so **any** extra cycle drifts WRAM for good
   (measured for C-to-ROM, [../reverse-engineering/c-to-rom.md](../reverse-engineering/c-to-rom.md) §7a; the
   Everscript hotkey hack hit the same). A hook at `$81F7`/`$81FB` is too
   late: `$80:B5B6` already reads ROM through `$C0+` and the run parts at frame 9.
3. **Cycle-exact (what ships).** At power-on the reset code sets up the stack, D and DB (`$80:802D–$803B`) and
   writes 70-odd PPU/CPU registers (`$80:803C–$8109`) before it turns FastROM on (`$80:810A`, `$420D` = 1), so all
   of it is fetched at 8 master clocks per byte. At `$80:802D` a `JML $B8:8000` (4 bytes, LoROM view only) runs a
   272-byte boot block that:
   - turns FastROM on first;
   - runs the same prologue and register writes in the same order, now fetched at 6 clocks per byte (in `$B8`,
     `PHK; PLB` would give DB = `$B8`, so `LDA #$80; PHA; PLB` sets DB = `$80` and leaves the same stack byte);
   - sets CXB+DXB, EXB+FXB and SBWE+CBWE with three 16-bit stores (`$2220`, `$2222`, `$2226`);
   - leaves A, X, S, D, DB and the flags as the original leaves them at `$80:810F`;
   - pads with NOPs, 5 slow (14 clocks each, before the switch) and 5 fast (12 each);
   - jumps back to `$80:810F`.

   The original and the boot block both reach `$80:810F` at master clock **2,660** and the RNG seed read at
   `$80:81A1` at **1,624,602** *(MesenCE)*. The converter computes the padding from a cost table for the
   instruction forms involved (fetch 8 or 6 per byte, I/O writes and internal cycles 6, stack accesses 8;
   MesenCE `GenerateMasterClockTable`). Writes to `$2200–$22FF` cost the same as `$21xx`. DRAM refresh is the
   one thing the table can't predict: 40 clocks once a scanline, starting at the next cycle boundary. The
   original's stretch takes 2,346 clocks, 2,266 plus two stalls, and the block, padded to the same 2,266, gets the
   same two. A change to the block can catch a stall differently; `REFRESH_FIT` in `tools/sa1/boot.mts` makes up
   for that, and `npm run sa1:measure -- --fit` finds its value. The proof fails at frame 4 when it is off.

   *Correction (v0.403.0):* v0.402.0 carried `REFRESH_FIT` = 8, read as "the block's stalls are 8 clocks
   shorter". It was two errors in its own cost table instead (a `REP` after the FastROM switch counted as a slow
   fetch, a `REP`/`SEP` pair counted as stack accesses). With the table fixed the value is 0 and the bytes are
   the same.
4. **The game's own reset.** Script opcode `$AB` resets the game with `JML $80:8034`, with FastROM already on.
   The first version of the block replaced `$80:803C`, which the warm path also runs: its padding was timed for
   slow fetches, and the three movies that reset at frame 6186 parted there. With the jump at `$80:802D`, only
   power-on takes the boot block; the warm path runs the untouched original, and the bank registers keep their
   values across it.

Register writes during forced blank don't depend on their exact time, so moving them by a few hundred clocks
changes nothing the game can see. Nothing before `$80:B5B6` reads ROM through `$C0–$FF` (try 2), so the
setup before `$80:810F` is early enough.

## 4. The 4th MB

`$80:D113` reads `$B0:E653+`, past the end of the 3 MB ROM (`row_table_low_bytes_from_bank_b0.md`). What it
gets there depends on the cartridge or emulator, so the image says what to answer (`--upper`): `hardware` (the
real 2 MB + 1 MB cartridge, the default), `mesen` (MesenCE maps every 4 KB page there to page `0x200000`,
`BaseCartridge::Init`; used by the proof so the run that reaches `$80:D113` can match), `snes9x2005`, or `fill`.
The boot block sits in that half at `$B8:8000`, away from `$B0:E653–E6D1`.

## 5. Proof (MesenCE)

`npm run sa1:prove` builds three images and runs each against the original in MesenCE (headless testrunner,
power-on RAM zeros, each run under its own ROM name so no `.srm` carries over):

- **release**: 4th MB like the cartridge;
- **mesen**: 4th MB like MesenCE's HiROM, so it must match everywhere;
- **trap**: every byte not written on purpose is `STP` (`$DB`); the run reports every ROM byte read or executed in
  blocks 0–1 and the 4th MB.

Each trace has a CRC of WRAM `$0000–$01FF` every frame, and CRCs of WRAM, VRAM, CGRAM, OAM, SRAM/BW-RAM, the room
and the NMI counter every 60 frames. Inputs: power-on without input, then movies recorded on the base ROM that
replay as plain input. `W`, `R` and `L` events change a replay; `S`/`T`/`K` only check or mark. The
pads drift from what was played on snes9x, which is fine: both ROMs get the same pads on the same emulator.

Results (2026-11-12, MesenCE from `/Applications/Mesen.app`):

| Input | Frames | release | mesen | trap |
|---|---|---|---|---|
| power-on, no input (attract demo, 9 rooms) | 6,000 | identical | identical | identical |
| 4 movies, first 15,000 frames each (13 rooms; three of them reset the game at frame 6186) | 60,000 | identical | identical | identical |

"Identical" means every per-frame and every 60-frame CRC matched: 66,000 frames per ROM (18 minutes of play),
about 4 minutes of wall time over six MesenCE instances. None of these runs reaches `$80:D113`, so the release
image's 4th MB (which differs from MesenCE's) was not exercised.

- Bus reads after frame 60: bank `$00` shows the SA-1 header; `$80:8034`, `$C0:8034`, `$A0:8000`, `$E0:8000` read
  the original's bytes; `$40:0000` is BW-RAM.
- Trap image: in blocks 0–1 the game executes only the reset entry, the NMI `JML` and reads the NMI vector; in
  the 4th MB only the boot block runs. MesenCE hands ROM callbacks the CPU address, not the file offset; the proof
  maps it back.
- MesenCE's header scoring (`GetHeaderScore`) also scores the linear copy of the original header at `0x40FFC0` and
  breaks ties toward the later base. That would map the cart as ExHiROM around the SA-1. The linear copy's
  checksum pair is zeroed (score 8 vs 14), and the converter refuses an image where block 0 does not win.

## 6. Open questions

- **Other emulators and hardware** *(to verify)*: bsnes/ares and snes9x have their own header heuristics and
  SA-1 cores; the image is checked only in MesenCE. Real SA-1 carts and FXPak-class flashcarts may not give the
  S-CPU FastROM speed on SA-1 ROM. MesenCE does (its timing table doesn't depend on the cart). If hardware is
  slower, the timing differs, though the game would still run.
- **The bundled snes9x2005 core** has an SA-1 implementation; not tried (and it is never the reference).
- **Saves**: BW-RAM holds the save. A battery save from the HiROM ROM (`.srm`, 8 KB) should load unchanged
  *(to verify: no movie in the proof saves to SRAM and reloads it)*.
- **Longer play**: fights, menus, saving, the `$80:D113` room; none of the four movies gets far into the game.

## 7. Next steps

| Step | What | Gate |
|---|---|---|
| C1b | longer proof: every replayable movie, a save/reload, a run on ares by hand | identical / plays |
| C1c | reclaim the duplicate: block 0's 32 KB view only needs ~3 KB; block 1 is free; most of block 2–3 is code that only runs from `$8x` | free-space map in the ROM tab |
| C2 | shared state for the SA-1: the SA-1 can't see WRAM, so anything it computes must sit in I-RAM (2 KB) or BW-RAM | per-variable, from the WRAM map |
| C3 | first offload: release the SA-1 (`$2200`), give it a routine with no WRAM inputs (`functions.json` blockers), compare cycles | measured time saved in a busy scene |

C3 is where speed comes from, and also where cycle-identity ends on purpose: from then on, comparisons go by game
event (reference-emulators skill, rule 4), not frame by frame.

Code: `tools/sa1/`, explained file by file with recipes for changes in its [README](../../tools/sa1/README.md)
(`npm run sa1`, `npm run sa1:measure`, `npm run sa1:prove`). Images and reports go to `out/`, never committed.
