# Repo cleanup

Decided 2026-10-16 in a design interview with the owner. This file is the plan and the backlog;
the game-neutral target architecture it works towards is [architecture/multi-game.md](architecture/multi-game.md).
It replaces the v0.199.0 audit `docs/architecture-state.md` (read it with
`git show daeb17a:docs/architecture-state.md`); the findings still worth acting on are carried
over below, each marked "re-measure" because the tree has moved since.

Work happens in this repo (no fresh repo), one work item per session, in the order of §3. Tick
an item only when its check passes.

---

## 1. Goals and the check that proves each

| Goal | Done when |
|---|---|
| No licence violations in the tree | `npm run check:legal` passes on `git ls-files` (§3 step 1) |
| Nothing ported from SoETilesViewer / SoEScriptDumper | No file in `src/`, `tools/`, `tests/`, `docs/` declares itself a port, reads upstream output or points into an upstream checkout (`check:legal`); names are the one exception (D3) |
| No dead code, lean tools | `npm run check:dead` (knip, no blanket ignores) is clean; every file in `tools/` is reached by an npm script, a skill or a doc workflow |
| No code duplication | `npm run check:dup` (jscpd): no clone ≥ 30 lines, ≤ 5 % per domain |
| TypeScript wherever it makes sense | Every `.js` outside the exceptions in D9 is `.ts`; `strict` on |
| Every address and name documented | `npm run check:knowledge`: 100 % of CDL-recorded routines and of WRAM addresses the code uses have a knowledge entry with a name (D11) |
| Docs current, no stale docs | Every domain has a true `README.md` + `AGENTS.md`; no doc points at a missing path; finished plans and dossiers deleted |
| Skills for everything we need, AI context slim | `npm run check:ai-context` passes (D10) |
| Any game, not just Evermore | `src/` is `platform/` + `core/` + `games/<game>/` with the dependency rules of multi-game.md §2 enforced by `check:deps` |

---

## 2. Decisions

- **D1 — This file is the plan.** One work item per finding, each with its check.
- **D2 — Git history is kept for now.** The repo is on GitHub (`r-bin/everscript-vscode`).
  Commits that added problem content are listed in §4 as a known future problem; no history
  rewrite is part of this cleanup.
- **D3 — The re-do (clean room).** Everything ported from SoETilesViewer / SoEScriptDumper is
  re-implemented from the game: the script decoder, `sprites.ts`, the character record readers.
  Procedure and phases: [plans/script-decoder-from-game-code.md](plans/script-decoder-from-game-code.md).
  1. Write what the part does as a black-box spec in our own words (inputs, outputs, users).
  2. Delete the ported code and data.
  3. Rebuild from game evidence (ROM, CDL, headless runs, `soe://`) against that spec, with tests.
  A rebuilt part is checked against the game only — never against the old ported output.
  Whoever rebuilds a part has not read the upstream source.
- **D4 — Names.** Labels only (room, enemy, item, flag names); groupings and layouts are
  structure and are re-derived.
  - Room names stay for now but are **rewritten in our own style**:
    `Prehistoria › Blimp's hut › exterior  [map $1A]` for display; a path id
    (`prehistoria/blimps-hut/exterior`) is generated from it. Each part has a source (region from
    the game's world structure, place from in-game text where it exists, interior/exterior from
    the map data) recorded as evidence.
  - Disassembly text is **reinvented**: an instruction prints as the everscript compiler spells
    it, e.g. `heal(boy, mem16[$23E5 + 15], animate: true)` instead of
    `(94) HEAL boy FOR *($23e5 + 15) WITH ANIMATION`. The output is valid Everscript that
    recompiles to the same bytes; the opcode number shows on hover. Opcode spec from the
    interpreter at `$8C:D0A6`, wording from the compiler's grammar, one opcode table shared by
    decoder and compiler.
- **D5 — The ROM comes from `soe://` only** (and `som://` for Mana). `$SOE_ROM`,
  `EVERSCRIPT_ROM`, `everscript.romPath` and every hard-coded ROM path go. Tools, tests and the
  extension read through one resolver module that does not need VS Code; decoded data that
  `soe://` already serves is read from there, and duplicate parsers in tools/tests are deleted. A
  tool parses a format itself only while `soe://` does not decode it yet — the fix is to add it to
  `soe://`. Details: multi-game.md §4–§5.
- **D6 — Multi-game structure** (`platform/`, `core/`, `games/<game>/`), game descriptor,
  variants, base ROM, ROM panel: multi-game.md. The restructure is step 4 below.
