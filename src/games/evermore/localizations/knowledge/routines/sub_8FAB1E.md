---
addr: 8FAB1E
end: 8FAB6D
size: 80
kind: code
category: 🧠
name: sub_8FAB1E
evidence: ["disasm: `lda $0012,y : sta $12 : lda $0014,y : sta $14 : ldy $4e : ... : rtl` at $8F:AB1E", "c: G1 passed 100% parity"]
---

Traverses companion breadcrumb coordinate history ring buffer starting at pointer `$4E`, accumulating step distances between consecutive waypoints and testing if accumulated distance exceeds the companion trailing threshold.
