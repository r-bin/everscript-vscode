---
addr: $7E:010C
name: PPU_SHADOW_BG34NBA
type: u16
tags: [graphics, ppu]
confidence: verified
evidence: ["cdl", "disasm: $80:B3B0, $8E:E08B"]
---
Hardware shadow register word for PPU $210C (BG3 & BG4 tile base address in VRAM; $80:B3B0, $8E:E08B). Low byte controls BG3/BG4 tile base; high byte maintained in 16-bit PPU register shadow block.
