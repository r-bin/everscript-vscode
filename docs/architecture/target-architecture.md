# Target Architecture — Everscript VS Code Extension

> Authoritative specification for the long-term architecture.
> Read this before starting any structural work.
> Implementation happens incrementally via the migration plan.

Version: June 2026
Status: Specification (migration in progress)

---

## 1. Architectural Goals

| Goal | Rationale |
|---|---|
| Bounded contexts | AI agents load only the domain relevant to the task |
| Minimal context | Each domain is independently understandable |
| Explicit ownership | Every file has exactly one owner |
| Explicit dependencies | All cross-domain calls go through published APIs |
| Zero hallucination surface | No ambiguous shared state, no implicit coupling |
| Independent testability | Every domain can be tested without activating the full extension |

This repository is developed primarily through AI-assisted sessions. The most expensive
failure mode is an AI agent loading irrelevant code and producing cross-domain side effects.
The architecture is designed to make that physically impossible by enforcing isolation at
the directory level.

---

## 2. Design Principles

### 2.1 Domain Isolation over DRY

Prefer duplication over coupling when a utility is used by only one domain.
Shared code is justified only when used by three or more domains and has zero
side effects.

### 2.2 Orchestration Belongs in `extension.js` Only

`extension.js` is the only file permitted to import from more than one domain.
All cross-domain wiring happens there. Domain modules never import each other directly
except through the dependency rules in §5.

### 2.3 Pure Functions First

Data transformation (parsing, rendering, math) must be pure functions with zero
VS Code dependency. This makes them testable, portable, and safe to share.

### 2.4 One State Owner

Every mutable state has exactly one owner file. No mirrored state.
No two files that both read-and-write the same variable.

### 2.5 File Size Law

| Range | Status |
|---|---|
| 50–150 LOC | Ideal |
| 150–250 LOC | Acceptable |
| 250–400 LOC | Requires justification |
| > 400 LOC | Must split before adding code |

---

## 3. Repository-Level Folder Structure (Target)

```
/
├── extension.js              — Activation + orchestration only (< 200 LOC target)
├── settings-model.js         — Config resolution (shared, pure)
│
├── language/                 — Language features (grammar, hover, completions)
│   ├── providers/            — hover, completion, definition, symbol, dead-branch
│   ├── grammar/              — syntaxes/, tests/
│   ├── themes/
│   ├── snippets/
│   └── workspace-index.js
│
├── memory/                   — Memory Radar: WRAM grid tab
│   ├── radar-utils.js        — Pure scope/address parsing (zero deps)
│   ├── rom-readers.js        — Pure ROM I/O (no VS Code)
│   ├── render-memory-tab.js
│   └── tests/
│
├── maps/                     — Map format models + ROM map analysis
│   ├── models/               — map-blob-evidence, map-pipeline, render-script
│   └── rom/                  — ROM readers specific to map format
│
├── rooms/                    — Rooms tab: map browser UI
│   ├── parsing/
│   ├── rendering/
│   ├── data/                 — vanilla-data, lua-watchers
│   └── webview/              — client-side rooms tab JS
│
├── scaling/                  — Character scaling tab
│   └── webview/              — client-side scaling tab JS
│
├── route/                    — Route planner tab (nascent)
│
├── rng/                      — RNG + alchemy docs tab (nascent)
│
├── debugger/                 — DAP adapter + mock runtime
│   ├── adapter.js
│   ├── mock-runtime.js
│   └── tests/
│
├── emulator/                 — SNES emulator panel
│   ├── panel.js
│   ├── panel-webview.js
│   ├── room-script-model.js
│   ├── snes-rom-header-model.js
│   ├── opcode-registry.js
│   ├── core/                 — WASM builds (submodules)
│   ├── webview/              — client-side emulator JS
│   └── tests/
│
├── script_parser/            — Isolated parser domain (own package.json)
│
└── shared/                   — Cross-domain pure infrastructure
    ├── config.js             — (= settings-model.js)
    └── webview/              — shared.css, shared.js
```

> **Note on current paths:** The migration plan (migration-plan.md) describes how the
> current directory layout evolves into this structure. Until a phase is complete,
> use the current paths. The target layout is a goal, not the present state.

---

## 4. Domain Definitions

### `language` (currently `code_highlighter/`)

The VS Code language extension surface for Everscript source files.

