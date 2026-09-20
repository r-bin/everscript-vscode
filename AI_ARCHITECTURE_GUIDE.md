# AI Architecture Guide — Everscript VS Code Extension

> This file is a cognitive anchor for AI sessions.
> Read it before modifying any subsystem.
> It defines laws, not suggestions.

---

## 1. Repository Mission

Make Everscript code more readable in VS Code.
Every change must serve: better token differentiation, more information on hover/completion/diagnostics, or better developer tooling.

---

## 2. Architectural Laws

### 2.1 File Size

| Range      | Status      |
|------------|-------------|
| 50–150 LOC | Ideal       |
| 150–250    | Acceptable  |
| 250–400    | Justified   |
| > 400      | MUST split  |

### 2.2 One Owner Per State

Every important state has **one owner file**. Never two files that both mutate the same state. No mirrored state. No implicit synchronization.

State that must have a single owner:
- viewport dimensions
- zoom scale
- selection state
- filter state
- emulator runtime state
- radar panel lifecycle
- room tree cache
- memory map cache
- enum cache
- extension config

### 2.3 Directional Dependencies

```
parser → model → renderer → UI
         ↓
       rom-readers (read-only)
```

Forbidden directions:
- renderer → parser
- UI → model mutation (except via explicit action files)
- rom-readers → UI
- rom-readers → extension state

### 2.4 Subsystem Isolation

Each domain under `src/` (`debugger/`, `emulator/`, `memory/`, `rooms/`, `language/`,
`shared/`, ...) must be:
- independently understandable from its own files
- independently testable without full extension startup
- minimally coupled to other domains

Cross-domain coupling rules (enforced by `.depcruise.js` / `npm run check:deps` — see
`docs/architecture/domain-overview.md` for the full table):
- `debugger` may NOT directly call `memory`/`rooms` rendering
- `memory`/`rooms` may read ROM via `shared/rom-readers` but not call `debugger`
- `language` may NOT call `memory`, `rooms`, `debugger`, or `emulator`
- `shared` has no VS Code dependency and no dependency on any other domain

### 2.5 Anti-Abstraction

Prefer **duplication over coupling** for utilities used by only one subsystem.

Forbidden patterns:
- giant shared helpers
- giant utils.js / common.js
- abstraction pyramids (helpers-of-helpers)
- dependency injection systems
- registries

Allowed shared code: `src/shared/radar-utils.js` (pure functions, no state),
`src/shared/config.js` (config resolution).

---

## 3. Ownership Domains

Since v0.6.0, all production code lives under `src/`, one directory per domain. See
`docs/architecture/domain-overview.md` for the full per-domain "Allowed deps" /
"Forbidden deps" table (that doc's "Current folder" / "Target folder" language predates
the actual move — trust the directory names below and on disk, not its phase numbers).

### `src/extension.js`
- Activation only: command registration, watcher setup, panel lifecycle
- Must NOT contain rendering logic, parsing logic, or model logic
- Target: < 300 LOC — continue reducing

### `src/debugger/`
- Owns: DAP adapter, mock runtime
- Does NOT own: radar rendering, language features, ROM graphics, the emulator panel

### `src/emulator/`
- Owns: SNES emulator panel lifecycle, WASM core loading, ROM header model,
  room-script decoding, opcode registry
- Does NOT own: radar rendering, language features

### `src/memory/` + `src/rooms/`  (formerly `memory_radar/`)
- `src/memory/` owns: radar panel assembly, WRAM grid tab rendering
- `src/rooms/` owns: rooms/map-browser tab (tree building, parsing, rendering, data)
- `src/docs/`, `src/scaling/`, `src/routes/` own the docs/RNG, scaling, and route tabs
  respectively

### `src/language/`  (formerly `code_highlighter/`)
- Owns: grammar, hover, completions, diagnostics, symbols
- Does NOT own: ROM parsing, radar state

### `src/maps/` + `src/shared/`  (formerly parts of `memory_radar/`)
- `src/maps/` owns: ROM map/blob evidence models, map pipeline, script rendering model.
  **Being retired**, not extended: its sentinel-based tilemap decoder is an
  independent, weaker re-derivation of ROM map decoding that the sibling `everscript`
  repo already solves byte-exactly for all 127 rooms. See the `map-format` skill
  before adding new heuristics here.
- `src/shared/` owns: all ROM byte reading (`rom-readers.js`), config resolution
  (`config.js` — including `everscript.repoPath`/`romPath`/`pythonPath`, reused by any
  future map-server bridge), `radar-utils.js` — has ZERO VS Code dependencies, ZERO
  rendering dependencies

### `src/map-editor/`  (PLANNED — does not exist yet)
- Will own: a bridge (spawned process, transport TBD) into the sibling `everscript`
  repo's verified Python map/room decoder (`tools/dump_room.py`, `encode_room.py`,
  `collision.py`, `cuttable_grass.py`, `render_map.py`), plus whatever map-editor UI is
  built on top of it.
- Dependency direction is fixed even though transport/packaging isn't decided yet: this
  extension depends on the compiler/map-server, **never the reverse**.
- Do not create this domain, or write code assuming it exists, without first reading
  the `map-format` skill and the planning docs it points to in the `everscript` repo.

---

## 4. Local Reasoning Principle

Each directory must be understandable from its own files without reading parent directories.

