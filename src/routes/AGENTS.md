# src/routes — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The radar panel's **Route Planner** tab script, `route-tab.js` (currently an empty stub).

## Dependencies
- Webview assets are browser-side only; excluded from typecheck/knip.
- No server-side Node files in this domain currently.

Existing exceptions (do not add more):
- The route planner's logic (`rp-*` elements) lives in `src/docs/docs-tab.js` ("logic
  lives in docsJs for now", per `route-tab.js`).

## Tests
- `tests/memory/smoke.test.js` — unit (radar page assembly with `routeJs`).
