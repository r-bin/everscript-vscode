# Test Speed, Relevance Classification & Recomp vs MesenCE

> Audit date: 2026-11-23 (10-core Apple Silicon host).
> Covers `npm test`, static checks (`release-ritual`), `rom` / `dom` / `emulator` tiers, `c-to-rom`, and proof tools (`tools/sa1`, `tools/exhirom`, `tools/open-evermore`, `tools/combo`, `tools/table-hack`).

## Summary & Target Timings

The documented `~7 s` figure for `npm test` ([AI_ARCHITECTURE_GUIDE.md](../../AI_ARCHITECTURE_GUIDE.md) §4, [test-discipline](../../.agents/skills/test-discipline/SKILL.md)) is stale: sequential execution, a 20.4 s `vsce ls` subprocess inside `unit`, repeated `build:ts` calls across checks, unconditional Emscripten rebuilds, and mis-tiered tests now push everyday waits far past what is needed.

| Workflow | Documented | Measured / Observed Today | After Phase 1+2 Speedups | After `--changed` Selection |
|---|---|---|---|---|
| `npm test` (`unit` + grammar) | ~7 s | **~38–42 s** (35.9 s in top 34 files + 4.0 s `build:ts` + 0.3 s grammar) | **~3–4 s** | **~1–3 s** |
| Static checks (`typecheck` + 8 `check:*`) | — | **~21.5 s** sequential (runs `build:ts` 3×) | **~3–4 s** (`check:all`, 1× incremental build + parallel) | **~0.5–3 s** (`check:ai-context` + `check:legal` on doc-only) |
| `npm run test:dom` (20 files) | ~45 s | **21.8 s** for 10 non-ROM tests alone (~45 s with ROMs) | **~8–12 s** (shared Chromium server + parallel workers) | **~2–5 s** |
| `npm run test:rom` (23 files) | ~80 s | Multi-minute when ROM present (`c-asm-parity` + `g0` + `scheduler` + Python) | **~15–20 s** | **~2–8 s** |
| `npm run test:emulator` (13 files) | ~20 s | **~90–150+ s** (unconditional `build:cores` + serial `in-game.test.mts`) | **~15–25 s** | **~5–15 s** |
| Recomp vs MesenCE proofs | minutes | Up to ~4–15+ min across `Mesen --testrunner` pools | **~30–60% faster** (trace cache + Lua CRC fix + `--quick`) | **0 s MesenCE** for stock-US logic / G2 |

---

## 1. Where Time Actually Goes (Measured 2026-11-23)

### 1.1 Build & Static Checks (Sequential + Duplicate `build:ts`)

Measured individually via `npm run -s`:

| Script | Measured | What runs inside it | Bottleneck |
|---|---|---|---|
| `build:ts` | **4.0 s** | `rmSync('dist')` + `tsc -p tsconfig.build.json` (2.5 s) + `tsc -p tsconfig.webview.json` (0.6 s) + sequential `tools/bundle-pages.mts` (0.15 s) | Full non-incremental rebuild every time (`dist/` wiped on every call) |
| `typecheck` | **2.0 s** | `tsc --noEmit` | Re-parses full project after `build:ts` just checked it |
| `check:circular` | **1.8 s** | `madge --circular src/` | Independent static scan; runs serially |
| `check:dead` | **4.7 s** | `npm run -s build:ts` + `knip --no-gitignore` | ~4.0 s wasted re-running `build:ts`; `knip` itself is ~0.7 s |
| `check:deps` | **2.3 s** | `depcruise --config .depcruise.js src/` | Independent static scan; runs serially |
| `check:legal` | **1.7 s** | `node tools/check-legal.mts` | Independent scan; runs serially |
| `check:dup` | **0.3 s** | `jscpd -c .jscpd.json --silent` | Fast |
| `check:knowledge` | **4.2 s** | `npm run -s build:ts` + `node tools/check-knowledge.mts` | ~4.0 s wasted re-running `build:ts`; script itself is ~0.2 s |
| `check:ai-context` | **0.5 s** | `node tools/check-ai-context.mts` | Fast |

Running the `release-ritual` checks sequentially invokes `build:ts` **3–5 times** (`test`, `check:dead`, `check:knowledge`, plus `package`), adding **~12–16 s** of pure duplicate `tsc` work before tests even start.

### 1.2 `unit` Tier (56 files, `tools/test.mts` runs strictly 1 process at a time)

Top measured unit files (all 34 files >= 100 ms totaled **35.9 s**, plus 4.0 s `build:ts` and 0.3 s `vscode-tmgrammar-test`):

