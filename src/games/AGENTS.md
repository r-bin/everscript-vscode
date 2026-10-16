# src/games — agent rules

Kind: **game** modules (docs/architecture/multi-game.md §2–§3). One folder per game; `index.ts` is the
one list of games (removing a game = deleting its folder and its line).

## Owns
- `<game>/descriptor.ts`: id, scheme, header match, variants (SHA-1, one `base`), capabilities, docs.
- `evermore/derived.ts`: the marker our builders write into ROMs derived from the Evermore base ROM.
- `index.ts`: `registerGames()`, plus `romPath(game)` / `baseRomPath(game)` for tests and tools.

## Dependencies
- `platform/` only. A game never imports another game (rule `games-stay-apart`); the one exception is
  `<game>/imports/<other>/`, through the other game's public `index`.
- Facts never cross games (root AGENTS.md §0.4): a Mana descriptor holds Mana facts only.

## Invariants
- Variant hashes are facts about the user's own dumps, recorded with their source
  (Evermore: docs/evermore-releases.md §1).
- Secret of Mana lives in `mana/` (`decoder/`, `resources/`, `maps/`, each with its own AGENTS.md);
  the Evermore domains (`src/games/evermore/maps`, `src/games/evermore/script`, …) move into `evermore/` during cleanup step 4.
