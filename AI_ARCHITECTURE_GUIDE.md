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

Each subsystem (`debugger/`, `radar/`, `language/`, `rom/`) must be:
- independently understandable from its own files
- independently testable without full extension startup
- minimally coupled to other subsystems

Cross-subsystem coupling rules:
- `debugger` may NOT directly call `radar` rendering
- `radar` may read ROM via `rom-readers` but not call debugger
- `language` may NOT call radar or debugger
- `rom` has no VS Code dependency

### 2.5 Anti-Abstraction

Prefer **duplication over coupling** for utilities used by only one subsystem.

Forbidden patterns:
- giant shared helpers
- giant utils.js / common.js
- abstraction pyramids (helpers-of-helpers)
- dependency injection systems
- registries

Allowed shared code: `radar-utils.js` (pure functions, no state), `settings-model.js` (config).

---

## 3. Ownership Domains

### `extension.js`
- Activation only: command registration, watcher setup, panel lifecycle
- Must NOT contain rendering logic, parsing logic, or model logic
- Target: < 300 LOC (currently 878 after v0.5.0 extraction — continue reducing)

### `debugger/`
- Owns: emulator lifecycle, DAP adapter, mock runtime, room-script model
- Does NOT own: radar rendering, language features, ROM graphics

### `memory_radar/`  (→ future `radar/`)
- Owns: radar panel, all tab rendering, rooms tab, memory map parsing
- Sub-owns by tab: memory/, rooms/, scaling/, docs/route/rng/

### `code_highlighter/`  (→ future `language/`)
- Owns: grammar, hover, completions, diagnostics, symbols
- Does NOT own: ROM parsing, radar state

### `rom/` (currently split across `memory_radar/rom-readers.js` + `debugger/emulator/`)
- Owns: all ROM byte reading, map headers, character stats, decompression
- Has ZERO VS Code dependencies
- Has ZERO rendering dependencies

---

## 4. Local Reasoning Principle

Each directory must be understandable from its own files without reading parent directories.

This means:
- Every subsystem directory gets a `README.md`
- `README.md` defines: ownership, allowed dependencies, state owned, key invariants
- No "see extension.js for details" — if extension.js owns it, move it or document the invariant locally

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
- Per-subsystem `README.md` — local ownership contracts
- `.global/skills/` — reusable architectural operation prompts
- File size limits — enforced by commit review

---

## 6. Anti-Entropy Checklist (run before every commit)

- [ ] No file exceeds 400 LOC without documented justification
- [ ] No new state variable added to `extension.js` (use subsystem modules)
- [ ] No new cross-subsystem require() added (check direction)
- [ ] Every new directory has a `README.md` or is trivially named
- [ ] `npm run typecheck` passes
- [ ] `npm run check:circular` passes (no circular deps)
- [ ] `npm run check:dead` passes (no unused files)
- [ ] `npm run check:deps` passes (no domain boundary violations — warn level)
- [ ] Tests pass: `npm test`
- [ ] Version bumped in `package.json`

---

## 7. Current Entropy Hotspots (as of v0.5.1)

| File | LOC | Status |
|---|---|---|
| `debugger/emulator/panel-webview.js` | 1007 | HTML template — single indivisible function, justified |
| `extension.js` | 454 | Continue reducing; extract command handlers |
| `debugger/emulator/panel.js` | 454 | Reduced from 1448; lifecycle + IPC only |
| `memory_radar/models/map-blob-evidence-model.js` | 701 | Large but single-purpose |
| `debugger/emulator/room-script-model.js` | 666 | ROM decoding — split candidate |
| `memory_radar/render-memory-tab.js` | 300 | Single-purpose tab renderer — acceptable |

### Completed decompositions (v0.5.0–v0.5.1):
- ✅ `renderRadarHtml` (593 LOC) → `memory_radar/render-radar.js` + `render-memory-tab.js` + `render-docs-tab.js`
- ✅ `code_highlighter/language-providers.js` (559 LOC) → 39-line facade + 6 focused modules
- ✅ `memory_radar/webview/assets/scaling-tab.js` (638 LOC) → `assets/scaling/` (8 files)
- ✅ `debugger/emulator/panel.js` (1448 LOC) → `panel.js` (454) + `panel-webview.js` (1007 HTML template)
- ✅ Deleted dead: `assets/scaling-tab.js`, `memory_radar/room-tree-new.js`

### Priority migration order:
1. Continue reducing `extension.js` below 300 LOC (extract radar command handler)
2. Split `debugger/emulator/room-script-model.js` → ROM decode + model
3. Migrate `radar-utils.js` → TypeScript (good TS candidate: pure functions)

---

## 8. The Change Ritual (mandatory)

1. Bump version in `package.json` (patch/minor/major)
2. Run validation: `npm run typecheck && npm run check:circular && npm run check:dead`
3. Run tests: `/opt/homebrew/bin/npm test`
4. Commit to `develop` with `v<ver>: [<subsystem>] <description>`
5. Install: `rsync -a --delete --exclude='.git' /Users/v/Documents/GitHub/everscript-vscode/ ~/.vscode/extensions/everscript-$(ver)/`
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