- **D7 — Dead code and tools.** knip for unused files/exports, jscpd for clones, depcruise for
  orphans and edges. Checks start report-only and become blocking when their step is done. Code
  used only by tests or tools counts as live. Python leaves the repo entirely.
- **D8 — The docs rule.** Whenever you see a WRAM address or an asm routine/line, look up its
  knowledge entry; if there is none, write it (`game-knowledge` skill). Enforced by
  `check:knowledge`: the backlog is reported, new undocumented addresses block.
- **D9 — TypeScript.** Port actively, everything under `src/`, `tools/`, `tests/`, `scripts/`,
  webviews included (bundled with esbuild). Exceptions: generated files, the emscripten glue,
  configs that must be JS (`.depcruise.js`). Each domain moves to TS when it is restructured
  (step 4/5), `strict` on for moved and new files.
- **D10 — Slim AI context.** Root `AGENTS.md` ≤ 150 lines (the big file map moves to
  `src/README.md` / `docs/`); each `SKILL.md` ≤ ~200 lines with details in linked reference
  files; skill descriptions ≤ 2 lines, written as trigger conditions; no fact stated in two AI
  files (one owner, others link). `check:ai-context` fails on overruns.
- **D11 — Every address and name for recomps.** Every routine the CDL library recorded and every
  WRAM address the code touches gets a knowledge entry and a name in our style; the name becomes
  the label in the Asar export and later the C function name in the recomp; entries can carry a
  comment for the asm and for the C function. `check:knowledge` reports coverage (routines,
  WRAM); the `re-curator` agent works it down. Mana and Terranigma get the same scheme, each its
  own knowledge store.
- **D12 — WASM: scout only.** Record candidates and how to measure them (§3 step 5); build
  nothing in this cleanup. A future WASM module keeps a TS twin or a TS test oracle.
- **D13 — Stale docs are deleted or merged**, not kept: `STATE_FLOW.md`, pre-refactor
  `docs/architecture/*`, finished plans and dossiers. Git keeps them.

---

## 3. Order of work

### Step 1 — Legal check and the rules agents read
- [x] **1.1** `tools/check-legal.mts` + `npm run check:legal` (tree; `--staged`; `--history` writes
  [legal-history.md](legal-history.md); `--baseline` rewrites `tools/check-legal.baseline.json`, the
  known findings that later steps remove — it only shrinks). Fails on: ROM/save/patch/audio/image extensions and magic bytes; `data:`
  URIs or 200+-char base64 runs; 64+ consecutive numeric literals or 8+ hex-dump lines; ROM file
  names or home-directory paths; mentions of SoETilesViewer / SoEScriptDumper / `data.h` /
  `list-rooms.cpp` / `characterdata.h` outside this file, the plan and `AGENTS.md`. Run in the
  release ritual on staged files.
- [x] **1.2** One rule on names in `AGENTS.md`, `AI_ARCHITECTURE_GUIDE.md` §3.8 and the plan (D4).
- [x] **1.3** `docs/release-checklist.md` (called the upstream tool MIT; stale) deleted.
  `LICENSE`/README: MIT covers our code only; the snes9x2005 core and the SPC engine are
  non-commercial and keep their `copyright`/`NOTICE` files. README §License: no `file:///Users/…`
  links.
- [x] **1.4** `.vscodeignore` and `.gitignore`: ROM/save/patch/audio globs, `docs/**`, `wiki/**`,
  `.agents/**`, `tools/**`, `.emscripten_cache/**` (re-measure the VSIX; at v0.199 it was 37 MB,
  ~30 MB of it the emscripten cache; now 614 files, 7.6 MB).
- [x] **1.5** Trim the short ROM byte excerpts in `docs/map-format/map_decompression_trace_analysis.md`
  and `docs/render-script-93.md`.

### Step 2 — The re-do (D3, D4)
Scope, from the inventory of 2026-10-16:

