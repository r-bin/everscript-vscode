# Evermore + Mana on one SA-1 cartridge, Start switches the game

Status: 🧪 **research done; a working POC exists** (2026-11-15): [poc.md](poc.md). Where the POC took another way
than this page planned: NMI/IRQ go through I-RAM stubs, not the SA-1's SNV/SIV (no SA-1 CPU needed); reset uses
the spare vector slot `$FFE0`; Mana reads the pad in two places and keeps no register shadow (the combo keeps one). A separate track next to the SA-1 port
([../sa1/port.md](../sa1/port.md)) and the ExHiROM combo concept ([../exhirom/combo-rom.md](../exhirom/combo-rom.md)).
Neither is replaced. Both stay as they are. This track reuses the SA-1 image's layout idea and adds a
second game to it.

Labels: *(repo)* = read in our docs/code, *(ROM)* = read in the user's own ROM on 2026-11-15 (facts only, no bytes
kept), *(Mesen source)* = read in MesenCE's `Core/SNES/Coprocessors/SA1/` and `BaseCartridge.cpp`,
*(hardware)* = generic SNES/SA-1 knowledge, *(estimate)*, *(to verify)*.

Legal: as for every image here, the combo is built **at runtime from the user's own two ROMs** by a converter. No
bytes of either game, no state images and no code from SMZ3 enter the repo (AGENTS.md rule 0.1). Games stay apart
(rule 0.4): the combo code knows each game only through facts recorded in that game's docs, and no Evermore fact is
assumed for Mana.

---

## 1. SMZ3 and what is different here

What SMZ3 does, from its public file list and `banks.txt` (no code read; details in
[../exhirom/combo-rom.md](../exhirom/combo-rom.md) §4.1):

- Two LoROM games on one ExHiROM board, each kept at its own CPU addresses.
- The switch happens at **fixed portals** (`teleport.asm`, `transition.asm` per game). The game being left writes
  its progress to its SRAM page. The other game is **entered fresh** at a known spot from prebuilt WRAM/VRAM/SPC
  images (`sm-wram-*.bin`, `zelda-vram-*.bin`, `spc-*.bin`) plus its own SRAM page.
- So SMZ3 never pauses a running game. Each crossing is "save here, load there".

**Start-to-switch is a different mechanism: suspend and resume.** The game being left is frozen wherever the
player is, mid-room with enemies, timers and RNG. The other game continues exactly where it was frozen. That needs
a full machine snapshot of the frozen game (§5), something SMZ3 never builds. What we take from SMZ3:
one image with each game at its own CPU addresses, one SRAM page per game, the switch code apart from both games,
and hooks in a few central places instead of rewriting each game.

## 2. Why SA-1 and not ExHiROM

Secret of Mana is **HiROM, 2 MB, SlowROM** *(repo: [../mana/README.md](../mana/README.md))*. Under ExHiROM it would
have to move from `$C0–$DF` to `$40–$5F`, a bank-byte relocation through every pointer
([../exhirom/combo-rom.md](../exhirom/combo-rom.md) §2.2). The SA-1 removes that work:

| SA-1 feature | What it does for the combo |
|---|---|
| Super MMC: CXB–FXB `$2220–$2223` choose the 1 MB block behind `$C0`/`$D0`/`$E0`/`$F0` *(Mesen source: `Sa1::UpdatePrgRomMappings`)* | Each game sees **its own ROM at its own HiROM addresses**. Switching is four register writes. No relocation in either game. |
| Bit 7 clear keeps the LoROM views `$00–$3F`/`$80–$BF:8000+` on blocks 0–3 *(SA-1 port §2)* | Evermore's code view (blocks 2–3) stays where it is while Mana runs, and the reverse. |
| BMAPS `$2224`: one of 32 × 8 KB BW-RAM pages behind every `$00–$3F/$80–$BF:6000–7FFF` *(Mesen source: `Sa1::CpuRegisterWrite`, `UpdateSaveRamMappings`)* | Each game's SRAM accesses land in its own page with **no patch**: one register write per switch. |
| BW-RAM up to 256 KB (header nibble ≤ 8, MesenCE `min(SramSize & 0xF, 8)`) at `$40–$4F` *(Mesen source)* | Room for both saves **and** the frozen game's snapshot (§5). |
| I-RAM, 2 KB at `$00–$3F:3000–37FF`, owned by neither game *(hardware)* | Switch code's stack, variables and copy buffer. NMI/IRQ stubs, since it sits in bank `$00`. |
| SNV/SIV `$220C–$220F` + SCNT `$2209` bits 4/6 replace the S-CPU's NMI/IRQ vectors *(Mesen source: `Sa1VectorHandler`)* | Each game gets its own NMI/IRQ vector without a dispatcher on the vector path (§4). Catch: SCNT and SNV/SIV are written **by the SA-1 CPU** (`Sa1RegisterWrite`), so the SA-1 has to run a short program at boot and at each switch. |

