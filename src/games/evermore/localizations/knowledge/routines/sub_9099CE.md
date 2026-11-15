---
addr: 9099CE
end: 9099FA
size: 45
kind: code
category: 🧠
name: sub_9099CE
evidence: ["disasm: `lda $7F0000,x : phy : tay : lda [$26],y ... jmp $9A58 : rts` at $90:99CE", "c: G1 passed 100% parity"]
---

Terrain metatile decompression loop that copies metatile indices from $7F0000 and resolves tile pattern words via pointer $26 into staging VRAM buffer, wrapping around row bounds at $30, before queueing VRAM DMA transfer via $90:9A58.
