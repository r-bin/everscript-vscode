# src/games/evermore/script-vm — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The script instruction format: opcode table, expressions, packed pointers, the tables that
  name scripts. Spec: `docs/game-research/script-vm/` (prose + one row per opcode).

## Dependencies
- `platform/snes/` and `../variant-resolver` only (`.depcruise.js` `script-vm-from-the-game`).
  No VS Code API, no filesystem.
- JS consumers require `dist/games/evermore/script-vm` (no JS facade); TS imports `src/` directly.

## Invariants
- Written from the game. Never read the legacy decoder (`../script/decoder.ts`, `expression.ts`,
  `ops-*.ts`) or the third-party tools the root `AGENTS.md` names while changing this folder; comparing outputs
  (lengths, stop points) is allowed.
- A rule change starts in the handler's code (`$8C:E8BD` table), goes into
  `docs/game-research/script-vm/` and the handler's knowledge entry, then `spec.ts`. The entries are
  the opcodes' descriptions for `soe://rom/assets/scripts/opcodes/` (`resources/opcode-files.js`): what
  the handler does in plain words, then `## Addresses` (calls, WRAM, ROM tables, fields).
- Never guess a length: an opcode without a handler or a sub-op the game cannot run is a
  `DecodeError` at its address.
- US layout only: `ScriptRom` refuses a ROM whose script header is elsewhere.
- Goldens hold addresses only, never ROM bytes; the test reads opcodes from the user's ROM.

## Tests
- Unit: `tests/script-vm/units.test.js` (synthetic bytes, no ROM).
- ROM: `tests/script-vm/rom.test.js`: `goldens.json` (what the game ran, from
  `tools/script-vm/record-goldens.js`) and a walk over every table.
