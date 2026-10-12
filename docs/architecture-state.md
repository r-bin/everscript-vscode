# Architectural State — v0.199.0 (2026-10-11, follow-up §16–§24 at v0.200.0)

A snapshot audit of the extension: what is healthy, what is drifting, and what to do next.
Produced by six parallel read-only audits (duplication/coupling, VFS/languages, dead code/size,
docs/AI files, emulator performance/bundle, UI/UX/features/tests); headline claims were spot-checked.
Line numbers are as of this version and will drift.

---

## 0. TL;DR — top 12 actions, ranked by value / effort

| # | Action | Why | Effort |
|---|---|---|---|
| 1 | Add `.emscripten_cache/**`, `docs/**`, `wiki/**`, `.agents/**`, `tools/**`, `**/*.d.ts`, `src/script/*.ts`, root md files, ROM globs to `.vscodeignore` | VSIX is **37.4 MB uncompressed, ~30 MB of it is the emscripten cache** (verified: 33 MB dir, only in `.gitignore`). Target ≈ 6 MB | 10 min |
| 2 | Drop `onStartupFinished` from `activationEvents` | Extension activates in *every* workspace and loads 141 modules + a 357 KB JSON synchronously | 5 min |
| 3 | Gate per-frame emulator work on visibility (`samplePreLoopState`, overlay redraws, script trace round-trip, bottom-tab refresh) and arm the `SND_SEND` breakpoint only when needed | Biggest cheap emulator win; `sndShow = true` by default forces the per-instruction breakpoint check for the whole session | ½ day |
| 4 | AudioWorklet + ring buffer, frames paced from audio (or fixed-step accumulator) | Fixes crackle, judder on 75/144 Hz, slowdown on 50 Hz. `createScriptProcessor` is deprecated | 1–2 days |
| 5 | Extract `shared/snes-addr` (bus→file, read16/24) and `shared/webview` runtime (`escH`, hex, tab strip, CSP shell) | ~11 bus→file variants, ~20 read16/24 helpers, 6 HTML escapers, 23 hex formatters | 1 day |
| 6 | Move the tab strip out of `rooms/`, make each radar tab optional (lazy/try-require) | Today deleting *any* radar tab (or rooms) kills the whole radar panel | 1–2 days |
| 7 | Add depcruise rules for the 11 unenforced cross-domain edges + a generic "no tab→tab" rule | `check:deps` passes only because the rules don't cover the violations | 1 h |
| 8 | Fix the AI-instruction layer: keep **only** `AGENTS.md` (§18), refresh or archive the stale architecture docs it sends agents to | Agents are actively steered toward pre-refactor paths | ½ day |
| 9 | Tier the tests (§17): `npm test` = grammar + unit (< 10 s), heavy tiers on demand; add CI | Tests currently need Emscripten; 3 files take > 15 min each; 4 files never run; no CI | ½ day |
| 10 | Introduce esbuild: one host bundle + one bundle per webview from real `.ts/.html/.css` | Enables splitting the 4 k-line template literals, typed webviews, smaller VSIX | 2–3 days |
| 11 | Unify webview theming on `--vscode-*` variables | Three colour systems; map editor + emulator ignore light/high-contrast themes | 1–2 days |
| 12 | Doc restructure: `docs/{architecture,extension,game-research,plans,workflows,archive}` | ~60 % of `docs/` is game research mixed with extension docs; 7+ roadmap/todo files | ½ day |

Local disk hygiene (not in git, not in the VSIX, but 960 MB): `out/` holds 55 old `.vsix` builds (510 MB), `tmp/` 449 MB.

---

## 1. Current shape

- **17 domains** under `src/`, 381 tracked files; ~61 k lines JS, ~11 k lines hand-written TS in `src/` (`maps` 8.6 k, `script` 2.6 k), plus `script_parser/` (34 k TS, ~33 k of it generated).
- **Host:** `src/extension.js` (1627 lines, target < 300) wires everything; loaded from source, no bundler.
- **UI hosting:** one "Radar" webview with 9 tabs (Memory, Rooms, Characters, Scaling, Route, Docs, RNG, ROM, Music) whose HTML/CSS/JS is concatenated as strings at open time (`memory/webview/index.js`, ~70 JS files); a separate Emulator panel (`emulator/panel-webview.js`, one 4115-line template literal); the `soe://` Check panel.
- **Data plane:** the read-only `soe://` VFS (`src/resources/`) + MCP server (`src/mcp/`, 332 lines, zero deps) — the cleanest part of the architecture.
- **Native:** snes9x2005 core and the SPC engine compiled to wasm.
- **Checks:** `check:circular` clean (but `.js` only — TS not scanned), `check:deps` clean (but rules incomplete, see §3), knip clean (but ignores most webview folders, so it says little).

---

## 2. Code duplication

Worst offenders, measured:

| What | Copies | Where (examples) |
|---|---|---|
| Sprite/palette decoder | 2 (~240 LOC) | `emulator/panel-webview.js:1881-2120` re-implements `maps/sprites.ts` + `maps/character-record.ts` (host already uses `../maps`) |
| Alchemy damage math | 3 (60–110 LOC each) | `scaling/webview/alchemy-math.js`, `docs/docs-tab.js:6-70`, `maps/alchemy-model.js` |
| Bus → file offset (LoROM/HiROM) | ~11 | `maps/rom.ts:16`, `script/addressing.ts:15`, `emulator/address-lookup.js:27`, `debugger/source-map.js:29`, `resources/rom-files.js:87` ≡ `resources/table-files.js:10` (byte-identical), `resources/asm-view.js:22`, `emulator/cdl/rom-map.js:26`, `emulator/cdl/asar-build.js:49`, … |
| read16 / read24 | ~20 | identical `r24` lambda ×6 in `resources/audio-files.js`, `music/model/rom-audio.js`, `rom/model/{audio,catalog,assets}.js` |
| HTML escape | 6 | `shared/radar-utils.js:28`, `rooms/webview/utils.js:4`, `rom/webview/rom-tab.js:21`, `emulator/trace-formatter.js:15`, … |
| Hex formatters | 23 | `fmtHex`, `hex`, `hex4` across 24 files |
| 65816 opcode table | 2 | `emulator/cdl/opcodes.js`, `shared/opcodes-65816.js` |
| Room-table pointer `0x1ffde7` | 3 | `maps/rom.ts`, `shared/rom-readers.js`, `emulator/panel-webview.js:34` (ad-hoc `parseRoomTriggers`) |
| `crc32` | 2 | `maps/png.ts:22`, `shared/zip.js:11` |
| BGR555 → RGB | 4+ | `panel-webview.js:2010/2043/2491`, `bottom-bar-views.js:1172`, `maps/palette.ts:37` |

CSS duplication is low (tabs namespace their tokens). The real CSS problem is inconsistency, not copies — see §11.

**Extract to:**
1. `shared/snes-addr.js` — `busToFile(bus, layout)`, `read8/16/24`, `readPtr24`; re-export from `maps/rom.ts` and `script/addressing.ts`.
2. `shared/snes-gfx` — BGR555, 2/4bpp tiles, sprite-block decompressor, built from the `maps/` TS and shipped as a webview bundle so the emulator copy can be deleted.
3. `shared/alchemy-math.js` — one UMD file for scaling, docs and `maps/alchemy-model`.
4. `shared/webview/` — `escH`, hex formatting, tab strip, nonce/CSP shell.
5. Merge the opcode tables; move `parseRoomTriggers` into `src/maps`.

> Note on the anti-abstraction law (`AI_ARCHITECTURE_GUIDE.md` §2.5): "prefer duplication over coupling" is for utilities used by **one** subsystem. Everything above is used by 3–11 subsystems and is pure, so extraction is consistent with the law.

---

## 3. Tab independence

**Goal:** removing tab B must not break tab A. **Today it does — badly.**

