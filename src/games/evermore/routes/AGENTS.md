# src/games/evermore/routes — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The radar panel's **Routes** tab: the route file format and checks (`model/route.ts`), the
  `routes*` requests (`host.ts`), the pane scaffold and `webview/`.

## Dependencies
- Libraries only: `../script-model`, `../localizations`, `platform/`. `.depcruise.js` rule
  `routes-no-features`. The Maps tab's room opener arrives through the page (`gotoVanillaRoom`).

## State owned
- `host.ts`: `_facts` (room loot and exits, for one ROM).
- `webview/routes-tab.dom.ts`: `st` (selected route and step, filter).

## Invariants
- A route's numbers are the draft's until a check confirms them: show "as drafted", and show
  where the room scripts disagree rather than correcting the route silently.
- No odds, damage or timing until the models behind them are validated (routes.md); the tab
  says "not built".
- Route files hold our own descriptions of actions, never game text or data.

## Tests
- `tests/memory/routes-tab.test.js` — unit (model, host without ROM), ROM (the checks against
  the room scripts) and DOM (the page answered by the real host; skips without playwright).
  `ROUTES_TAB_SHOT=<dir>` saves screenshots.
