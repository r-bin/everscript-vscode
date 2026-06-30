# Domain Overview — Everscript VS Code Extension

> Navigation guide for AI agents and developers.
> Each domain is a bounded context that can be worked on independently.
>
> Before starting any task, identify which domain(s) it touches,
> then load only those domain entries plus `shared`.

---

## How to Use This Document

1. Find the feature you are working on in the table below.
2. Read only the domains listed in its "Load these domains" row.
3. Ignore all other domains.
4. Start with the domain README, then the requirements doc, then the source files.

---

## Quick Navigation Table

| Task | Load these domains | Ignore these |
|---|---|---|
| Grammar / syntax highlighting | `language` | All others |
| Hover / completion / go-to-def | `language`, `shared` | All others |
| Memory radar / WRAM grid | `memory`, `shared` | All others |
| Map browser / rooms tab | `rooms`, `maps`, `shared` | debugger, emulator, scaling |
| Scaling calculator | `scaling`, `shared` | All others |
| RNG / alchemy docs | `rng`, `shared` | All others |
| Route planner | `route`, `maps`, `shared` | debugger, emulator, scaling |
| Emulator panel / SNES core | `emulator`, `debugger`, `shared` | maps, rooms, scaling |
| DAP / breakpoints / mock runtime | `debugger`, `shared` | emulator internals |
| Parser / compiler / opcodes | `script` | Everything — script is isolated |
| Config / settings | `shared` | All others |
| Panel assembly (render-radar.js) | `memory_radar`, `shared` | domain internals |

---

## Domain: `language`

**Purpose:** VS Code language extension surface for `.evs` source files.

**Responsibilities:**
- TextMate grammar tokenization
- Hover documentation (function signatures, memory addresses, enums)
- Auto-completions (keywords, functions, enum members)
- Go-to-definition and find-references
- Document symbols / outline
- Dead-branch decorations
- Bundled Everscript Dark theme, snippets

**Current folder:** `code_highlighter/`
**Target folder:** `language/` (Phase 2)

**Key files:**
- `code_highlighter/language-providers.js` — 39-line facade (entry point)
- `code_highlighter/hover-provider.js` — hover logic
- `code_highlighter/workspace-index.js` — symbol index state
- `code_highlighter/syntaxes/everscript.tmLanguage.json` — grammar (source of truth)

**Public API:** `require('./code_highlighter/language-providers')` → `{activate(ctx)}`

**Allowed deps:** `shared` (radar-utils for hex hover), `vscode`, `fs`, `path`
**Forbidden deps:** `debugger`, `emulator`, `memory_radar/webview/`, `maps`, `rooms`, `scaling`

**Documentation:** `code_highlighter/README.md`
**Requirements:** `docs/vscode-highlighter-spec.md`
**Future Skill:** `.global/skills/language-features.md` (not yet created)

---

## Domain: `memory`

**Purpose:** Memory Radar panel — WRAM address grid and scope analysis.

**Responsibilities:**
- Parse `.github/memory-map.md` into address entries
- Analyze scope references (reads/writes to WRAM addresses)
- Render the WRAM grid tab HTML
- Enum cross-reference (`in/core/**/*.evs` → addr → enum name)
- Arg[] tracking and rendering
- Pool declaration tracking

**Current folder:** `memory_radar/` (core radar files) + `memory_radar/render-memory-tab.js`
**Target folder:** `memory/` (Phase 3)

**Key files:**
- `memory_radar/render-memory-tab.js` — builds WRAM grid HTML
- `memory_radar/radar-utils.js` — pure functions (will move to `shared/`)

**Public API:**
- `radarReadMemoryMap(wsRoot)` → `Map<addr, entry>`
- `radarAnalyzeScope(doc, scope)` → `{refs, pools, argRefs}`
- `buildMemoryTabHtml(mapByAddr, refs, enumMap, scope, argRefs)` → `{html, cellData}`

**Allowed deps:** `shared`, `fs`, `path`
**Forbidden deps:** `rooms`, `scaling`, `debugger`, `emulator`, `vscode` (for pure functions)

**Documentation:** `memory_radar/README.md`
**Requirements:** `.github/copilot-instructions.md` §9 (Memory Radar section)
**Future Skill:** `.global/skills/memory-radar.md` (not yet created)

---

## Domain: `maps`

**Purpose:** ROM map format models and blob analysis.

**Responsibilities:**
- Map blob decoding (tile grid, object list, transition table)
- Multi-iteration evidence accumulation (map-pipeline-model)
- ROM script rendering model (byte script → instruction list)
- Alchemy model

**Current folder:** `memory_radar/models/`
**Target folder:** `maps/` (Phase 4)

**Key files:**
- `memory_radar/models/map-blob-evidence-model.js` — map blob decoder (701 LOC)
- `memory_radar/models/map-pipeline-model.js` — evidence pipeline
- `memory_radar/models/render-script-model.js` — byte script → instructions

**Public API:** `require('./memory_radar/models/...')` — no unified facade yet
**Target public API:** `require('./maps')` → `{MapBlobEvidenceModel, MapPipelineModel, RenderScriptModel}`

