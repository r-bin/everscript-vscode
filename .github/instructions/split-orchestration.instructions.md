---
name: split-orchestration
description: Use when a god file (src/extension.js) has absorbed logic that belongs to a domain, or when a panel file in everscript-vscode mixes lifecycle, IPC, and rendering. Covers decomposing orchestration files into lifecycle/IPC/HTML-builder pieces.
applyTo: "src/extension.js,src/emulator/panel.js,src/memory/render-radar.js"
---

# Skill: Split Orchestration

Use this skill when a god file (`src/extension.js`) has absorbed logic that belongs to a
domain, or when a panel file mixes lifecycle, IPC, and rendering.

---

## When to invoke

- A file has 10+ module-level state variables
- A file imports from 5+ different domains under `src/`
- A file contains rendering logic AND state management AND command registration
- A "manager" or "panel" file exceeds 500 LOC

---

## Split procedure for `src/extension.js`

### Phase 1: Extract HTML rendering

Rendering belongs in the owning tab's domain (e.g. `src/memory/render-radar.js`,
already extracted) — takes explicit params (`scope, refs, pools, argRefs, mapByAddr,
enumMap, roomTree, activeTab, config`), returns an HTML string, no module-level state
access. Must be callable standalone.

### Phase 2: Extract state into a state module

Target: a `<domain>/state.js` (or similar) that owns panel/cache/timer state and
exports `getPanel()`, `setPanel(p)`, `isPinned()`, `setPinned(v)`, `getMapCache()`, etc.
`src/extension.js` calls the state module instead of direct `let` mutation.

### Phase 3: Extract refresh/orchestration logic

A `<domain>/refresh.js` that calls scope detection, analysis, render, and panel update,
taking the state module as a dependency. `src/extension.js` just registers the watcher
and calls `refresh(editor)`.

---

## Split procedure for a panel file (e.g. `src/emulator/panel.js`)

### Phase 1: Extract panel lifecycle

Owns `openXPanel()`, panel creation, `_panel.onDidDispose`. Returns the panel reference
to the caller.

### Phase 2: Extract the IPC bridge

Owns `_panel.webview.onDidReceiveMessage` and all message routing logic.

### Phase 3: Extract the webview HTML builder

Pure function `(romPath, config) => HTML string` — see `src/emulator/panel-webview.js`
for a large-but-justified example (single indivisible HTML template). Testable
standalone.

---

## Orchestrator residue rule

After extraction, the orchestrator file should contain ONLY:
- `require()` imports
- `vscode.commands.registerCommand(...)` calls
- File watcher setup
- Provider registration
- Thin calls to domain functions

No business logic. No rendering logic. No parsing logic.

---

## After any split

Run the `release-ritual` skill (version bump — minor for extraction, `npm test`, commit
as `v<ver>: [<domain>] split <filename> → <new-files>`, `npm run deploy`).