Responsible for:
- TextMate grammar (syntax tokenization)
- Hover documentation
- Auto-completions
- Go-to-definition + find-references
- Document symbols / outline
- Diagnostics / dead-branch decorations
- Bundled color theme + snippets

Does NOT own: ROM parsing, radar state, debugger state, emulator.

---

### `memory` (currently part of `memory_radar/`)

The Memory Radar panel — WRAM address grid and memory-map analysis.

Responsible for:
- Parsing `.github/memory-map.md`
- Analyzing scope references to WRAM addresses
- Rendering the WRAM grid tab HTML
- Enum cross-reference (`in/core/**/*.evs`)
- Pure address parsing utilities

Does NOT own: rooms, scaling, route, rng tabs.

---

### `maps` (currently `memory_radar/models/`)

ROM map format analysis and data models.

Responsible for:
- Map blob decoding (tile/object/transition data)
- Map pipeline model (multi-iteration evidence accumulation)
- ROM script rendering model
- Map ROM header reading

Does NOT own: room browser UI, scaling, language features.

---

### `rooms` (currently `memory_radar/tabs/map_browser/`)

The Rooms tab — collapsible map browser with SVG room preview.

Responsible for:
- Room tree building from `.evs` file structure
- Room content parsing (entrances, enemies, objects, transitions)
- Vanilla room catalog
- Lua watcher POI integration
- Server-side tree + JSON rendering
- Client-side SVG grid, interactions, entity tables

Does NOT own: memory grid, scaling, map blob models.

---

### `scaling` (currently `memory_radar/webview/assets/scaling/`)

Character scaling calculator tab.

Responsible for:
- Character stat data (ROM-derived, 142 entries)
- Hit% lookup table
- Damage math
- Alchemy math
- Client-side scaling chart + interaction

Does NOT own: any other tabs, ROM map parsing.

---

### `route` (currently `memory_radar/tabs/route/` — nascent)

Route planner tab.

Responsible for:
- Route step sequencing
- Map-aware routing suggestions
- Client-side route editor

Depends on: `maps` (for map IDs), `rooms` (for room layout).

---

### `rng` (currently part of `render-docs-tab.js` — nascent)

RNG documentation and alchemy docs tab.

Responsible for:
- RNG documentation rendering
- Alchemy docs rendering

---

### `debugger` (currently `debugger/adapter.js` + `mock-runtime.js`)

Debug Adapter Protocol implementation.

Responsible for:
- DAP wire protocol (VS Code ↔ runtime)
- Script execution orchestration (mock runtime)
- Breakpoint management

Does NOT own: emulator webview, ROM decoding, radar.

---

### `emulator` (currently `debugger/emulator/`)

SNES emulator panel and WASM integration.

Responsible for:
- Webview panel lifecycle + IPC
- WASM core loading (vanilla + custom)
- ROM header parsing
- Room script decoding
- Opcode registry
- Cross-panel message relay to radar

Does NOT own: DAP protocol, language features, radar grid.

---

### `script` (currently `script_parser/`)

Standalone parser and compiler tools. **Fully isolated domain.**

Responsible for:
- Script AST model
- Opcode generation
- Truth test generation

Has its own `package.json`. Never loaded by the VS Code extension at runtime.
AI agents working on parser issues should load ONLY this domain + shared types.

---

### `shared` (currently `settings-model.js` + parts of `memory_radar/`)

Cross-domain pure infrastructure.

Contains:
- `settings-model.js` — Extension config resolution (no VS Code dep)
- `radar-utils.js` — Pure address/scope parsing (zero deps)
- `rom-readers.js` — Pure ROM file I/O (no VS Code dep)
- `shared.css` / `shared.js` — Common webview styles and utilities

Rules:
- No VS Code imports (except `settings-model.js` which reads config shape only)
- No mutable state
- No rendering logic
- Zero circular dependencies

---

## 5. Dependency Rules

### Allowed dependency graph

```
extension.js  →  ALL domains (orchestration only)

language      →  shared
memory        →  shared
maps          →  shared
rooms         →  shared, maps
scaling       →  shared
route         →  shared, maps, rooms
rng           →  shared
debugger      →  shared
emulator      →  shared, debugger
script        →  (none — fully isolated)
shared        →  (none)
```

### Forbidden dependencies

