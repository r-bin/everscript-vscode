---
addr: 8CC67C
end: 8CC6CA
size: 79
kind: code
category: 🧠
name: dialogue_hide_speaker_figure
title: Hide dialogue speaker bust portrait figure in left or right HUD speaker slot
confidence: confirmed
tags: [dialogue, speaker, portrait, cutscene, hud]
evidence: ["disasm: 79 bytes at $8C:C67C..$8C:C6CA; called by script opcode 0x66 ($8C:DEAB) and opcode 0x6A ($8C:DECD) with speaker slot in X; clears speaker status bits in $7E:0B79 and exits via RTL"]
see: [rom/8cdeab.md, rom/8cdecd.md, rom/8cc627.md, ram/7e0b79.md]
---
Hides dialogue speaker portrait figure in the designated dialogue window slot (Left slot `X=1` or Right slot `X=2`):
- Invoked by script opcodes `0x66` (`hide_left_speaker`) and `0x6A` (`hide_right_speaker`).
- Clears speaker active flag bits in dialogue status register `$7E:0B79`.
- Dismisses the speaker figure sprite overlay and returns via `RTL`.

