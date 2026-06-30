# src/ — Extension Source Root

All production code lives here. Each subdirectory is an ownership domain.

| Domain | Description |
|---|---|
| `shared/` | Cross-domain utilities: config, radar-utils, rom-readers, shared webview assets |
| `language/` | VS Code language features: grammar, theme, hover, completion, definitions, snippets |
| `memory/` | Memory Radar tab: WRAM grid, detail table, rendering pipeline |
| `docs/` | Docs/RNG tab rendering (render-docs-tab.js and webview assets) |
| `scaling/` | Scaling/Alchemy tab: damage math, charts, state, webview assets |
| `maps/` | ROM map models: pipeline, blob evidence, render-script, alchemy |
| `rooms/` | Rooms map browser: tree building, content parsing, rendering, data watchers |
| `routes/` | Route planner tab webview assets |
| `emulator/` | Embedded SNES emulator: panel, webview, room-script-model, opcode-registry |
| `debugger/` | VS Code debug adapter (DAP): adapter.js + mock-runtime.js |

Entry point: `extension.js` (orchestration root, registered as `main` in package.json).

## Dependency Rules

- `shared/` → no VS Code API, no domain deps
- `language/` → no debugger, no emulator, no memory UI
- `memory/` → may use `shared/`, `docs/`, `rooms/`, `maps/`
- `emulator/` → may use `shared/`
- `debugger/` → no memory, no emulator internals
- No circular dependencies allowed

See `.depcruise.js` for machine-enforced rules.
