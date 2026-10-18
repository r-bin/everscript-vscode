# src/games/evermore/imports/mana — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2), the one bridge between the two
games: a Secret of Mana map rewritten as an Evermore room. What it does: [README.md](README.md);
the translation table: [docs/mana/evermore-rooms.md](../../../../../docs/mana/evermore-rooms.md).

## Owns
- Converting a Mana map into Evermore cells, graphics, families, collision and step-on
  boxes (`convert.js`), the in-memory ROM image that holds it (`virtual-rom.js`, `ids.ts`),
  and serving converted rooms to the Rooms tab's host (`rooms.js`).

## Dependencies
- `games/mana/decoder/`, Evermore `maps/` and `rom-readers.js` only (`.depcruise.js` `mana-import-bridges-libraries`).
  Only `extension.js` requires it (`no-evermore-to-mana`). No `vscode`: ROMs arrive as functions.

## Invariants
- Each mapping is a stated translation between two documented facts (one per game),
  never an assumption that one game works like the other. Facts about Mana go in
  `src/games/mana/decoder` + `docs/mana`, about Evermore in `src/games/evermore/maps` + `docs/map-format`; this folder
  only pairs them, and every pairing is a row in `docs/mana/evermore-rooms.md`.
- The room is encoded by Evermore's own encoder and must decode with `decodeRoom`.
- The image is built in memory and never written anywhere; vanilla graphics, families and
  rooms other than slot `0x7E` are untouched in it.
- Converted rooms use tab ids from `0x1000`, never a ROM room id.

## Tests
- `tests/mana/mana-evermore.test.js` — unit checks always; both ROMs (from the ROM library) for
  the end-to-end part.
- `tests/mana/mana-rooms-dom.test.js` — the rail group and opening a room (Playwright).
- `tests/mana/mana-editor-dom.test.js` — a converted room in the real editor: Tile, Trigger, Object tabs (both ROMs + Playwright).
