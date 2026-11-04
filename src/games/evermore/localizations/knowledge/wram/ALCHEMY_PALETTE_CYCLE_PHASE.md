---
addr: $7E:23CB
name: ALCHEMY_PALETTE_CYCLE_PHASE
type: u16
tags: [graphics, palette, alchemy]
confidence: verified
evidence: ["disasm", "cdl"]
---
Alchemy Subsystem: Sprite palette cycling phase offset word ($7E:23CB, values {$00,$20}; read in func_CCE899 at $8C:E8A0). Added as a base offset to ROM sprite palette table $A7CB when updating cycling color gradients for active alchemy visual effects.

