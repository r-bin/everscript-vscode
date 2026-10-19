# tools/ — node tools and the repo checks

Node 26 runs the `.mts` files directly. Tools find a ROM through the ROM library (`rom.js`,
`npm run roms`), never a path or environment variable.

| Path | What | Run |
|---|---|---|
| `test.mts` | Runs test tiers (`tests/tiers.json`) | `npm test`, `npm run test:{rom,dom,emulator,all}` |
| `check-legal.mts` | No game data, other projects' code or home paths (tree, staged, history) | `npm run check:legal` |
| `check-knowledge.mts` | Every address in code has a knowledge entry; coverage of the CDL | `npm run check:knowledge` |
| `check-ai-context.mts` | AI files within budget; no broken links in any Markdown | `npm run check:ai-context` |
| `*.baseline.json`, `*.allow.json` | Known findings of the checks; they only shrink | `--baseline` on each check |
| `roms.js`, `rom.js` | The ROM library from the command line; how tools find a ROM | `npm run roms` |
| `derived-marker.js` | Marks a built ROM as derived from the base ROM | used by the builders |
| `recomp/` | The static recompilation ([README](recomp/README.md)) | `npm run recomp` |
| `exhirom/` | Evermore as an 8 MB ExHiROM and its proof ([README](exhirom/README.md)) | `npm run exhirom` |
| `table-hack/` | Content tables moved into the 4th MB and the proof ([README](table-hack/README.md)) | `npm run table-hack` |
| `cdl/` | Replay a movie headless on our core, with the CDL recorder | `node tools/cdl/replay.js` |
| `playbacks/` | Record the vanilla attract loop as a sample playback | `node tools/playbacks/record-attract.js` |
| `simulation/` | Sweep every room with the simulation; trace the real scheduler; exit cut-offs | `node tools/simulation/*.js` |
| `mana/` | Compare a Mana map's picture / step events with the running game; find a map by picture | `node tools/mana/*.js` |
| `variants/` | Find table addresses in other Evermore releases (the scans: `variant-scans.js`) | `node tools/variants/analyze-variant.js` |
| `auto-decompile.js` | The autonomous decompilation loop: runs "continue the decompilation" (`decomp-curator`) with parallel agents until the quota or `docs/disassembly/PROGRESS.md` is done | `node tools/auto-decompile.js --concurrency 3` |
| `gen-cdl-optable.js` | Writes the core's `cdl-optable.h` from the opcode matrix | after changing the matrix |
| `gen-sound-animations.js` | Writes `localizations/data/sound-animations.json` | after changing the animation catalogue |
| `measure-collision.js` | How well a tile predicts its collision (the editor's suggestion) | `npm run check:collision` |
| `build_snes_core.sh` | Builds the snes9x cores with Emscripten | `npm run build:cores` |