| Part | Files | Rebuilt as |
|---|---|---|
| Script decoder | `src/games/evermore/script/{addressing,decoder,expression,loot,ops-entity,ops-flow,ops-memory,ops-system,index}.ts` (~1.7 k lines) | `src/games/evermore/script-vm/` from the interpreter at `$8C:D0A6`, printing compiler spelling (D4) |
| Sprites | `src/games/evermore/maps/sprites.ts` | from the routines that walk the sprite pools |
| Character record | `src/games/evermore/maps/character-record.ts`, `src/games/evermore/sprites/character-model.js` | from the game's own reads of the records |
| Names | `src/games/evermore/script/names.json`, `names.ts`, `src/games/evermore/localizations/{maps,scripts}.js`, `src/games/evermore/localizations/data/scripts.json` | kept (D4); room names rewritten in our style; `tools/generate-script-names.js` deleted (it reads an upstream checkout) |
| Upstream-output tests | `tests/memory/script-parity.test.js`, `script-loot.test.js`, the upstream parts of `script-units.test.js`, `map-parity.test.js:365,372` | goldens from the running game (plan phase 2) |
| Upstream-output data | `script_parser/generated/**` (incl. the 2.3 MB `opcode-corpus.json` with raw ROM bytes + dumper text), `script_parser/tests/generated/**`, `sandbox/{,opcodes/}corpus`, `sandbox/{,opcodes/}boundaries` | deleted |
| Upstream paths | `src/games/evermore/maps/render-script-model.js:8`, `script_parser/src/scripts-all-model.ts:56` | `soe://` (D5) |
| Attribution in docs/comments | `src/README.md:17`, `src/games/evermore/script/README.md`, `src/games/evermore/maps/README.md:82`, `src/games/evermore/sprites/README.md:7`, `src/games/evermore/sprites/animation-decoder.js:113`, `src/games/evermore/docs-tab/render-docs-tab.js:136` (user-visible), the "OBJ n" comments in `rom-overlay.js:35`, `overlay-features.ts:48`, `collision-overlay.ts:185`, `docs/script-format/*`, `docs/room-script-parser.md`, `docs/map-format/map_editor_design.md:50-58,233`, `docs/room-simulation.md:107`, `docs/rooms-settings-cleanup-dossier.md:42`, `.agents/agents/script-parser-generator.md:128` | rewritten with the code they describe |

- [ ] **2.1** Sprites + character record (plan part B).
- [ ] **2.2** Script VM phases 1–5 of the plan, with the compiler-spelled output.
- [ ] **2.3** Room names in the new style, each with evidence.
- [ ] **2.4** Delete every row's old files; `check:legal` clean.

### Step 3 — Dead code and tools (D7)
Inventory of 2026-10-16. Move the ROM out of `script_parser/dependencies/` first: 7 tests,
`src/games/evermore/rom-readers.js:15`, `src/games/evermore/emulator/script-trace.js:29` and
`tools/gen-sound-animations.js` look for it there — they go through the resolver (D5) instead.

- [x] **3.1 Delete, superseded:** `script_parser/` (tracked files; its untracked `dependencies/` and
  `tests/` stay on disk for you to delete — nothing reads them now), `sandbox/opcodes`,
  `sandbox/corpus`, `sandbox/boundaries` (broken: import the missing `tests/parity/failure-types`),
  `tools/snes9x_wram.py`, `tools/pack_snes_core.py`, `tools/generate_data.py`,
  `tools/dump_proto_spc.py`, `tools/check-encode.js` + npm `check:encode`.
- [x] **3.2 Delete, one-off or broken:** `tools/_extract_webview.py`, `tools/_patch_extension.py`,
  `tools/extract_modules.py`, `tools/slice_montage.py`, `tools/run_slicer.py`,
  `tools/process_maps.sh`, `tools/render-script-dump-93.js` (imports the missing
  `memory_radar/`), `tools/call-graph-galaxy/`, `sandbox/room-data/`.
- [x] **3.3 Delete, unreferenced:** tracked `tools/__pycache__/*.pyc`, `.gemini/` (duplicates
  `.mcp.json`; Gemini users keep their own). Untracked leftovers to delete by hand (git cannot
  restore them, so agents leave them): `experimental/`, `.storage/`, `dependencies/` (Finder
  aliases), `.github/`, `last_run_report.json`, `tools/__pycache__/`, `tools/call-graph-galaxy/`.
- [x] **3.4 Move:** `call-log/design.md` → `docs/plans/call-log.md`, `simulation/*.md` →
  `docs/plans/simulation/`, `todo.md` → `docs/todo/scratch.md`.
- [x] **3.5 Dead code:** emulator handlers with no sender (`wramDelta`, `getRomOfferInfo`),
  unreferenced `src/emulator/webview/index.html`, the Route mock tab (`src/routes/`, its HTML, CSS
  and logic in `docs-tab.js`; the plan stays in `docs/route-planner.md`), setting
  `everscript.patchesPath`. Checked and kept: the vanilla core is the default bundled core.
