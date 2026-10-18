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
| Attribution in docs/comments | `src/README.md:17`, `src/games/evermore/script/README.md`, `src/games/evermore/maps/README.md:82`, `src/games/evermore/sprites/README.md:7`, `src/games/evermore/sprites/animation-decoder.js:113`, `src/games/evermore/docs-tab/render-docs-tab.js:136` (user-visible), the "OBJ n" comments in `rom-overlay.js:35`, `overlay-features.ts:48`, `collision-overlay.ts:185`, `docs/script-format/*`, `docs/room-simulation.md:107`, `.agents/agents/script-parser-generator.md:128` | rewritten with the code they describe |

- [x] **2.1** Sprites + character record (plan part B). v0.283.0: `maps/sprites.ts`, `maps/character-record.ts` and
  `sprites/character-model.js` rewritten from the game's code: the sprite renderer `$80:9033` (record, 5-byte chunks,
  culling box), the block loaders `$80:9742` / `$80:A4FC` (tables, banks, mask-per-group compression) and the NMI
  upload (tile order); the spawn `$8F:B094`, the animation choice `$90:8240`-`$90:8317` and start `$90:8124`, the
  palette loader `$90:CF3A`, the overlap test `$8F:B4AB`, the weapon and Dog form loaders `$8F:81C9` / `$8F:9471`
  (knowledge `rom/8eb678.md` and the entries it links). The sprite list is now what the animation scripts name
  (4,903 that draw), not a walk of the banks; block pixels agree with the old reader on all 8,000 checked, chunks on
  every shared sprite. Colours now use the full 8-bit range like the map palettes. Left: the emulator webview's own
  copy of the sprite readers (`overlays-view.js`, 5.1/5.3).
- [ ] **2.2** Script VM phases 1–5 of the plan, with the compiler-spelled output. v0.280.0: phases 1–3 —
  `docs/game-research/script-vm/` (the interpreter, packed pointers, expressions, the tables that name
  scripts, one row per opcode; a knowledge entry per handler), `src/games/evermore/script-vm/` (strict TS,
  from that spec), `tools/script-vm/record-goldens.js` → `tests/script-vm/goldens.json` (2,130
  instructions the game ran in the intro and 32 recorded sessions, addresses only). A walk from every
  table reaches 64,839 instructions, none the game cannot run, all 2,130 among them; sizes agree with the
  legacy decoder on every one (compared once, not kept as a test). v0.281.0: `facts.ts` (writes, flags, calls, map
  changes, sound, music, text, spawns, sleeps) and `print.ts` (one line per instruction in the compiler's notation,
  `code(...)` with it as a comment for the exact form); 25 more opcodes named from their handlers; every handler's
  knowledge entry lists the addresses it uses, and `soe://rom/assets/scripts/opcodes/` serves one page per opcode.
  v0.282.0: the consumers moved (2.4); phases done.
