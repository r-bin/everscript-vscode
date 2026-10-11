# Architectural State — v0.199.0 (2026-10-11)

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
| 8 | Fix the AI-instruction layer: add `CLAUDE.md`/`GEMINI.md` → `@AGENTS.md`, refresh or archive the 3 stale architecture docs AGENTS.md sends agents to | Agents are actively steered toward pre-refactor paths | ½ day |
| 9 | Split `npm test` into `test:unit` (no emcc, no ROM) / `test:rom` / `test:cores`; add a GitHub Actions workflow | Tests currently need Emscripten; 4 test files never run; no CI | ½ day |
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
- `AGENTS.md` is the only rules file. **No `CLAUDE.md`, `GEMINI.md` or `.github/copilot-instructions.md`**, so non-Gemini agents don't auto-load it. Add one-line pointer files.
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
CLAUDE.md / GEMINI.md / .github/copilot-instructions.md  → "@AGENTS.md"
.agents/skills/          (~15 skills)
docs/
  architecture/          overview.md (merged guide + STATE_FLOW, current paths), this file
  extension/             editor, emulator, debugger, CDL, soe:// specs, highlighter spec
  game-research/         map-format/, script-format/, combat/, prototype/, patches/
  plans/                 ROADMAP.md, per-feature plans, simulation/, research-requests.md
  workflows/             cdl-export-build-recomp, release
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
