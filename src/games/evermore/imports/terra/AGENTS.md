# src/games/evermore/imports/terra — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2), a bridge between two games: a Terranigma room
rewritten as an Evermore room. What it does: [README.md](README.md); the translation table:
[docs/terra/evermore-rooms.md](../../../../../docs/terra/evermore-rooms.md).

## Owns
- Converting a Terranigma room into Evermore cells, graphics, families, collision, step-on and B-trigger boxes
  and objects (`convert.ts`, `collision.ts`, `graphics.ts`), and serving converted rooms to the Rooms tab's
  host (`rooms.ts`).

## Dependencies
- `games/terra/decoder/`, `../common/`, Evermore `maps/` and `rom-readers.ts` only (`.depcruise.js`
  `terra-import-bridges-libraries`). Only `../index.ts` requires it (`no-evermore-to-terra`). No `vscode`.

## Invariants
- Each mapping is a stated translation between two documented facts (one per game), never an assumption
  that one game works like the other. Terranigma facts go in `games/terra/decoder` + `docs/terra`; this
  folder only pairs them, and every pairing is a row in `docs/terra/evermore-rooms.md`.
- Only the base ROM (`eu`) is converted: the decoder knows no other release's tables.
- Converted rooms use tab ids `0x2000 + room id`, families from `TERRA_FAMILY_BASE` (`../common/ids.ts`).

## Tests
- `tests/terra/terra-evermore.test.js` (rom), `terra-editor-dom.test.js` (dom), `terra-play.test.js` (emulator).
