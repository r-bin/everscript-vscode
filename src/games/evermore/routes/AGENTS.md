# src/games/evermore/routes — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The radar panel's **Routes** tab: the route file format (`model/route.ts`), the `routes*`
  requests (`host.ts`), the pane scaffold and `webview/` (incl. the fight panel). Routes are
  played and fights simulated by `../simulation` (`play.ts`, `combat/`).

## Dependencies
- Libraries only: `../script-model`, `../simulation` (incl. `combat/`), `../maps`, `../localizations`, `platform/`. Simulation code (playing, combat) belongs in `../simulation`, not here. `.depcruise.js` rule
  `routes-no-features`. The Maps tab's room opener arrives through the page (`gotoVanillaRoom`).

## State owned
- `host.ts`: `_cache` (room models, trigger analyses, pictures, for one ROM).
- `webview/routes-tab.dom.ts`: `st` (route, step, hover, filter, zoom, pictures).

## Invariants
- What a step does comes from the trigger's script (the simulation's cases), never from a rule
  typed here. What no script decides (drops, an unexplained room change) is applied as drafted
  and labelled so; where the script disagrees with the draft, show it, never correct silently.
- A condition the state cannot decide is listed as assumed, not dropped.
- Odds and timings are a model (`../simulation/combat/`), checked in the game only for a Wimpy Flower
  killing the Boy (`tools/routes/fight-in-game.mts`; rerun it after changing the model): the
  panel always shows its inputs (from the ROM and the route's party) and what it assumes. Lead
  with what the runs show (fastest, median), never with a floor no run reaches. Every
  mechanic in it is read from the game's code (knowledge `rom/8fcc40`, `rom/8fba06`); a number
  nobody traced does not go in.
- Route files hold our own descriptions of actions, never game text or data.

## Tests
- `tests/memory/routes-tab.test.js` — unit (parsing, playing a gourd and an exit, views, host
  without ROM), ROM (the Any% draft played; overlays; the opened gourd's picture) and DOM (step
  through, lit and hovered targets; skips without playwright).
  `ROUTES_TAB_SHOT=<dir>` saves screenshots.
