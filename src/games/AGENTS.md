# src/games — agent rules

Kind: **game** modules (docs/architecture/multi-game.md §2–§3). One folder per game; `index.ts` is the
one list of games (removing a game = deleting its folder and its line).

## Owns
- `<game>/descriptor.ts`: id, scheme, header match, variants (SHA-1, one `base`), capabilities, docs.
- `evermore/derived.ts`: the marker our builders write into ROMs derived from the Evermore base ROM.
- `evermore/emulator/`: Evermore's half of the emulator panel's host side (`host.js`, handed in through
  `configureEmulator({ game })`), script trace, address lookup, custom-map test ROMs; `evermore/cdl/`:
  the CDL export's Evermore seeds (`regions.ts`) and the CDL tab's tools.
- `<game>/extension.js`: the game inside VS Code — its commands, file system, main view
  (`core/game-views.ts`); called from the list in `src/extension.ts`.
- `index.ts`: `registerGames()`, plus `romPath(game)` / `baseRomPath(game)` for tests and tools.

## Dependencies
- `platform/` only. A game never imports another game (rule `games-stay-apart`); the one exception is
  `<game>/imports/<other>/`, through the other game's public `index`.
- Facts never cross games (root AGENTS.md §0.4): a Mana descriptor holds Mana facts only.

## Invariants
- Variant hashes are facts about the user's own dumps, recorded with their source
  (Evermore: docs/evermore-releases.md §1).
- Secret of Mana lives in `mana/` (`decoder/`, `resources/`, `maps/`, each with its own AGENTS.md);
  the Evermore domains live in `evermore/` (moved in cleanup step 4).
