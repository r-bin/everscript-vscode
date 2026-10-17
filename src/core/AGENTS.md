# src/core — agent rules

Kind: **core** — game-neutral features and UI shells (docs/architecture/multi-game.md §2).

## Owns
- `roms/`: the ROM library inside VS Code — status bar item, Everscript: Switch ROM, the ROM panel
  (`roms/webview/`), asking for a ROM when there is none, `onDidChangeRoms` for everyone else.
- `map-editor/`: the editor both games' map pages are built from — `view/` (filter chips, tile
  animation, design tokens), `core/` (undo history, sessions, "not saved" notice, tool keys) and
  `shell/` (frame, rail, canvas column, dock, layout, zoom/pan). Browser-side files loaded by the
  Rooms tab (`src/games/evermore/memory/webview/index.js`) and the Mana Maps page; each has its own AGENTS.md.
- `game-views.js`: each game's main view (registered by the game) and which one shows for the selected
  ROM; Switch ROM refreshes the selected game's open view, views of other games keep their ROM, every
  view's title names its ROM.
- `emulator/`: the embedded SNES emulator (own AGENTS.md); the recorder ships it alone.
- `mcp/`: the localhost MCP server serving the games' file systems to AI clients (own AGENTS.md).

## Dependencies
- `platform/` only (through `dist/platform`) and `vscode`; `map-editor/` and `mcp/` import nothing
  outside themselves. Never a game (rule `core-knows-no-game`):
  games are registered by `extension.js` before `activateRoms()`.

## Invariants
- No game named in code or text; game names, docs and capabilities come from the registry.
- The webview page is real files (`roms/webview/*.js|css`), never code in template strings.
