---
addr: $7E:013D
name: VRAM_DMA_QUEUE_CURSOR
type: u16
tags: [widescreen, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Cursor index into 16-slot deferred VRAM DMA transfer queue.

## Widescreen notes

The streamer `$90:98FA` queues each row/column buffer here (8-byte entries at `$013F`: VMAIN, source, size `$40`, VRAM word address | `$0400` for BG2), wrapped at `$1FF` (asm read 2026-11-09).
