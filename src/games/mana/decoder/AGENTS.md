# src/games/mana/decoder — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). Secret of Mana, pure TypeScript:
ROM bytes in, map data and pictures out. What the folder does: [README.md](README.md).

## Owns
- Decoding Secret of Mana maps (header, pieces, metatiles, BG characters, palettes,
  display mode), drawing them (SNES Mode 1 BG1 + BG2), and the area catalogue.

## Dependencies
- None inside `src/`. Never `maps/`, `script/` or anything else Evermore: the two games
  share no format here, only SNES hardware rules (`.depcruise.js` `mana-decoder-is-alone`).

## Invariants
- Every format fact comes from Secret of Mana's own code or the running game, with the
  routine address in the file comment ([docs/mana/README.md](../../../../docs/mana/README.md)).
  Never from Evermore knowledge, other projects' code, or guesses.
- Map pictures show frame 0 of animations and flag value 0 for event pieces.
- Animation is the game's own code run on `cpu65816.ts`; do not re-implement its modes by
  hand. The interpreter and bus model generic SNES hardware only.
- `areas.ts` holds area names and map ids only — never the reference pictures or their layout.

## Tests
- `tests/mana/mana-units.test.js` — unit, synthetic ROM images.
- `tests/mana/mana-cpu.test.js` — unit, the interpreter and bus on synthetic programs.
- `tests/mana/mana-rom.test.js` — rom tier; needs the Mana ROM in the ROM library, else skips.
- `tools/mana/check-map.js` — compares a picture with the running game (manual).
- `tools/mana/check-events.js` — compares step events with the running game (manual).
