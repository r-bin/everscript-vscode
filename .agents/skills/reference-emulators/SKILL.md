---
name: reference-emulators
description: Use before comparing against an emulator or calling emulated behaviour correct (recomp, C to ROM, hacks, replays): MesenCE is the WRAM reference, ares a by-hand check, our snes9x core never accurate.
applyTo: "tools/compare/**,tools/recomp/**,tools/c-to-rom/**,src/core/emulator/**"
---

# Skill: which emulator decides

| Emulator | Trust | Control | Role |
|---|---|---|---|
| **snes9x 2005** (our core, `src/core/emulator/core/`) | **not trusted**: known timing gaps | full: our build, node at ~10,000 fps, write breakpoints, CDL recorder, replays | probing: where to look, who writes what, coverage. Never the reference |
| **MesenCE** (`/Applications/Mesen.app`, fork `~/Documents/GitHub/MesenCE`) | trusted | good: `Mesen --testRunner <script.lua> <rom>` headless, `emu.read(addr, emu.memType.snesWorkRam)`, debugger, `mesen2-mcp` | **the reference for every WRAM comparison** |
| **ares** (`~/romhacking/emulators/ares-v148/ares.app`) | precision reference | least: GUI debugger; CLI picks system, settings, a save-state slot | probing by hand: a disputed frame |

higan (2020 nightly) is superseded by ares; bsnes is ares' lineage and unused.

## Rules
0. Two ROMs or builds on the **same** emulator (a hack against vanilla on snes9x) is a differential
   test and fine on snes9x. The rules below apply when an emulator stands in for the hardware:
   the recomp or C against an emulator, a timing or PPU fact.
1. "Correct" means matches **MesenCE**. `npm run compare` against snes9x is a lead, not a verdict:
   matching snes9x proves nothing, differing from it proves nothing.
2. Use snes9x to find the frame, the writer, the routine; confirm the finding on MesenCE before it
   goes into a knowledge entry or a doc as fact, and say which emulator it came from.
3. When MesenCE's own answer is in doubt (timing, PPU, DMA), check that frame in ares by hand.
4. After the first few hundred frames, compare at game events (`$7E0100`, room change, fight end),
   never at equal frame numbers.
5. Never edit or rebuild the snes9x core to make it agree with something (owner's rule).

## Traps
- MesenCE `--testRunner` exited with 255 although the script called `emu.exit(0)`: read the
  script's output, not the exit code. Checked 2026-10-30: 600 frames from power-on, `$7E0100` = 461.
- No MesenCE backend in `tools/compare` yet: until there is, every lockstep result is snes9x's.

The recomp repository (SecretOfEvermoreRecomp) has its own copy of these rules and a doc on how to run each (its docs folder, reference-emulators).
