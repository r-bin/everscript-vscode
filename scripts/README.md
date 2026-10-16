# scripts/ — shell wrappers for the npm commands

Run from anywhere; each script changes to the repo root and finds `npm` (PATH or `/opt/homebrew/bin`).

| Script | Does | npm underneath |
|---|---|---|
| `build-plugin.sh [--install] [--cores]` | compile `src/maps` + `src/script`, package the `.vsix`; `--install` also installs it in VS Code, `--cores` rebuilds the snes9x wasm cores first | `build:maps`, `build:script`, `package` / `deploy`, `build:cores` |
| `test.sh [--quick\|--all]` | test suite, typecheck, circular-dependency scan; `--quick` tests only, `--all` adds the advisory knip / depcruise scans | `test`, `typecheck`, `check:circular`, `check:dead`, `check:deps` |
| `build-recorder.sh [--install]` | package the SNES CDL Recorder (only the files it uses) into `out/snes-cdl-recorder-<version>.vsix`; `--install` also installs it | `build:recorder` |
| `build-recomp.sh [rom] [-- args]` | build the recompiled game; ROM defaults to `$SOE_ROM`, then `out/rom.sfc` | `recomp` |
| `build-exhirom.sh [rom] [--prove] [-- args]` | build the 8 MB ExHiROM ROM into `out/soe-exhirom.sfc`; `--prove` also checks it against the original (`out/exhirom/REPORT.md`) | `exhirom`, `exhirom:prove` |
| `build-table-hack.sh [rom] [--prove] [-- args]` | build the table hack into `out/table-hack/soe-tables.sfc`; `--prove` replays the sample playbacks against the original (`out/table-hack/REPORT.md`) | `table-hack`, `table-hack:prove` |
| `play-recomp.sh [args]` | start the built game | – |
| `lockstep.sh [rom] [-- args]` | recomp vs snes9x WRAM comparison | `recomp:lockstep` |
| `release.sh` | on a clean, committed tree: `test.sh`, push `develop`, install the extension | `test`, `typecheck`, `check:circular`, `deploy` |

Examples:

```sh
scripts/test.sh --quick
scripts/build-plugin.sh --install
scripts/build-recomp.sh -- --fresh --strict
scripts/play-recomp.sh
scripts/build-exhirom.sh "/path/Secret of Evermore (U) [!].smc"
```