### Structural cause: one webview hosts every tab, wired eagerly
- `memory/render-radar.js:7-13` eagerly `require`s docs, rooms, sprites, rom, music and inlines scaling/routes HTML.
- `memory/webview/index.js` `readFileSync`s every tab's webview folder at module load.
- The **tab strip lives in Rooms** (`rooms/webview/tab-init.js`); Docs calls `escH` from `rooms/webview/utils.js`; Scaling reads the `ITEM_ICONS` global that comes from `rooms/data/item-icons`.
- All radar messages route through one if/else chain in `extension.js:677-830`.

### Blast radius if a domain is deleted
| Delete | Breaks |
|---|---|
| `rooms` | Entire radar panel (all 9 tabs), `extension.js` imports, soe:// map-objects; emulator ring icons degrade silently |
| `docs`, `sprites`, `rom`, `music`, `scaling`, `routes` | Entire radar panel (eager require / `readFileSync` throws) |
| `memory` | Every radar tab (it is their only host) |
| `language` | Sprites tab (reads `language/data/index.json`) |
| `emulator` | Only injected features degrade (debugger, live music, CDL, "test in emulator") — **this one is done right** |
| `mcp`, `debugger` | Only their registration — **done right** |
| `maps`, `script`, `localizations` | Many importers; these are library domains, not tabs — acceptable |

### Unenforced cross-domain edges (depcruise passes because no rule exists)
`memory→sprites`, `memory→music`, `emulator→rooms` (item-icons), `emulator→maps`, `emulator→script`, `emulator→localizations`, `resources→music` (**a webview module**: `audio-files.js:10` requires `music/webview/music-view`), `resources→rooms`, `resources→sprites`, `rom→localizations`, `sprites→language`.

### Fix
1. **Tab contract.** Each tab exports `{ id, label, html(), css[], js[], onMessage }`; the radar shell is given a plain array of tabs (`try { require(...) }` per tab in `extension.js`, skipping missing ones). This is a list, not a registry framework — but it does brush against §2.5's "no registries" rule; **amend the guide** to allow exactly this.
2. Move the tab strip + `escH` to `shared/webview/`; move `item-icons` decode to `maps/`; move `muOwners`/pure music functions to `music/model/`; move `known-scripts.json` to `localizations/`.
3. Give Rooms, ROM, Music, Characters their own open commands (today the radar only opens from an `.evs` editor — "No active Everscript file.").
4. Add the missing depcruise rules plus a generic rule: `memory|rooms|sprites|music|rom|scaling|docs|routes` must not import each other. Extend `check:circular` to `.ts`; make `no-script-to-src`/`no-sandbox-to-src` actually scan those folders.
5. Long term: let tabs fetch their data from `soe://` (§4) — then a tab depends on the VFS, not on sibling domains.

---

## 4. The soe:// VFS — what else can go there, how to make it better

**What's good:** read-only provider (`resources/fs-provider.js`, 312 lines) with clean per-authority handlers (`rom`, `ram`, `bus`, `localization`, `tags`), auto `index.md`, mountable as a workspace folder, ROM selection by query, MCP exposes exactly the same tree. Emulator access is injected, never imported.

### Data that lives only in tabs / host today → candidates
| Data | Today | Proposed path |
|---|---|---|
| ROM bank map, ownership | `src/rom/build.js`, sent by message | `soe://rom/map/banks.json`, `owners/<off>.json` |
| CDL coverage, xrefs, functions, asar export | `src/emulator/cdl/*` | `soe://cdl/coverage.bin`, `functions/<addr>.md`, `xrefs/<addr>.json`, `export.asm` |
| Room triggers | ad hoc in `panel-webview.js:34` | `maps/<id>/triggers.json` |
| Hitboxes, projectiles, dog forms | `src/sprites/*` (partly mirrored) | `characters/<id>/hitbox.json`, `projectiles/` |
| Music sequences/tracks | `music/model/*` (parallel to `audio-files.js`) | unify under `assets/audio/` |
| Scaling/damage curves | webview-only `damage-math.js` | `assets/tables/scaling/<enemy>.json` |
| Emulator state | nothing but `live.png` | `soe://emu/screen.png`, `state.bin`, `vram.bin`, `cgram.json`, `oam.json` |
| Function signatures/enums | `language/data/index.json` (16 k lines) | `soe://script/functions/` (generated) |
| Known scripts | `emulator/known-scripts.json` | `soe://rom/scripts/` |
| User custom rooms | `rooms/data/custom-store.js` | `soe://custom/rooms/` |

### Making it better
1. **Tabs consume the VFS** as their single data source (`workspace.fs.readFile` host-side, `fetch` via `soeClientScript` in webviews). Start with ROM and Music tabs. Payoff: decoupled tabs, AI sees exactly what users see, one cache.
2. **Writes, in layers:** first `soe://ram/<addr>.json` → poke memory (debugger + AI agents); then asset JSON edits → a **patch overlay** (IPS/asar snippet), never in-place ROM mutation. The static cache is keyed by buffer identity, so writes need a version counter.
3. **Watching:** today every watched live URI fires every 1 s with no diff. Hash-diff per URI and drive from the emulator's vblank push instead of `setInterval`.
4. **.evs integration:** hover/definition providers have zero `soe://` references. Hovers should link `soe://bus/<addr>`, embed `icon.png`/`render.png`; go-to-definition on a script id → `assets/scripts/<id>.evs`. This directly serves the project goal ("more information on hover").
5. **Consistency:** an `index.json` (not just `index.md`) and a `schema.json` per directory kind, so MCP clients know the fields.
6. **Performance:** `stat()` currently renders the whole file to learn its size (costly for PNG/GIF/SPC) — use size hints; replace the 256-entry FIFO with a byte-bounded LRU; memoize `decodeRoom(rom, id)` per ROM in `rom-assets.js`.
7. **Search:** generalize `tags/search/<word>.md` to `soe://search/<q>.json` across strings, localization, functions, RAM symbols.

---

## 5. Language choice — HTML/JS vs TS vs wasm

**Verdict: the language choice is right** (TS/JS for a VS Code extension, C→wasm for the emulator and SPC engine). The problem is the **absence of a build step and of types**, not the languages.

- `tsconfig.json` is `allowJs`, `checkJs: false`, `strict: false`, and excludes all `webview/` dirs → ~61 k lines of JS get essentially no type checking.
- Webview code is concatenated strings: no modules, no tree-shaking, no types; the map editor depends on a hand-maintained file order of ~65 `map-editor-*.js` files.

### Should become TS (priority order)
1. Host↔webview message protocol (`extension.js`, `emulator/panel.js`) — typed message unions catch mismatched `command` strings (two dead handlers already exist, §6).
2. `src/emulator/cdl/*` — untyped byte scans over 4 MB.
3. `src/resources/*.js` (6.2 k) — pure handlers, easy to convert.
4. Emulator webview: `panel-webview.js` → `src/emulator/webview/*.ts` + `index.html` with config passed via `<script type="application/json">`.
5. `sprites/webview/sprites-view.js`, `rooms/rendering/room-draft.js`, `sprites/character-model.js`.

### Should become wasm
Almost nothing new. The emulator frame path needs **fewer copies**, not wasm (§9). Only if profiling of room renders/GIF batches says so: `maps/lzss.ts` + `chr.ts` (small pure byte loops). The core itself should be rebuilt with better flags (§9).

### Python
`tools/` (9 files, 2 k lines) partly duplicates TS: `dump_proto_spc.py` vs `audio-files.js`, `slice_montage.py`/`extract_modules.py` vs the TS renderers, `generate_data.py` (could share `script_parser`). `snes9x_wram.py`, `_extract_webview.py`, `_patch_extension.py` are obsolete one-offs. Confirm `script_parser/` vs `src/script/` as a single source of truth.

---

## 6. Dead code & unused features

