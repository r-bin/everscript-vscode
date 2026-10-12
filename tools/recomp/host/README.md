# tools/recomp/host — our game-specific glue for the snesrecomp host

Everything in this folder (except this README) is copied over the scaffolded host project at the
same relative path on every `npm run recomp`. The project itself (`out/recomp/project/`) is
generated and git-ignored. Edit glue **here**, never in `out/recomp/project/`.

| File | Replaces in the project | What it does |
|---|---|---|
| `src/game_rtl.c` | the scaffold's `src/game_rtl.c` | frame model + session reset for SoE (today: the framework's beam-aligned driver, which boots SoE into the intro) |
| (hook) | one line in the scaffold's generated `src/main.c` | `tools/recomp/host.js` adds `.after_config = SoeAfterConfig` to the host descriptor; `SoeAfterConfig` (in `game_rtl.c`) forces the reference PPU renderer, because the optimized one draws BG mode 4 as mode 7 and SoE's name screen is mode 4 |

Rules:
- Only files **we write** go here. snesrecomp (and its scaffold templates) is PolyForm
  Noncommercial 1.0.0: do not copy its files into this repo, not even filled-in templates.
  Leave the files we do not change to the scaffold.
- No generated C, no ROM-derived data, no disassembly.
- The interface a file must keep is the scaffold's: `game_rtl.c` provides `GameRunOneFrame`,
  `GameDrawPpuFrame`, `GameSessionReset` and `kGameInfo` (declared in the scaffold's `game_rtl.h`).

Background: [docs/recomp/game-rtl.md](../../../docs/recomp/game-rtl.md).
