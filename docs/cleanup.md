# Repo cleanup

Decided 2026-10-16 in a design interview with the owner; **concluded 2026-10-19 at v0.314.2.** This file is the
record: the decisions (§2), which are still the rules, and what each work item ended as (§3). The step-by-step logs
are in git: `git log -- docs/cleanup.md`, and the full plan as it last stood is `git show 3b4437f:docs/cleanup.md`.
The game-neutral architecture it built is [architecture/multi-game.md](architecture/multi-game.md). The work that is
left is ordinary backlog in [todo/](todo/README.md): the JS still to port and the per-page webview bundles
([todo/port-to-ts.md](todo/port-to-ts.md), which owns 5.1, 5.3 and 5.5 now), the address backlog (§1) and the
variant consumers ([todo/variant-vfs-and-consumers.md](todo/variant-vfs-and-consumers.md)).

---

## 1. Goals and how they ended

Every check below passes and blocks in the release ritual (measured at v0.314.2).

| Goal | Check | End state |
|---|---|---|
| No licence violations in the tree | `check:legal` on `git ls-files` | met: 0 findings, baseline empty |
| Nothing ported from SoETilesViewer / SoEScriptDumper | `check:legal` (no file declares a port, reads upstream output or points into a checkout) | met; names are the one exception (D3, D4) |
| No dead code, lean tools | `check:dead` (knip), `check:circular` | met for files; unused exports are reported as warnings (157, mostly exports used only in their own file, which compiled CommonJS writes as `exports.x`) |
| No code duplication | `check:dup` (jscpd, 30+ lines) | met: 0 clones; shorter page-side copies go with the page bundles (5.1) |
| TypeScript wherever it makes sense | every `.js` outside D9's exceptions carries `// TODO port to TS` | 222 host modules strict TS; left: 9 host modules, 173 page scripts, 42 in `tools/` + `scripts/`, 77 tests → [todo/port-to-ts.md](todo/port-to-ts.md) |
| Every address and name documented | `check:knowledge` (new gaps block; the baseline only shrinks) | 40.7 % of code addresses (from 12.4 %; 315 left), 220/420 CDL routines (from 11), 5.9 % of touched WRAM bytes; the `re-curator` agent works the backlog |
| Docs current, no stale docs | `check:ai-context` link check; D13 | met |
| Skills for everything, AI context slim | `check:ai-context` (D10) | met: allow list empty |
| Any game, not just Evermore | `check:deps` (multi-game.md §2) | met: `platform/` + `core/` + `games/<game>/` + `recorder/` |

---

## 2. Decisions

- **D1 — This file was the plan.** One work item per finding, each with its check; now the record.
- **D2 — Git history is kept for now.** The repo is on GitHub (`r-bin/everscript-vscode`).
  Commits that added problem content are listed in §4 as a known future problem; no history
  rewrite is part of this cleanup.
- **D3 — The re-do (clean room).** Everything ported from SoETilesViewer / SoEScriptDumper is
  re-implemented from the game: the script decoder, `sprites.ts`, the character record readers.
  1. Write what the part does as a black-box spec in our own words (inputs, outputs, users).
  2. Delete the ported code and data.
  3. Rebuild from game evidence (ROM, CDL, headless runs, `soe://`) against that spec, with tests.
  A rebuilt part is checked against the game only — never against the old ported output.
  Whoever rebuilds a part has not read the upstream source, nor the old ported code it replaces (comparing
  test *outputs*, such as lengths and stop points, is allowed); goldens hold observed facts, never ROM bytes.
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

## 3. What each work item ended as

### Step 1 — Legal check and the rules agents read
- [x] **1.1** `tools/check-legal.mts`, `npm run check:legal` (tree; `--staged` in the release ritual; `--history` writes
  [legal-history.md](legal-history.md); `--baseline`, which only shrinks and is empty). Fails on ROM/save/patch/audio/image
  files and magic bytes, `data:` URIs and long base64, number runs and hex dumps, ROM file names and home paths, and
  mentions of the upstream projects outside the policy files.
- [x] **1.2** One rule on names (D4) in `AGENTS.md` and `AI_ARCHITECTURE_GUIDE.md` §3.8.
- [x] **1.3** MIT covers our code only; the snes9x2005 core and the SPC engine keep their own licence files.
- [x] **1.4** `.vscodeignore` / `.gitignore` keep ROMs, saves, docs, tools and caches out of the package and the tree.
- [x] **1.5** ROM byte excerpts trimmed from the docs.

### Step 2 — The re-do (D3, D4), done v0.280.0–v0.285.0
- [x] **2.1** Sprites and character records rebuilt from the game's renderer, loaders and spawn code (`maps/sprites.ts`,
  `maps/character-record.ts`, knowledge `rom/8eb678.md` and what it links).
- [x] **2.2** The script VM (`src/games/evermore/script-vm/`, spec in `docs/scripts/`) from the
  interpreter at `$8C:D0A6`, checked against goldens the running game produced; printed in the compiler's notation.
- [x] **2.3** Room names in our style with evidence per part (`localizations/data/rooms.json`).
- [x] **2.4** Every ported file, test and data set deleted; `check:legal` clean with an empty baseline.

