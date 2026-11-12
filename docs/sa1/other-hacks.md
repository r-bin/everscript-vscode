# Public SA-1 hacks of other games: what they use the chip for, and how

Status: **survey, read 2026-11-12** from the projects' READMEs and docs, news write-ups and the authors' posts
(sources at the end). Nothing here was run or disassembled by us. The aim is to compare their approach with ours
([port.md](port.md), [uses.md](uses.md)) and change the plan where they know better.

Legal: these projects' code and tables are not used here, and SA1-Root states no license. This page holds only
what their documentation says, in our own words, and links. Same rule as for any third-party project
(`AGENTS.md` rule 1).

---

## 1. The hacks

| Hack | Author | Base game's map *(to verify)* | What the SA-1 does | RAM moved | BW-RAM | Result they report |
|---|---|---|---|---|---|---|
| **SA-1 Pack** (Super Mario World), v1.41 | Vitor Vilela and contributors | LoROM | heavy routines called on the SA-1; some run in parallel with the S-CPU; sprite and level code | direct page → I-RAM `$3000`; `$0100–$1FFF` → BW-RAM window `$6100+`; sprite tables, the level's block map and old SRAM → BW-RAM `$40/$41`; the rest stays in WRAM | yes (sizes in its docs) | "3× to 7×" faster; 22 sprites on screen, 255 per level, MaxTile, faster level loads, 8 MB ROM |
| **Gradius III** (SA-1 Root), v1.7 | Vitor Vilela | LoROM | the whole game, "for the maximum time possible"; the S-CPU is called back for APU uploads and PPU updates | **all of it**: `$0000–$1FFF` → `$6000–$7FFF`, `$7E–$7F` → `$40–$41`; pointers into `$7E/$7F` fixed **at run time** (450 KB of data not reworked by hand) | 128 KB | most slowdown gone, shorter loads; the game gets harder, so an "Origin" variant slows bosses back down |
| **Contra III** (SA-1 Root), v1.3 | Vitor Vilela | LoROM | as Gradius III (callbacks for APU/PPU) | all of it, run-time remap (950 KB of data) | 128 KB | all slowdown gone, much shorter loads, high scores and settings saved |
| **Super R-Type** (SA-1 Root), v1.3 | Vitor Vilela | LoROM | the SA-1 is master and runs the whole game; S-CPU routines are requested **asynchronously**, the SA-1 doesn't wait | `$0000–$1FFF` → `$6000–$7FFF`, `$7E:0000–7FFF` → `$40:0000–7FFF`; **static** remap (the routines were orderly enough) | 32 KB | all slowdown gone, much shorter loads |
| **Race Drivin'** (SA-1 Root), v1.1 | Vitor Vilela | — | the SA-1 is master; math-heavy routines and almost all processing; async S-CPU jobs for PPU work | partial, "semi-static": direct page → I-RAM, `$0100–$1FFF` → BW-RAM, parts of `$7E/$7F`; car positions stay in WRAM for the replays | 32 KB | ~4.8 fps → 30 fps; NMI routine and frame buffer reworked; **delta-based frame correction** so the game doesn't run too fast; "Origin" variant keeps the old speed |
| **Mega Man X** SA-1 patch, v1.1 | "Bosn" | LoROM | speed in busy scenes (mid-boss, cart ride); not documented further | not documented | used for saves | less slowdown; passwords saved to SRAM; plus gameplay tweaks |

