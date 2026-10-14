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

`loadMap` + `renderMap` take ~30 ms per map; `mapSize` and `pictureKey` decode nothing.
