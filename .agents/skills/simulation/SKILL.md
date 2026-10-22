---
name: simulation
description: Use before changing anything that simulates the game: scripts run symbolically, a route step played against WRAM, fight time and odds (combat). Where it lives, what keeps it honest.
applyTo: "src/games/evermore/simulation/**,tools/routes/**,docs/entities/combat.md"
---

# Simulation

Everything that predicts what the game does lives in `src/games/evermore/simulation/`. Features
(Routes tab, Scripts tab, `soe://`) only call it.

| Question | Where |
|---|---|
| What does this script do, under which conditions? | the engine: `analyze`, `room`, `emit` ([README](../../../src/games/evermore/simulation/README.md)) |
| What changes when the party does this step? | `play.ts` (`playStep` on a trigger's cases, `playableTrigger`) |
| How long does this fight take, how many hits, what odds? | `combat/` (`fightFor`, `simulateFight`); the game's rules: `docs/entities/combat.md` |

## Rules

1. **Rules come from the game's code.** Each mechanic names its routine and has a knowledge entry
   (`game-knowledge` skill); timings come from the animation VM, stats from the character record.
   A number nobody traced stays out, and the panel lists what is assumed.
2. **Checked against the game.** A model is trusted for what an in-game run has matched. Combat:
   `node tools/routes/fight-in-game.mts --trials 80` (~50 s, the ROM library's ROM, patched in
   memory only). Rerun it after changing a rule and record the numbers in `docs/entities/combat.md` §8.
   A new kind of fight gets a mode in that tool before it is called checked.
3. **Report what runs show.** Lead with fastest, median and spread over the runs; a floor no run
   reaches is a footnote.
4. **Library shape.** No VS Code, no files, no UI. The engine reads only `script-vm`/`script-model`
   (`simulation-is-a-library`); `combat/` may also read `maps/` (`simulation-combat-is-a-library`).
   Seeded randomness, so a result reproduces.

## Traps

- Booting straight into a room (the intro hook at file `0x12E0CA`) skips the opening: the Boy keeps
  entity `+$10` bit 5 and no enemy can hit him until it is cleared.
- One tick is one frame. An attack rolls to hit once per target, not once per strike frame.
