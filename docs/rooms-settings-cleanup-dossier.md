# Rooms And Settings Cleanup Dossier

## Status

- In progress
- Core cleanup implemented and test-covered
- Remaining gap: sub-instruction-heavy room-script opcodes are still only partially decoded

## Feature Scope

- Consolidate extension settings around `repoPath`-derived defaults
- Remove duplicated settings confusion in the Settings UI while keeping legacy compatibility
- Make vanilla Rooms data ROM-backed instead of client-side placeholder text
- Surface explicit room errors when no ROM is available
- Clean up Rooms tab filters and remove the misleading bottom render block
- Expand room-script opcode coverage for fixed-width opcodes
- Add a dedicated model for the SNES cartridge ROM header

## Dependencies

- Open workspace folder for repo-relative defaults
- Configured `everscript.repoPath` or `everscript.romPath` for vanilla room parsing
- ROM-backed room-script parser in [debugger/emulator/room-script-model.js](../debugger/emulator/room-script-model.js)
- Cartridge header model in [emulator/snes-rom-header-model.js](../emulator/snes-rom-header-model.js)
- Webview data assembly in [extension.js](../extension.js)

## Evidence

- Focused tests cover repo-path autofill and legacy `patchesPath` compatibility
- Rooms smoke/UI tests now assert:
  - ROM-backed header and script sections render
  - explicit missing-ROM errors render
  - stale vanilla placeholder copy is gone
  - removed bottom render canvas block does not reappear
- Room-script parser tests now cover additional fixed-width opcodes such as `0x51`, `0x54`, `0x58`, `0xA4`, `0xA6`, `0xA8`, and `0xAB`
- SNES ROM-header model tests cover HiROM and LoROM candidate detection

## Known Gaps

- Many room-script opcodes still depend on a real sub-instruction model; adding them safely requires decoding the nested operand format first
- The cartridge ROM-header model is not yet surfaced in a UI panel
- Full opcode parity with SoETilesViewer is not complete yet

## Pending Requests / Next Steps

- Decide where cartridge ROM-header metadata should be surfaced in the extension UI
- Add a dedicated sub-instruction model so the remaining room-script opcodes can be decoded without guesswork
- After that model exists, finish opcode parity and add fixture coverage for representative real-room scripts