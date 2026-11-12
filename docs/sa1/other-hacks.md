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

## 5. Moving all of Evermore to the SA-1

Asked 2026-11-12: could Evermore go the SA-1 Root way, the SA-1 running the whole game? **Yes, technically; the
code is better suited than it first looked. The downsides are mostly outside the ROM.**

### 5.1 What the code says

From `out/recomp/asar/functions.json` (CDL export of 2026-11-10, 987 functions), what keeps each function off the
SA-1, counting only what the function does itself:

| Blocker | Functions | What happens to it under "SA-1 as master" |
|---|---|---|
| WRAM | 931 (**805 with no other blocker**) | goes away with the whole-WRAM remap (§2.2) |
| none at all | 53 | runs on the SA-1 as is |
| multiply/divide (`$4202–$4216`) | 73 | rewritten for the SA-1's math unit (other registers, 16-bit operands) |
| PPU (`$21xx`) | 40 | stays on the S-CPU, called as a job |
| CPU I/O (`$42xx`: NMI/IRQ setup, timers, `$4212`) | 35 | stays on the S-CPU |
| DMA (`$43xx`) | 28 | stays on the S-CPU |
| WRAM port (`$2180`) | 10 | rewritten as plain BW-RAM access, or stays on the S-CPU |
| APU (`$2140–$2143`) | 5 | stays on the S-CPU |
| joypad | 1 | stays on the S-CPU (or the NMI copies pads to I-RAM) |

Counted through callees, 366 functions reach the PPU and 224 the APU; those are the call chains that need a
job boundary somewhere along the way. So about 100 functions belong to the S-CPU, ~75 need their math rewritten,
and the rest (~800) need only the RAM to move. That is the same shape as Gradius III and Contra III.

What Evermore has that they didn't:

- **The script VM.** Bytecode and tables hold 24-bit pointers and WRAM operands ([../scripts/](../scripts/),
  [layout-options.md](../exhirom/layout-options.md) §1). With the low 16 bits kept, the VM can translate `$7E/$7F`
  operands to `$40/$41` when it reads them (the Gradius/Contra run-time strategy), so no bytecode is rewritten.
- **Size.** The Asar export has about 17,700 long `$7E/$7F` operands (code and data; not all are addresses the
  game uses as RAM pointers). Each one is a remap decision, and the "RAM here, ROM there" trap (§2.2) applies.
- **HiROM.** The dual-view image (C1) covers the S-CPU. Whether the SA-1's own view of `$80–$BF` follows the same
  CXB–FXB rule is *(to verify)* (it shares the registers, *hardware*).

### 5.2 Downsides

Ordered by how much they cost us, not by how hard they are to build.

1. **The gain is unmeasured.** No busy scene is profiled ([uses.md](uses.md) use 1). If Evermore's slow scenes
   are DMA/VBlank-bound, or rare, months buy little. Every public conversion started from known, heavy slowdown.
2. **Our own tooling watches the S-CPU.** The script debugger hooks the interpreter, the CDL recorder, Memory
   Radar and `soe://ram/` read the S-CPU and WRAM. With the game on the SA-1 and its RAM in BW-RAM, all of them
   go blind until the bundled core and tools learn the SA-1. That is a core change, so it needs the owner's OK
   (`emulator-subsystem` skill).
3. **Every replay and frame-based proof stops applying.** The engine time-slices (c-to-rom §7a): a faster CPU
   changes how much work lands in each frame, so RNG draws, AI and pacing differ. Sample playbacks, recomp replay
   01, speedrun routes and RNG manipulation, and the Routes tab's frame model don't carry over. Checks go by game
   event only (§2.5).
4. **Community tools read `$7E` addresses.** Trackers, randomizers, Lua scripts and practice tools look at WRAM.
   They break unless the S-CPU copies the state they read back to WRAM each frame (DMA through `$2180`, a few
   hundred bytes) or they learn the `$7E→$40` offset.
5. **Patches and the compiler.** Everscript's output, the table hack and existing patches (the 2-player edition,
   our own hacks) use vanilla WRAM addresses. Each needs the remap, like SMW's ecosystem (§2.7).
6. **The recomp and C-to-ROM stay on vanilla.** `snesrecomp` models only the S-CPU, so the SA-1 build is a
   separate branch of the game, not something the recomp can check.
7. **Fewer places it runs.** It needs SA-1 emulation (Snes9x, bsnes/ares, MesenCE; MiSTer per a forum) or an
   FXPak-class cart. Cheaper flashcarts without SA-1 can't run it. Only MesenCE is checked today.
8. **A new kind of bug.** Two CPUs really run at once. The S-CPU's NMI and its jobs read state the SA-1 is writing,
   so a structure can be read half-updated. Super R-Type and Race Drivin' needed routines changed to avoid exactly
   that (§1).
9. **Less speed than "4×".** With all of RAM in BW-RAM, the SA-1 accesses it at half its clock *(hardware, to
   verify)*; only the direct page in I-RAM runs at full speed. Expect a gain closer to 2–3× on RAM-heavy code
   *(estimate)*.
10. **It feels different.** No slowdown makes fights faster and maybe harder; a speed cap ("Origin" variant) is
    needed for players who want the original feel.

Upsides: slowdown gone where it is CPU-bound, faster room loads, an S-CPU with most of its time free, and uses
11–25 from [uses.md](uses.md) come along with it instead of 14 separate projects.

### 5.3 How we would do it, if we do

1. Profile busy scenes (use 1). Stop here if they aren't CPU-bound.
2. Whole-WRAM remap with the **S-CPU still running everything** (direct page → I-RAM, `$0000–$1FFF` → `$6000`,
   `$7E/$7F` → `$40/$41`, VM operands translated at run time), checked by game event. This finds remap bugs before
   two CPUs make them hard to reproduce.
3. A WRAM mirror for trackers and our own tools (downsides 2 and 4), so this step keeps them working.
4. Math rewritten for the SA-1 unit; S-CPU job boundary at the ~100 hardware functions; S-CPU wait loop in WRAM.
5. Hand the main loop to the SA-1. Add the speed cap.

Effort *(estimate)*: several months for one person, with Gradius III's three months as the floor. Ship it, if at
all, as a variant next to the vanilla-layout build, never instead of it.

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