- **`tests/memory/package-files.test.js`: 20,391 ms (20.4 s)** — over half of `npm test`! Line 86 spawns `execFileSync('vsce', ['ls', '--ignoreFile', 'bundle/.vscodeignore'])`, which walks the full working tree and dependency metadata every single unit run.
- **`tests/memory/ui.test.js`: 1,913 ms** — renders full radar HTML twice and executes JS in Node `vm`.
- **`tests/memory/ppu-tabs.test.js`: 1,592 ms** — launches **headless Chromium** via Playwright inside `unit`, violating the "no browser in `unit`" rule in [tests/tiers.json](../../tests/tiers.json).
- **`tests/memory/assets-documentation.test.js`: 1,392 ms** — parses VFS asset catalogs.
- **`tests/memory/bundle.test.js`: 1,062 ms** — rebuilds `bundle/extension.js` via `tools/bundle.mts` and re-spawns `activation.test.js` (0.75 s) right after `activation.test.js` already ran as file #1.
- **`tests/debugger/emulator-audio.test.mts`: 952 ms**
- **`tests/memory/smoke.test.js`: 892 ms**
- **`tests/memory/activation.test.js`: 754 ms**
- **`tests/memory/animation-relations.test.js`: 653 ms**
- **`tests/memory/variants.test.js`: 587 ms**
- Remaining 46 smaller files (100–401 ms each, plus sub-100 ms files) pay ~100–350 ms of Node startup + module loading each because `tools/test.mts` spawns them sequentially (`for (const f of tiers[tier]) await run(f)`).

### 1.3 `rom` Tier (23 files)

By inspecting the source of every `rom` test:

- **`tests/memory/c-asm-parity.test.mts`**: loops sequentially over **all 315+ bound routines** (`bindings(sourceFiles())`), spawning Calypsi `cc65816` (x86_64 binary under Rosetta) once — and **twice** whenever a file mentions `SOE_OPTIMIZE` or `SOE_USE_ASM` — with zero parallelism and zero caching, while its only hard assertion is `assert(totalCompiledInsns > 0)`.
- **`tests/simulation/scheduler.test.js`**: boots `snes9x_2005.wasm` and runs **10,500 frames** via `tools/simulation/trace-scripts.js`. This belongs in `emulator`, not `rom`.
- **`tests/open-evermore/g0.test.mts`**: runs `explode()` once, then runs ~15+ `implode()` passes sequentially on a single thread (stable, fast, two random seeds, ExHiROM/SA-1, plus ~10 validation/edit trees).
- **`tests/memory/map-parity.test.js`**: spawns a fresh Python subprocess (`tools/dump_room.py`) sequentially for each of `SAMPLE_ROOMS` (9 rooms).
- **`tests/simulation/everscript.test.js`**: builds script models and decompiles every trigger across all 127 rooms, then invokes the sibling Python compiler.
- **`tests/memory/code-vfs.test.js`**: uses only a 64 KB synthetic `mockRom` — needs no ROM file at all.

### 1.4 `dom` Tier (20 files, 21 cold `chromium.launch()` calls)

Measured durations of the non-ROM tests (on this host, ROM-backed tests skipped because no ROM was registered in the sandbox library):

- `tests/memory/map-editor-dom.test.js`: **4,347 ms**
- `tests/debugger/host-watch.test.js`: **3,741 ms** (launches `chromium.launch()` **twice** inside one file)
- `tests/mana/mana-map-editor-dom.test.js`: **2,955 ms**
- `tests/mana/mana-panel-dom.test.js`: **2,561 ms**
- `tests/mana/mana-editor-cells-dom.test.js`: **2,300 ms**
- `tests/memory/routes-tab.test.js`: **2,291 ms** (even before skipping)
- `tests/memory/rooms-rail-dom.test.js`: **1,913 ms**
- `tests/debugger/recorder.test.js`: **1,556 ms**
- `tests/mana/mana-rooms-dom.test.js`: **1,241 ms**
- `tests/memory/rom-tab.test.js`: **832 ms** (skip)
- `tests/debugger/click-walk.test.js`: **593 ms**
- `tests/debugger/ui-log.test.js`: **573 ms**
- Remaining 8 ROM-backed DOM tests (`room-variants-dom`, `scripts-tab`, `data-tab`, `code-tab`, `mana-editor-dom`, `terra-maps-dom`, `terra-editor-dom`, `tree-editor-dom`): launch Chromium sequentially when ROMs exist (~45 s documented total).

### 1.5 `emulator` Tier (13 files)

- **Unconditional Emscripten rebuilds in [package.json](../../package.json)**: `test:emulator` unconditionally runs `npm run build:cores` (compiling both `snes9x2005-wasm-vanilla` and `snes9x2005-wasm` from C with `emcc -O3` via [tools/build_snes_core.sh](../../tools/build_snes_core.sh)), and `test:all` runs both `build:cores` and `build:music-engine` ([build-engine.sh](../../src/games/evermore/music/engine/build-engine.sh)), even when zero C files changed since October.
- **`tests/open-evermore/in-game.test.mts`** (~1 min documented in file header): boots `snes9x` **9 times for 1,000 frames each** (9,000 frames total). Its `await Promise.all([play(...), play(...), play(...)])` calls **do not run in parallel** because `M._mainLoop()` runs synchronously on Node's single JS thread inside `vm.runInContext` — all 3 cores interleave zero CPU work.
- **`tests/mana/mana-play.test.js`** (~5 s) & **`tests/terra/terra-play.test.js`** (~8 s): repeat 1,100–1,200 frame cold boots for each sub-scenario inside one process.
- **`tests/debugger/mesen-movie.test.js`**: 44-line pure unit test on synthetic ZIP buffers; needs neither emulator nor ROM.