The SA-1 port already shows Evermore plays cycle-identically on this board in MesenCE, and it leaves about 2 MB
free (block 1, most of block 0) *(repo: [../sa1/port.md](../sa1/port.md) §2)*.

## 3. Block layout and register values

Facts about Mana used here *(ROM, recorded in [../mana/rom.md](../mana/rom.md))*: header map mode `$21`
(HiROM, slow), ROM size `$0B` (2 MB), type `$02` (ROM + RAM + battery), SRAM size `$03` (8 KB). Its code runs in
banks `$00–$02` and also through `$C0+` (`$C0:C481`, the reset jumps to `$C1:0010`). It reads data through `$C0+`
and reads `$FF:0000` (the mirror of its `$DF`).

| Block | Bus view | Holds |
|---|---|---|
| 0 | `$00–$1F:8000+` (bit 7 clear) | **Mana's** upper halves of banks `$00–$02` in LoROM order (96 KB), the combo header, the shared vector table, and Evermore's bank-`$00` entry bytes, wherever §4 puts them |
| 1 | `$C0`/`$E0` while Mana runs | Mana file `0x000000–0x0FFFFF` (linear) |
| 2–3 | `$80–$BF:8000+` | Evermore's LoROM-arranged upper halves and the boot block at `$B8:8000`, as in the SA-1 port |
| 4–6 | `$C0`/`$D0`/`$E0` while Evermore runs | Evermore file `0x000000–0x2FFFFF` (linear) |
| 7 | `$D0`/`$F0` while Mana runs | Mana file `0x100000–0x1FFFFF` (linear). In the SA-1 port it holds Evermore's linear 4th MB, which vanilla Evermore never reads through `$F0+` (it reads its 4th MB only through `$B0`, block 3; port §4, trap image). |

| Register | Evermore active | Mana active |
|---|---|---|
| CXB / DXB / EXB / FXB | 4 / 5 / 6 / 7 | 1 / 7 / 1 / 7 (the HiROM 2 MB mirror; `$FF:0000` → Mana's `$DF`) |
| BMAPS `$2224` | page 0 (Evermore's 8 KB) | page 1 (Mana's 8 KB) |
| MEMSEL `$420D` (FastROM) | 1 | 0 (Mana never turns it on) |
| SCNT/SNV/SIV | Evermore's NMI/IRQ stubs (§4) | `$0100` / `$0104`, Mana's own vectors |

Things this layout needs to be true. The Mana CDL bus-form audit settles them (step S1):
- Mana never uses `$20–$3F:8000+` (block 1 there is linear, not LoROM-arranged), `$80–$BF:8000+` (Evermore's
  blocks), `$40–$7D` (BW-RAM or nothing), `$00–$3F:3000–37FF` (I-RAM) or `$2200–$23FF` (SA-1 registers).
- Mana's code in bank `$00–$02` is reached only through `$00–$02`, not `$03–$1F`.
- Evermore hacks that put data in the 4th MB (`$F0+`, `docs/patches/README.md`) don't fit next to Mana's second MB.
  The combo is vanilla Evermore first.

## 4. The one clash: bank `$00`

Every interrupt and the reset start in bank `$00`, and the 65816 reads one vector table at `$00:FFE0`. Block 0 must
hold Mana's whole bank-`$00` page because its code runs there. Evermore needs only 21 bytes of entry code there
*(repo: `knowledge/routines/CPU_VECTORS.md`)*:
reset `$00:8020` (13 bytes), NMI `$00:823A` (`JML $80:823E`), IRQ `$00:84EA` (`JML $80:84EE`).

*(ROM)* All three addresses are Mana code in Mana's own bank-`$00` page, and banks `$00–$02` have no run of 64
`$00`/`$FF` bytes anywhere. Mana's vectors: NMI → `$0100`, IRQ → `$0104` (both **in WRAM**: Mana writes its own
jumps there), reset → `$8004` (four setup instructions, then `JML $C1:0010`).

