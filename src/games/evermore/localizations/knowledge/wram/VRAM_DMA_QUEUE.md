---
addr: $7E:013F
name: VRAM_DMA_QUEUE
type: VramDmaEntry[16]
tags: [graphics, system]
confidence: verified
evidence: ["cdl", "disasm: $80:8A86, $90:8E40"]
---
16-slot deferred VRAM DMA queue (`$7E:013F`..`$7E:01BE`, 128 bytes: 16 descriptors × 8 bytes).

Each descriptor (`VramDmaEntry`) is 8 bytes:
| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | SRC_ADDR | 16-bit source address in bank |
| +$02 | 1 | SRC_BANK | 8-bit source bank |
| +$03 | 1 | FLAGS | DMA transfer flags / mode parameter |
| +$04 | 2 | DEST_VRAM | Target VRAM word address ($2116 VMADDL/VMADDH) |
| +$06 | 2 | BYTE_COUNT | Number of bytes to transfer |

Read cursor is tracked by `VRAM_DMA_QUEUE_TAIL` (`$7E:013B`) and write cursor by `VRAM_DMA_QUEUE_CURSOR` (`$7E:013D`). Processed during VBlank.
