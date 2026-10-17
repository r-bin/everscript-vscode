# src/games/mana — agent rules

Kind: **game**. What is where: [README.md](README.md). Related skill: `supported-games`.

## Dependencies
- `platform/` and `core/` only; never Evermore (`games-stay-apart`, `no-evermore-to-mana`). Each
  sub-folder has its own rule (`decoder/` imports only `platform/snes/`).

## Invariants
- Nothing known about Evermore is assumed here; only SNES hardware facts carry over.
- Every fact is checked against the running game (`tools/mana/check-map.js`, `check-events.js`) and
  written to `docs/mana/`.
- Mana edits are never saved (multi-game.md §8).
