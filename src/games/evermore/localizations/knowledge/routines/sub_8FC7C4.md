---
addr: 8FC7C4
end: 8FC7FF
size: 60
kind: code
category: 🧠
name: sub_8FC7C4
evidence: ["disasm: `sta $06 : lda $000c,y : bne $8FC7CE : lda #$0200 : tsb $06` at $8F:C7C4", "c: G1 passed 100% parity"]
---

Calculates screen-relative entity sprite projection coordinates and bounding box clipping relative to camera origin `($59, $5B)`: sets up flags in direct page `$06`, checks entity depth against screen boundary (`0 < X < 320`, `0 < Y < 224`), and returns Y coordinate offset.
