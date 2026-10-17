# core/ — game-neutral VS Code features

What every game shares inside VS Code. Rules: [AGENTS.md](AGENTS.md).

| Path | What |
|---|---|
| `roms/` | The ROM library in VS Code: status bar item, Everscript: Switch ROM, the ROM panel (`webview/`), asking for a ROM when there is none |
| `game-views.js` | Each game's main view, registered by the game; which one opens for the selected ROM; the swap on Switch ROM |
| `map-editor/` | The editor both games' map pages are built from: `view/` (chips, tile animation, tokens), `core/` (history, sessions, tool keys), `shell/` (frame, rail, dock, layout, zoom/pan) |
| `mcp/` | The read-only MCP server on 127.0.0.1:47917 serving the games' file systems to AI clients ([README](mcp/README.md)) |
| `webview/shared.css` | The page base of the radar and the Mana Maps page |
