# src/platform — agent rules

Kind: **platform** — knows SNES hardware and our machinery, no game (docs/architecture/multi-game.md §2).

## Owns
- `games.ts`: the game registry (`registerGame`, `listGames`, `baseVariant`) and the descriptor type.
- `roms/header.ts`: finding and reading the cartridge header (LoROM / HiROM / ExHiROM, PAL regions).
- `roms/identify.ts`: game + variant from header and SHA-1; derived ROMs through the game's marker.
- `snes/hirom.ts`: HiROM bus → file offset and little-endian reads, the one copy (cleanup 5.1).
- `roms/library.ts`: the ROM library file (paths only), selected ROM, base ROM per game, `romFor`.

## Dependencies
- Node built-ins only. Never `core/`, never `games/` (rule `platform-knows-no-game`), never `vscode`:
  the same code runs in the extension, the MCP server, tests and node tools.

## Invariants
- Strict TypeScript, built to `dist/platform` by `npm run build:ts`; JS callers require `dist/`.
- No game name, title, hash or address in this folder. A game's facts live in its descriptor.
- The library stores paths, never ROM bytes or copies.

## Tests
- Identification and the library run in every test that finds a ROM through `dist/games` `romPath()`.
