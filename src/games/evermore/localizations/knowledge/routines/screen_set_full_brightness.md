---
addr: 8085ED
end: 8085F5
size: 9
kind: code
category: 🧠
name: screen_set_full_brightness
title: Set PPU screen display to maximum brightness (0x0F) in shadow register
confidence: confirmed
tags: [ppu, screen, brightness, graphics]
evidence: ["disasm: PHA; LDA #$000F; STA $0106; PLA; RTL at $80:85ED..$80:85F5; preserves Accumulator and restores screen brightness to 15"]
see: [ram/7e0106.md, rom/8085f6.md]
---
Sets screen brightness shadow register `$7E:0106` to maximum brightness (`0x000F`), preserving the incoming Accumulator value across stack push/pull (`PHA` / `PLA`). Used to unblank the display or restore full luminescence after transitions.
