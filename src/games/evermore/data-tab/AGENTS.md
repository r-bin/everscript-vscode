# src/games/evermore/data-tab — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The radar panel's **Data** tab: Tables, Enums and Palettes; the `data*` requests
  (`host.ts`), the models in `model/`, the pane scaffold and `webview/`.

## Dependencies
- Libraries only: `../maps`, `../localizations` (incl. knowledge entries), `platform/`.
- Must **not** import another feature: the character list (names, palette addresses,
  thumbnails) is the Characters tab's, injected by `radar-open.js`. `.depcruise.js` rule `data-tab-no-features`.

## State owned
- `host.ts`: `_cache` (the whole index, for one ROM).
- `webview/data-tab.dom.ts`: `st` (view, selections, filter).

## Invariants
- Every value is read from the user's ROM at runtime or from a knowledge entry; never from the
  compiler's `.evs` enums (guessed, hack-specific). No list is copied into this folder. A new list
  or table gets a knowledge entry for its address first (`game-knowledge` skill), states its
  `source`, and leaves out what is not verified.
- Tables lists only tables decoded into readable values; raw words stay in `soe://rom/tables/`.
- Charts: one y-axis; a legend when there are two series; colours are VS Code's
  `--vscode-charts-*`; the values stay beside the chart as the table.
- The pane is also `.scr-pane`: it reuses the Scripts tab's tool bar, rail and columns.

## Tests
- `tests/memory/data-tab.test.js` — unit, ROM (models, host) and DOM (the page answered by the
  real host; skips without playwright). `DATA_TAB_SHOT=<dir>` saves a screenshot per view.