**Allowed deps:** `shared/rom-readers`, `fs`, `path`
**Forbidden deps:** `vscode`, `rooms`, `scaling`, `language`, `debugger/emulator`

**Documentation:** `memory_radar/models/` (no README yet — create in Phase 4)
**Requirements:** `docs/map-loading.md`, `docs/map-0x33-analysis.md`, `docs/payload-deep-analysis.md`
**Future Skill:** `.global/skills/map-analysis.md` (not yet created)

---

## Domain: `rooms`

**Purpose:** Rooms tab — collapsible map browser with SVG room preview.

**Responsibilities:**
- Room tree building from workspace `.evs` file structure
- Room content parsing (entrances, enemies, objects, transitions)
- Vanilla room catalog + ROM backing
- Lua watcher POI integration
- Server-side tree HTML + ROOMS JSON rendering
- Client-side SVG grid, entity tables, filter buttons, interactions

**Current folder:** `memory_radar/tabs/map_browser/` (server) + `memory_radar/webview/assets/rooms/` (client)
**Target folder:** `rooms/` (Phase 5)

**Key files:**
- `memory_radar/tabs/map_browser/index.js` — public API
- `memory_radar/tabs/map_browser/parsing/content-parser.js` — room content parsing
- `memory_radar/tabs/map_browser/parsing/file-scanner.js` — tree building
- `memory_radar/tabs/map_browser/data/vanilla-data.js` — vanilla room catalog
- `memory_radar/webview/assets/rooms/detail-renderer.js` — client SVG rendering

**Public API:** `require('./memory_radar/tabs/map_browser')` (via room-tree.js shim)

**Allowed deps:** `shared`, `maps` (for map format data), `fs`, `path`
**Forbidden deps:** `memory` (radar grid), `scaling`, `debugger`, `emulator`, `language`

**Documentation:** `memory_radar/tabs/map_browser/README.md`
**Requirements:** `docs/rooms-map-coordinates.md`, `docs/room-script-parser.md`
**Future Skill:** `.global/skills/rooms-tab.md` (not yet created)

---

## Domain: `scaling`

**Purpose:** Character scaling calculator tab.

**Responsibilities:**
- Character stat data (142 ROM entries: HP, ATK, DEF, hit rates, etc.)
- Hit% lookup table (precomputed from ROM)
- Damage math (vanilla formula + scale_enemies modifier)
- Alchemy damage math
- Client-side scaling chart, character selector, damage table interactions

**Current folder:** `memory_radar/webview/assets/scaling/` (client) + `memory_radar/render-docs-tab.js` (partial server)
**Target folder:** `scaling/` (Phase 6)

**Key files:**
- `memory_radar/webview/assets/scaling/state.js` — client state (characters, filters)
- `memory_radar/webview/assets/scaling/damage-math.js` — damage formula
- `memory_radar/webview/assets/scaling/alchemy-math.js` — alchemy formula
- `memory_radar/webview/assets/scaling/chart.js` — chart rendering

**Public API:** Server-side: `buildScalingTabHtml(chars, hitLookup)` (from render-docs-tab.js)

**Allowed deps:** `shared/rom-readers` (for stat loading), `fs`, `path`
**Forbidden deps:** `rooms`, `memory`, `debugger`, `emulator`, `language`

**Documentation:** No README yet — create in Phase 6
**Requirements:** `docs/scaling-scenarios.md`
**Future Skill:** `.global/skills/scaling-tab.md` (not yet created)

---

## Domain: `route`

**Purpose:** Route planner tab (nascent).

**Responsibilities:**
- Route step sequencing UI
- Map-aware routing
- Export/import of route plans

**Current folder:** `memory_radar/tabs/route/` (empty placeholder)
**Target folder:** `route/` (Phase 6+)

**Allowed deps:** `shared`, `maps`, `rooms`
**Forbidden deps:** `memory`, `scaling`, `debugger`, `emulator`, `language`

**Documentation:** `docs/route-planner.md`
**Future Skill:** `.global/skills/route-planner.md` (not yet created)

---

## Domain: `rng`

**Purpose:** RNG documentation and alchemy docs tab (nascent).

**Responsibilities:**
- RNG documentation rendering
- Alchemy recipe docs
- Alchemy drop odds

**Current folder:** Part of `memory_radar/render-docs-tab.js`
**Target folder:** `rng/` (Phase 6)

**Allowed deps:** `shared`
**Forbidden deps:** `rooms`, `memory`, `debugger`, `emulator`, `language`

**Documentation:** `docs/alchemy-damage.md`
**Future Skill:** `.global/skills/rng-docs.md` (not yet created)

---

## Domain: `debugger`

**Purpose:** Debug Adapter Protocol implementation.

**Responsibilities:**
- DAP wire protocol (VS Code ↔ runtime)
- Script execution orchestration (mock runtime)
- Breakpoint management
- Debug session lifecycle

**Current folder:** `debugger/adapter.js`, `debugger/mock-runtime.js`
**Target folder:** `debugger/` (no move needed)

**Key files:**
- `debugger/adapter.js` — DAP adapter
- `debugger/mock-runtime.js` — script execution orchestrator

