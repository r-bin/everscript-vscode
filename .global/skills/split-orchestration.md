---
applyTo: "**"
---

# Skill: Split Orchestration

Use this skill when a god file (like `extension.js`) has absorbed logic that belongs to subsystems, or when a panel file mixes lifecycle, IPC, and rendering.

---

## When to invoke

- A file has 10+ module-level state variables
- A file imports from 5+ different subsystem domains
- A file contains rendering logic AND state management AND command registration
- A "manager" or "panel" file exceeds 500 LOC

---

## Current orchestration hotspots

| File | LOC | God functions |
|---|---|---|
| `extension.js` | 1461 | `renderRadarHtml`, `refreshRadar`, command handlers, panel lifecycle |
| `debugger/emulator/panel.js` | 1448 | `openEmulator`, `_sendRom`, webview HTML assembly, IPC message routing |

---

## Split procedure for `extension.js`

### Phase 1: Extract `renderRadarHtml`

Target: `memory_radar/webview/render-radar.js`
- Takes: `(scope, refs, pools, argRefs, mapByAddr, enumMap, roomTree, activeTab, config)` as explicit params
- Returns: HTML string
- No module-level state access
- Test: can be called standalone

### Phase 2: Extract radar state into a state module

Target: `memory_radar/radar-state.js`
- Owns: `_radarPanel`, `_radarPinned`, `_radarDoc`, `_radarCurrentScope`, caches, timer
- Exports: `getPanel()`, `setPanel(p)`, `isPinned()`, `setPinned(v)`, `getMapCache()`, etc.
- `extension.js` calls state module instead of direct `let` mutation

### Phase 3: Extract `refreshRadar`

Target: `memory_radar/radar-refresh.js`
- Calls: scope detection, memory analysis, HTML render, panel update
- Takes state module as dependency
- `extension.js` just registers watcher → calls `refreshRadar(editor)`

---

## Split procedure for `panel.js`

### Phase 1: Extract panel lifecycle

Target: `panel-lifecycle.js`
- Owns: `openEmulator()`, panel creation, `_panel.onDidDispose`
- Returns panel reference to caller

### Phase 2: Extract IPC bridge

Target: `panel-ipc.js`
- Owns: `_panel.webview.onDidReceiveMessage` handler
- All message routing logic

### Phase 3: Extract webview HTML builder

Target: `panel-html.js`
- Pure function: `(romPath, config) => HTML string`
- Testable standalone

---

## Orchestrator residue rule

After extraction, the orchestrator file should contain ONLY:
- `require()` imports
- Command `vscode.commands.registerCommand(...)` calls
- File watcher setup
- Provider registration
- Thin calls to subsystem functions

No business logic. No rendering logic. No parsing logic.

---

## Change Ritual

1. Bump version (minor for extraction)
2. `/opt/homebrew/bin/npm test`
3. Commit: `v<ver>: [<subsystem>] split <filename> → <new-files>`
4. Install
