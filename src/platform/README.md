# platform/ — game-neutral machinery

SNES facts and tools that know no game. Rules: [AGENTS.md](AGENTS.md). Design:
`docs/architecture/multi-game.md` §2.

| Path | What |
|---|---|
| `games.ts` | The game registry: `registerGame`, `listGames`, `gameById`, `baseVariant`; the descriptor type |
| `roms/header.ts` | The cartridge header: where it is (LoROM / HiROM / ExHiROM), title, map mode, region, vectors |
| `roms/identify.ts` | Game + variant of a ROM file: SHA-1, then header, then the game's derived-ROM marker |
| `roms/library.ts` | The ROM library (`roms.json` in global storage): add, select, base per game, `romFor` |
| `snes/hirom.ts` | HiROM bus address ↔ file offset, little-endian reads |
| `snes/opcodes-65816.ts` | The 65816 opcode matrix (mnemonic, mode, length, flow) |
| `crc32.ts`, `png.ts`, `zip.ts` | CRC-32, an RGBA PNG encoder, a small zip reader/writer |
| `cdl/` | The CDL engine: library, xrefs, disassembly, Asar / Mesen / recomp exports ([README](cdl/README.md)) |
| `tas/` | The `.evsmv` movie format (`movie.js`) and replay verification (`verify.js`) |
| `index.ts` | What JS callers get from `dist/platform` |

TypeScript is built to `dist/platform/` (`npm run build:ts`); the CDL and TAS files are still JS.