- [x] **3.6** knip: one `src/**/webview/**` ignore instead of nine folders, stale entries gone, clean.
  The webview ignore goes with esbuild (5.3), because those files are spliced as strings and knip
  cannot follow them. `check:circular` covers `.ts` (`.madgerc`, type-only imports skipped); the one
  cycle (`maps/animation → render → room`) was type-only. Both checks are now blocking.
- [x] **3.7** `npm run package`: `vsce` from `PATH` (`build:script` already ran via `build:simulation`).

### Step 4 — Multi-game restructure (D5, D6)
Progress: [architecture/multi-game.md](architecture/multi-game.md) §7 "Status" (ROM library, game
descriptors, layer rules and the derived-ROM marker are built; moving the domains is open).
Follow [architecture/multi-game.md](architecture/multi-game.md) §7. In short: resolver + ROM
library + game descriptor; move domains into `platform/`, `core/`, `games/evermore/`,
`games/mana/`; ROM panel and status bar; depcruise rules; `$SOE_ROM`/`romPath` gone. Each domain
converts to TS as it moves (D9).

### Step 5 — Duplication, big files, TypeScript (re-measure all)
What is duplicated between Evermore and Mana is what becomes `core/`.

- [ ] **5.1 Clones at v0.199** (v0.234.0, done: `platform/snes/hirom.ts` (bus→file, read16/24; Evermore `maps/rom.ts`,
  Mana `decoder/rom.ts`, sprites, ROM tab, table hack, CDL values), `platform/crc32.ts` (6 copies → 1),
  `platform/png.ts` (2 encoders → 1), `platform/snes/opcodes-65816.ts` (the one matrix, now TS; the CDL shim is
  gone), ROM history identifies through the ROM library instead of its own hash list. Left: the inline
  `& 0x3FFFFF` masks in `emulator/` and `shared/rom-readers.js` (go with their split), HTML escape, hex
  formatters, tab strip, CSP shell → `core/webview` with 5.3; the script decoder's `addressing.ts` with step 2) → one owner each: bus→file offset (~11 copies) and read16/24 (~20)
  → `platform/snes`; BGR555, 2/4bpp, sprite decompressor (emulator copy of `maps/sprites.ts`
  ~240 lines) → `platform/snes` gfx; alchemy damage math (×3) → one module in `games/evermore`;
  HTML escape (×6), hex formatters (×23), tab strip, CSP shell → `core/webview`; 65816 opcode table
  (×2), crc32 (×2), room-table pointer `0x1ffde7` (×3).
- [x] **5.2** `npm run check:dup` (jscpd, `.jscpd.json`: clones of 30+ lines in `src/` and `tools/`), blocking.
  The only such clone was the alchemy math (×3): one copy now, `src/games/evermore/scaling/webview/alchemy-math.js`,
  loaded by the radar page and required by the tests. The short helpers of 5.1 are below its threshold.
- [ ] **5.3 esbuild:** (first part done in v0.231.0: one TypeScript build, `tsconfig.build.json` →
  `dist/` mirroring `src/`, `npm run build:ts`; the five per-domain builds are gone) one host bundle and one bundle per webview from real `.ts`/`.css`/`.html`;
  no code in template literals (~9.5 k lines at v0.199: `emulator/panel-webview.js`,
  `menu/menu-view.js`, `bottom-bar-views.js`, the emulator `*-view.js` files) and no
  `readFileSync` concatenation of ~70 webview files.
- [ ] **5.4 Split files > 400 lines** (19 at v0.199; largest `emulator/panel-webview.js` 4115,
  `menu-view.js` 1925, `extension.js` 1627, `bottom-bar-views.js` 1422, `sprites-view.js` 1409,
  `emulator/panel.js` 1130). The split lines are in the old audit §7.
- [ ] **5.5 TS everywhere (D9)** with `@types/vscode` and `strict`; typed host↔webview message
  unions per panel. Measured at v0.199: 4 360 strict errors over the JS.
- [ ] **5.6 WASM scouting (D12):** profile and list candidates with numbers — room decompression
  and encoding (`maps/lzss.ts`, `chr.ts`), the collision/special solver, CDL library analysis and
  xrefs, the script VM if it runs simulations at scale. Output: a table in this file, no code.

### Step 6 — Docs and knowledge (D8, D11, D13)
- [x] **6.1** `tools/check-knowledge.mts` + `npm run check:knowledge` (2026-10-16: 580 addresses in code,
  12.4 % documented; CDL: 11/420 called routines, 4.7 % of touched WRAM bytes; the 508 known gaps are
  in `tools/check-knowledge.baseline.json`, which only shrinks): scan `src/`, `tools/`, docs
  for `$7E…`/`$7F…` and `$XX:XXXX` addresses and the CDL library for routines; report the ones
  without an entry and the coverage %. Wire into the release ritual (new uncovered = block).
- [ ] **6.2** Migrate `functions.js`, `tables.js` and the RAM side of `tags.json` into knowledge
  entries; generate the RAM/ROM map overviews from the entries; drop the runtime wiki overlay
  (`rom/model/wiki-overlay.js`) and the RAM bounds hard-coded in `extension.js`.
- [ ] **6.3** Names and comments for recomp: entries feed the Asar export labels and the recomp's
  C names (`tools/recomp/names.js`).
- [ ] **6.4** Delete or merge stale docs: `STATE_FLOW.md`, `docs/architecture/{domain-overview,
  migration-plan,target-architecture}.md`, `docs/roadmap-and-vision.md` (empty),
  `emulator-status-and-roadmap.md`, `future-features.md`, revert notes, `docs/features/`,
  finished dossiers. Docs layout mirrors the code: `docs/platform/`, `docs/games/<game>/`,
  `docs/plans/`, `docs/todo/`.
- [ ] **6.5** README per domain and for `tools/`, `tests/`; file names without spaces; no doc
  links a missing path (add a link check to `check:ai-context`).
- [ ] **6.6** Tests tiered (`unit` / `rom` / `dom` / `emulator` / `slow`), `npm test` < 10 s without
  Emscripten, ROM tests skip when the library has no base ROM (old audit §17).

### Step 7 — AI files last (D10)
- [x] **7.1** `tools/check-ai-context.mts` + `npm run check:ai-context` (limits of D10, broken links; the 42
  known overruns are in `tools/check-ai-context.allow.json`, which step 7 empties).
- [ ] **7.2** Root `AGENTS.md` to ≤ 150 lines; `AI_ARCHITECTURE_GUIDE.md` updated to the
  `platform/core/games` kinds; no rule in two places.
- [ ] **7.3 Skills:** merge the five architecture skills (`compress-architecture`,
  `isolate-subsystem`, `split-orchestration`, `stabilize-state-flow`, `code-quality`) into one;
  `map-format` + `rom-map-data`; `wram-memory-mapping` + `snes-memory-mapping`; `grammar-rules` +
  `colour-theme`; `animation-script` + `sprites-subsystem`. Split `map-editor-rules` (444 lines),
  `memory-radar` (282), `webview-dom-safety` (257), `rom-map-data` (242). New skills for what has
  none: the game descriptor / adding a game, the ROM library and resolver.
- [ ] **7.4 Personas:** drop `architecture-compressor` (covered by the merged skill); trim the rest.
  (`script-parser-generator` is gone with its package.)

---

## 4. Known future problem: git history

Kept by D2. `npm run check:legal -- --history` writes the full list of commits to
[legal-history.md](legal-history.md) (2026-10-16: 366 of 565 commits, nearly all for mentions of the
upstream projects; real data: `docs/payload-byte-plots.md` hex dump, the vendored EmulatorJS
`emulator/vendor/`, old core with an embedded base64 wasm, `script_parser/generated/opcode-corpus.json`,
a tracked `.pyc`). Known from the old audit §28:
- Early versions of `docs/payload-byte-plots.md`, `docs/payload-deep-analysis.md`,
  `docs/map-loading.md`: full hex dumps of room payloads.
- `tests/debugger/parity/snapshots/`, `tests/parity/snapshots/`, `tests/corpus/script-all-corpus.js`:
  upstream dumper output.
- Every version of `script_parser/generated/` and `script_parser/tests/generated/`.
- `emulator/vendor/` (vendored EmulatorJS, GPLv3), `emulator/core/` (old snes9x build).
- Every commit of the ported files in §3 step 2.

The way out when it becomes a problem: `git filter-repo --invert-paths` over those paths plus a
message rewrite, then force-push; old clones and forks keep the old history.

---

## 5. Not part of the cleanup (roadmap)

Carried from the old audit; they live in `docs/todo/`: emulator performance (visibility gating,
AudioWorklet pacing, `SND_SEND` arming, core flags), PAL timing (multi-game.md §6), unified
webview theming on `--vscode-*`, live diagnostics and `soe://` in hovers, porting the everscript
compiler front end to TS (an alternative, deferred 2026-10-16: keep the Python compiler and move this repo into `everscript`, [merge-into-everscript.md](todo/merge-into-everscript.md)).