| From | To | Reason |
|---|---|---|
| language | debugger | Language features must work without debugger |
| language | emulator | Language features must work without emulator |
| language | memory | Language may use radar-utils via shared, not memory module |
| memory | rooms | Sibling domains — no direct coupling |
| memory | maps | Memory tab reads ROM via shared rom-readers only |
| debugger | memory | IPC relay only through extension.js |
| debugger | rooms | Separate concerns |
| emulator | memory | IPC relay only through extension.js |
| emulator | rooms | Separate concerns |
| rooms | scaling | Sibling tabs — no coupling |
| scaling | rooms | Sibling tabs — no coupling |
| script | * | Parser is fully isolated — no extension coupling |
| shared | vscode | shared must be importable without VS Code |
| Any domain | webview assets of another domain | Client-side bundles are domain-private |

---

## 6. Shared Infrastructure

### `settings-model.js` (→ `shared/config.js`)

- Pure config resolution — no VS Code at import time
- Only file that knows about extension setting keys
- Used by: language, memory, emulator, debugger

### `memory_radar/radar-utils.js` (→ `shared/radar-utils.js`)

- Pure functions: scope detection, address parsing, enum parsing
- Zero imports — the safest shared file in the codebase
- Used by: memory, rooms, language (hex hover)

### `memory_radar/rom-readers.js` (→ `shared/rom-readers.js`)

- Pure ROM I/O: map headers, character stats, PNG dims
- No VS Code dependency
- Used by: maps, scaling, emulator

### Webview shared assets

- `shared.css` — Common styles (radar panel, tab chrome)
- `shared.js` — Common utilities (tab switching, message handling)
- Loaded by every tab's webview bundle

---

## 7. `extension.js` Contract

`extension.js` is the orchestration root. It:

- Registers all VS Code commands
- Sets up all FileSystemWatchers
- Owns all cross-domain state (radar panel, caches, tab state)
- Is the ONLY file that imports from more than one domain
- Contains NO parsing logic, NO rendering logic, NO ROM reading

Target size: < 200 LOC.
Current size: ~454 LOC (as of v0.5.1). Reduction is ongoing.

Every module-level `let` in `extension.js` is legitimate state that has no
better home — it is the glue, not a dumping ground.

---

## 8. AI Optimization Rationale

### Why domains matter for AI

An AI agent working on the scaling calculator needs exactly:
- `scaling/` (8 files, ~600 LOC total)
- `shared/` (3 files, ~200 LOC)

Without domain isolation it loads:
- `memory_radar/` (20+ files, 3000+ LOC)
- `debugger/` (10+ files, 2000+ LOC)
- `extension.js` (454 LOC)
- etc.

The result is wasted context, irrelevant edits, and hallucinated cross-domain calls.

### How this architecture helps AI

| Problem | Solution |
|---|---|
| Agent loads entire `memory_radar/` for a scaling fix | `scaling/` is a separate domain — load only that |
| Agent modifies `extension.js` when fixing a parser bug | `script/` has no extension.js dependency — agent never touches it |
| Agent creates cross-domain coupling | Dependency rules make violations visible before commit |
| Agent hallucinates shared state between tabs | Each tab owns its own client-side state — no global radar state in tab JS |
| Agent doesn't know which file owns a feature | Every domain has one README that lists ownership explicitly |

### Agent entry points per task

| Task | Load these domains |
|---|---|
| Emulator improvements | `emulator/`, `debugger/`, `shared/` |
| Debugger / DAP | `debugger/`, `shared/` |
| Route editor | `route/`, `maps/`, `shared/` |
| Memory radar / WRAM grid | `memory/`, `shared/` |
| Map browser / rooms | `rooms/`, `maps/`, `shared/` |
| Scaling calculator | `scaling/`, `shared/` |
| Language features | `language/`, `shared/` |
| Parser / compiler | `script/` only |
| RNG / alchemy docs | `rng/`, `shared/` |

---

## 9. Invariants Never to Violate

1. `shared/` has no VS Code imports and no mutable state.
2. `script/` has no `require()` path into the extension tree.
3. No webview asset file uses `require()` — they are concatenated globals.
4. No domain imports another domain's webview assets.
5. Every domain directory contains a `README.md` defining its ownership contract.
6. `extension.js` imports domains but domains never import `extension.js`.
7. Cross-domain IPC (e.g., emulator → radar) routes through `extension.js` message relay only.