Resolution, cheapest first:
1. **NMI/IRQ through SNV/SIV for both games.** While Evermore runs, SNV/SIV point at two 4-byte `JML $80:823E` /
   `JML $80:84EE` stubs in I-RAM. These are copied there at boot, and I-RAM is in bank `$00`. While Mana runs they
   point at `$0100`/`$0104`, exactly its own values, so Mana's interrupt path is unchanged. The ROM vector table
   is then needed only for reset.
2. **Reset**: one 4-byte `JML` into the boot block in block 3. That needs 4 bytes of Mana's bank-`$00` page that
   Mana never executes or reads (from its CDL), or else a 4-byte trampoline that moves one Mana instruction away.
   The SA-1 boot block's timing then needs re-fitting (`npm run sa1:measure -- --fit` pattern).
3. Without the SA-1 CPU: a dispatcher on the NMI vector (`JML [$3000]` through I-RAM). That costs about 2 cycles
   per NMI, so Evermore is no longer cycle-identical to vanilla. Fallback only.

Option 1 means the SA-1 CPU runs for the first time in our work. A program of a few bytes writes SNV/SIV/SCNT, then
the S-CPU puts it back in reset (`$2200`). That matches stage C3's "release the SA-1" ([../sa1/port.md](../sa1/port.md) §7).

## 5. Suspend and resume: what a switch saves

The active game lives in the real hardware. The frozen one lives in BW-RAM:

| State | Size | How it is read / written *(hardware)* |
|---|---|---|
| WRAM `$7E0000–$7FFFFF` | 128 KB | DMA `$2180` ↔ A-bus (WRAM→cart and cart→WRAM both work; WRAM→WRAM does not) |
| VRAM | 64 KB | DMA from `$2139/$213A` (one dummy read after setting the address) / to `$2118/$2119` |
| CGRAM | 512 B | `$213B` / `$2122` |
| OAM | 544 B | `$2138` / `$2104` |
| DMA/HDMA registers `$4300–$437F` | 128 B | readable and writable |
| CPU registers, S, D, DB, P | ~10 B | pushed by the switch routine |
| PPU write-only registers, `$4200`, `$420C`, IRQ timers | ~70 B | **cannot be read**: §6 |

BW-RAM budget at 256 KB: Evermore save page 0 (8 KB), Mana save page 1 (8 KB), one snapshot ≈ 194 KB (pages
2–26). About 40 KB left. Two snapshots don't fit, so the switch **swaps in place**, chunk by chunk through an I-RAM
buffer: WRAM chunk → I-RAM (DMA), snapshot chunk → WRAM (DMA), I-RAM → snapshot (CPU `MVN`, since DMA can't copy
A-bus to A-bus). About 0.6 s per switch with the screen blanked *(estimate: ~68 master clocks a byte over 192 KB)*.
Running the third leg with the SA-1's own I-RAM→BW-RAM DMA would roughly halve it (that DMA exists in MesenCE's
`Sa1::RunDma`).

The switch routine owns nothing in WRAM while it runs: its stack and direct page are in I-RAM.

**First switch into Mana**: no snapshot exists yet. Set Mana's registers and take Mana's reset path (`$00:8004`).
Mana boots to its own title screen.
**Battery**: the snapshot is in battery-backed BW-RAM, but the active game's WRAM is lost on power-off. A valid
flag in the slot header stops a stale snapshot from being resumed after a reset.

## 6. State the CPU can't read

**PPU and CPU write-only registers.** Restored either from the game's own WRAM shadows, or from shadows the combo
keeps by hooking the few write sites that bypass them:
- Evermore *(repo: `knowledge/wram/JOYPAD1_TRIGGERED.md`, `NMITIMEN_MIRROR.md`)*: the NMI copies `$2100`, all
  eight BG scrolls and the window masks `$2123–$2125` from `$0106+` every frame, and the IRQ timers from
  `$0108`/`$010A`. `$4200` has the mirror `$0E6B`. Others (BG mode, tilemap/character bases, OBSEL, colour math)
  are written at room load and need a list.
- Mana: unknown.
- Measurement (step S2): a MesenCE script logs every write to `$2100–$2133` and `$4200–$420D` with PC and "inside
  NMI or not", over the stored playbacks. A register is **covered** if the game rewrites it from WRAM every frame.
  The rest get hooks.

**APU.** ARAM can't be read from the S-CPU, so the sound driver is reinstalled, and the music restarts its current
track from the beginning. Sound effects playing at the moment are lost.
- Leaving Evermore: driver command `$0E` makes it jump to the IPL ROM *(repo: SPC notes, `$8C:81FD` command path)*.
- Entering Evermore: its own boot-time driver upload, then `$06 M` with the music id from WRAM. The 65816 side
  keeps a rolling echo counter (`$2142`), which has to match the fresh driver.
