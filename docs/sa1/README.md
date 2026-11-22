# SA-1: Evermore on the SA-1 board

What we know about putting Secret of Evermore on an SA-1 cartridge, and what the second CPU is worth to it.

| Page | What it holds |
|---|---|
| [port.md](port.md) | Stage C1 (v0.402.0): the 8 MB dual-view image that plays cycle-identically in MesenCE with the SA-1 held in reset; the next stages C2–C3 |
| [uses.md](uses.md) | 50 uses for the SA-1 CPU, BW-RAM and mapper, scored by effort and benefit, with a suggested order |
| [other-hacks.md](other-hacks.md) | How public SA-1 hacks of other games use the chip; §5 asks whether all of Evermore should move to the SA-1 |

Code: `tools/sa1/` ([README](../../tools/sa1/README.md)). Evermore + Mana on the same board:
[../combo/README.md](../combo/README.md).

## What we have learned so far

1. **The board works without touching the code.** The mapper's two views hold the HiROM game with no address
   rewrite; only a cycle-exact boot block was needed to stay in lockstep ([port.md](port.md) §2–§5).
2. **The SA-1 can't see WRAM.** That one fact sets the cost of every speed use: inputs must be copied or moved to
   I-RAM/BW-RAM first ([uses.md](uses.md) §1).
3. **Evermore rarely slows down in early play.** The first busy-play profile (2026-11-18, `npm run sa1:load`)
   puts slowdown at 0.2–0.5 % of field frames; the leftover time already runs pathfinding steps
   ([other-hacks.md](other-hacks.md) §5.4).
4. **So: no full port for now.** The S-CPU stays master; the SA-1 gets self-contained jobs (pathfinding, room
   decompression), and the BW-RAM and space uses come first because they keep lockstep. The full port stays an
   option for "more enemies on screen", or if later scenes turn out CPU-bound ([other-hacks.md](other-hacks.md)
   §5.4).