- **Emulator message handlers with no sender:** `case 'wramDelta'` (`emulator/panel.js:445`, body is a "Reserved" comment), `case 'getRomOfferInfo'` (`:388`).
- **Unreferenced file:** `src/emulator/webview/index.html` (307 lines) — either delete or make it the real shell (§5).
- **Stub tab:** Route tab ships with a "Mock UI only" banner; `src/routes/route-tab.js` is 4 lines. Hide it until it's real.
- **Duplicate setting:** `everscript.patchesPath` is a legacy alias of `patchesDirectory`.
- **Vanilla core** (612 KB) ships but is never chosen when the debug core exists (`emulator/panel.js:243-248`).
- **Top-level folders:** `experimental/` empty; `call-log/` is a 5-month-old design with no code; `simulation/` is design-only — both → `docs/plans/`. `sandbox/room-data/` holds parked Rooms code that two `src/` files still point to in comments.
- **Hidden runtime dependency:** `shared/rom-readers.js:15` and `emulator/script-trace.js:29` fall back to `script_parser/dependencies/Secret of Evermore (U) [!].smc` (untracked) — make it explicit via the ROM resolver.
- **knip config is stale:** it ignores most webviews (so "clean" is meaningless) and has 7 now-unneeded ignore entries.
- **Knowledge in code that belongs in docs/VFS:** ROM-format essays in 40–53 %-comment files (`maps/object-stamps.ts`, `maps/character-animation.ts`, `maps/collision.ts`, `rooms/webview/map-editor-phases.js`, …) → `docs/game-research/map-format/` or `soe://tags`; long design notes in `extension.js` → links.

---

## 7. Files too large

Limit (`AI_ARCHITECTURE_GUIDE.md` §2.1): **> 400 lines must split**. **19 files** exceed it; 100 exceed 250.

| File | Lines | Split along |
|---|---|---|
| `emulator/panel-webview.js` | 4115 | css · boot/ROM offer · audio/input · render loop · overlays · sprite decode (delete → `shared/snes-gfx`) · extended map · script-stack debug · trace panel; `parseRoomTriggers` → `maps/` |
| `emulator/menu/menu-view.js` | 1925 | css · html · nav · objects/loot · keybinds · gamepad sync |
| `extension.js` | 1627 | radar cache/CodeLens → `memory/radar-host.js`; room PNG export → `rooms/export.js`; language providers → `language/register.js`; radar panel + message switch → per-tab handlers; Build-and-Run → its own module |
| `emulator/bottom-bar-views.js` | 1422 | css · html · icons · cheats · entities · alchemy · palettes · events |
| `sprites/webview/sprites-view.js` | 1409 | list · stats · playback · draw · palettes · stamina · raw mode |
| `emulator/panel.js` | 1130 | core resolve · ROM dispatch · message switch · room-map render (~340 lines) |
| `sprites/webview/sprites-layout.css` | 809 | per region |
| `shared/shared.css` | 599 | tokens · controls · layout |
| `resources/audio-files.js` | 540 | ROM walk → `music/model/`; drop webview import |
| `rooms/webview/map-editor-canvas.css` | 521 | canvas · overlays · toolbar |
| `maps/animation-vm.ts` | 491 | opcode table/decoders vs step loop |
| `rooms/rendering/room-draft.js` | 477 | serialization vs edit ops |
| + 7 more at 401–435 | | `map-editor-theme.css`, `character-model.js`, `vanilla-index.ts`, `animation.ts`, `render-script-model.js`, `map-editor-input.js`, `map-editor-families.js` |

Most of the top six are big because they are HTML/CSS/JS template literals; an esbuild step (§5) makes splitting them mechanical.

---

## 8. Docs, AI and skill files

### AI instructions
- `AGENTS.md` is the only rules file — and that is the right call (see §18): Claude Code and Antigravity load it directly.
- AGENTS.md §4 sends agents to `AI_ARCHITECTURE_GUIDE.md` (11 broken paths), `STATE_FLOW.md` (16 old-layout paths) and `docs/architecture/domain-overview.md` (41 broken paths) — **all three predate the `src/` refactor**. Its file map omits emulator, maps, script, music, mcp, rom, tools, tests.
- 20 of 25 skills have `applyTo`; the 5 without (`alchemy-spell-mechanics`, `secret-of-evermore-engine`, `snes-memory-mapping`, `snes-asm-asar-patching`, `wram-memory-mapping`) are **copies of the everscript repo's skills** (3 byte-identical, 3 diverged) that describe the compiler workflow, not this extension.
- Broken refs in skills: `map-format` (10), `rom-map-data` (12), `memory-radar`/`wram-memory-mapping` (`.github/memory-map.md`, external), and others.
- The same architecture laws are stated in ~9 places (guide + 5 architecture skills + 3 personas).
- The same MCP server is configured 3× (`.agents/mcp_config.json`, `.mcp.json`, `.gemini/settings.json`) — fine (different clients) but undocumented. `.github/agents/` contains only `.DS_Store`.

### Proposed skill consolidation (25 → ~15)
| Merge | Into |
|---|---|
| `compress-architecture`, `isolate-subsystem`, `split-orchestration`, `stabilize-state-flow`, `code-quality` (+ `AI_ARCHITECTURE_GUIDE.md` as reference) | `architecture` |
| `map-format` + `rom-map-data` | `rom-map-data`; slim `map-editor-rules` (29 KB) by moving tables to docs |
| `animation-script` + `sprites-subsystem` (0.6 KB) | `sprites-animation` |
| `grammar-rules` + `colour-theme` | `language-grammar-theme` |
| `wram-memory-mapping` + `snes-memory-mapping` | `snes-memory` (rewritten around `soe://` + `src/maps`) |

Personas: keep `everscript-plugin-builder` and `mechanics-modeler`; drop `architecture-compressor` (covered by the merged skill); move `script-parser-generator` next to `script_parser/` (its test ref is broken).

