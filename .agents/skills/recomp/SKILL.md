---
name: recomp
description: Use when making snesrecomp seeds (npm run recomp) or touching the recomp's inputs here; the recomp itself (glue, build, debugging) lives in the SecretOfEvermoreRecomp repository.
applyTo: "tools/recomp/**,src/platform/cdl/recomp-*.ts,docs/recomp/**"
---

# Skill: seeds for the SoE recomp

The recomp is its own repository: `../SecretOfEvermoreRecomp`
(https://github.com/r-bin/SecretOfEvermoreRecomp). Its glue, docs, bug history, debugging tools and
its own skills (`recomp`, `recomp-debugging`) are there; read its `AGENTS.md` before working on
the game itself, and commit there (branch `develop`).

## What lives here
- `npm run recomp` (`tools/recomp/build.js`, `repo.mts`): CDL library + names + asset regions →
  byte-identical Asar project, Mesen2 files, seeds → the recomp repo's `recomp/bank*.cfg`, then its
  regen + build. `--no-build` stops after the seeds, `--no-recomp` after the Asar rebuild,
  `--repo` / `SOE_RECOMP` pick another checkout. Commit the changed cfgs in the recomp repo.
- The seed generator: `src/platform/cdl/recomp-seeds.ts`, `recomp-analysis.ts`. Exclusions are not
  here: they are lines in the recomp repo's `recomp/seed-exclusions.txt` (`func` / `dispatch`
  `<pc24> <reason>`), parsed by `parseExclusions`.
- Tools that need this repository: `tools/recomp/room-nav.js` (a room's triggers and spawns as
  headless script lines), `s9x-run.js` (the same script on snes9x), `npm run compare -- recomp=`
  (lockstep; runs the recomp repo's `build/` game).

## Finishing
Game facts found while debugging the recomp go to knowledge entries here (`game-knowledge` skill);
the bug and its lesson go to the recomp repo's bug table (its docs folder, bugs-and-todos).