### Step 3 — Dead code and tools (D7), done
- [x] **3.1–3.3** Superseded, one-off, broken and unreferenced tools deleted (`script_parser/`, the sandboxes, the Python).
- [x] **3.4** Loose design notes moved to `docs/plans/` and `docs/todo/`.
- [x] **3.5** Dead handlers, pages, the Route mock tab and `everscript.patchesPath` removed.
- [x] **3.6** knip and madge blocking, without blanket ignores (the `webview/**` ignore goes with the page bundles).
- [x] **3.7** `npm run package` uses `vsce` from `PATH`.

### Step 4 — Multi-game restructure (D5, D6), done v0.271.0–v0.303.0
- [x] ROM library and resolver, game descriptors, layer rules in `check:deps`, the derived-ROM marker, ROM panel and status
  bar; `$SOE_ROM` / `romPath` gone. Status and what it leaves open on purpose: multi-game.md §7. Two variants side by side
  is a feature in [todo/variant-vfs-and-consumers.md](todo/variant-vfs-and-consumers.md).

### Step 5 — Duplication, big files, TypeScript
- [x] **5.1 Short copies, one owner each.** `platform/snes/hirom.ts` (bus→file, read16/24; every `& 0x3FFFFF` in TS host
  code), `platform/crc32.ts`, `platform/png.ts`, `platform/hex.ts`, `platform/snes/tiles.ts` (4bpp, BGR555),
  `platform/snes/opcodes-65816.ts`, `core/webview/html.ts` (`escapeHtml`); the emulator page uses the host's sprite,
  character-record and room-trigger readers through the `EvsRom` bundle. v0.314.2: the room table had five readers of
  its own that took the US offset `0x1FFDE7` for every ROM, so on the five PAL builds the emulator's trigger boxes,
  its address lookup, the room header, the CDL regions and the ROM tab read no room at all; they now go through
  `maps/rom.ts` `mapTableOffset` / `roomBlobOffset`, and script ids through the ROM's own script bank
  (`$93:8000` on PAL). Handed to [todo/port-to-ts.md](todo/port-to-ts.md): the copies left in page scripts and `tools/`
  JS (HTML escape, hex, the bus mask), which go with their port.
- [x] **5.2** `check:dup` blocking; the one 30+ line clone (alchemy math ×3) is one file.
- [x] **5.3 One build.** One TS build (`tsconfig.build.json` → `dist/`), the esbuild host bundle (`bundle/extension.js`, the
  `main`), a package of ~480 files instead of 785, and no page code in template literals: every page script, style
  sheet and HTML part is a real file (`page-file.ts`), and page code the host shares is a TS module bundled per page
  (`tools/bundle-pages.mts`). Handed to [todo/port-to-ts.md](todo/port-to-ts.md): one esbuild bundle per page from
  real `.ts`, which ends the `readFileSync` splicing and the knip webview ignore.
- [x] **5.4** No file in `src/` or `tools/` over 400 lines, CSS included (v0.302.0).
- [x] **5.5 TypeScript (D9).** `@types/vscode`, `strict` for every TS file; 222 host modules ported (v0.303.0–v0.313.0),
  the types found 10 real bugs on the way. Every JS file left is marked; the list, the order and the way to port is
  [todo/port-to-ts.md](todo/port-to-ts.md).
- [x] **5.6 WASM scouting (D12).** Measured v0.277.0 (Node 26, Apple M4): room decoding (127 rooms, 42 ms), rendering
  (~8 ms a room), Mana maps, CDL analysis and the asar export are all fast enough in JS; the one slow path was the
  script simulation, and that was algorithmic. No WASM needed now.
- [x] **5.7** The simulation's hot spots fixed (all-pairs longest-path table, memoized merges, shared path state):
  all rooms 308 → 201 s, byte-identical output; fewer paths is the next lever
  ([todo/research-and-visualizations.md](todo/research-and-visualizations.md) §3).

### Step 6 — Docs and knowledge (D8, D11, D13), done
- [x] **6.1** `check:knowledge`, wired into the release ritual (new gaps block; `tools/check-knowledge.baseline.json` only shrinks).
- [x] **6.2** `functions.js`, `tables.js` and the RAM side of `tags.json` are knowledge entries; the RAM/ROM map is
  generated from them (`soe://localization/knowledge/`).
- [x] **6.3** Entries name the Asar export's labels and the recomp's C functions (`tools/recomp/names.js`).
- [x] **6.4** Stale docs, finished plans and dossiers deleted (v0.255.0, v0.263.0; the script-decoder plan in v0.314.2,
  its rules are D3).
- [x] **6.5** README per domain and for `tools/`, `tests/`; no file name with a space; every relative Markdown link checked.
- [x] **6.6** Test tiers (`tests/tiers.json`, `tools/test.mts`): `npm test` ~7–10 s; `rom`, `dom`, `emulator`, `all` on demand.

### Step 7 — AI files (D10), done
- [x] **7.1** `check:ai-context` (limits of D10, broken links); allow list empty.
- [x] **7.2** Root `AGENTS.md` ≤ 150 lines, the guide on the `platform/core/games` kinds.
- [x] **7.3** Skills merged and split to their limits; new `games-and-roms`.
- [x] **7.4** Personas trimmed to pointers.

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
