# src/platform — agent rules

Kind: **platform** — knows SNES hardware and our machinery, no game (docs/architecture/multi-game.md §2).

## Owns
- `games.ts`: the game registry (`registerGame`, `listGames`, `baseVariant`) and the descriptor type.
- `roms/header.ts`: finding and reading the cartridge header (LoROM / HiROM / ExHiROM, PAL regions, native
  vectors); the one header reader (the CDL ROM map uses it too).
- `roms/identify.ts`: game + variant from header and SHA-1; derived ROMs through the game's marker.
- `snes/opcodes-65816.ts`: the 65816 opcode matrix (mnemonic, mode, length, flow); `tools/gen-cdl-optable.js`
  generates the core's C table from it.
- `cdl/`: the CDL engine (library, xrefs, disassembly, Asar / Mesen / recomp exports) — JS until cleanup
  5.5; a game's seeds come in as `gameRegions`, the VS Code side is `src/core/emulator/cdl/host.js`.
- `tas/`: movie format and verification (`movie.js`, `verify.js`); `zip.js`.
- `crc32.ts`, `png.ts`: CRC-32 and the RGBA PNG encoder, one copy each.
- `snes/hirom.ts`: HiROM bus → file offset and little-endian reads, the one copy (cleanup 5.1).
- `roms/library.ts`: the ROM library file (paths only), selected ROM, base ROM per game, `romFor`.

## Dependencies
- Node built-ins only; nothing outside `platform/` (rule `platform-stands-alone`), never `vscode`:
  the same code runs in the extension, the MCP server, tests and node tools.

## Invariants
- New code is strict TypeScript (the moved CDL / TAS JS converts in cleanup 5.5), built to `dist/platform` by `npm run build:ts`; JS callers require `dist/`.
- No game name, title, hash or address in this folder. A game's facts live in its descriptor.
- The library stores paths, never ROM bytes or copies.

## Tests
- Identification and the library run in every test that finds a ROM through `dist/games` `romPath()`.
