# memory/ — Memory Radar Tab

Renders the WRAM memory radar: the grid of 128KB WRAM addresses, lifecycle badges, scope analysis, enum cross-references, and the detail table.

## Files

| File | Description |
|---|---|
| `render-memory-tab.js` | Renders the Memory tab HTML (WRAM grid + detail table) |
| `render-radar.js` | Top-level radar HTML assembler: tabs, layout, webview entry |
| `webview/index.js` | Loads and concatenates all webview asset JS/CSS into the panel HTML |

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
