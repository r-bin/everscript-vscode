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
- Names: `func` seeds carry ROM-map names; entries snesrecomp found itself get `symbol` lines (read from
  the program manifest of the recomp's last generation, `readNodes` in `repo.mts`). `symbol` adds no roots,
  but names break ties in snesrecomp's resume table (recomp repo bugs-and-todos §3.6): an A/B of names
  compares its dispatch_v2.c too. `tools/recomp/annotate.mts` comments the generated C from
  `out/recomp/asar/recomp/annotations.tsv` (asm + WRAM names); the recomp repo's regen script runs it.
- C bindings: an `hle <pc24> <c_function> [body=<pc24>] <reason>` line in the recomp's exclusions file becomes `hle_func` (`body=`: the second instruction as a compiled root, for calls the C cannot take); the
  recomp's glue compiles `reconstructed-c/` from this checkout and runs it only where unobservable (its
  game-rtl doc §4b). A broken `reconstructed-c/include/soe_ram.h` breaks that build: keep bound names in it. Its `ENTITY_RECORD_*_OFF` come from `EntityRecord` in `data/types.json`; only 3 routines compile there, so after a WRAM map change run `npm run c-to-rom:g1`, which builds all of them.
  `tools/compare/probes/run-stats.mts` measures speed per mode, banks that run and how often each binding's C ran.
- Tools that need this repository: `tools/recomp/room-nav.js` (a room's triggers and spawns as
  headless script lines), `s9x-run.js` (the same script on snes9x), `npm run compare -- recomp=`
  (lockstep; runs the recomp repo's `build/` game).
- Trap: the runner's headless script spends frames of its own (a `poke` 2, a `press` of n frames
  n + 1), and its frame f is MesenCE's f + 1. `tools/compare/recomp.mts` compensates both when it
  turns a replay into a script; a hand-written script must too, or every press lands late.

## Finishing
Game facts found while debugging the recomp go to knowledge entries here (`game-knowledge` skill);
the bug and its lesson go to the recomp repo's bug table (its docs folder, bugs-and-todos).
