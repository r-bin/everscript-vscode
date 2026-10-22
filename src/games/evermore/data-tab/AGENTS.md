# src/games/evermore/data-tab — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The radar panel's **Data** tab: Tables, Enums and Palettes; the `dataInit` request
  (`host.ts`), the models in `model/`, the pane scaffold and `webview/`.

## Dependencies
- Libraries only: `../maps`, `../localizations`, the language data file
  (`../language/data/index.json`), `platform/`.
- Must **not** import another feature: the character list (names, palette addresses) is the
  Characters tab's, injected by `radar-open.js`. `.depcruise.js` rule `data-tab-no-features`.

## State owned
- `host.ts`: `_cache` (the whole index, for one ROM).
- `webview/data-tab.dom.ts`: `st` (view, selections, filter).

## Invariants
- Every value is read from the user's ROM at runtime or from the language data; no table,
  enum or palette is copied into this folder. A new decoded table gets a knowledge entry for its
  address first (`game-knowledge` skill), then a function in `model/tables.ts`.
- Charts: one y-axis; a legend when there are two series; colours are VS Code's
  `--vscode-charts-*`; the values stay beside the chart as the table.
- The pane is also `.scr-pane`: it reuses the Scripts tab's tool bar, rail and columns.

## Tests
- `tests/memory/data-tab.test.js` — unit, ROM (models, host) and DOM (the page answered by the
  real host; skips without playwright). `DATA_TAB_SHOT=<dir>` saves a screenshot per view.
