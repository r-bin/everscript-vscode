# src/mana — Secret of Mana maps

Rules for agents: [AGENTS.md](AGENTS.md). Format and evidence: [docs/mana/README.md](../../docs/mana/README.md).
Built by `npm run build:mana` (`tsconfig.mana.json`) into `dist/`; `index.js` is the CommonJS facade.

| File | Owns | Game routine |
|---|---|---|
| `rom.ts` | bus address → file offset, title check | — |
| `header.ts` | the 8-byte map header | `$00:C481` |
| `placement.ts` | piece records, visibility, layer assembly, map size, picture key | `$00:CB90` |
| `piece-decoder.ts` | the piece stream and stamps | `$00:CD93` |
| `metatiles.ts` | 384 metatiles per set, halves | `$02:A000`, `$02:A069` |
| `chars.ts` | BG characters in VRAM, animated characters (frame 0) | `$01:F413`, `$01:F5CE`, `$01:B0EC` |
| `palette.ts` | BG palettes, display mode (TM/TS/CGADSUB/backdrop) | `$01:F62D`, `$02:AA60` |
| `map.ts` | `loadMap`: everything one map needs | — |
| `render.ts` | Mode 1 BG1/BG2 picture with priorities and colour math | SNES PPU |
| `areas.ts` | maps grouped into the areas players know | — |
| `collision.ts` | layer A collision bytes per cell, floor class / diagonal / level switch / special | `$02:A043`, `$01:BE15` |
| `cpu65816.ts` | a 65816 interpreter (native mode, no interrupts) to run game routines | — |
| `snes-bus.ts` | HiROM, WRAM, VRAM/CGRAM ports, DMA, multiply/divide for it | — |
| `animate.ts` | runs the game's animation setup and per-frame code, records what changes | `$01:B0EC`, `$01:B17E`, `$02:BC7E`, `$00:B0BB`, `$00:C304` |
| `anim-cells.ts` | turns a trace into frames per cell kind (cells with equal tile words) | — |

`loadMap` + `renderMap` take ~30 ms per map; `mapSize` and `pictureKey` decode nothing;
`traceAnimation` ~20 ms, `animateCells` up to ~200 ms (map 128).

`cpu65816.ts` is 376 lines: one table-like switch over the 256 opcodes plus the
addressing modes; splitting it would scatter one instruction set over files.
