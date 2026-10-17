# src/games/evermore/localizations — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- Subjective names across the game: room names (`maps.js`), music/SFX names
  (`sounds.js`), script names (`scripts.js`, `data/scripts.json`), in-game string resolution
  (`strings.js`), and the knowledge entries (`knowledge/`, loaded by `knowledge.js`; `tables.js` and
  `functions.js` are views of them — add a routine or table as an entry, never as a JS line).

## Dependencies
- Libraries only (guide §2). Currently requires no other `src/` domain.
- No `vscode`, no DOM, no extension state.

## Invariants
- The only place where naming data lives. The room, enemy and flag names imported long ago stay
  frozen and are rewritten in our own words (cleanup D4); nothing new comes from other projects.
- `data/sound-animations.json` is generated from the ROM by
  `tools/gen-sound-animations.js`; rerun it when the animation catalogue changes. Do not
  hand-edit it.
- A `stringIndex` resolves against ROM bytes when a ROM is given and falls back to the
  subjective name otherwise.

## Tests
- Unit: `tests/localizations/localizations.test.js` (mock ROM buffer; also requires
  `src/games/evermore/rooms`). Not wired into `npm test` — run it with
  `node tests/localizations/localizations.test.js`.
