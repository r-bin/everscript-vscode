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
- Target: < 300 LOC (currently 1461 — major reduction target)

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
- [ ] Tests pass: `npm test`
- [ ] Version bumped in `package.json`

---

## 7. Current Entropy Hotspots (as of v0.4.0)

| File | LOC | Problem |
|---|---|---|
| `extension.js` | 1461 | God file — owns radar state, rendering, all command dispatch |
| `debugger/emulator/panel.js` | 1448 | Mixed UI + emulator lifecycle + IPC |
| `memory_radar/webview/assets/rooms-tab.js` | 746 | Pre-decomp remnant (superseded by rooms/) |
| `memory_radar/models/map-blob-evidence-model.js` | 701 | Large but single-purpose |
| `debugger/emulator/room-script-model.js` | 666 | ROM decoding — split candidate |
| `memory_radar/webview/assets/scaling-tab.js` | 638 | Scaling tab needs split |
| `code_highlighter/language-providers.js` | 559 | Mixed hover/completion/diagnostics |

### Priority migration order:
1. Extract `renderRadarHtml` from `extension.js` → `radar/rendering/`
2. Split `debugger/emulator/panel.js` → `panel-lifecycle.js` + `panel-ipc.js` + `panel-webview.js`
3. Split `code_highlighter/language-providers.js` → per-feature files
4. Split `memory_radar/webview/assets/scaling-tab.js` → scaling/
5. Delete `memory_radar/webview/assets/rooms-tab.js` (superseded)

---

## 8. The Change Ritual (mandatory)

1. Bump version in `package.json` (patch/minor/major)
2. Run tests: `/opt/homebrew/bin/npm test`
3. Commit to `develop` with `v<ver>: [<subsystem>] <description>`
4. Install: `rsync -a --delete --exclude='.git' /Users/v/Documents/GitHub/everscript-vscode/ ~/.vscode/extensions/everscript-$(ver)/`
5. Tell user to reload VS Code

**One prompt = one commit.**
