# src/ — Extension Source Root

All production code lives here. Each subdirectory is an ownership domain.

| Domain | Description |
|---|---|
| `platform/` | Game-neutral: ROM header and identification, the ROM library, the game registry (`docs/architecture/multi-game.md`) |
| `core/` | Game-neutral features: `webview/shared.css` + `shared-map-editor.css` + `shared-tabs.css` (the page base of the radar and the Mana Maps page); Switch ROM, the ROM panel, the status bar item; `map-editor/` (view, core, shell of both games' editors); `mcp/` (read-only MCP server, 127.0.0.1:47917, for AI clients); `emulator/` (the embedded SNES emulator: panel, page, cores, profiles Everscript / recorder; a game hands in its part) |
| `games/` | One folder per game; `games/index.ts` is the list of games (→ `dist/games`) |
| `games/evermore/` (files) | `rom-readers.ts` (ROM reads for rooms, characters, stats), `radar-utils.ts` (Everscript parsing for the radar), the descriptor and derived-ROM marker |
| `games/evermore/memory/` | Memory Radar tab: WRAM grid, detail table, rendering pipeline |
| `games/evermore/rooms/` | Rooms map browser: tree building, content parsing, rendering, data watchers |
| `games/evermore/language/` | VS Code language features: grammar, theme, hover, completion, definitions, snippets |
| `games/evermore/localizations/` | Centralized subjective names (maps, sounds, tables, functions) & ROM string resolution |
| `games/evermore/maps/` | ROM map models: pipeline, blob evidence, render-script, alchemy |
| `games/evermore/script-model/` | Rooms' scripts as the editor shows them, on script-vm: listings, loot, doors, spawns, arrivals; the kept names (`names.json`, D4) |
| `games/evermore/script-vm/` | The script decoder written from the game's interpreter: opcodes, expressions, packed pointers, the tables that name scripts (TypeScript, pure) |
| `games/evermore/simulation/` | Runs scripts symbolically: loot cases, room scenarios + flag tree, NPC tracking, clusters, byte-identical Everscript (TypeScript, pure) |
| `games/evermore/resources/` | Read-only `soe://` file system: ROM, decoded assets and live WRAM as files |
| `games/evermore/rom/` | ROM tab: every bank's content, gaps and CDL coverage, measured from the ROM |
| `games/evermore/sprites/` | Sprites tab and the character pictures: frames, animations, projectiles, palettes (from `maps/` sprites + character record) |
| `games/evermore/scripts-tab/` | Scripts tab: Everscript (room scripts + map, simulation toggle, clusters), Maps (a room blob section by section, each part drawn), animation scripts with their animation, music sequences with a silent player |
| `games/evermore/data-tab/` | Data tab: ROM tables (XP per level, sine, boomerang orbit, every known table), every core enum and the character/map blobs, sprite palettes and map tile families |
| `games/evermore/music/` | Music tab: the sound chip live from the emulator or playing a track in its own engine; voices, instruments, sound effects, ARAM |
| `games/evermore/docs-tab/` | The radar's Docs and RNG tabs (alchemy reference, RNG) |
| `games/evermore/routes/` | Routes tab: route files (`*.route.json`) as runs of steps per room, checked against the room scripts |
| `games/evermore/scaling/` | Scaling/Alchemy tab: damage math, charts, state, webview assets |
| `games/evermore/debugger/` | VS Code debugger for .evs scripts in the emulator: DAP session, compiler source map, step logic |
| `games/evermore/imports/mana/` | The one bridge: a Mana map converted into a real Evermore room (cells, graphics, families, collision, step-on boxes) for the Rooms tab |
| `games/mana/decoder/` | Secret of Mana maps: header, pieces, metatiles, characters, palettes, Mode 1 picture, areas (TypeScript, pure; nothing Evermore) |
| `games/mana/resources/` | Read-only `som://` file system: Secret of Mana maps and areas as files |
| `games/mana/maps/` | Secret of Mana Maps panel: area list and map pictures, read from `som://` |
| `games/terra/decoder/` | Terranigma rooms: the room table, the game's room loader run on `platform/snes/cpu65816.ts`, layers, metatiles, picture, catalog (TypeScript, pure) |
| `games/terra/resources/` | Read-only `terra://` file system: Terranigma rooms as files |
| `games/terra/maps/` | Terranigma Maps panel on the shared editor shell, read from `terra://` |

Entry point: `extension.js` (composition root, registered as `main` in package.json): the game-neutral layers, then
the one list of games, each with its own `games/<game>/extension.js`. Evermore's wiring (commands, injection) is
`games/evermore/extension.js`.

## Dependency Rules

Below, `language/`, `maps/`, … without a prefix are under `games/evermore/`.

- `language/` → no debugger, no emulator, no memory UI
- `memory/` → may use `docs-tab/`, `rooms/`, `maps/`, `rom/`, `core/map-editor/`, `core/webview/`
- `rom/` → may use `maps/`; never `emulator/` (the CDL library is injected by `games/evermore/extension.js`)
- `scripts-tab/` → libraries only (`script-model/`, `maps/`, `localizations/`, `simulation/`); sprites and music capabilities are injected by `games/evermore/extension.js`
- `data-tab/` → libraries only (`maps/`, `localizations/`, the language data file); the character list is injected by `games/evermore/radar-open.js`
- `routes/` → libraries only (`script-model/`, `localizations/`)
- `music/` → may use `localizations/`; never `emulator/` (the sound-chip stream is injected by `games/evermore/extension.js`)
- `recorder/` → only `core/emulator/`; nothing imports it
- `core/emulator/` → `platform/` only; no game (`emulator-knows-no-game`); a game hands in its part
- `debugger/` → no memory, no emulator internals (the emulator bridge is injected by `games/evermore/extension.js`)
- `core/mcp/` → `vscode` only; reads `soe://` through `vscode.workspace.fs`, never another domain
- `simulation/` → `script-vm/` and `script-model/` only, through its `decoder.ts`
- `script-model/` → `script-vm/`, `localizations/`; `script-vm/` → `variant-resolver`, `platform/snes/`
- `resources/` → may use `maps/`, `script-vm/`, `script-model/`, `simulation/`, `localizations/`; never `emulator/` (ROM and memory reads are injected by `games/evermore/extension.js`)
- `platform/` → no `core/`, no game; `core/` → `platform/` only; a game never imports another game except through `games/<game>/imports/<other>/`
- `games/terra/decoder/` → `platform/` and its own descriptor; `games/terra/resources/` → the decoder and `core/resources/`; `games/terra/maps/` → `terra://` only
- `games/mana/decoder/` → nothing in `src/`; `games/mana/resources/` → the decoder only; `games/mana/maps/` → `som://` only; `games/evermore/imports/mana/` → the Mana decoder, Evermore `maps/` and `rom-readers.ts`; no Evermore domain uses any of them (only `extension.js` wires them)
- No circular dependencies allowed

See `.depcruise.js` for machine-enforced rules.
