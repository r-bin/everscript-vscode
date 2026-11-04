---
addr: 8CC627
end: 8CC67B
size: 85
kind: code
category: 🧠
name: dialogue_show_speaker_figure
title: Display dialogue speaker bust portrait figure in left or right HUD speaker slot
confidence: confirmed
tags: [dialogue, speaker, portrait, cutscene, hud]
evidence: ["disasm: 85 bytes at $8C:C627..$8C:C67B; called by script opcode 0x65 ($8C:DEB4) and opcode 0x69 ($8C:DED6) with speaker slot in X; configures speaker status bits in $7E:0B79 and exits via RTL"]
see: [rom/8cdeb4.md, rom/8cded6.md, rom/8cc67c.md, ram/7e0b79.md]
---
Displays dialogue speaker portrait figure in the designated dialogue window slot (Left slot `X=1` or Right slot `X=2`):
- Invoked by script opcodes `0x65` (`reshow_left_speaker`) and `0x69` (`reshow_right_speaker`).
- Sets active speaker display flag bit in dialogue status register `$7E:0B79`.
- Fades in or unhides the speaker figure sprite overlay and returns via `RTL`.
