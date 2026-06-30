# scaling/ — Scaling / Alchemy Tab

Damage scaling calculator and alchemy chart for the Memory Radar webview panel.

## Files

`webview/` — all browser-side JS (excluded from typecheck/knip):

| File | Description |
|---|---|
| `state.js` | Tab state container |
| `helpers.js` | DOM and math helpers |
| `alchemy-math.js` | Alchemy formula computations |
| `damage-math.js` | Damage formula computations |
| `chart.js` | Chart rendering |
| `redraw.js` | Redraw coordinator |
| `events.js` | UI event wiring |
| `tab-init.js` | Tab initialization entry point |

## Dependency Rules

- Webview assets are browser-side concatenated; no `require()` — excluded from all Node.js tooling
- No server-side Node files in this domain (pure client-side tab)
