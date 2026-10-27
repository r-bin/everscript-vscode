# Secret of Evermore Working RAM (WRAM) Map

The authoritative one-line-per-entry address catalog is maintained at:
👉 **[`docs/disassembly/engine-core/wram-map.md`](disassembly/engine-core/wram-map.md)**

Managed by the [`wram-curator`](../.agents/agents/wram-curator.md) persona.

---

## WRAM Layout Overview (`$7E0000–$7FFFFF`, 128 KB)

| Range | Size | Subsystem / Role |
|---|---|---|
| `$7E:0000–$7E:01FF` | 512 B | Direct page, scratchpad, hardware PPU/DMA shadows, frame counters (`$0100`) |
| `$7E:0200–$7E:0FFF` | 3.5 KB | Controller inputs (`$0104`), ring menu state, player stats (`$0A35+`), audio buffers |
| `$7E:1000–$7E:1FFF` | 4 KB | Dynamic actor tables, animated tile channels (`$107E+`), OAM slice descriptors, HDMA tables |
| `$7E:2210–$7E:2257` | 72 B | Player boy and dog custom character name buffers |
| `$7E:2258–$7E:23FF` | 424 B | Persistent story, world, and chest event flags (saved to cartridge SRAM) |
| `$7E:2400–$7E:27FF` | 1 KB | Markets, alchemy ingredients, weapon levels, camera limits; `$2200–$27FF` persists across rooms |
| `$7E:2834–$7E:28FF` | 204 B | Compiler temporary scratchpad RAM (wiped on room reload) |
| `$7E:2900–$7E:FFFF` | ~53 KB | Tilemap cache, script VM thread stack, actor entity pool (`$7E:3DE5 + n·$8E`) |
| `$7F:0000–$7F:FFFF` | 64 KB | High WRAM: decompressed room metatile grid (`$7F:0000`), tile palette table (`$7F:C300`), font glyph 2bpp staging (`$7F:A000`), and dialogue text buffer (`$7F:D81E`) |

See the complete 230+ entry catalog in [`docs/disassembly/engine-core/wram-map.md`](disassembly/engine-core/wram-map.md).