- Leaving / entering Mana: **unknown**. Mana's sound request sits in `$95` *(repo: [../mana/wram.md](../mana/wram.md))*.
  Its driver's upload / return-to-IPL protocol is a research item. A driver that can upload a few bytes can always
  be made to jump to `$FFC0` with the IPL enabled.

**Multiply/divide results, open DMA, SPC handshakes**: these are why the switch happens only at a safe point (§7),
never at an arbitrary NMI.

## 7. The Start button

Where the switch is taken: in each game's **own field-mode input handling**, at the place where a new Start press
is acted on. The combo replaces that branch with a call to the switch routine. The game is then frozen between two
of its own instructions in its main thread. No DMA, decompression, multiply/divide or SPC upload is open, and
resume returns to the same spot. The switch only fires in normal field play. In menus, dialogue, cutscenes, room
transitions and the title, Start keeps its old meaning (or does nothing).

- Evermore: the press flags are `JOYPAD1_TRIGGERED` / `JOYPAD1_HELD` (`$0104`, consumed with `TRB $0104`, so a held
  Start counts once) *(repo: `knowledge/wram/JOYPAD1_HELD.md`)*. The field handler that reads Start: to find.
- Mana: its joypad routine and field Start handler: to find (Mana CDL + a trace of a Start press).
- The resumed game must not see the Start press that switched it away. Clear it in the game's own pad state
  before returning.

**Decision for the owner:** what each game's own Start function becomes. What Start does in each game today has
not been checked here (to verify in-game). Options: (a) Start always switches in field play and the old function
moves to Select+Start, (b) a short tap switches and a hold keeps the old function, (c) Start switches only while a
toggle is on.

## 8. Proof

Cycle identity with vanilla ends here on purpose. The Start hook adds cycles in each game's field input path (any
hook does), so proofs go by game event (reference-emulators skill, rule 4):

1. **Each game alone, Start never pressed**: each plays its stored playbacks to the same room and flag sequence
   as its original ROM in MesenCE (Evermore: `sample-playbacks`. Mana: its headless walks, [../mana/verifying.md](../mana/verifying.md)).
2. **Round trip**: switch away and back at frame N. WRAM, VRAM, CGRAM and OAM CRCs must equal the pre-switch CRCs,
   except the documented differences (music restarted, the Start bit cleared).
3. **Many switches**: a playback with a switch every k frames still reaches the same rooms.
4. **Saves**: each game's battery save lands in its own page. An existing 8 KB `.srm` of either game can be
   imported into its page by the converter.

## 9. Steps

| Step | What | Gate |
|---|---|---|
| S0 | this research | — |
| S1 | Mana bus-form audit with the CDL: banks and views used (§3 list), unused bytes in its bank-`$00` page (§4) | every §3 condition answered |
| S2 | write-only register survey for both games (§6), Mana sound driver protocol | per-register "covered / needs hook" table; a way to send Mana's driver to the IPL |
| S3 | converter `tools/combo/` (next to, not inside, `tools/sa1/`): build the block layout from both ROMs, combo header, reset `JML`, I-RAM stubs, BMAPS pages | each game boots alone in MesenCE with the other's blocks present |
| S4 | SA-1 vector program (SNV/SIV/SCNT) and the switch routine (§5) | round trip (§8.2) |
| S5 | Start hooks in both games (§7) | §8.1–8.3 |
| S6 | other emulators (bsnes/ares by hand), hardware questions inherited from the SA-1 port (S-CPU FastROM on SA-1 ROM, 256 KB BW-RAM on flashcarts) | plays |

## 10. Open questions

- Does any SA-1 board or flashcart give 256 KB BW-RAM? Commercial carts used much less *(to verify)*. With
  128 KB the snapshot doesn't fit, so VRAM would have to be rebuilt by the game's own room reload instead of
  saved.
- Can a game's room loader serve as the VRAM rebuild (a smaller snapshot, SMZ3-like) without respawning the room?
  Per game, after S2.
- Does Mana check its SRAM size or mirroring (an anti-copy test)? *(to verify)*
- Archipelago already links Evermore with other games over the network ([../exhirom/combo-rom.md](../exhirom/combo-rom.md)
  §6). The combo is worth it for the single-cartridge, instant Start switch, nothing else.