Mentioned but not released as SA-1 conversions in what we read: Axelay, Super Metroid, Super Castlevania IV,
Super Aleste, Final Fight 3 (the "SA-1 collection project" asked players for traces of these). Super Ghouls'n
Ghosts and Super Castlevania IV got a **FastROM** speed-up instead (the author's "Project FastROM"), not an SA-1
conversion.

Commercial SA-1 games (Super Mario RPG, the Kirby games, about 34 titles) were designed for the chip. The sources
we read don't say how they split work, so they're not compared here.

## 2. How they do it

### 2.1 The SA-1 becomes the main CPU

Every SA-1 Root conversion inverts the roles: **the SA-1 runs the game; the S-CPU becomes an I/O servant** that
does what only it can (PPU registers, APU uploads, DMA to VRAM/OAM/CGRAM, joypads). The SA-1 asks for those jobs
through callbacks; Super R-Type and Race Drivin' make them asynchronous so the SA-1 keeps going. The SA-1 Pack is
the one exception: SMW keeps running on the S-CPU and calls the SA-1 for heavy routines, with a "parallel" mode
for work both CPUs do at once.

Mailbox, as the SA-1 Pack documents it: a 24-bit code pointer and a done flag each way (S-CPU→SA-1 and
SA-1→S-CPU), plus a pointer and flag for parallel mode, all in a 16-byte block of I-RAM, with the SA-1's stack at
the top of I-RAM.

### 2.2 Move all of WRAM, then fix the pointers

The SA-1 can't see WRAM, so they move the game's RAM where both CPUs see it, keeping the low 16 bits of every
address:

- direct page → I-RAM `$3000–$30FF` (fastest for the SA-1);
- `$0000/$0100–$1FFF` → the BW-RAM window at `$6000–$7FFF` (visible in every bank, like low WRAM);
- `$7E/$7F` → BW-RAM banks `$40/$41`.

Three strategies, by how pointers into RAM are found:

| Strategy | Used by | How |
|---|---|---|
| static | Super R-Type, SMW | every instruction and table that names a RAM address is rewritten in the ROM |
| run-time | Gradius III, Contra III | code that builds or follows `$7E/$7F` pointers is patched to translate them when used; data tables stay as they are |
| semi-static / partial | Race Drivin' | only the hot RAM moves; some structures stay in WRAM where only the S-CPU needs them |

The remap lists come from **trace logs and usage maps** of play (bsnes-plus), fed into a modified DiztinGUIsh and
the author's remapping tool. The trap: an instruction that indexes a RAM table in one place may index a ROM table
in another. In Gradius III, 380 of 871 indexed-absolute remaps were wrong for that reason and had to be removed by
hand; they caused about half the crashes in beta testing.

### 2.3 The S-CPU's own code stays out of ROM's way

The SA-1 waits whenever the S-CPU reads ROM in the same cycle. The SA-1 Pack therefore keeps the S-CPU's
main loop, its "run this on the SA-1" stub and its wait routine **in WRAM** (`$7E:1E80+`), so an idle S-CPU spinning
doesn't slow the SA-1's ROM reads.

### 2.4 Sprites: MaxTile (SA-1 Pack)

Four priority buffers in BW-RAM (up to 512 OAM entries), filled by sprite code in three modes (legacy, direct,
allocate). At the end of the frame they are merged into the OAM mirror, highest priority first, stopping at
the hardware's 128. This is how "more sprites on screen" works without flicker logic in each sprite.

### 2.5 Speed changes the game, so they add speed controls

Removing slowdown makes shooters harder and makes a frame-counted game run fast. Answers so far: "Origin"
variants that slow bosses down again (Gradius III, via a separate add-on); Race Drivin's delta correction, which
counts VBlanks per drawn frame and scales the movement per frame to match.

### 2.6 Extras that ride along

Battery BW-RAM is there anyway, so several add saves (Contra III high scores and settings, Mega Man X
passwords). The SA-1 Pack sells 8 MB ROM and "bitmap and arithmetic support" to hack authors. None of the SA-1
Root READMEs mentions character-conversion DMA, the bitmap view or the bit-stream reader: **the public
conversions use the SA-1 as a fast CPU with shared RAM, not its special units** (except Race Drivin's math).

### 2.7 Testing and compatibility

They test on Snes9x, bsnes/higan/ares and real hardware (sd2snes/FXPak Pro, SA-1 carts); a forum report says they
run on MiSTer; ZSNES is not supported. The SA-1 Pack's price is ecosystem-wide: **every other SMW patch, sprite or
block must detect the pack and use its remap**. It ships a remap macro file and a conversion tool, and SMW Central
tags compatible resources.

## 3. Compared with our plan

| Topic | Public hacks | Evermore today ([port.md](port.md), [uses.md](uses.md)) | What we take from it |
|---|---|---|---|
| Base layout | LoROM games: the SA-1's LoROM-style `$00–$3F/$80–$BF` view already matches | HiROM: needed the dual-view 8 MB image (C1) They never needed a trick like C1; we know of no other HiROM→SA-1 conversion *(to verify)* |
| Who is master | the SA-1 (SA-1 Root); the S-CPU with calls (SA-1 Pack) | per-routine offload planned (C3) | Weigh "SA-1 as master" seriously: it's the route that removed all slowdown in four games. Per-routine offload is the SA-1 Pack's route, which needed years of ecosystem work |
| Moving WRAM (C2) | **whole RAM at once**, same low 16 bits, to I-RAM / `$6000` window / `$40–$41`; pointer fixes static or at run time | planned per variable from the WRAM map | Do C2 the same way: Evermore uses ~81 KB of 128 KB WRAM ([unused-wram.md](../unused-wram.md)), so a 128 KB BW-RAM image of WRAM fits. Per-variable moving stays useful for I-RAM placement of hot DP variables only |
| Finding pointers | trace logs + usage maps → remap lists; hand-removal of false hits | CDL library: per-instruction bus and WRAM forms, `functions.json` blockers, read sites | Our recorder already records what their tools had to infer; the "same instruction, RAM here, ROM there" trap must be a test in our remap tool |
| Script data | not applicable (no script VM in those games) | 24-bit pointers in script bytecode and tables ([layout-options.md](../exhirom/layout-options.md) §1) | Script operands that name WRAM need either a run-time translation in the VM (Gradius/Contra style) or a bytecode rewrite; run-time in the VM is the smaller change *(estimate)* |
| S-CPU idle loop | kept in WRAM to free the ROM bus | `wait_for_nmi` spins in ROM at `$80:858C` | Once the SA-1 runs, move the spin (or any S-CPU wait) into WRAM |
| Mailbox | code pointer + done flag each way + parallel flag in I-RAM | use 2, not designed | Same shape; async S-CPU jobs (Super R-Type) once the SA-1 is master |
| Speed side effects | "Origin" variants; delta correction | time-sliced engine: more work per frame changes RNG draws and pacing (c-to-rom §7a) | Plan a speed-cap option from the start; compare by game event |
| Sprites | MaxTile priority buffers in BW-RAM | uses 12, 37 | Their design is the reference shape for "more on screen"; Evermore's OBJ cache (`$80:A4B5`, `$80:96FE`) limits VRAM tiles too, not only OAM entries |
| Special units | barely used (math in Race Drivin') | uses 10, 23, 38, 39, 42 | Our list's bitmap/char-conversion uses are untried territory, not proven wins |
| Emulators | Snes9x, bsnes/ares, FXPak, SA-1 carts | MesenCE only | Use 6 before anything else ships |
| Effort | Gradius III ≈ 3 months; Race Drivin' ≈ 13,000 lines of asm, ~90 % of code touched; "a full working disassembly" named as the prerequisite | Asar export byte-identical, D1 (symbolisation) open | Evermore is far bigger (3 MB, script VM, 449+ functions). Read their months as a floor |
| Ecosystem | SMW: every patch must remap | Everscript compiler, table hack, our Asar patches | Use 9 is not optional: the compiler and table hack must target the remapped image |

## 4. Changes to [uses.md](uses.md)

- **Use 3 (C2)** becomes "remap all of WRAM to BW-RAM/I-RAM, keeping the low 16 bits". Same effort score, lower
  risk: it's the proven route. **Needs 256 KB BW-RAM** if Evermore's save and extras also live there (128 KB of
  WRAM image + save).
- **New option for section B**: the SA-1 as master (the SA-1 Root shape) instead of per-routine offload. It turns
  uses 11–25 from 14 separate projects into one large one, and is what removed slowdown entirely in every public
  case. Effort 5, benefit 5.
- **Use 4 (DMA snapshots)** stays a stepping stone; no public hack does it, because they move the RAM outright.
- **Uses 38, 39, 42 (bitmap, char conversion)**: no public conversion uses them; keep the scores but treat them
  as research.
- **Add to use 2**: the S-CPU's wait loop in WRAM.
- **Add a speed-cap variant** to any section-B work (their "Origin" lesson).

## Sources

- [VitorVilela7/SA1-Root](https://github.com/VitorVilela7/SA1-Root) (README; per-game READMEs
  [Gradius-III](https://github.com/VitorVilela7/SA1-Root/tree/master/Gradius-III),
  [Contra-III](https://github.com/VitorVilela7/SA1-Root/tree/master/Contra-III),
  [Super-R-Type](https://github.com/VitorVilela7/SA1-Root/tree/master/Super-R-Type),
  [Race-Drivin](https://github.com/VitorVilela7/SA1-Root/tree/master/Race-Drivin))
- [VitorVilela7/SA1-Pack](https://github.com/VitorVilela7/SA1-Pack) (README, `docs/memory-map-summary.md`,
  `docs/I-RAM.md`, `docs/W-RAM.md`, `docs/maxtile.md`); [SNESLab: SA-1 Pack](https://sneslab.net/wiki/SA-1_Pack)
- [The SA-1 collection project](https://vilela.sneslab.net/2019/06/15/the-sa-1-collection-project/) (author's blog, 2019)
- [Race Drivin' 4 → 30 fps](https://www.nintendolife.com/news/2021/02/random_talented_hacker_bumps_the_frame_rate_of_snes_race_drivin_from_4fps_to_30);
  [Gradius III slowdown fix](https://www.nintendolife.com/news/2019/05/random_someones_working_to_fix_snes_shooter_gradius_iiis_slowdown_issues)
- [SA-1 patch for Mega Man X released](https://retrorgb.com/sa-1-patch-for-mega-man-x-released.html);
  [romhacking.net hack 5145](https://www.romhacking.net/hacks/5145/)
- [Vitor Vilela reveals Project FastROM](https://retrorgb.com/vitor-vilela-reveals-project-fastrom.html)
- [SA-1 patched ROMs work fine in MiSTer](https://mail.misterfpga.org/viewtopic.php?p=15657) (forum)
- [superfamicom.org wiki: SA-1](https://wiki.superfamicom.org/sa-1)
