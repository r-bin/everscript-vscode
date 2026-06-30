# shared/ — Cross-Domain Utilities

Shared utilities used across multiple domains. No VS Code API. No domain-specific logic.

## Files

| File | Description |
|---|---|
| `config.js` | Extension settings model (reads VS Code workspace config) |
| `radar-utils.js` | Pure parsing functions: memory-map, enums, scope analysis, HTML escaping |
| `rom-readers.js` | ROM file reading utilities for character/stats data |
| `shared.js` | Webview asset — common JS loaded in all radar webview tabs |
| `shared.css` | Webview asset — common CSS for radar panel |

## Dependency Rules

- No imports from other `src/` domains
- No `require('vscode')` — `config.js` is the single exception (reads settings)
- Pure functions preferred; all exports are tested