This means:
- Every domain directory under `src/` gets a `README.md`
- `README.md` defines: ownership, allowed dependencies, state owned, key invariants
- No "see extension.js for details" — if `src/extension.js` owns it, move it or
  document the invariant locally

---

## 5. Cognitive Stabilization Doctrine

AI sessions degrade when:
- files are too large to hold in context
- ownership is ambiguous
- state flows are implicit
- rendering logic and state mutation coexist
- the same concept appears in 3+ files

Counter-measures:
- `AI_ARCHITECTURE_GUIDE.md` — laws (this file)
- `STATE_FLOW.md` — authoritative state flow map
- Per-domain `src/<domain>/README.md` — local ownership contracts
- `.github/instructions/`, `.claude/skills/`, and `GEMINI.md` imports — reusable
  architectural operation skills (`compress-architecture`, `isolate-subsystem`,
  `stabilize-state-flow`, `split-orchestration`)
- File size limits — enforced by commit review

---

## 6. Anti-Entropy Checklist (run before every commit)

- [ ] No file exceeds 400 LOC without documented justification
- [ ] No new state variable added to `src/extension.js` (use domain modules under `src/`)
- [ ] No new cross-domain require() added (check direction against `docs/architecture/domain-overview.md`)
- [ ] Every new directory has a `README.md` or is trivially named
- [ ] `npm run typecheck` passes
- [ ] `npm run check:circular` passes (no circular deps)
- [ ] `npm run check:dead` passes (no unused files)
- [ ] `npm run check:deps` passes (no domain boundary violations — warn level)
- [ ] Tests pass: `npm test`
- [ ] Version bumped in `package.json`

---

## 7. Current Entropy Hotspots (as of v0.5.1)

> Historical snapshot — paths below predate the v0.6.0 `src/` refactor (see
> `CHANGELOG.md` for the rename map, e.g. `memory_radar/` → `src/memory/` +
> `src/rooms/` + `src/maps/`, `code_highlighter/` → `src/language/`,
> `debugger/emulator/` → `src/emulator/`). Kept as-is for historical LOC records; do
> not use these paths for navigation.

| File | LOC | Status |
|---|---|---|
| `debugger/emulator/panel-webview.js` | 1007 | HTML template — single indivisible function, justified |
| `extension.js` | 454 | Continue reducing; extract command handlers |
| `debugger/emulator/panel.js` | 454 | Reduced from 1448; lifecycle + IPC only |
| `memory_radar/models/map-blob-evidence-model.js` | 701 | Large but single-purpose |
| `memory_radar/render-memory-tab.js` | 300 | Single-purpose tab renderer — acceptable |

### Completed decompositions (v0.5.0–v0.5.1):
- ✅ `renderRadarHtml` (593 LOC) → `memory_radar/render-radar.js` + `render-memory-tab.js` + `render-docs-tab.js`
- ✅ `code_highlighter/language-providers.js` (559 LOC) → 39-line facade + 6 focused modules
- ✅ `memory_radar/webview/assets/scaling-tab.js` (638 LOC) → `assets/scaling/` (8 files)
- ✅ `debugger/emulator/panel.js` (1448 LOC) → `panel.js` (454) + `panel-webview.js` (1007 HTML template)
- ✅ Deleted dead: `assets/scaling-tab.js`, `memory_radar/room-tree-new.js`
- ✅ v0.17.0: `emulator/room-script-model.js` + `opcode-registry.js` (1261 LOC) replaced by the ported `src/script/` domain

### Priority migration order:
1. Continue reducing `extension.js` below 300 LOC (extract radar command handler)
2. Migrate `radar-utils.js` → TypeScript (good TS candidate: pure functions)

---

## 8. The Change Ritual (mandatory)

1. Bump version in `package.json` (patch/minor/major)
2. Run validation: `npm run typecheck && npm run check:circular && npm run check:dead`
3. Run tests: `/opt/homebrew/bin/npm test`
4. Commit to `develop` with `v<ver>: [<domain>] <description>`
5. Install: `npm run deploy` (packages a `.vsix` via `vsce` and installs it with
   `code --install-extension --force`) — do not use the old `rsync`-to-
   `~/.vscode/extensions/` method
6. Tell user to reload VS Code

**One prompt = one commit.**

---

## 10. Architecture Specification Documents

The following documents define the long-term target architecture:

| Document | Purpose |
|---|---|
| `docs/architecture/target-architecture.md` | Authoritative architecture spec: goals, domains, ownership, dependencies |
| `docs/architecture/domain-overview.md` | Navigation guide — which domains to load for each task |
| `docs/architecture/migration-plan.md` | Phased migration roadmap (current state → target) |
| `docs/architecture/dependency-rules.md` | Dependency-cruiser rule motivations and graduation schedule |
| `.depcruise.js` | Machine-readable dependency rules (run via `npm run check:deps`) |

**Read `docs/architecture/domain-overview.md` first** when starting any session.
It tells you which files to load and which to ignore.

| Script | Tool | Purpose | Blocks release? |
|---|---|---|---|
| `npm run typecheck` | tsc | Type checking (noEmit) | Yes |
| `npm run check:circular` | madge | Circular dependency scan | Yes |
| `npm run check:dead` | knip | Unused files/exports | Yes (files only) |
| `npm test` | custom | Full test suite | Yes |

Config: `tsconfig.json` (excludes webview assets), `knip.json` (ignores runtime-loaded assets).
