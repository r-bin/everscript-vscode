# The static recompilation

The recomp has its own repository: **[SecrefOfEvermoreRecomp](https://github.com/r-bin/SecrefOfEvermoreRecomp)**
(locally a sibling checkout, `../SecrefOfEvermoreRecomp`). Its glue, docs (status, setup,
debugging, headless exploration, bugs and roadmap, research), debugging tools and AI skills live
there, and so do its seeds once written.

What stays here is what needs this repository's internals:

| Here | What |
|---|---|
| `npm run recomp` ([tools/recomp/README.md](../../tools/recomp/README.md)) | CDL library + names + asset regions → byte-identical Asar project, Mesen2 files, and the seeds, written into the recomp repository's `recomp/`; then its regen and build |
| `src/platform/cdl/recomp-seeds.ts`, `recomp-analysis.ts` | the seed generator; the exclusions it honours come from the recomp repository's `recomp/seed-exclusions.txt` |
| `tools/recomp/room-nav.js`, `s9x-run.js` | a room's triggers and spawns as headless script lines; the same script on snes9x |
| `npm run compare -- recomp=` | lockstep against snes9x; runs the recomp repository's `build/` game |
| knowledge entries | every game fact the recomp work finds |
