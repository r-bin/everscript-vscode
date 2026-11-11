# The static recompilation

The recomp has its own repository: **[SecretOfEvermoreRecomp](https://github.com/r-bin/SecretOfEvermoreRecomp)**
(locally a sibling checkout, `../SecretOfEvermoreRecomp`). Its glue, docs (status, setup,
debugging, headless exploration, bugs and roadmap, research), debugging tools and AI skills live
there, and so do its seeds once written.

What stays here is what needs this repository's internals:

| Here | What |
|---|---|
| `npm run recomp` ([tools/recomp/README.md](../../tools/recomp/README.md)) | CDL library + names + asset regions → byte-identical Asar project, Mesen2 files, the seeds and the annotations, all in `out/recomp/`; the recomp repository's `tools/import.mts` copies them (and the bound C from `reconstructed-c/`) over. Nothing here writes into that repository, and it builds without this one |
| `src/platform/cdl/recomp-seeds.ts`, `recomp-analysis.ts` | the seed generator; the exclusions it honours come from the recomp repository's `recomp/seed-exclusions.txt` |
| `tools/recomp/room-nav.js`, `s9x-run.js` | a room's triggers and spawns as headless script lines; the same script on snes9x |
| knowledge entries | every game fact the recomp work finds |

`tools/compare` commands in these docs belong to the recomp repository: the tool, its replays and its tests live there.

Other people's Secret of Evermore ports and how they compare: [other-projects.md](other-projects.md).

ROM hacks reach the recomp as `.snesmod` packages against the stock ROM, never as recompiled patched ROMs. An Everscript
hack (the practice ROM) is mostly script data the game's own interpreter runs, so the everscript compiler can write the
mod; only its Asar patches need C there. The plan, with the practice ROM's bytes sorted: the recomp repository's
`docs/mods/evs-to-snesmod.md` (the general rule: `docs/mods/rom-hacks.md`).
