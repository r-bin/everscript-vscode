# src/ — Extension Source Root

All production code lives here. Each subdirectory is an ownership domain.

| Domain | Description |
|---|---|
| `platform/` | Game-neutral: ROM header and identification, the ROM library, the game registry (`docs/architecture/multi-game.md`) |
| `core/` | Game-neutral features: Switch ROM, the ROM panel, the status bar item |
| `shared/` | Cross-domain utilities: config, radar-utils, rom-readers, shared webview assets |
| `emulator/` | Embedded SNES emulator: panel, webview, SNES ROM header model; profiles (Everscript / recorder) and Evermore gating; recording bundles |
| `recorder/` | SNES CDL Recorder: the second extension's entry (`recorder/package.json`), the emulator in its recorder profile |
| `mcp/` | Read-only MCP server (127.0.0.1:47917) serving `soe://` to AI clients (Claude Code, Antigravity, Copilot, any MCP client) |
| `memory/` | Memory Radar tab: WRAM grid, detail table, rendering pipeline |
| `rooms/` | Rooms map browser: tree building, content parsing, rendering, data watchers |
| `docs/` | Docs/RNG tab rendering (render-docs-tab.js and webview assets) |
| `games/` | One folder per game; `games/index.ts` is the list of games (→ `dist/games`) |
| `games/evermore/language/` | VS Code language features: grammar, theme, hover, completion, definitions, snippets |
| `games/evermore/localizations/` | Centralized subjective names (maps, sounds, tables, functions) & ROM string resolution |
| `games/evermore/maps/` | ROM map models: pipeline, blob evidence, render-script, alchemy |
| `games/evermore/script/` | Everscript bytecode decoder (TypeScript, pure); re-done from the game in cleanup step 2 |
| `games/evermore/simulation/` | Runs scripts symbolically: loot cases, room scenarios + flag tree, NPC tracking, clusters, byte-identical Everscript (TypeScript, pure) |
| `games/evermore/resources/` | Read-only `soe://` file system: ROM, decoded assets and live WRAM as files |
| `games/evermore/rom/` | ROM tab: every bank's content, gaps and CDL coverage, measured from the ROM |
| `games/evermore/sprites/` | Sprites tab and the character pictures: frames, animations, projectiles, palettes (from `maps/` sprites + character record) |
| `games/evermore/scripts-tab/` | Scripts tab: Everscript (room scripts + map, simulation toggle, clusters), animation and alchemy scripts with their animation, music sequences with a silent player |
| `games/evermore/music/` | Music tab: the sound chip live from the emulator or playing a track in its own engine; voices, instruments, sound effects, ARAM |
| `games/evermore/scaling/` | Scaling/Alchemy tab: damage math, charts, state, webview assets |
| `games/evermore/debugger/` | VS Code debugger for .evs scripts in the emulator: DAP session, compiler source map, step logic |
| `games/evermore/imports/mana/` | The one bridge: a Mana map converted into a real Evermore room (cells, graphics, families, collision, step-on boxes) for the Rooms tab |
| `games/mana/decoder/` | Secret of Mana maps: header, pieces, metatiles, characters, palettes, Mode 1 picture, areas (TypeScript, pure; nothing Evermore) |
| `games/mana/resources/` | Read-only `som://` file system: Secret of Mana maps and areas as files |
| `games/mana/maps/` | Secret of Mana Maps panel: area list and map pictures, read from `som://` |

Entry point: `extension.js` (orchestration root, registered as `main` in package.json).

## Dependency Rules

- `shared/` → no VS Code API, no domain deps
Below, `language/`, `maps/`, … without a prefix are under `games/evermore/`.

- `language/` → no debugger, no emulator, no memory UI
- `memory/` → may use `shared/`, `docs/`, `rooms/`, `maps/`, `rom/`
- `rom/` → may use `maps/`; never `emulator/` (the CDL library is injected by `extension.js`)
- `scripts-tab/` → libraries only (`script/`, `maps/`, `localizations/`, `simulation/`); sprites and music capabilities are injected by `extension.js`
- `music/` → may use `localizations/`; never `emulator/` (the sound-chip stream is injected by `extension.js`)
- `recorder/` → only `emulator/`; nothing imports it
- `emulator/` → may use `shared/`
- `debugger/` → no memory, no emulator internals (the emulator bridge is injected by `extension.js`)
- `mcp/` → `vscode` only; reads `soe://` through `vscode.workspace.fs`, never another domain
- `simulation/` → `script/` only, injected through its `index.js`
- `resources/` → may use `shared/`, `maps/`, `script/`, `simulation/`, `localizations/`; never `emulator/` (ROM and memory reads are injected by `extension.js`)
- `platform/` → no `core/`, no game; `core/` → `platform/` only; a game never imports another game except through `games/<game>/imports/<other>/`
- `games/mana/decoder/` → nothing in `src/`; `games/mana/resources/` → the decoder only; `games/mana/maps/` → `som://` only; `games/evermore/imports/mana/` → the Mana decoder, Evermore `maps/`, `shared/`; no Evermore domain uses any of them (only `extension.js` wires them)
- No circular dependencies allowed

See `.depcruise.js` for machine-enforced rules.
