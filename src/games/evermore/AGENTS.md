# src/games/evermore — agent rules

Kind: **game** (`docs/architecture/multi-game.md` §2). What is where: [README.md](README.md).
Related skills: `architecture`, `game-knowledge`, `map-format`, `memory-map`.

## Owns
- Everything about Secret of Evermore; each folder's `AGENTS.md` says what it owns.
- `extension.js`: the wiring — commands, providers, panels, and the capabilities one feature
  injects into another. It owns no logic of its own (`architecture` skill, splitting).
- `emulator/`, `cdl/` (no AGENTS.md of their own): Evermore's halves of the emulator panel and the
  CDL export, handed in through `configureEmulator({ game, cdlTools })` and `gameRegions`.

## Dependencies
- `platform/`, `core/`; never another game except `imports/mana/` (rule `games-stay-apart`).
- Libraries never import features; features never import each other (guide §3.1).

## Invariants
- Facts come from the game itself and are written down (root AGENTS.md §0.1, §0.2): addresses in
  `localizations/knowledge/`, formats in `docs/map-format/`, `docs/script-format/`.
- Address facts are for the base variant (`us`); other releases go through `variants.json`.
