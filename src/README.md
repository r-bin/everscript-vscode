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
| `emulator/` | Embedded SNES emulator: panel, webview, SNES ROM header model |
| `script/` | Everscript bytecode decoder, ported from SoEScriptDumper (TypeScript, pure) |
| `rom/` | ROM tab: every bank's content, gaps and CDL coverage, measured from the ROM |
| `debugger/` | VS Code debugger for .evs scripts in the emulator: DAP session, compiler source map, step logic |
| `localizations/` | Centralized subjective names (maps, sounds, tables, functions) & ROM string resolution |
| `resources/` | Read-only `soe://` file system: ROM, decoded assets and live WRAM as files |
| `mcp/` | Read-only MCP server (127.0.0.1:47917) serving `soe://` to AI clients; `.mcp.json` at the repo root |

Entry point: `extension.js` (orchestration root, registered as `main` in package.json).

## Dependency Rules

- `shared/` → no VS Code API, no domain deps
- `language/` → no debugger, no emulator, no memory UI
- `memory/` → may use `shared/`, `docs/`, `rooms/`, `maps/`, `rom/`
- `rom/` → may use `maps/`; never `emulator/` (the CDL library is injected by `extension.js`)
- `emulator/` → may use `shared/`
- `debugger/` → no memory, no emulator internals (the emulator bridge is injected by `extension.js`)
- `mcp/` → `vscode` only; reads `soe://` through `vscode.workspace.fs`, never another domain
- `resources/` → may use `shared/`, `maps/`, `script/`, `localizations/`; never `emulator/` (ROM and memory reads are injected by `extension.js`)
- No circular dependencies allowed

See `.depcruise.js` for machine-enforced rules.
