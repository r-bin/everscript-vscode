# src/games/terra/decoder — Terranigma rooms (pure TypeScript)

Rules: [../AGENTS.md](../AGENTS.md). Facts and routine addresses: [docs/terra/README.md](../../../../docs/terra/README.md).

| File | What | Game code |
|---|---|---|
| `rom.ts` | identification (title, the base ROM by SHA-1), the room table and its pointers | `$86:9010` |
| `loader.ts` | runs the room loader on the platform's 65816 interpreter: power-on WRAM table, layout 0, the vblank and music stand-ins; records sections, shared scripts, compressed blocks, script bytes, VRAM written | `$86:86ED`, `$86:B8D6`, `$86:8E5B`, `$86:8F37` |
| `room.ts` | a room from the WRAM / VRAM / registers the loader leaves: layers, metatiles, palette, display; header-only summaries; the rooms loaded before a room that keeps parts from before | `$0826-$0850`, `$7F:0600`, `$8D:8C52` |
| `render.ts` | the picture (BG priority, main / sub screen, colour math, repeating backgrounds) and a layer's metatile sheet | — |
| `catalog.ts` | every used room and which show the same picture, from header-only runs (~1 s), in groups of 64 ids | — |
| `collision.ts` | what each of the 32 cell types does to a move up / down / left / right, read from the movement code's jump tables; the ground table | `$80:D542`, `$80:D8E8`, `$80:DC60`, `$80:DFDC`, `$80:E11C` |
| `exits.ts` | a room's exits: rectangles, targets, choices by event flag | `$81:8000`, `$8D:8797`, `$8D:8911` |
| `changes.ts` | the map changes a room's load applies by the bits of `$7E:0710` (set a cell, copy a block); the cells one writes; a room with one applied | `$99:D4E7`, `$8D:8FB4` |
| `chests.ts` | a room's chests: cell, contents, opened flag, gate flag | `$99:D859`, `$87:C7AE`, `$87:939E`, `$8D:912B` |

`loadRoom` + `renderRoom`: ~20 ms for a small room, up to ~140 ms for the biggest maps; `roomCatalog`: ~1 s.
