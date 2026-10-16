# shared/ — Cross-Domain Utilities

Shared utilities used across multiple domains. The Evermore helpers that lived here (`config.js`,
`radar-utils.js`, `rom-readers.js`, `resource-uri.js`) moved to `src/games/evermore/` in v0.242.0. No VS Code API. No domain-specific logic.

## Files

| File | Description |
|---|---|
| `zip.js` | Writing and reading a small .zip (custom-map export, recording bundles) |
| `shared.js` | Webview asset — common JS loaded in all radar webview tabs |
| `shared.css` | Webview asset — common CSS for radar panel |

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