### Docs
- **Empty/stale:** `docs/roadmap-and-vision.md` (0 bytes), `emulator-status-and-roadmap.md` (pinned to v0.154.0), `future-features.md` (lists hover/completion/definition/problem matcher as future — all shipped), `emulator-v0.2.71-revert-notes.md`, `sprite-rendering.md` (stub), `architecture/migration-plan.md` + `target-architecture.md` (migration done), early emulator/editor concept docs, `docs/features/` (empty), `wiki/` (3 near-empty pages), `README.md` (duplicate "Customisation" heading, nothing about emulator/map editor/soe://, links outside the repo).
- **Roadmap sprawl:** `todo.md`, `future-features.md`, `roadmap-and-vision.md`, `emulator-status-and-roadmap.md`, `map-editor-todo.md`, `music-sequence-todo.md`, `map-editor-redesign-plan.md`, `docs/todo/*` (7). Collapse into `docs/plans/ROADMAP.md` + per-feature files.
- **Missing:** READMEs for `tools/`, `tests/`, `script_parser/`, `sandbox/`; no CHANGELOG (the git log already follows `vX.Y.Z: [tab] …`, so it can be generated).
- Filenames with spaces (`Naris Super Heal Logic.md`, `Prophet Bronze Armor Logic.md`) → kebab-case.

### Target layout
```
AGENTS.md                (≤3 KB: goal, ritual pointer, accurate file map, skill index)
.agents/skills/          (~15 skills)
docs/
  architecture/          overview.md (merged guide + STATE_FLOW, current paths), this file
  extension/             editor, emulator, debugger, CDL, soe:// specs, highlighter spec
  game-research/         map-format/, script-format/, combat/, prototype/, patches/
  plans/                 ROADMAP.md, per-feature plans, simulation/, research-requests.md
  reverse-engineering/   RE master plan, CDL, recomp/C port, Ghidra, REA, formats
  archive/               revert notes, migration plan, early concepts
```

---

## 9. Performance (emulator focus)

### Frame loop today (`emulator/panel-webview.js`)
- `requestAnimationFrame`, emulate when ≥ 14.67 ms elapsed, no catch-up (`:1334-1346`) → slow on 50 Hz displays, judder on 75/144 Hz.
- Video: 512×448 RGBA, `imageData.data.set(...)` + `putImageData` = two ~0.9 MB copies per frame.
- Audio: `createScriptProcessor(2048)` on the main thread (`:950`), not tied to emulated frame count → 46 ms blocks, drift, likely crackle.

### Every frame, regardless of what's visible
| Work | Location | Cost |
|---|---|---|
| `samplePreLoopState` — ~12 `readMemoryRange().slice()` calls | `:2389-2477` | ~7 KB garbage/frame, even with all overlays off |
| Extended map + overlays redraw 4 canvases | `:2580-2816` | `JSON.stringify(objectStates)`, string sorts, median sort, CSS `filter`, `measureText` per label |
| Script-trace check → host round trip | `:3816-3911`, `panel.js:547-560` | per-frame postMessage + `executeCommand` during cutscenes; duplicated in the 250 ms poll |
| APU stream / snapshot / memory bridge | `apu-stream-view.js`, `memory-bridge-view.js` | `Array.from` of up to 64 K bytes — send `Uint8Array` instead |
| 250 ms poll | `:3313-3350` | rebuilds stack table via `innerHTML`, re-renders the bottom tab even when collapsed; fallback path calls `_saveState()` and **never frees it** (leak) |
| `SND_SEND` exec breakpoint | `sound-source-view.js:48` (`sndShow = true`) | sets `hasExecBP` for the session → PC check on **every instruction** + `EM_ASM` crossing per hit |

### Ranked fixes
1. Audio-driven pacing via AudioWorklet + ring buffer (load the worklet from `asWebviewUri`/blob to satisfy CSP).
2. Visibility gating for pre-loop sampling, overlays, bottom tab, trace; redraw static layers only on cam/map/zoom change; read entity table via a reused `subarray` view.
3. Batch script trace every 100–250 ms and only while a consumer is open.
4. WebGL `texSubImage2D` (or one `ImageData` over the heap buffer); render 256×224 when not hi-res.
5. Arm `SND_SEND` only when sound marks / Music tab are open.
6. Typed arrays over `postMessage`; dirty flags instead of per-frame stringify/sort.
7. Rebuild the core with `-flto -msimd128 -sENVIRONMENT=web -sFILESYSTEM=0 -sINITIAL_MEMORY=32MB` (no memory growth → stable HEAP views); consider `-DEVS_CDL=0` variant if CDL isn't needed.

### Extension-host performance
- `onStartupFinished` → activation in every workspace; 37 top-level requires pull 141 modules (~44 ms) and a sync 357 KB `index.json` read (`extension.js:526`).
- `apuStream` wiring at `extension.js:1304-1316` loads the emulator panel at startup — move behind the open path.
- `soe://` `stat()` renders whole files; `decodeRoom` not memoized (§4).

---

## 10. What we bundle

`vsce ls`: **2245 files, 37.4 MB uncompressed.** No runtime npm deps (good).

| Ships but shouldn't | Size |
|---|---|
| `.emscripten_cache/**` (libc++.a, libc.a, arm_neon.h, GL headers…) | **~30 MB, 1583 files** |
| `docs/**`, `wiki/**`, `.agents/**`, `AGENTS.md`, `AI_ARCHITECTURE_GUIDE.md`, `STATE_FLOW.md`, `todo.md` | ~1 MB |
| `tools/**` incl. `__pycache__`, `.pytest_cache`, a 551 KB call-graph HTML | ~1 MB |
| `src/script/*.ts`, all `dist/*.d.ts` | small |
| Vanilla core (unused when debug core present), core `test.html`/`*.md` | ~0.6 MB |

Correctly excluded: `tmp/`, `sandbox/`, `call-log/`, `script_parser/`, `tests/`, `out/`, core C sources. Copyright/NOTICE files ship as required.

**ROM leak guard:** no ROM ships today, but nothing prevents it — add `**/*.sfc`, `**/*.smc`, `**/*.srm`, `**/*.spc`, `**/*.state`.

**Packaging bug:** `npm run package` runs `build:maps` but not `build:script`; it relies on `src/script/dist` already existing. It also hard-codes `/opt/homebrew/bin/vsce`.

---

## 11. UI/UX — is the look and feel unified?

**No.** Three colour systems coexist:
- `shared/shared.css`: 5 `--vscode-*` vars vs **323 hex colours**, dark-only.
- Map editor (`rooms/webview/map-editor-theme.css`): its own oklch `--rg-*` palette from the design mock, **0** `--vscode-*` vars.
- Emulator (`panel-webview.js`): 58 hard-coded hex, 0 vars.
- Sprites/ROM/Music CSS *do* use `--vscode-*` (75/25/21 vars).

Other inconsistencies:
- **Type:** monospace 11 px body with many 6–8 px sizes; map editor switches to system sans; ROM tab uses half-pixel sizes; nobody uses `--vscode-font-*`.
- **Components:** no shared button/chip/tab/table — `.doc-btn`, `.mu-btn`, `.rom-btn`, `.rp-btn`, `.sc-toggle-btn`, `.sp-chip-btn`; three tab-strip implementations; tooltips mix 171 native `title=` with 4 custom hover systems.
- **Icons:** emoji tab labels, no codicons.
- **Empty states disagree:** Scaling says "place the .smc in workspace root", Emulator says "set `everscript.romPath`". No shared empty/loading component.
- **Accessibility:** tab strip has no arrow-key / ARIA tablist handling; radar webview has no CSP (emulator and check panel do).
- **Copy:** Scaling's `.sc-note` paragraph is rendered twice (`render-radar.js` ~125 and ~133).

**Direction:** one `shared/webview/theme.css` that maps the `--rg-*` design tokens onto `--vscode-*` variables (keeps the mock's look in dark themes, works in light/HC), one component sheet (button, chip, tabstrip, table, empty-state), codicons, `--vscode-font-size` as the base with a minimum of ~10 px.

---

## 12. What should be simplified

- **Settings (14):** drop `patchesPath`; derive `compilerPath`, `pythonPath`, `inDirectory`, `patchesDirectory` from `repoPath` silently (keep as hidden overrides); `openSettings` command adds little.
- **ROM resolution:** one resolver (`romPath` → workspace `.smc` → explicit error) with one message; remove the `script_parser/dependencies` fallback.
- **Map renderers:** five overlapping paths (`maps/render.ts`, Rooms SVG, `rooms/rendering/tile-overlay.js`, emulator extended-map canvas, `soe://` map layers); collision/trigger overlays in three places. Converge on `maps/` TS + `soe://maps/<id>/` layers, with views only compositing.
- **Duplicate views:** ROM tab vs `soe://rom/`, Characters vs `character-markdown.js`, Music vs `audio-files.js` — once tabs read the VFS these become one model with two renderers.
- **Low-value tabs:** Route (mock), RNG, Docs could fold into `soe://` markdown pages until they have real behaviour.
- **Map editor load order:** ~65 concatenated files in a hand-ordered list → ES modules via the bundler.

---

## 13. Features that would help most

Measured against the project goal (readability + tooling):

1. **Live diagnostics** — no `DiagnosticCollection` exists; errors only surface through the build task's problem matcher. Run the TS script decoder / workspace index on change.
2. **soe:// in hovers and go-to-definition** (§4.4) — cheap, high value, uses existing infrastructure.
3. **Rename, workspace symbols, signature help, folding, semantic tokens, inlay hints** (e.g. enum values, resolved addresses). A TS language service on `src/script` + `language/workspace-index.js` is cheaper than the Python LSP in `future-features.md`.
4. **Onboarding:** a `contributes.walkthroughs` flow with ROM pick + header validation (`snes-rom-header-model.js` already exists).
5. **Entry points without an `.evs` file:** commands (or an activity-bar tree) to open Rooms/ROM/Music/Characters directly.
6. **Patch export:** IPS/BPS + diff-vs-vanilla + the documented round-trip test.
7. **Undo/dirty/save integration** via `CustomEditorProvider` for map editor (and later music/sprites).
8. **CI** (see §14).

**Low value for this goal (park):** Secret of Mana content port, SoE+ALttP combo ROM, Route simulation (blocked on damage models), Atlas trace work (blocked on user data), SPC monitor panel.

---

## 14. Testing

- 41 test files (~19.4 k lines): plain Node `assert` scripts, one `node:test`; one grammar fixture.
- `npm test` is one `&&` chain that first runs `build:cores` + `build:music-engine` → **requires Emscripten to run any test**; first failure aborts, no summary.
- **Never run by `npm test`:** `tests/debugger/emulator-map-overlays.test.js`, `emulator-runtime.test.js`, `rom-history.test.js`, `tests/localizations/localizations.test.js`.
- **No CI** (`.github/workflows` absent).
- Parity tests need a real ROM with no skip guard.
- Gaps: no `@vscode/test-electron` integration tests; no tests for hover/completion/definition providers, Scaling/Route/Docs/RNG webviews, sprites interactions, soe:// provider edge cases.

**Fix:** `node --test` with a glob (nothing can be forgotten); split `test:unit` / `test:rom` (skip when ROM absent) / `test:cores`; GitHub Actions running grammar + unit + `typecheck` + `check:deps` + knip.

---

## 15. Suggested sequencing

1. **Hygiene (1 day):** `.vscodeignore`, activation events, ROM guard, `package` script fix, delete dead handlers/empty dirs, AI pointer files, prune `out/`.
2. **Guardrails (1 day):** depcruise rules for all violating edges + no-tab→tab; `check:circular` on TS; knip config refresh; test split + CI.
3. **Emulator perf (2–3 days):** visibility gating, `SND_SEND` arming, typed-array messages, AudioWorklet pacing, core flags.
4. **Shared extraction (2 days):** `snes-addr`, `snes-gfx`, `alchemy-math`, `shared/webview` (tab strip, escH, CSP shell, theme + components).
5. **Tab independence (2–3 days):** tab contract, lazy tab loading, per-tab message handlers out of `extension.js`, direct open commands.
6. **Bundler (2–3 days):** esbuild; then split the template-literal giants mechanically.
7. **VFS as the data plane (ongoing):** ROM tab → Music → Sprites read `soe://`; ram writes; hover/definition integration.
8. **Docs/skills restructure (½–1 day):** target layout, skill merges, archive stale docs.

---

# Part II — Follow-up decisions (v0.200.0)

## 16. Content copied from SoETilesViewer / SoEScriptDumper

**Policy (now in `AI_ARCHITECTURE_GUIDE.md` §3.8):** no code, data tables or structure definitions from the reference repos; naming/localization data (room names etc.) is allowed and lives in `src/localizations/`.

**Licence problem (verified):** both `SoETilesViewer/LICENSE` and `SoETilesViewer/SoEScriptDumper/LICENSE` are **GPLv3**; this extension is **MIT** (`LICENSE`, `package.json:"license"`). Files that declare themselves ports of GPLv3 code cannot ship under MIT as they stand. `docs/release-checklist.md:53` wrongly calls the upstream tool "MIT-licensed". (Not legal advice — but the mismatch is explicit in the source comments.)

| # | What | Kind | Size | Way out |
|---|---|---|---|---|
| 1 | `src/script/*.ts` — decoder, expression (`buf_parse_sub`), loot (`LootData`), addressing (`rom2scriptaddr`), ops-* | ported code | ~1.7 k lines | Biggest item. Rewrite from our own `docs/script-format/` + ROM/trace evidence, verified by ROM-only golden tests; or obtain the author's permission / relicense. Keep the current decoder until the replacement passes. |
| 2 | `src/script/names.json` (1851) + `names.ts` + `tools/generate-script-names.js` | copied data | 1.9 k | Enemy/item **names** → `src/localizations/` (allowed). RAM-address names, 842 flag names, loot table, enemy→character mapping are curated upstream research → drop (decoder already falls back to raw numbers) or re-research. Delete the generator. |
| 3 | `src/maps/sprites.ts` — port of `spriteblock.h`/`spriteinfo.h` (pools, `0xca0003`, `+0x10001` wrap) | ported code | 279 | Re-derive from ROM (pointer tables + skip-list compression), verify with existing map-parity tests, rewrite comments. |
| 4 | `src/maps/character-record.ts`, `src/sprites/character-model.js` — 74-byte record from `characterdata.h`, constants `0x8eb678`, `0x7e2210`, `0x7e2234` | data/code | 664 | Re-derive layout from the game's own reads (CDL/trace), or remove fields we can't evidence. |
| 5 | `src/maps/render-script-model.js:8` — hard-coded ROM path **inside the SoETilesViewer checkout** | runtime dependency | 1 line | Use the ROM resolver / soe://. Violates AGENTS.md "do not depend on it". |
| 6 | Test/dev harnesses reading upstream output: `tests/memory/script-parity.test.js`, `script-loot.test.js`, `script_parser/src/scripts-all-model.ts:56`, `sandbox/corpus/*` | dev dependency | — | Replace with ROM-only golden files, or drop. |
| 7 | Attributions/derived field names in comments and docs: `src/sprites/README.md:7`, `src/docs/render-docs-tab.js:136` (user-visible), `src/maps/README.md:100`, `src/script/README.md`, ~10 files in `docs/script-format/`, `docs/room-script-parser.md`, `.agents/agents/script-parser-generator.md:128` | docs | — | Reword/remove alongside #1–#4 (the comments are honest attribution; remove them only when the code they describe is replaced). |
| ✓ | `src/localizations/maps.js`, `scripts.js`, `data/scripts.json` — room names | localization | — | Allowed, stays. |

Order: #5 (trivial) → #2 names split → #3/#4 (ROM re-derivation, testable) → #1 (clean-room decoder) → #6/#7.

**Decision (2026-10-11):** written permission from the author exists, but we still don't build on their work. #1, #3–#7 are re-implemented from the game's own code — plan in [docs/plans/script-decoder-from-game-code.md](plans/script-decoder-from-game-code.md). #2 (names) is **postponed**: it stays, isolated, until a separate decision. Room names in `src/localizations/` stay.

---

## 17. Tests — heavy tests only on demand

Measured by running every file individually (ROM and Playwright present on this machine):

| Tier | Files | Wall time | Needs |
|---|---|---|---|
| **unit** | ~30 files (debugger/*, localizations, memory/{activation,radar,map-units,script-units,damage,rebuild-invalidation,scaling-rom,mcp-server,map-editor,smoke,sprites,render-script-model}, …) | **~8 s** total (`render-script-model` 4.1 s, `tas` 2.6 s, rest < 1 s) | nothing |
| **rom** | collision-suggest, rom-export, script-loot, script-parity, soe-resources, soe-tags, rom-tab, music-tab, script-debug-hook | ~10 s | ROM (some: everscript repo / asar / upstream dump) |
| **dom** | map-editor-dom, rooms-rail-dom, `ui` (22 s) | ~27 s | Playwright Chromium |
| **emulator** | emulator-health, emulator-runtime | **955 s, currently failing (exit 1)** | built cores, Chromium, ROM |
| **slow** | custom-maps (> 17 min, killed), map-parity (> 15 min, killed) | > 30 min | ROM, everscript repo, Python venv |

Problems found:
- `npm test` runs `build:cores` (two full uncached `emcc -O3` builds) and `build:music-engine`, which **rewrites the tracked `src/music/engine/spc-engine.js`** — so testing can dirty the worktree.
- Not run by `npm test` at all: `emulator-map-overlays`, `rom-history`, `localizations` (all fast units) and `emulator-runtime`.
- Timed-out heavy tests ignore SIGTERM (child browser/processes) — a runner must use SIGKILL.

Proposal — a ~30-line `tools/run-tests.js` with a tier manifest (no file moves needed), per-tier timeouts, SIGKILL, and a summary:

```json
"test":           "npm run build:maps && npm run build:script && npm run test:grammar && node tools/run-tests.js unit",
"test:grammar":   "vscode-tmgrammar-test -g src/language/syntaxes/everscript.tmLanguage.json 'src/language/tests/**/*.test.evs'",
"test:rom":       "npm run build:maps && npm run build:script && node tools/run-tests.js rom dom",
"test:emulator":  "npm run build:cores && node tools/run-tests.js emulator",
"test:slow":      "npm run build:maps && npm run build:script && node tools/run-tests.js slow",
"test:all":       "npm run build:music-engine && npm test && npm run test:rom && npm run test:emulator && npm run test:slow"
```

Shared skip guard `tests/_rom.js`: resolve `EVERSCRIPT_ROM` → local fallbacks; if absent print `SKIP` and exit 0 (exit 2 under `CI_STRICT=1` so a full run can't pass silently). Same for Playwright.

Release ritual: `npm test` every commit; `test:rom` when a ROM is present (+~40 s); `test:emulator` only when `src/emulator/**` or the cores change; `test:slow` pre-release. Fix `emulator-runtime` before gating on it.

---

## 18. AI instruction files — only AGENTS.md?

**Yes, keep only `AGENTS.md`.** Evidence: this Claude Code session loaded `AGENTS.md` as project instructions without any `CLAUDE.md` present; Antigravity reads it too. Copilot in VS Code can read `AGENTS.md` (setting `chat.useAgentsMdFile`). Gemini CLI defaults to `GEMINI.md`; if you use it, point it at AGENTS.md in `.gemini/settings.json` (`"context": { "fileName": "AGENTS.md" }`) rather than adding a second file.

What to fix inside AGENTS.md: the file map (missing emulator, maps, script, music, mcp, rom, tools, tests), the §4 reading list (points at three stale docs), and the skills table duplicating every skill's own description — an index of names is enough.

### Nested AGENTS.md files — adopted
These are *directory-scoped* (hierarchical) instruction files from the agents.md convention: an agent loads the nearest `AGENTS.md` above the file it works on.

**Verified in Claude Code:** after adding `src/mcp/AGENTS.md`, reading `src/mcp/protocol.js` injected that file into the session automatically.

Layout (guide §3.10):
- `src/<domain>/AGENTS.md` — the contract: kind, ownership, dependencies + existing exceptions, state, invariants, tests. ≤ 70 lines, rules only.
- `src/<domain>/README.md` — descriptive docs; the rule sections moved out, a link back remains. No rule lives in both.
- Root `AGENTS.md` §4 now points at the nested files instead of `STATE_FLOW.md`/`docs/architecture/*`.

---

## 19. Where should localization live?

**In `src/localizations/` — it stays.** It is runtime data the extension ships and `require`s, so it belongs under `src/` (root-level would sit outside `main`'s tree and fight `.vscodeignore`). What should change is its *role*: make it the single **library** domain for all human-readable names:
- move in: `emulator/known-scripts.json` (address → id/kind), the enemy/item names from `script/names.json` (§16 #2), the label-strip helper pasted 3× in `resources/`;
- keep it pure data + thin lookups (no `vscode`), exposed via `soe://localization/`;
- if the compiler ever joins this repo (§22), it becomes a shared top-level package — not before.

---

## 20. AI_ARCHITECTURE_GUIDE review — done

The guide was rewritten in this change. What was wrong with the old one:
- §3 said `src/maps/` is "being retired" — it is now the authoritative strict-TS ROM library (8.6 k lines).
- It described a planned `src/map-editor/` Python bridge that was never built (the editor lives in `rooms/` on the TS port).
- It justified the 1000+-line HTML template as "a single indivisible function" — the root of the string-code problem.
- §2.5 "no registries" made a plain tab list look forbidden, blocking tab independence.
- It listed 11 broken paths, a v0.5.1 hotspot table, pointed at four stale `docs/architecture/*` files, and restated the release ritual (a second copy that had already drifted from the skill).
- Its dependency picture ignored half of the domains.

The new guide: three domain kinds with a dependency table; laws for removable features, soe:// as data plane, no code-in-strings, extract-on-third-copy, strict types, data provenance, activation/perf, packaging, test tiers; each marked **[now]** or **[target]**, with known violations pointing back here. Measurements and backlog live in this file, not the guide.

---

## 21. JS/HTML stored as strings → real code

**Yes — and it is the single biggest structural debt.** Two patterns:

| Pattern | Where | Size |
|---|---|---|
| Client JS/CSS/HTML **inside template literals** | `emulator/panel-webview.js` (4136), `menu/menu-view.js` (1933), `bottom-bar-views.js` (1422), `cdl-view.js`, `tas-view.js`, `sound-source-view.js`, `script-debug-view.js`, `apu-stream-view.js`, `memory-bridge-view.js`, `fps-meter.js`, `cdl-float.js`, `cdl-strips.js`, `menu/menu-sound.js` | **~9.5 k lines** |
| Real `.js` files, but **concatenated as strings** at open time | `memory/webview/index.js` splices ~70 files from 7 tab folders into placeholders in `shared/shared.js` | ~21.8 k lines of webview JS |

Costs today: no syntax highlighting/lint/types inside strings, escaping bugs (regex backslashes in template literals are a known trap here), no source maps, hand-maintained load order, every tab loaded into one global scope (the root of the tab coupling in §3).

Plan:
1. **Add esbuild** (dev dependency, ~1 s builds): one bundle for the host (`src/extension.js` → `dist/extension.js`) and one IIFE bundle per webview entry (`src/emulator/webview/main.ts`, `src/memory/webview/main.ts`, …). CSS as files loaded via `<link>` + `asWebviewUri`; HTML shell as a `.html` file (the unused `src/emulator/webview/index.html` can become it) with only nonce/URIs substituted.
2. Config enters the webview as JSON (`<script type="application/json" id="cfg">`) — no `${}` inside code.
3. **Convert emulator views smallest-first** (`memory-bridge-view` 57 → `fps-meter` 76 → `cdl-float` 94 → … → `bottom-bar-views` → `menu-view` → `panel-webview` along the split in §7). Each step: move the string body to `webview/<name>.ts`, export an `init(ctx)`; the host stops returning strings.
4. **Radar:** replace the `readFileSync` splice with ES `import`s in each tab's `main.ts`; the shell imports tabs from the tab list (§3) — the hand-ordered list disappears.
5. Then the guide's §3.5 flips from [target] to [now] and depcruise can forbid host→webview imports.

---

## 22. Merge everscript into this repo? Port the compiler to Rust/wasm?

Facts: everscript = Python compiler **6.2 k lines** (rply parser), 445 `.evs` files (~105 k lines) of game content, 3.2 k lines asm patches, 8.6 k lines pytest, PyInstaller releases, needs external **asar**. Activity: 41 commits / 6 months vs **459** here. The extension depends on it through unversioned contracts: spawning `python everscript.py` (users need the repo + Python + venv + asar), `out/source_map.json` (debugger), a regex scraper `tools/generate_data.py` that builds `index.json` (and writes to a stale path), hand-copied signatures in `src/script/everscript.ts`, RAM bounds hard-coded in `extension.js:18`, six duplicated (partly drifted) skills, a shared wiki.

**Recommendation: don't merge now; port the front end to TypeScript; not Rust.**
- **Merge:** the coupling is real but the repos have different lifecycles (compiler also ships as a standalone CLI and hosts mod content). First turn the implicit contracts into explicit ones — a versioned `source_map.json` schema; the compiler emits a `signatures.json` that replaces the regex scraper; one home per skill. If a TS port (below) happens, a monorepo (`packages/compiler`, `packages/extension`, `content/`) becomes the natural next step — revisit then.
- **Rust → wasm: no.** Speed isn't a demonstrated problem, there is no Rust in either repo, and the extension's real need is in-process access to the AST for language features — across a wasm boundary that is awkward.
- **TypeScript: yes, staged.** (1) Port lexer + parser + AST (~4 k lines) to TS for a real language server — diagnostics, scopes, rename — keeping Python codegen as the reference. (2) Port codegen/linker with byte-identical parity tests against the Python compiler (the same method `check:maps` already uses for the map port). (3) Build asar (C++) to wasm with the emscripten toolchain already in place. Result: no Python or external binaries for users, one grammar, and the extension compiles in-process.

---

## 23. Strict type checking

Measured baseline (current `tsconfig.json`, same include/exclude):

| Setting | Errors |
|---|---|
| today (`checkJs: false`) | 0 |
| `checkJs: true` | 365 |
| `checkJs: true` + `strict: true` | **4 360** |

By domain (strict): emulator 867 · resources 743 · music 692 · rooms 529 · rom 378 · debugger 253 · `extension.js` 233 · sprites 202 · shared 172 · maps 80 · language 71 · memory 55 · mcp 40 · localizations 40. Top codes: TS7006 implicit-any parameter (2 774), TS2339 unknown property (407), TS7005/7034 implicit-any variables (362). **Plus ~21.8 k lines of webview JS that aren't in the program at all.**

Also: **`@types/vscode` isn't installed**, so every VS Code API call is `any` — strict mode would be checking a lot less than it appears.

Plan (ratchet, no big bang):
1. Add `@types/vscode@~1.85` (matching `engines`) and `"lib": ["ES2020", "DOM"]` for webview code.
2. Flip `strict: true` in `tsconfig.json`; keep `checkJs: false` globally but add a `tsconfig.strict.json` whose `include` list grows file by file — `npm run typecheck` runs both. A file never leaves the list.
3. Order by cost/benefit: `localizations` (40) → `mcp` (40) → `memory` (55) → `language` (71) → `maps` JS (80) → `shared` (172) → `debugger` (253) → `resources` (743, pure handlers — convert to `.ts` instead) → host message protocol in `extension.js`/`emulator/panel.js` (typed unions) → the rest.
4. Webviews join once they are bundled `.ts` (§21) — that is where they get types at all.
5. New files: `.ts`, strict, from day one (guide §3.7).

---

## 24. Does the file structure make sense?

**Mostly at the `src/` level; not at the root, and naming misleads in places.**

Problems:
- **Root clutter:** `script_parser/` (separate TS package, 7.6 MB, mostly generated corpora), `sandbox/`, `simulation/` (md only), `call-log/` (one md), `experimental/` (empty), `tmp/` (449 MB), `out/` (510 MB of old `.vsix`), `dependencies/`, untracked `resources/icons/`, plus `AI_ARCHITECTURE_GUIDE.md`, `STATE_FLOW.md`, `todo.md` beside `AGENTS.md`.
- **Flat `src/` hides the three domain kinds** (§2 of the guide) — `maps` (a library) sits beside `rooms` (a feature) with confusingly similar names.
- **Misleading names:** `src/memory/` is really the *radar host* for 9 tabs; `src/docs/` (a tab) collides with root `docs/`; `tests/memory/` holds rooms/music/rom/mcp tests and `tests/debugger/` holds emulator tests.
- **Build output inside `src/`:** `src/maps/dist`, `src/script/dist`.
- **Emulator is the only feature without a real `webview/` folder** — its client code is strings (§21).
- `tools/` mixes live generators, Python research tools, one-off refactor scripts and caches (`__pycache__`, `.pytest_cache`).

Target (moves can happen opportunistically; the depcruise rules by kind matter more than the folders):

```
AGENTS.md  AI_ARCHITECTURE_GUIDE.md  README.md  LICENSE  package.json
src/
  extension.js               composition root
  lib/        shared/ maps/ script/ localizations/
  platform/   resources/ mcp/ language/ debugger/
  features/   emulator/ radar/(was memory) rooms/ sprites/ music/ rom/ scaling/ routes/ rng-docs/(was docs)
    <feature>/host/ … webview/main.ts … README.md
dist/                        esbuild output (host + webview bundles) — ships
tests/<domain>/              tiered via tests/tiers.json
tools/                       live generators/build scripts only (+ README)
packages/script-parser/      (was script_parser/)
docs/                        architecture/ extension/ game-research/ plans/ reverse-engineering/ archive/
```

Folded into `docs/plans/`: `simulation/`, `call-log/`, `todo.md`. Deleted: `experimental/`, `docs/roadmap-and-vision.md`, one-off tools. Gitignored scratch stays in `tmp/` — prune it and `out/`.

If the full move feels like too much churn: do only the cheap, high-signal renames (`memory`→`radar`, `src/docs`→`rng-docs`, `tests/memory`→`tests/<domain>`, `script_parser`→`packages/script-parser`) and encode the three kinds in `.depcruise.js`.

---

## 25. Not violating the GPL — options

*Not legal advice; this is the engineering reading of the situation.*

**Renaming is not enough.** Copyright protects *expression*: code structure, the order and shape of cases, comments, chosen names and the selection of data. A case-for-case translation from C++ to TypeScript (which is what `src/script/*.ts` says it is) stays a derivative work after every identifier is renamed. What is free to use are **facts about the game**: an address, an opcode's byte value, a record's layout as the ROM stores it. They're free because they are the ROM's facts, not the upstream author's expression — provided we establish them ourselves.

| Option | What it takes | Verdict |
|---|---|---|
| **1. Ask permission** | Both repos are by one main author (black-sliver: 73 of 77 SoETilesViewer commits). Ask for the ported parts, `names.json` data and room names to be usable under MIT (a short written grant or a relicence of those files). | **Do first.** Cheapest; also covers the names. |
| **2. Independent reimplementation** | Derive each fact from **the game itself**, not from `list-rooms.cpp`. The real spec of the script format is the game's own script interpreter: disassemble its opcode jump table (CDL + trace tooling already exists), write an evidence note per opcode in `docs/script-format/`, then implement **table-driven from that spec** with our own structure and names. Tests use ROM goldens produced by the game (emulator traces), not upstream output. Keep the old port until the new one matches it on every room, then delete it. Rule during the rewrite: nobody opens the upstream source. | **Fallback, and do the cheap parts now**: `maps/sprites.ts` and `character-record.ts` can be re-derived from ROM reads in days. |
| 3. Relicense the extension to GPLv3 | Legally simple for the ported files. **But** the bundled snes9x2005 core is under a *non-commercial* licence (see the `emulator-subsystem` skill), which conflicts with GPL's "no further restrictions" — defensible only as separate-program aggregation. Murky. | Not recommended. |
| 4. Remove the features | Script decoding feeds the debugger, hover, Rooms scripts, `soe://` scripts and the ROM tab. | Too costly. |

Housekeeping regardless of choice:
- Fix `docs/release-checklist.md:53` (it says MIT).
- State in `LICENSE`/README that MIT covers our code only and bundled third-party parts (snes9x core, SPC engine) keep their own licences, with the `copyright`/`NOTICE` files that already ship.
- The new guide's §3.8 makes "derive from the ROM, with a test" the rule for all future work, so the problem doesn't regrow.

---

## 26. Keeping the RAM and ROM views from going stale

### Where the content comes from today
| View | Source | Stale risk |
|---|---|---|
| ROM tab: **regions** | measured live from the ROM by decoders (`src/rom/model/*`) | none (fresh by construction) ✓ |
| ROM tab: **point names** | `localizations` FUNCTIONS/TABLES **+ wiki §4 rows regex-parsed at runtime** (`rom/model/wiki-overlay.js`) from the first copy found: `<workspace>/wiki/rom/Rom-Map.md` → `.github/rom-map.md` → the extension's own `wiki/` submodule | high: output depends on the open workspace. The bundled submodule is pinned at a **2024 commit with no `rom/` folder**. Wiki §4 is itself generated from the ROM, so the data loops back on itself. |
| `soe://ram` symbols | `src/script/names.json` (SoEScriptDumper data, see §16) + hand-curated `resources/tags/tags.json` | medium; also the GPL problem |
| Memory tab | `.evs` scope analysis + region bounds hard-coded in `extension.js:18` (copied from the compiler and `02_ram.evs`) | medium: silent drift from the compiler |
| everscript `wiki/ram/Ram-Map.md` | 576 lines of hand-written prose that calls itself "the authoritative single source of truth" | high: nothing checks it |

That is four RAM truths and two ROM-name truths.

### Should the views be generated from the wiki? **No — invert it.**
The wiki is a poor source of truth:
- It is prose with Markdown tables, parsed by regex; a harmless edit can silently break the parse.
- It lives in a separate git repo with no review, tests or types, and isn't versioned with the code (the submodule here is two years behind).

The wiki should be **generated from, or checked against,** this repo.

### Proposal
1. **One source per address space — one Markdown file per entry** (superseded the `ram.json` idea; see §27): `src/localizations/knowledge/ram/<addr>.md` and `…/rom/<addr>.md`, flat front matter for the machine fields (address, end, kind, name, lifetime, confidence, evidence) and a plain-language body for the purpose. Seed from `02_ram.evs` (your own compiler definitions), `tags.json`, `functions.js`/`tables.js` and our docs — **not** from `names.json` (§16).
2. **Every consumer reads that one source:** Memory tab, ROM tab, `soe://ram`, `soe://rom`, hover and MCP. The runtime wiki overlay and the hard-coded bounds in `extension.js` go away.
3. **The RAM map and ROM map tables are generated** from the entries (`npm run gen:maps-docs`), into the repo's docs and into the wiki between markers (`<!-- generated:ram-map -->`), the way Rom-Map §4 already is. Edits go to the entries; prose around the markers stays hand-written.
4. **Guards, cheapest first:**

   | Guard | Catches | Tier |
   |---|---|---|
   | front-matter schema + no-overlap + unique-name checks on the entries | typos, collisions | unit |
   | every named ROM point lies inside a measured region of the matching kind; code points are executed entry points in the CDL library (when present) | names pointing at the wrong bytes | rom |
   | headless boot in the bundled core under node (already proven, see the headless-boot notes): play a short input script, assert key addresses behave (HP drops on a hit, room id changes on a transition, a flag sets) | wrong or moved RAM addresses | emulator |
   | `gen:wiki --check`: fail when the wiki's generated sections differ from what the repo produces | wiki drift | unit (when the wiki checkout is present) |
   | `02_ram.evs` ↔ RAM entries diff when the everscript repo is present | compiler/extension drift | rom |
5. **Show the evidence:** the tabs can badge entries with no evidence, or not verified since the last N versions, so staleness is visible instead of silent.

---

## 27. Format for the RAM map and ROM map — and the "write it down" loop

### Format comparison
| Format | Prose purpose per entry | Structured sub-data (bits, fields, per-room) | Parallel edits | Parse at runtime without deps | LLM-friendly |
|---|---|---|---|---|---|
| One big Markdown table (current wiki) | ✗ one cell, no line breaks, pipes break it | ✗ | ✗ every edit touches one file | fragile regex | ✓ |
| JSON | ✗ no comments, no multi-line | ✓ | ✗ one file | ✓ | ~ (escaping) |
| YAML / TOML file per area | ✓ (`|` blocks) | ✓ | ~ | ✗ needs a parser dependency | ✓ |
| **Markdown per entry + flat front matter** | ✓ the body | ✓ small tables under fixed headings | ✓ one file per address | ✓ flat `key: value` is a few lines of code | ✓ |

**Chosen: one Markdown file per entry** (`src/localizations/knowledge/{ram,rom}/<addr>.md`). The Markdown tables you like survive in two places: as the *generated* overview (RAM map, ROM map) and as small local tables inside an entry (`## Fields`, `## Bits`, `## Values`, `## Layout per room`). The full spec is in the `game-knowledge` skill. Example — what `soe://ram/2834` would serve:

```markdown
---
addr: 7E2834
end: 7E2BFF
kind: region
name: ROOM_SCRATCH
title: Room scratch RAM
lifetime: room
confidence: likely
evidence: ["write: cleared on screen transition (emulator, v0.200.0)"]
---
Temporary RAM for whatever the current room needs. Reset on every screen transition.
Multi-purpose with no fixed structure: each room's scripts lay it out their own way,
so a value only means something together with the room id.
```

Lookups inside a region (`soe://ram/2840`) resolve to the containing entry through `end:`.

### Making agents write things down (done in this change)
- Root `AGENTS.md` §0 has three **standing rules** for every task: legal first, write down what you learn, keep the AI files true (fix skills/AGENTS.md without asking).
- New **`game-knowledge` skill** (`applyTo: "**"`): look up before researching, record after learning, entry format, evidence kinds, confidence levels, "Previously believed" for corrections, migrate legacy `functions.js`/`tables.js` lines on touch.
- **Release-ritual checklist** gained three items: knowledge recorded, AI files fixed, nothing legally risky staged.

### Still to build (code)
1. Entry loader (flat front matter + body sections) in `src/localizations/`, with schema/overlap tests (unit tier).
2. `soe://ram/<addr>` and `soe://rom/<addr>` serve the entry (purpose + fields + evidence) next to the live value; hover in `.evs` shows the purpose.
3. Migrate `functions.js`, `tables.js` and the RAM side of `tags.json` into entries (scripted, one commit).
4. Generate the RAM-map/ROM-map overview tables and the wiki sections; drop the runtime wiki overlay.
5. Optional enforcement for Claude Code: a project `Stop` hook that reminds the agent to record findings when the session touched addresses. Instructions alone may be enough; add the hook only if entries keep going missing.

---

## 28. Legal audit — game assets and third-party material (2026-10-11)

**Both GitHub repos are public** (`r-bin/everscript-vscode`, `r-bin/everscript`), so anything below that is in HEAD *or history* can be downloaded today.

**Clean:** no ROM, image, audio, save, patch or archive file is tracked or was ever committed. Icons, strings, sprites and music are decoded from the user's ROM at runtime. There are no base64 or `data:` blobs. `resources/icons/*.svg` are hand-made logos.

### In HEAD — remove
| Path | What | Risk |
|---|---|---|
| `script_parser/generated/opcode-corpus.json` (2.4 MB) | **7,880 instructions with their raw ROM bytes** (35 KB of game bytecode) **plus SoEScriptDumper's disassembly text** — effectively `script_all` with the bytecode | **high** (verified) |
| `script_parser/generated/opcode-shapes.json`, `script_parser/tests/generated/**` (branch-targets, script-boundaries, opcode-corpus, expression-corpus) | addresses + upstream dumper text per instruction, used as test oracles | medium |
| `src/script/*`, `src/script/names.json`, `src/localizations/data/scripts.json`, `src/maps/sprites.ts`, `src/maps/character-record.ts` | GPL-derived code/data (§16) | handled by the rewrite plan; names postponed |
| `sandbox/*`, `src/maps/render-script-model.js` | hard-coded paths to `script_all` and the ROM file | low |
| `docs/map-format/map_decompression_trace_analysis.md` (16 hex lines), `docs/render-script-93.md` (2 lines) | short ROM byte excerpts | low — trim |
| `README.md` §License | links to `file:///Users/v/...` | low — make it relative |

### In history only — needs a rewrite to be gone
`docs/payload-byte-plots.md`, `docs/payload-deep-analysis.md`, `docs/map-loading.md` (early versions: **full hex dumps of room payloads**), `tests/debugger/parity/snapshots/`, `tests/parity/snapshots/`, `tests/corpus/script-all-corpus.js` (dumper-output snapshots), every version of `script_parser/generated/` and `script_parser/tests/generated/`, `emulator/vendor/` (vendored EmulatorJS, GPLv3), `emulator/core/` (old snes9x build).

Purge: `git filter-repo --invert-paths` over those paths, then force-push every branch and tag. Existing clones and forks keep the old history, and GitHub may keep cached views until support purges them. The same audit should run on `r-bin/everscript`, which holds `script_all` and the ROM in its working tree; check they were never committed.

### Licences of what ships
- The snes9x2005 core and the SPC engine built from it are **non-commercial**. The extension must never be sold, and the `copyright`/`NOTICE.md` files must keep shipping next to them.
- The MIT `LICENSE` should say it covers our code only.

### Guard rails
- **Done in this change:** `.gitignore` blocks ROM, save, patch, audio, image, `script_all` and `dumps/` files. Our own art is re-allowed per path with `!path`.
- **To do:**
  - `.vscodeignore`: the same patterns plus `docs/**`, `wiki/**`, `.agents/**`, `tools/**` (§10).
  - `tools/check-legal.js`, run as a pre-commit hook on staged files and in CI on `git ls-files`. It fails on: forbidden extensions; media/SPC/IPS magic bytes; `data:` URIs or 200+-character base64 runs; 64+ consecutive numeric literals or 8+ hex-dump lines; ROM filenames or `/Users/` paths in data files; source headers mentioning SoETilesViewer/SoEScriptDumper/`data.h`.
