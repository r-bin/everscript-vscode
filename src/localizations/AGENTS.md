# src/localizations — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- Subjective names across the game: room names (`maps.js`), music/SFX names
  (`sounds.js`), table and routine names (`tables.js`, `functions.js`), script names (`scripts.js`, `data/scripts.json`), and in-game string
  resolution (`strings.js`).

## Dependencies
- Libraries only (guide §2). Currently requires no other `src/` domain.
- No `vscode`, no DOM, no extension state.

## Invariants
- The only place where naming data (room/map/enemy names) lives. Naming data is the one
  thing that may come from SoETilesViewer/SoEScriptDumper (guide §3.8); code, tables and
  struct layouts may not.
- `data/sound-animations.json` is generated from the ROM by
  `tools/gen-sound-animations.js`; rerun it when the animation catalogue changes. Do not
  hand-edit it.
- A `stringIndex` resolves against ROM bytes when a ROM is given and falls back to the
  subjective name otherwise.

## Tests
- Unit: `tests/localizations/localizations.test.js` (mock ROM buffer; also requires
  `src/rooms`). Not wired into `npm test` — run it with
  `node tests/localizations/localizations.test.js`.
