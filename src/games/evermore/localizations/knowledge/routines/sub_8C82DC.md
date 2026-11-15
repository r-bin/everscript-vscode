---
addr: 8C82DC
end: 8C82E2
size: 7
kind: code
category: 🧠
name: sub_8C82DC
evidence: ["disasm: `rep #$30 : sta $0E4F : bra $8C831D` at $8C:82DC", "c: G1 passed 100% parity"]
---

APU sound effect command dispatcher entry point that switches to 16-bit register mode, stores SFX identifier in A to $0E4F, and branches into $8C:831D.