**Public API:** VS Code debugger contribution (package.json). Not called directly.

**Allowed deps:** `shared`, `vscode`
**Forbidden deps:** `memory_radar/`, `code_highlighter/`, `emulator/` (IPC only through extension.js)

**Documentation:** `debugger/README.md`
**Requirements:** `debugger/poc-design.md`
**Future Skill:** `.global/skills/debugger.md` (not yet created)

---

## Domain: `emulator`

**Purpose:** SNES emulator panel with WASM integration.

**Responsibilities:**
- Webview panel lifecycle and IPC bridge
- WASM core loading (vanilla + custom snes9x2005)
- ROM header parsing (SNES header model)
- Room script decoding (ROM bytes → instruction model)
- Opcode registry
- Cross-panel byteScriptFocus message relay

**Current folder:** `debugger/emulator/`
**Target folder:** `emulator/` (Phase 7)

**Key files:**
- `debugger/emulator/panel.js` — panel lifecycle + IPC
- `debugger/emulator/panel-webview.js` — HTML template (1007 LOC, indivisible)
- `debugger/emulator/room-script-model.js` — ROM decoder
- `debugger/emulator/snes-rom-header-model.js` — header parser
- `debugger/core/` — WASM submodules

**Public API:** `openEmulatorPanel(extCtx, extConfig)` (called from extension.js)

**Allowed deps:** `shared`, `debugger` (for mock-runtime coordination), `vscode`, `fs`, `path`
**Forbidden deps:** `memory_radar/` rendering, `code_highlighter/`, `rooms/`, `scaling/`

**Documentation:** `debugger/README.md` (until Phase 7 extracts `emulator/README.md`)
**Requirements:** `docs/emulator-integration.md`, `docs/byte-script-debugging.md`
**Future Skill:** `.global/skills/emulator.md` (not yet created)

---

## Domain: `script`

**Purpose:** Standalone Everscript parser and compiler tools. **Fully isolated.**

**Responsibilities:**
- Script AST model (TypeScript)
- ROM script decoding to structured model
- Truth test generation
- Opcode generation

**Current folder:** `script_parser/`
**Target folder:** `script_parser/` (no move — already isolated with own package.json)

**Key files:**
- `script_parser/model/rom-script-model.ts` — AST model
- `script_parser/src/scripts-all-model.ts` — bulk script model
- `script_parser/src/generate-truth-tests.ts` — test generator

**Public API:** None — this is a standalone tool, not required by the extension.

**Allowed deps:** Node.js stdlib, own `dependencies/`
**Forbidden deps:** `extension.js`, `vscode`, any other domain in this repository

**Documentation:** `script_parser/docs/`
**Future Skill:** `.global/skills/script-parser.md` (not yet created)

---

## Domain: `shared`

**Purpose:** Cross-domain pure infrastructure. Zero side effects.

**Responsibilities:**
- Extension config resolution (`settings-model.js`)
- Pure WRAM address/scope parsing (`radar-utils.js`)
- Pure ROM I/O (`rom-readers.js`)
- Shared webview styles and utilities (`shared.css`, `shared.js`)

**Current files:** `settings-model.js`, `memory_radar/radar-utils.js`, `memory_radar/rom-readers.js`
**Target folder:** `shared/` (Phase 1)

**Rules:**
- No `vscode` imports (settings-model reads config shape but has no VS Code runtime dep)
- No mutable state
- No rendering logic
- Zero circular dependencies
- Importable in plain `node` without VS Code host

**Public API:**
- `resolveExtConfig(raw, wsRoot)` → config object
- `radarLifecycle(addr)` → `'temp'|'session'|'sram'|'system'`
- `radarAnalyzeScope(doc, scope)` → `{refs, pools, argRefs}`
- `parseEnumsFromContent(content)` → `Map<addr, [{cls, name}]>`
- `parseEvsNum(s)` → `number|NaN`
- `readRomMapHeader(romPath, mapId)` → header object
- `readCharacterStats(romPath)` → stat array

**Allowed deps:** `fs`, `path`, `node` stdlib only
**Forbidden deps:** `vscode`, any domain module

**Documentation:** (inline JSDoc in each file)
**Future Skill:** N/A — shared is pure infrastructure, no skill needed

---

## Domain: `ui` (Webview Assembly)

**Purpose:** Orchestration layer that assembles per-tab HTML and JS into the radar webview.

**Responsibilities:**
- HTML skeleton + tab chrome (`render-radar.js`)
- JS bundle concatenation order (`webview/index.js`)
- Tab switching (client-side)

**Current folder:** `memory_radar/render-radar.js` + `memory_radar/webview/`
**Target folder:** `memory_radar/` (stays here — it is the panel assembler)

**Note:** This domain does NOT own any tab's content. It assembles tabs into the
panel. Tab content is owned by the respective tab domain.

**Allowed deps:** all tab render functions (memory, rooms, scaling, rng, route), `vscode`
**Forbidden deps:** direct import of tab implementation internals (use public render functions only)

**Documentation:** `memory_radar/README.md`
