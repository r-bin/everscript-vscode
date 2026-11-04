---
addr: $7E:72D1
name: SPRITE_TILE_STAGING_BUF
type: u8[80]
tags: [sprites, vram, staging]
confidence: verified
evidence: ["disasm: staging buffer header for 4bpp sprite tile graphics unpacked dynamically before VRAM DMA upload (80 bytes: $7E:72D1..$7E:7320)"]
---
Staging buffer header for 4bpp sprite tile graphics unpacked dynamically before VRAM DMA upload (80 bytes: $7E:72D1..$7E:7320).
