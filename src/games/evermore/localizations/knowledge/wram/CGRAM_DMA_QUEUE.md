---
addr: $7E:1292
name: CGRAM_DMA_QUEUE
type: CgramQueueEntry[32]
tags: [cgram, graphics]
confidence: verified
evidence: ["cdl", "disasm: func_C085FA (loc_C08627) writes transfer descriptors into $7E:1292,x, advances $128E by #$0007, and wraps at #$00E0"]
---
32-slot deferred CGRAM DMA transfer queue (`$7E:1292`..`$7E:1371`, 224 bytes).

Each descriptor (`CgramQueueEntry`) is 7 bytes:
| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | SRC_ADDR | 16-bit source address in bank |
| +$02 | 1 | SRC_BANK | 8-bit source bank |
| +$03 | 2 | CGRAM_DEST | Target CGRAM color index (CGADD $2121) |
| +$05 | 2 | BYTE_COUNT | Number of bytes to transfer |

Palette transfers are packed into this deferred queue by `$80:85FA` when direct DMA is disabled, and committed to PPU CGRAM during the subsequent VBLANK interrupt.