### 1.6 Summary of Tier Contract Violations in [tests/tiers.json](../../tests/tiers.json)

| Test File | Current Tier | Why It Violates Tier Contract | Target Home |
|---|---|---|---|
| `tests/memory/package-files.test.js` | `unit` | Runs `tools/bundle.mts` + `vsce ls` (**20.4 s**) | New `package` tier (run in `package` / `test:all`) |
| `tests/memory/ppu-tabs.test.js` | `unit` | Launches headless Chromium (`playwright`) inside `unit` (**1.6 s**) | Split HTML assertions (`unit`) from Playwright assertions (`dom`) |
| `tests/debugger/mesen-movie.test.js` | `emulator` | Pure ZIP/buffer parser test (~40 ms, zero emulator/ROM) | `unit` |
| `tests/memory/code-vfs.test.js` | `rom` | Uses only a 64 KB synthetic `mockRom` (no retail ROM) | `unit` |
| `tests/simulation/scheduler.test.js` | `rom` | Runs 10,500 frames in `snes9x_2005.wasm` | `emulator` |
| `tests/memory/c-asm-parity.test.mts` | `rom` | Spawns Rosetta `cc65816` 315+ times; `c-to-rom` quality audit | Separate `c-to-rom:asm-parity` / cached `c-to-rom` check |

---

## 2. Concrete Speedups (Prioritized Roadmap)

### Phase 1 — Quick Wins (5–10× faster everyday `npm test` & `check:*`)

1. **Parallelize [tools/test.mts](../../tools/test.mts) (`--jobs N`, default `cpus - 2`, ~8 on 10 cores):**
   - Run files concurrently using an async worker pool (matching the pattern already used in [tools/sa1/prove.mts](../../tools/sa1/prove.mts) and [tools/exhirom/prove.js](../../tools/exhirom/prove.js)).
   - Buffer each child's `stdout`/`stderr` and flush cleanly on completion so logs don't interleave.
   - Keep `bundle.test.js` and `package-files.test.js` out of the hot parallel unit batch (or enforce explicit ordering if kept together, since `package-files.test.js` reads `bundle/drop.json` created by `bundle.test.js`).
   - *Expected impact:* 54 lightweight unit files drop from ~15 s serial to **~2–3 s** wall time; `dom` and `rom` files scale across 8 cores immediately.

2. **Move `package-files.test.js` (and `bundle.test.js`) out of `unit` into a `package` tier:**
   - Wire `npm test` → `unit` (pure + fast); run `node tools/test.mts package` inside `npm run package` / `npm run test:all` (or when `package.json`, `bundle/`, or webview manifests change).
   - Drop the redundant `activation.test.js` re-spawn inside `tests/memory/bundle.test.js` when running full `unit`, or keep `bundle.test.js` solely in the `package` tier.
   - Speed up `package-files.test.js` itself by replacing `vsce ls` (20 s) with a fast `git ls-files` + `bundle/.vscodeignore` filter check (keeping `vsce ls` only as an optional `--strict-vsce` check in `npm run package`).
   - *Expected impact:* saves **20.4 s** on every `npm test` immediately.

