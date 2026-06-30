# debugger/ — Subsystem README

## Ownership

Owns: DAP adapter, mock runtime, emulator panel lifecycle, SNES ROM header model, room-script decoder.

Does NOT own: radar rendering, memory-map display, language features, token grammar.

---

## Directory Map

```
debugger/
  adapter.js              — DAP protocol adapter (VS Code ↔ runtime)
  mock-runtime.js         — Script execution orchestrator
  emulator/
    panel.js              — Webview panel lifecycle + emulator IPC bridge  ← LARGE (1448 LOC)
    room-script-model.js  — ROM script decoder (ROM bytes → instruction model)
    snes-rom-header-model.js — SNES ROM header parser
  core/
    snes9x2005-wasm/           — Vanilla SNES core (WASM build, git submodule)
    snes9x2005-wasm-vanilla/   — Custom SNES core (WASM build, git submodule)
  tests/
    debugger.test.js
    emulator-health.test.js
    emulator-runtime.test.js
    room-script-model.test.js
    snes-rom-header-model.test.js
    settings-model.test.js
```

---

## State Owned

| State | Location | Notes |
|---|---|---|
| Panel webview reference | `panel.js` module-local | Singleton |
| Current ROM path | `panel.js` local | Set on panel open |
| Core selection (vanilla/custom) | `panel.js` local | |
| Script execution cursor | `mock-runtime.js` | Per-debug-session |

---

## Allowed Dependencies

```
adapter.js            → mock-runtime.js, vscode
mock-runtime.js       → (pure logic)
panel.js              → room-script-model.js, snes-rom-header-model.js, vscode
room-script-model.js  → fs, path (pure I/O)
snes-rom-header-model.js → fs (pure I/O)
```

**Forbidden:**
- `debugger/` → `memory_radar/` rendering
- `debugger/` → `code_highlighter/`
- Direct radar state mutation — use IPC relay through `extension.js`

---

## Key Invariants

1. `panel.js` sends ROM once from the `ready` handler — no retry protocol.
2. `room-script-model.js` is pure: ROM path + trigger offsets → decoded instruction arrays.
3. WASM cores live in `debugger/core/` — do not copy them elsewhere.
4. `adapter.js` speaks raw DAP — no VS Code UI calls directly.

---

## Entropy Hotspots

- `panel.js` (1448 LOC) — mixes lifecycle, IPC, webview HTML. Split target: `panel-lifecycle.js` + `panel-ipc.js` + `panel-html.js`.
- `room-script-model.js` (666 LOC) — large but single-purpose. Split only if second responsibility appears.

Clone/update commands:

```bash
git submodule update --init --recursive
git submodule update --remote --recursive
```

Submodule branch workflow for VS Code debugger work:

```bash
cd debugger/core/snes9x2005-wasm
git checkout feature/vscode-debugger-integration
```

Full integration notes (including tmp migration and architecture layout):

- `docs/snes9x_integration.md`

## Future Scope

Potential features to explore:
- Bytecode step-through and breakpoints
- Memory watchpoints and conditional halts
- Script call stack inspection
- Frame-by-frame execution control