- [ ] **2.3** Room names in the new style, each with evidence.
- [ ] **2.4** Delete every row's old files; `check:legal` clean. v0.282.0, the script decoder row: `script-model/`
  (room listings in the compiler's notation, loot and doors read per path, spawns, arrivals, the kept names) on
  script-vm; every consumer moved (Rooms tab, `soe://` scripts, sound sources, palettes, export checks, trace, the
  simulation through `simulation/decoder.ts`, tools); `src/games/evermore/script/` and the upstream-output tests
  (`script-parity`, `script-loot`, `script-units`) deleted. Loot differs from the legacy reading where it was wrong
  (Ebon Keep's branched pickups, `$98:CCCC`) and finds 42 more pickups. Left: the other rows (sprites, character
  record, attribution in docs and comments, `map-parity.test.js` upstream parts), `docs/script-format/*`.

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
  unreferenced `src/core/emulator/webview/index.html`, the Route mock tab (`src/routes/`, its HTML, CSS
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
- [ ] **5.3 esbuild:** (v0.266.0: the game's part of the emulator page comes in through `game.webview()`; the
  bottom bar (ENTITIES / ALCHEMY / PALETTES, cheats) moved to `games/evermore/emulator/`, so the recorder no longer
  ships it; v0.267.0: pause-menu tabs 1-4 → `games/evermore/emulator/menu-tabs.js` (menu-view.js 2479 → 1581
  lines); v0.268.0: the screen layer (extended map, overlays, entity sprites, inspector, the per-frame RAM sample,
  overlay toggles and chips) → `games/evermore/emulator/overlays-view.js`, the trigger helpers → `room-triggers.js`
  (`panel-webview.js` 5342 → 2867 lines); v0.269.0: the script VM (STACK, TRACE, the script debugger's page side,
  who sent each sound) → `stack-view.js`, `script-debug-view.js`, `sound-source-view.js` (`panel-webview.js` → 2101); VIEW's room line → `gameLensInfo()`. v0.270.0: the Evermore detector (`rom-game.js`) → a game page file
  (`webviewFiles()`), the music package byte → `gameMusicPackage`, the camera entity → `gameCameraWorld`, the
  launcher names no game; the emulator holds no Evermore facts (the gate's name `emuEvermore` / `data-needs="evermore"`
  stays until v0.276.0: `emuGameRom` / `data-needs="game"`, the detector hook `gameDetectRom`, the ALCHEMY icons through `game.romData()` → `gameRomData`). v0.271.0: `src/emulator` → `src/core/emulator` (cores and submodules too). v0.272.0: esbuild
  host bundle (`tools/bundle.mts` → `bundle/extension.js`, the `main`; 361 modules; `__dirname` rewritten per
  module, `tests/memory/bundle.test.js` activates it). v0.274.0: the package leaves out the 243 JS files the bundle holds
  (`bundle/.vscodeignore`; `tests/memory/package-files.test.js` records the files every page and table reads from
  disk and fails if one is left out): 785 → ~540 files. v0.275.0: no repo tooling, configs, submodule folders or folder READMEs ship (the test holds the package root to an allowlist): 480 files. Next: the webview bundles. First part done in v0.231.0: one TypeScript build, `tsconfig.build.json` →
  `dist/` mirroring `src/`, `npm run build:ts`; the five per-domain builds are gone) one host bundle and one bundle per webview from real `.ts`/`.css`/`.html`;
  no code in template literals (~9.5 k lines at v0.199: `emulator/panel-webview.js`,
  `menu/menu-view.js`, `bottom-bar-views.js`, the emulator `*-view.js` files) and no
  `readFileSync` concatenation of ~70 webview files.
- [ ] **5.4 Split files > 400 lines** (v0.249.0: `src/extension.js` 1791 → the 25-line composition root +
  `games/evermore/extension.js` 1250; the map editor's and Characters tab's messages → `rooms/editor-host.js`,
  `sprites/radar-host.js`, unit-tested in `tests/memory/radar-hosts.test.js`; v0.250.0: scope analysis → `memory/scope-analysis.js`, Build and Run → `language/build-and-run.js`,
  Export Room Maps → `rooms/export-maps.js`: `games/evermore/extension.js` 1250 → 776) (19 at v0.199; largest `emulator/panel-webview.js` 4115,
  `menu-view.js` 1925, `extension.js` 1627, `bottom-bar-views.js` 1422, `sprites-view.js` 1409,
  `emulator/panel.js` 1130). The split lines are in the old audit §7.
- [ ] **5.5 TS everywhere (D9)** with `@types/vscode` and `strict`; typed host↔webview message
  unions per panel. Measured at v0.199: 4 360 strict errors over the JS.
- [x] **5.6 WASM scouting (D12):** profile and list candidates with numbers — room decompression
  and encoding (`maps/lzss.ts`, `chr.ts`), the collision/special solver, CDL library analysis and
  xrefs, the script VM if it runs simulations at scale. Output: a table in this file, no code.
  Measured v0.277.0 (2026-10-18), Node 26, Apple M4, the user's US ROMs, `node --cpu-prof`:

  | Work | Time | Where the time goes | Verdict |
  |---|---|---|---|
  | Evermore `decodeRoom`, 127 rooms (LZSS, Markov, CHR) | 42 ms | spread | no |
  | `decompressTile16x16` ×4096 | 6 ms | — | no |
  | `modelFromRom` + `buildBlob`, all rooms; `lzssCompress` 16 KB | 3 ms; 2–3 ms | — | no |
  | Evermore `renderRoomComposite`, all rooms (100 Mpx per layer) | 1.03 s (~8 ms a room) | `compositeLayers` 47 %, `renderVramLayer` 37 % (2.2 ns/px) | no: 32-bit pixel writes alone 2.2 → 1.6 ns/px, same bytes |
  | Mana `renderMap`, 408 maps (304 Mpx) | 4.7 s (median 6 ms, max 72 ms) | `pick` / `rgb` allocate 2 objects + 2 arrays per pixel (15 ns/px) | no: JS without per-pixel allocation |
  | Mana `loadMap` ×512, `mapCatalog` | 53 ms, 25 ms | — | no |
  | CDL: open the library, `buildIndex`, the whole asar export | 91 ms, 57 ms, 0.73 s | string building, spread | no |
  | Script simulation `sim.room()`, 127 rooms | 278 s (0x25: 5 s, 0x5a: 48 s) | see below | **no, algorithm** |

  The simulation is the only slow path, and both hot spots are algorithmic. `Clock.longest`
  (`simulation/time.ts`) runs Bellman–Ford over string-keyed edges, splitting `"a>b"` for every edge on every pass,
  and `project` calls it for every pair of points (80 % of room 0x25). Swapping in a cached
  all-pairs table (Floyd–Warshall, reset on `add`) gives identical `room()` output for 0x0a, 0x25, 0x35 and 0x5a and
  takes 0x25 from 5.0 s to 0.52 s. The slow rooms then spend 55 % in `mergeGroup`'s `shared` (`turn.ts`):
  each merge looks at every pair of paths for the longest shared history (cubic in the group size)
  and recurses when a pair will not rejoin; a trie of the shared step arrays finds the pair directly.
  WASM would buy a constant factor on top of these; nothing here needs it. Follow-ups: 5.7.
- [ ] **5.7 The simulation's hot spots (from 5.6):** v0.278.0: `Clock` answers from one all-pairs
  longest-path table, built on the first question after a change and shared by clones (a positive cycle
  falls back to the bounded search; `tests/simulation/sim-units.test.js` checks it against one search per
  question on random graphs); `mergeGroup` keeps each path's best partner and memoizes shared lengths
  instead of trying every pair on every merge (group sizes up to 737 in room 0x5a). `room()` output is
  byte-identical for all 127 rooms (sha1 of the JSON, before and after); all rooms 308 → 221 s, 0x25 5.0 →
  0.5 s, 0x5a 44 → 20 s, 0x35 31 → 12 s. v0.279.0: `PathState.clone` spent 83 % of its time copying
  `conds` and `known` (0x5a, timed per field): `conds` (rendering → condition, grow-only) is now one map for
  a path and its clones, `known` is shared until a clone writes; still byte-identical, all rooms → 201 s,
  0x5a → 16 s. Left: no single hot spot; the slowest rooms (0x48 20 s, 0x0a 20 s) spend ~30 % in GC and the
  rest across stepping, the scheduler and symbolic keys (`sym.ts` `memo` / `key`) over many paths: fewer
  paths (earlier merging) is what would move them, not faster code.

### Step 6 — Docs and knowledge (D8, D11, D13)
- [x] **6.1** `tools/check-knowledge.mts` + `npm run check:knowledge` (2026-10-16: 580 addresses in code,
  12.4 % documented; CDL: 11/420 called routines, 4.7 % of touched WRAM bytes; the 508 known gaps are
  in `tools/check-knowledge.baseline.json`, which only shrinks): scan `src/`, `tools/`, docs
  for `$7E…`/`$7F…` and `$XX:XXXX` addresses and the CDL library for routines; report the ones
  without an entry and the coverage %. Wire into the release ritual (new uncovered = block).
- [x] **6.2** (v0.262.0: 130 entries generated from `functions.js` / `tables.js` / the table sizes, which are now views of
  the entries (`localizations/knowledge.js`); the boy/dog stats blocks and record fields from `tags.json` are entries;
  the radar's temp/session bounds are `compiler-region` entries; `soe://localization/knowledge/{ram,rom}/index.md`
  is the generated RAM/ROM map; the ROM tab's wiki overlay is gone; knowledge coverage 12.4 % → 27.7 % of code
  addresses, CDL routines 11 → 49) Migrate `functions.js`, `tables.js` and the RAM side of `tags.json` into knowledge
  entries; generate the RAM/ROM map overviews from the entries; drop the runtime wiki overlay
  (`rom/model/wiki-overlay.js`) and the RAM bounds hard-coded in `extension.js`.
- [ ] **6.3** Names and comments for recomp: entries feed the Asar export labels and the recomp's
  C names (`tools/recomp/names.js`).
- [x] **6.4** (v0.263.0: revert notes, the emulator integration logs and plans (`emulator-integration`, `web-emulator-plan`,
  `snes9x_integration`, `embedded-emulator-panel-concept`), finished dossiers (`room-script-parser`,
  `rooms-settings-cleanup-dossier`), `compiler-bundling`, `future-features` (its open ideas → `docs/todo/`), the
  `sprite-rendering` stub, `ingredient-icons` (its facts → `item-icons.md`) and the two pre-build map editor design
  docs deleted; `docs/features/` was never tracked. The docs layout mirroring the code (`docs/games/<game>/`) moves
  to 5.x with the rest of the moves. v0.255.0: `STATE_FLOW.md` → its map-editor rows in `games/evermore/rooms/webview/STATE.md`, the rest
  deleted; `docs/architecture/{domain-overview,migration-plan,target-architecture,dependency-rules}.md` and
  `docs/emulator-status-and-roadmap.md` deleted) Delete or merge stale docs: `STATE_FLOW.md`, `docs/architecture/{domain-overview,
  migration-plan,target-architecture}.md`, `docs/roadmap-and-vision.md` (empty),
  `emulator-status-and-roadmap.md`, `future-features.md`, revert notes, `docs/features/`,
  finished dossiers. Docs layout mirrors the code: `docs/platform/`, `docs/games/<game>/`,
  `docs/plans/`, `docs/todo/`.
- [x] **6.5** (v0.261.0: READMEs for `platform/`, `core/`, `games/`, `games/evermore/`, `games/mana/`, `tools/`, `tests/`; AGENTS.md
  for `games/evermore/` and `games/mana/`; no file name with a space; `check:ai-context` checks every relative link
  in every tracked Markdown file, 26 broken ones fixed; `tools/generate-script-names.js` (read SoEScriptDumper's
  `data.h`) deleted, its names frozen per D4) README per domain and for `tools/`, `tests/`; file names without spaces; no doc
  links a missing path (add a link check to `check:ai-context`).
- [x] **6.6** (v0.260.0: `tests/tiers.json` + `tools/test.mts`; `npm test` = grammar + unit in ~7 s, was ~4 min with
  core builds; `test:rom` / `test:dom` / `test:emulator` / `test:all`; four forgotten tests back in a tier;
  the two slowest unit tests 24.6 s → 1.8 s and 4.9 s → 1.9 s by fixing the code they test) Tests tiered (`unit` / `rom` / `dom` / `emulator` / `slow`), `npm test` < 10 s without
  Emscripten, ROM tests skip when the library has no base ROM (old audit §17).

### Step 7 — AI files last (D10)
- [x] **7.1** `tools/check-ai-context.mts` + `npm run check:ai-context` (limits of D10, broken links; the 42
  known overruns are in `tools/check-ai-context.allow.json`, which step 7 empties).
- [x] **7.2** (v0.254.0–v0.255.0: 85 lines; guide §2 rewritten) Root `AGENTS.md` to ≤ 150 lines; `AI_ARCHITECTURE_GUIDE.md` updated to the
  `platform/core/games` kinds; no rule in two places.
- [x] **7.3 Skills:** (v0.251.0: the five architecture skills are one, `architecture`; v0.252.0: `map-format` absorbs `rom-map-data`,
  `memory-map` replaces `snes-memory-mapping` + `wram-memory-mapping`, `grammar-rules` absorbs `colour-theme`,
  `animation-script` absorbs `sprites-subsystem`; v0.257.0: new `games-and-roms` skill for adding a game, the
  ROM library and identification; v0.258.0: `map-editor-rules` 444 → 194 (detail in `docs/map-format/map-editor-reference.md`),
  `memory-radar` split off `rooms-tab`, `webview-dom-safety` 257 → 195; `check:ai-context` allow list empty) merge the five architecture skills (`compress-architecture`,
  `isolate-subsystem`, `split-orchestration`, `stabilize-state-flow`, `code-quality`) into one;
  `map-format` + `rom-map-data`; `wram-memory-mapping` + `snes-memory-mapping`; `grammar-rules` +
  `colour-theme`; `animation-script` + `sprites-subsystem`. Split `map-editor-rules` (444 lines),
  `memory-radar` (282), `webview-dom-safety` (257), `rom-map-data` (242). New skills for what has
  none: the game descriptor / adding a game, the ROM library and resolver.
- [x] **7.4 Personas:** (v0.251.0: `architecture-compressor` dropped; v0.259.0: `everscript-plugin-builder` 335 → 43
  lines, `mechanics-modeler` 260 → 43, pointing at the guide and skills instead of restating them) drop `architecture-compressor` (covered by the merged skill); trim the rest.
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
