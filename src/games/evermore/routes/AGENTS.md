# src/games/evermore/routes — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The radar panel's **Routes** tab: the route file format (`model/route.ts`), playing a route
  against one WRAM (`model/simulate.ts`), the `routes*` requests (`host.ts`), the pane scaffold
  and `webview/`.

## Dependencies
- Libraries only: `../script-model`, `../simulation`, `../maps`, `../localizations`, `platform/`. `.depcruise.js` rule
  `routes-no-features`. The Maps tab's room opener arrives through the page (`gotoVanillaRoom`).

## State owned
- `host.ts`: `_cache` (room models, trigger analyses, pictures, for one ROM).
- `webview/routes-tab.dom.ts`: `st` (route, step, hover, filter, zoom, pictures).

## Invariants
- What a step does comes from the trigger's script (the simulation's cases), never from a rule
  typed here. What no script decides (drops, an unexplained room change) is applied as drafted
  and labelled so; where the script disagrees with the draft, show it, never correct silently.
- A condition the state cannot decide is listed as assumed, not dropped.
- No odds, damage or timing until the models behind them are validated (routes.md); the tab
  says "not built".
- Route files hold our own descriptions of actions, never game text or data.

## Tests
- `tests/memory/routes-tab.test.js` — unit (parsing, playing a gourd and an exit, views, host
  without ROM), ROM (the Any% draft played; overlays; the opened gourd's picture) and DOM (step
  through, lit and hovered targets; skips without playwright).
  `ROUTES_TAB_SHOT=<dir>` saves screenshots.
