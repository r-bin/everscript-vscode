# src/games/evermore/script — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The only script decoder in the repo: operand grammar, instruction walk, room scripts,
  loot, transitions, entity candidates, and writing a pickup back out as `_loot(...)`.

## Dependencies
- Libraries only (guide §2). `names.ts` lazily requires `../localizations` (allowed).
- No VS Code API, no filesystem, no rendering.
- Consumers `require('../script')` (the facade), never `./dist`.

## Invariants
- Do not port or copy code, tables or struct layouts from SoETilesViewer/SoEScriptDumper;
  derive from the ROM with a test (guide §3.8). The current decoder is a known violation to
  replace, not extend; `names.json` stays for now (`docs/cleanup.md` step 2, D4).
- `decodeScript` never guesses a length: an opcode with no case stops the walk and says
  so in `stopReason` / `stoppedAt`. `bad-operand` stops it too.
- The operand stack belongs to the decode run — never reset it between operands.
- Legacy decoder only: its summary wording matches upstream's, quirks included, because
  `npm run check:script` scores it string for string — don't "improve" it in place. Its
  replacement is `../script-vm/` (written from the game, checked against goldens); new code uses
  that, and consumers move there one by one (`docs/cleanup.md` 2.2/2.4).
- `$2461` (`LOOT_AMOUNT`) means amount − 1 before the loot call and the next pickup's bonus
  after it: track where the call happened, never read it position-blind.
- All 922 pickups write a literal item; `script-loot.test.js` fails if that changes.
- `names.json`'s names are kept from an earlier import and frozen (cleanup D4): they are rewritten in our own style over time, and no new ones are added; there is no generator any more. Edit it only to rewrite a
  name in our words (with evidence from the game), never to add names from another project.
- `dist/script/` is gitignored; emitted by `tsconfig.build.json` (`npm run build:ts`),
  rebuilt by `npm test`, `npm run package` and `npm run deploy`.

## Tests
- Unit: `tests/memory/script-units.test.js` (no ROM, no SoETilesViewer).
- ROM (skip without the ROM or the `SoETilesViewer` checkout; override with
  `SOE_TILES_VIEWER`, `SOE_SCRIPT_DUMP`, `EVERSCRIPT_ROM`): `script-parity.test.js`
  (`check:script`), `script-loot.test.js` (regenerates `sniffflags.inc` exactly).
- ROM, as a consumer: `map-parity.test.js`, `rom-export.test.js`.
