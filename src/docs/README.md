# docs/ — Docs / RNG Tab

Renders the Docs and RNG tabs in the Memory Radar webview panel.

## Files

| File | Description |
|---|---|
| `render-docs-tab.js` | Server-side rendering of the Docs/RNG tab HTML |
| `docs-tab.js` | Webview asset — alchemy/docs tab client-side JS |
| `rng-tab.js` | Webview asset — RNG simulator client-side JS |

## Dependency Rules

- No imports from other `src/` domains (pure rendering functions)
- Webview assets (`docs-tab.js`, `rng-tab.js`) are browser-side; excluded from typecheck/knip