3. **Fix all 6 tier leaks in [tests/tiers.json](../../tests/tiers.json):**
   - Split the Playwright block (lines 89–155) of [tests/memory/ppu-tabs.test.js](../../tests/memory/ppu-tabs.test.js) into `tests/memory/ppu-tabs-dom.test.js` (`dom` tier); keep HTML checks in `unit`.
   - Move [tests/debugger/mesen-movie.test.js](../../tests/debugger/mesen-movie.test.js) and [tests/memory/code-vfs.test.js](../../tests/memory/code-vfs.test.js) into `unit`.
   - Move [tests/simulation/scheduler.test.js](../../tests/simulation/scheduler.test.js) into `emulator`.
   - Move [tests/memory/c-asm-parity.test.mts](../../tests/memory/c-asm-parity.test.mts) out of `rom` into `c-to-rom` / on-demand (or run it only when cached/dirty, see Phase 2 #6).
   - Fix or remove the stale `manual` entry [tests/debugger/emulator-runtime.test.js](../../tests/debugger/emulator-runtime.test.js) (stale since `v0.219.0`, fully superseded by `host-watch.test.js`, `click-walk.test.js`, `ui-log.test.js`, and `tas.test.js`).

4. **Make `build:cores` and `build:music-engine` skip when inputs are newer than outputs:**
   - In [tools/build_snes_core.sh](../../tools/build_snes_core.sh) and [build-engine.sh](../../src/games/evermore/music/engine/build-engine.sh), check source timestamps/hashes (`source/*.c`, `source/*.h`, `source/debugger-post.js`, `build.sh`) against `.wasm` / `spc-engine.js` and exit 0 immediately unless `--force` is passed or any input is newer.
   - *Expected impact:* `npm run test:emulator` and `npm run test:all` stop wasting 20–40 s recompiling unchanged C/WASM cores.

5. **Make `build:ts` incremental & add `npm run check:all`:**
   - Remove `rmSync('dist')` from the default `build:ts` (add a separate `build:ts:clean` for releases).
   - Enable `"incremental": true` and `"tsBuildInfoFile": "dist/.tsbuildinfo"` in [tsconfig.build.json](../../tsconfig.build.json) and [tsconfig.webview.json](../../tsconfig.webview.json) (requires dropping `noEmit` or using `emitDeclarationOnly` / `.tsbuildinfo` cleanly, and excluding `.tsbuildinfo` in `.vscodeignore`).
   - Parallelize `Promise.all(...)` over `PAGES` in [tools/bundle-pages.mts](../../tools/bundle-pages.mts).
   - Add a `tools/check-all.mts` runner (`npm run check:all`) that runs `build:ts` **once**, then executes `typecheck`, `check:circular`, `check:deps`, `check:dead` (calling `knip --no-gitignore` directly without re-running `build:ts`), `check:legal`, `check:dup`, `check:knowledge` (without re-running `build:ts`), and `check:ai-context` in parallel.
   - *Expected impact:* `release-ritual` static checks drop from **~21.5 s** to **~3–4 s**.

### Phase 2 — Medium Effort (3–6× faster `rom`, `dom`, `emulator`, `c-to-rom`)

6. **Parallelize + hash-cache Calypsi in `c-asm-parity.test.mts` & `tools/c-to-rom/build.mts`:**
   - In [tests/memory/c-asm-parity.test.mts](../../tests/memory/c-asm-parity.test.mts):
     - Cache per-routine instruction counts in `out/c-to-rom/asm-parity-cache.json` keyed by `sha256(cFile + soe.h + soe_ram.h + compilerFlags)`. Unchanged C files take **0 ms**.
     - Compile dirty files using an 8-worker async `execFile` pool (matching [tools/c-to-rom/build.mts](../../tools/c-to-rom/build.mts) lines 227–235).
   - In [tools/c-to-rom/build.mts](../../tools/c-to-rom/build.mts): stop calling `rmSync(workDir)` unconditionally on every build; recompile `.c -> .o` only when the `.c` or header hashes changed, keeping the existing `.o` files for `ln65816`.

7. **Share one Playwright browser instance across `dom` tests + remove double launch:**
   - In `tools/test.mts`, when running the `dom` tier, launch `const server = await chromium.launchServer()`, export `EVS_PLAYWRIGHT_WS=server.wsEndpoint()`, run all `dom` worker processes concurrently against `chromium.connect(process.env.EVS_PLAYWRIGHT_WS)` (using `browser.newContext()` per test, falling back to `chromium.launch()` when run standalone), and close `server` at the end.
   - In [tests/debugger/host-watch.test.js](../../tests/debugger/host-watch.test.js), reuse a single `browser` across both Playwright test blocks (currently launches Chromium twice: lines 52 and 129).
   - *Expected impact:* eliminates 20+ cold Chromium startups (~15–20 s saved across `dom`).

8. **Use real worker threads/subprocesses for multi-boot emulator tests (`in-game`, `mana-play`, `terra-play`):**
   - In [tests/open-evermore/in-game.test.mts](../../tests/open-evermore/in-game.test.mts), lines 125, 154, and 179 call `Promise.all([play(...), play(...), play(...)])`, which serializes on Node's single thread. Spawning `play()` in worker threads or child processes runs all 3 ROM boots per group (and even all 9 across cores) truly in parallel, cutting ~60 s down to **~10–15 s**.
   - In [tests/mana/mana-play.test.js](../../tests/mana/mana-play.test.js) and [tests/terra/terra-play.test.js](../../tests/terra/terra-play.test.js), share the boot save-state (`Module._saveState()` / `_loadState()`) across walk tests that use the same start ROM, or run the 3-4 sub-boots in worker children.

9. **Batch Python calls in `map-parity.test.js` & parallelize `g0.test.mts`:**
   - In [tests/memory/map-parity.test.js](../../tests/memory/map-parity.test.js), pass all room IDs in one `dump_room.py` invocation (or persistent JSON-lines pipe) instead of paying 9 Python + `everscript` import startups.
   - In [tests/open-evermore/g0.test.mts](../../tests/open-evermore/g0.test.mts), fan out the independent `implode` builds (random seeds, ExHiROM, SA-1, error rules) across workers after the single initial `explode()`.

---

## 3. Classifying Test Helpfulness (Signal-to-Cost Audit)

Not all tests carry the same signal per second waited:

| Class | Meaning | Execution Policy |
|---|---|---|
| **A — Fast High-Signal Guardrails** | Pure logic, decoders, encoders, 65816 CPU, VM, simulation units, Open Evermore formats/hooks, grammar. Deterministic, `< 0.5 s` each. | Always run on `npm test` (~2–3 s total once parallelized). |
| **B — High-Signal Domain Oracles** | ROM parity/round-trips (`g0`, `map-parity`, `script-vm/rom`), Playwright DOM tests (catch real browser bugs like `e.target` & missing `window.prompt`), real emulator behavior tests (`in-game`, `mana-play`, `terra-play`, `tas-*`). | Run **only when their domain (or upstream `platform`/`core`) changes**, plus pre-release. |
| **C — Release / Audit / Hygiene Gates** | Packaging (`package-files`, `bundle`, `activation`), knowledge/VFS parity (`rom-map-parity`, `assets-documentation`, `soe-tags`, `soe-resources`), `emulator-health`, `c-asm-parity`. | Run when touching packaging, knowledge/VFS, core files, or `reconstructed-c/` — and at release. |
| **D — Low-ROI / Redundant / Stale** | Slow or flaky checks duplicated by better tests, weak assertions at high runtime cost, or obsolete tests. | Trim, fix, or remove. |

### Complete Classification of All 113 Test Files + Proof Tools

- **Class A — Fast High-Signal Guardrails (48 files — keep in `unit`):**
  - Core / Platform / Localization / Debugger logic: `activation`, `snes-rom-header-model`, `rom-library`, `settings-model`, `debugger`, `script-trace`, `trigger-overlay`, `everscript-inject`, `emulator-audio`, `emulator-gamepad`, `emulator-bottom-bar`, `emulator-menu`, `emulator-crash-logging`, `emulator-map-overlays`, `emulator-reopen`, `cdl`, `cdl-rescue`, `cdl-recomp`, `cheats`, `exhirom`, `tas-resume`, `mesen-movie` *(move from `emulator`)*, `localizations`, `msu1`, `rebuild-invalidation`, `mcp-server`.
  - Evermore pure models: `radar`, `map-units`, `map-editor`, `variants`, `damage`, `scaling-rom`, `rooms-layout`, `animation-relations`, `script-vm/units`, `simulation/sim-units`, `simulation/combat`, `code-vfs` *(move from `rom`)*.
  - Open Evermore & Multi-game pure models: `enum-layout`, `formats`, `implode`, `ingredient-hooks`, `item-hooks`, `wram`, `mana-units`, `mana-cpu`, `mana-editor-core`, `mana-editor-props`, `terra-maps-model`, `imports/redraw`, `imports/status`.
  - TextMate grammar tests (`vscode-tmgrammar-test`, 0.3 s).

- **Class B — High-Signal Domain Oracles (48 files — run per changed domain + pre-release):**
  - *Evermore ROM decoders & compilers (`rom`):* `script-vm/rom`, `script-model/rom`, `simulation/loot`, `simulation/room`, `simulation/everscript`, `map-parity`, `rom-export`, `collision-suggest`, `custom-maps`, `render-script-model`, `radar-hosts`, `sprites`, `open-evermore/g0`, `rom-history`.
  - *Mana & Terranigma (`rom` + `dom` + `emulator`):* `mana-rom`, `mana-evermore`, `terra-rom`, `terra-evermore`, `mana-panel-dom`, `mana-map-editor-dom`, `mana-editor-cells-dom`, `mana-rooms-dom`, `mana-editor-dom`, `terra-maps-dom`, `terra-editor-dom`, `mana-play`, `terra-play`.
  - *Webview DOM (`dom`):* `map-editor-dom`, `rooms-rail-dom`, `room-variants-dom`, `rom-tab`, `scripts-tab`, `data-tab`, `routes-tab`, `code-tab`, `recorder`, `host-watch`, `click-walk`, `ui-log`, `tree-editor-dom`, plus split `ppu-tabs-dom` *(extracted from `ppu-tabs`)*.
  - *Emulator core & TAS (`emulator`):* `music-tab`, `script-debug-hook`, `scheduler` *(move from `rom`)*, `cdl-bus`, `cdl-values`, `tas-events`, `tas`, `tas-states`, `tas-verify`, `open-evermore/in-game`.

- **Class C — Release / Audit / Hygiene Gates (8 files — run when owning area changes or at release):**
  - *Packaging (`package` tier):* `package-files` (**20.4 s**, move out of `unit`), `bundle`.
  - *Knowledge & VFS parity:* `rom-map-parity`, `assets-documentation`, `soe-resources`, `soe-tags`, `ppu-tabs` (HTML structure checks).
  - *Core binary integrity:* `emulator-health` (546 lines scanning `snes9x_2005.wasm` / exports — only useful after touching `snes9x2005-wasm*` or `panel*`).

- **Class D — Low-ROI / Redundant / Stale (rework or retire):**
  1. **`tests/debugger/emulator-runtime.test.js` (`manual`):** Dead since `v0.219.0`; references deleted UI buttons. **Action:** delete or rewrite what isn't covered by `host-watch` / `click-walk` / `ui-log` / `tas`.
  2. **`tests/memory/c-asm-parity.test.mts` (`rom`):** Compiles 315+ C files sequentially via Rosetta Calypsi in `rom`, yet only asserts `totalCompiledInsns > 0` (its per-routine ratio output is advisory logging, not a failing gate). **Action:** move out of `rom` into `c-to-rom:asm-parity`, add hash cache + 8-way parallelism so touching 1 C file compiles 1 C file.
  3. **Node-`vm` fake-DOM duplication (`tests/memory/smoke.test.js` 0.9 s, `tests/memory/ui.test.js` 1.9 s):** Re-implement brittle mock DOMs in Node `vm` for radar HTML/JS that real Playwright tests (`map-editor-dom`, `rooms-rail-dom`, `data-tab`, `scripts-tab`, etc.) now test properly. **Action:** keep `smoke.test.js` only for syntax/load verification until `port-to-ts.md` finishes ESBuild webview bundling, and trim redundant mock-DOM event simulations covered by Playwright.
  4. **Duplicate `activation.test.js` inside `tests/memory/bundle.test.js`:** `activation.test.js` already runs in `unit`; `bundle.test.js` spawns it a second time (`0.75 s`). **Action:** move `bundle.test.js` to the `package` tier where testing the built `bundle/extension.js` actually matters.
  5. **On-demand proof suites (`tools/open-evermore/prove.mts`, `tools/exhirom/prove.js`, `tools/sa1/prove.mts`, `tools/table-hack/prove.js`, `tools/c-to-rom/g1.mts`):** Correctly kept outside `tests/tiers.json`. Keep them strictly on-demand; never add them to a tier.

---

## 4. Running Only Relevant Tests (`--changed` & Domain Selectors)

Add `--changed [base]`, `--domain <list>`, `--filter <glob>`, and `--jobs N` to [tools/test.mts](../../tools/test.mts):

- **Mapping strategy:** Use a small explicit `tests/domains.json` manifest (directory/glob → test files + tier) for webview assets, HTML string builders, and `tools/*`, combined with optional transitive JS/TS import tracing via `depcruise` / `madge` (both already in `devDependencies`) so a change to a library automatically selects tests importing it.

### Changed-Path → Relevant Tests Matrix

| Changed Path Pattern | Tests & Checks to Run | Skip Completely |
|---|---|---|
| `docs/**`, `*.md` (excluding `src/games/evermore/localizations/**`) | `check:ai-context`, `check:legal -- --staged` | All `build:ts`, `unit`, `rom`, `dom`, `emulator` |
| `src/games/evermore/language/**` | `vscode-tmgrammar-test`, `activation`, `bundle` (if `package.json` touched) | `rom`, `dom`, `emulator`, map/mana/terra tests |
| `reconstructed-c/**`, `tools/c-to-rom/**` | Cached `c-to-rom:asm-parity` (only changed `.c` files!), `code-vfs`, `cdl-recomp`, `c-to-rom:g1 <routine>` | `dom`, `mana`, `terra`, `map-editor` |
| `tools/open-evermore/**` | `tests/open-evermore/*.test.mts` (`unit` subset; add `g0` on codec edits, `in-game` on table/layout changes) | `mana`, `terra`, `debugger`, `language` |
| `src/games/evermore/maps/**`, `src/games/evermore/rooms/**`, `src/core/map-editor/**` | `map-units`, `map-editor`, `rooms-layout`, `smoke`, `map-editor-dom`, `rooms-rail-dom`, `room-variants-dom`, `map-parity`, `rom-export`, `collision-suggest`, `custom-maps` | `mana-play`, `terra-play`, `music-tab`, `c-asm-parity`, `tas-*` |
| `src/games/evermore/script*/**`, `simulation/**`, `routes/**` | `script-vm/units`, `sim-units`, `combat`, `script-vm/rom`, `script-model/rom`, `simulation/*` (`scheduler` only if scheduler changed), `scripts-tab`, `routes-tab` | `map-editor-dom`, `mana`, `terra`, `music-tab` |
| `src/games/mana/**`, `src/games/evermore/imports/mana/**` | `tests/mana/*.test.js` (`unit` + `rom` + `dom`, `mana-play` only on gameplay/collision changes) | `terra`, `c-asm-parity`, `tas-*` |
| `src/games/terra/**`, `src/games/evermore/imports/terra/**` | `tests/terra/*.test.*` (`unit` + `rom` + `dom`, `terra-play` only on gameplay/collision changes) | `mana`, `c-asm-parity`, `tas-*` |
| `src/core/emulator/**`, `src/games/evermore/emulator/**`, `src/platform/cdl/**`, `src/platform/tas/**` | `tests/debugger/*` (`unit` + `dom` + `emulator`), `music-tab` / `scheduler` if core WASM changed | `mana-editor-*`, `terra-*`, `open-evermore`, `map-editor` |
| `src/games/evermore/localizations/**`, `resources/**` | `localizations`, `rom-map-parity`, `assets-documentation`, `soe-resources`, `soe-tags`, `code-vfs`, `check:knowledge` | `dom`, `emulator`, `mana`, `terra` |
| `src/platform/**`, `src/core/**` (shared) | Full `unit` tier + downstream tests matching `depcruise` dependents | Unrelated game play/DOM tests |
| `package.json`, `tools/bundle*`, `bundle/.vscodeignore` | `package` tier (`bundle`, `package-files`, `activation`) + `npm run package` dry check | `rom`, `emulator` |

**Escalation rule:** Every change still runs its affected `unit` subset (`~1–3 s`) plus `typecheck`. Full `npm run test:all` and `check:all` remain the release / major-refactor gate in [release-ritual](../../.agents/skills/release-ritual/SKILL.md).

---

## 5. Can We Use the Recomp (`SecretOfEvermoreRecomp`) Instead of MesenCE?

### 5.1 Speed, Accuracy & Capability Comparison

| Dimension | Our `snes9x 2005` WASM (`src/core/emulator/core/`) | `SecretOfEvermoreRecomp` (`../SecretOfEvermoreRecomp`) | `MesenCE --testrunner` |
|---|---|---|---|
| **Measured speed** | **~10,000 fps** in headless Node ([reference-emulators](../../.agents/skills/reference-emulators/SKILL.md)) | **~166–463 fps** (2.8×–7.7× real time across 9 replays in [PROGRESS.md](../../docs/disassembly/PROGRESS.md) Session 82: 463 fps on 8.6k-NMI attract loop, 366 fps on 23.8k-NMI new game, 166 fps on 76k-NMI Thraxx→Magmar) | **~185–350 fps / instance** (e.g., `sa1:prove` ran ~270k frames in ~4 min across 6 parallel instances in [docs/sa1/port.md](../../docs/sa1/port.md)) |
| **WRAM trust** | **Not trusted** vs hardware (known timing/lag gaps); **valid** for differential A/B of two ROMs on the same core ([reference-emulators](../../.agents/skills/reference-emulators/SKILL.md) Rule 0) | **NMI-exact vs MesenCE** on all 9 tested US replays (0 desyncs, ~99.7% native execution; [PROGRESS.md](../../docs/disassembly/PROGRESS.md) §1, §4) | **Hardware-trusted WRAM reference** (disputed frames cross-checked by hand in `ares`) |
| **Inputs supported** | Any 3–8 MB HiROM/ExHiROM `.sfc`; no SA-1 | **Stock US HiROM ROM only**; hacks enter via `.snesmod` data overlays or rebuilt `hle_func` C bindings, **not** arbitrary patched `.sfc` images | Any HiROM, ExHiROM, SA-1, Combo, PAL, Mana, Terranigma, or `c-to-rom` `.sfc` |
| **Hardware accuracy** | Approximated CPU/PPU timing; no SA-1 | Recompiled 65816 + `snesrecomp` silicon; **not** valid for cycle counts, DRAM refresh, PPU/DMA races, or SA-1 | Full SNES + SA-1 + DRAM refresh + master-clock timing |

### 5.2 Decision Matrix: When Recomp (or `snes9x`) Can Replace MesenCE

| Use Case | Replace MesenCE? | Use Instead / Why |
|---|---|---|
| **1. `reconstructed-c/` Gate G2 (`hle_func` A/B equivalence)** | **YES (Recomp)** | Compare recomp with vs without bound C in `SecretOfEvermoreRecomp`. Both sides share identical recomp timing (0 drift, no MesenCE needed; [c-to-rom.md](../../docs/reverse-engineering/c-to-rom.md) §3). |
| **2. Stock-US WRAM/state probing, room scripts, mechanics & headless nav (`room-nav.js`)** | **YES (Recomp)** | Recomp matches MesenCE WRAM at every NMI across 9 replays (up to 75,966 NMIs). Probe in recomp first; only verify disputed PPU/DMA/timing frames in MesenCE. |
| **3. Recomp replay regression tests (`01`–`07` `.mmo`)** | **YES (Cached Hashes + Recomp)** | Run MesenCE **once** per `.mmo` to save a lightweight NMI-counter WRAM/VRAM CRC trace (hashes only, legal under Rule 0.1). Routine runs test the recomp against cached golden hashes in 0 s of MesenCE time. |
| **4. Open Evermore / Everscript / Table-Hack differential proofs (`prove.mts`, `in-game.test.mts`, `table-hack:prove`)** | **PARTIAL → Keep `snes9x` Today** | Recomp cannot run arbitrary patched `.sfc` images directly (only `.snesmod` overlays against stock code; [docs/recomp/README.md](../../docs/recomp/README.md)). Meanwhile `snes9x 2005` at **~10,000 fps** is **20×–50× faster** than both recomp and MesenCE and is **already valid** for differential original-vs-modified HiROM/ExHiROM ROM tests (Rule 0). Recomp only enters if Open Evermore emits `.snesmod` packages. |
| **5. ExHiROM 8 MB port & header-scoring sign-off (`tools/exhirom/prove.js`)** | **NO (MesenCE at sign-off; `--no-mesen` for dev)** | MesenCE tests real ExHiROM header detection (`0x40FFC0` vs `0xFFC0`) and `$80:D113` mirroring differences. Use `--no-mesen` on `snes9x` during iteration; run MesenCE only once before sign-off. |
| **6. SA-1 port, boot clock fit, offload, & Combo ROM (`tools/sa1/*`, `tools/combo/*`)** | **NO (MesenCE mandatory)** | Recomp and `snes9x 2005` do not emulate SA-1, BW-RAM, I-RAM, or Super MMC; `sa1:measure` depends on MesenCE master-clock DRAM-refresh timing ([docs/sa1/port.md](../../docs/sa1/port.md)). |
| **7. Calypsi 65816 `c-to-rom` binaries (`tools/c-to-rom/`)** | **NO (Use `cpu65816.ts` G1 + `snes9x` A/B)** | Recomp executes native host C (`src/bound-c/`), not Calypsi-compiled 65816 machine code in banks `$F8–$FB`. Use `g1.mts` + `snes9x` differential checks for Calypsi codegen, MesenCE only for cycle/NMI drift checks. |
| **8. Frame CPU-load / slowdown / lag profiling (`sa1:load`, `sa1:measure`)** | **NO (MesenCE mandatory)** | Requires real master-clock cycle timing per scanline and lag-frame counts ([tools/sa1/load.mts](../../tools/sa1/load.mts)). |
| **9. PAL Evermore, Secret of Mana, Terranigma** | **NO (MesenCE / `snes9x`)** | `SecretOfEvermoreRecomp` targets US Evermore only ([docs/recomp/other-projects.md](../../docs/recomp/other-projects.md)). |

### 5.3 Speeding Up the Unavoidable MesenCE Runs

1. **Cache vanilla control traces in [tools/sa1/prove.mts](../../tools/sa1/prove.mts) and [tools/exhirom/prove.js](../../tools/exhirom/prove.js):**
   - Both scripts re-run the unmodified base ROM across every input (plus a second `original-again` determinism run!) on every single invocation. Caching `original` traces in `out/` keyed by `(romSha256, movieSha256, frames, probes, scriptHash)` skips **~30–50%** of MesenCE work immediately.
2. **Eliminate the Lua byte-by-byte CRC loop in [tools/sa1/mesen.mts](../../tools/sa1/mesen.mts) and [tools/exhirom/mesen.js](../../tools/exhirom/mesen.js):**
   - Every frame currently runs `512` Lua `emu.read()` calls (`$0000–$01FF`), and every 60 frames runs **205,856 interpreted Lua `emu.read()` calls** (128 KB WRAM + 64 KB VRAM + CGRAM + OAM + SRAM) to compute CRCs in Lua. Hashing inside native Mesen2 or sampling only live WRAM / dirty ranges at checkpoints removes substantial Lua interpreter overhead on multi-movie runs.
3. **Add `--quick` dev presets & mid-game save states (`SaveState.mss`):**
   - Run 1–2 short targeted inputs (~3,000–6,000 frames) or mid-game `SaveState.mss` starts (at scanline 225, identical in both MesenCE and recomp; [reference-emulators](../../.agents/skills/reference-emulators/SKILL.md)) during development, saving 15,000–60,000-frame multi-movie sweeps for final sign-off.

---

## 6. Recommended Rollout Order

1. **PR 1 — Clean tiers & fast `npm test`:** Move `package-files` & `bundle` to a `package` tier (replace `vsce ls` with a fast `.vscodeignore` check in `unit`), fix the 6 tier misplacements in [tests/tiers.json](../../tests/tiers.json), split `ppu-tabs-dom.test.js`, and parallelize [tools/test.mts](../../tools/test.mts) (`--jobs`). Target: `npm test` **38–42 s → ~3–4 s**.
2. **PR 2 — Incremental TS build & `check:all`:** Incremental `tsc`, parallel [tools/bundle-pages.mts](../../tools/bundle-pages.mts), `build:cores` / `build:music-engine` mtime guards, and a single `check:all` runner. Target: static checks **21.5 s → ~3–4 s**.
3. **PR 3 — Targeted runner (`--changed` / `--domain`):** Add `tests/domains.json` + `--changed` / `--domain` / `--filter` to `tools/test.mts`, wire doc-only fast path. Target: daily change verification **~1–5 s**.
4. **PR 4 — Cache & parallelize `c-asm-parity` + `c-to-rom:build`:** SHA-256 cache + 8-worker Calypsi pool.
5. **PR 5 — Shared Chromium & multi-worker emulator tests:** `chromium.launchServer()` for `dom`, worker pool for `in-game.test.mts` / `mana-play` / `terra-play`, batched `dump_room.py` in `map-parity`.
6. **PR 6 — MesenCE trace caching & Lua CRC optimization:** Cache `original` traces in `sa1:prove` / `exhirom:prove` and `SecretOfEvermoreRecomp` `.mmo` golden NMI hashes.
