# memory/ — Memory Radar Tab

Renders the WRAM memory radar: the grid of 128KB WRAM addresses, lifecycle badges, scope analysis, enum cross-references, and the detail table.

## Files

| File | Description |
|---|---|
| `render-memory-tab.js` | Renders the Memory tab HTML (WRAM grid + detail table) |
| `render-radar.js` | Top-level radar HTML assembler: tabs, layout, webview entry |
| `webview/index.js` | Loads and concatenates all webview asset JS/CSS into the panel HTML |

## Dependency Rules

- May depend on `../shared/` (radar-utils, rom-readers)
- May depend on `../docs/` (render-docs-tab)
- May depend on `../rooms/` (room tree, rendering)
- No dependency on `../debugger/` or `../emulator/`
