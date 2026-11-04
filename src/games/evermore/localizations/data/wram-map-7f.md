# Secret of Evermore — Bank $7F Memory Map

```json
{
  "areas": {
    "metatiles":      { "range": ["0x0000", "0x7FFF"], "behavior": "room" },
    "vram_tilemap":   { "range": ["0x8000", "0x9FFF"], "behavior": "room" },
    "lzss_window":    { "range": ["0xA000", "0xAFFF"], "behavior": "scratch" },
    "audio_sample":   { "range": ["0xB000", "0xC7FF"], "behavior": "system" },
    "shadow_tilemap": { "range": ["0xC800", "0xD7FF"], "behavior": "room" },
    "dialogue_text":  { "range": ["0xD800", "0xDE9D"], "behavior": "system" },
    "dma_scratch":    { "range": ["0xDE9E", "0xFFFF"], "behavior": "scratch" }
  },
  "tag_tree": {
    "world": ["map", "metatiles"],
    "engine": ["graphics", "audio", "sound", "system", "dialogue", "script", "hud", "decompression", "scratch"],
    "quality": ["verified", "bank7f"]
  }
}
```

## Memory Layout (Contiguous, 0x0000..0xFFFF)

| Address | Identifier | Type | Tag | Summary |
|---|---|---|---|---|
| `$7F:0000` | [`ROOM_METATILE_GRID`](knowledge/wram/ROOM_METATILE_GRID.md) | `u8[0x8000]` | map, metatiles, bank7f | Primary decompressed room field metatile grid and attributes buffer ($7F:0000..$7F:7FFF). Holds live metatile IDs, Layer 1/2 VRAM tile words, and 2-bit elevation/collision attributes ($80:C0B5, $8F:9F05, $90:9DE8, $90:A739). |
| `$7F:8000` | [`VRAM_BG1_TILEMAP_BUF`](knowledge/wram/VRAM_BG1_TILEMAP_BUF.md) | `u8[0x2000]` | graphics, map, bank7f | Decompressed background Layer 1 tilemap decompression staging buffer before DMA upload to PPU VRAM ($80:BC00). |
| `$7F:A000` | [`LZSS_DECOMP_WINDOW`](knowledge/wram/LZSS_DECOMP_WINDOW.md) | `u8[0x0400]` | decompression, system, bank7f | 1,024-byte sliding ring buffer decompression window used by ROM LZSS method 0x03 decompression engine ($8C:988D). |
| `$7F:A400` | [`FONT_GLYPH_2BPP_BUF`](knowledge/wram/FONT_GLYPH_2BPP_BUF.md) | `u8[0x0C00]` | dialogue, graphics, bank7f | 2bpp font glyph proportional rasterization buffer and text tile blitter staging arena ($7E:0B41, $8C:A5AC, $8C:9E03). |
| `$7F:B000` | [`SOUND_SAMPLE_SCRATCH`](knowledge/wram/SOUND_SAMPLE_SCRATCH.md) | `u8[0x1300]` | audio, sound, bank7f | Audio sample staging buffer and sound driver transient streaming blocks for SPC700 communication ($8C:8000). |
| `$7F:C300` | [`DELTA_ACCUMULATOR_GRAPHICS`](knowledge/wram/DELTA_ACCUMULATOR_GRAPHICS.md) | `u8[0x0500]` | graphics, bank7f | Graphic ID and delta accumulator buffer populated during dynamic block animation updates ($90:8E85). |
| `$7F:C800` | [`SHADOW_TILEMAP_BUF`](knowledge/wram/SHADOW_TILEMAP_BUF.md) | `u16[2048]` | graphics, dialogue, hud, bank7f | 32×32 shadow tilemap RAM for dialogue windows, choice boxes, and HUD border 9-slice frames before VRAM DMA commit ($8C:CC43, $8C:CB64). |
| `$7F:D800` | [`DIALOGUE_DECODE_HEADER`](knowledge/wram/DIALOGUE_DECODE_HEADER.md) | `u8[30]` | dialogue, script, bank7f | Dialogue decompression control registers and dictionary symbol decoding parameters ($8C:CCF5). |
| `$7F:D81E` | [`DIALOGUE_DECODE_TEXT_BUF`](knowledge/wram/DIALOGUE_DECODE_TEXT_BUF.md) | `u8[1024]` | dialogue, script, bank7f | Active dialogue text line decoding buffer holding unpacked character stream before glyph rasterization ($8C:CCD3, $8C:CCF5). |
| `$7F:DC1E` | [`DIALOGUE_TEXT_RING_BUF`](knowledge/wram/DIALOGUE_TEXT_RING_BUF.md) | `u8[640]` | dialogue, script, bank7f | Cyclic decompressed text ring buffer (8 lines × 80 bytes, stride 80, wrap 640 bytes) tracked by cursor $7E:3BBF ($8C:CD84). |
| `$7F:DE9E` | [`BANK7F_DMA_SCRATCH`](knowledge/wram/BANK7F_DMA_SCRATCH.md) | `u8[8546]` | system, scratch, bank7f | High memory scratchpad and DMA upload staging arena in Bank $7F ($7F:DE9E through $7F:FFFF). |

