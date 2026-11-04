---
addr: 808838
size: 38
end: 80885D
kind: code
category: 🧠
name: joypad_button_typematic_repeat
title: Joypad Button Typematic Auto-Repeat Engine
confidence: confirmed
tags: [system]
evidence: ["disasm: $80:8838 compares button mask A with held buttons $0345, decrements repeat timer $0343, reloads sustained rate $0349 upon expiry, or resets initial delay $0347 upon new press"]
see: [routines/script_op_97_palette_transfer.md, engine-core/hardware-utilities.md]
---
Processes joypad button input with typematic auto-repeat acceleration:
- Evaluates active button mask against latched held buttons `$7E:0345`.
- On initial press: latches mask and arms countdown timer `$7E:0343` with initial delay `$7E:0347` (e.g. 24 frames / 400 ms).
- While held: decrements `$7E:0343`, suppressing repeated execution (`returns 0`).
- Upon timer expiry: reloads sustained repeat rate from `$7E:0349` (e.g. 6 frames / 100 ms) and fires the button action.
- Powers rapid scrolling across Ring Menu carousels, Shop inventory lists, and dialogue message boxes.
Full clean C decompilation: `docs/disassembly/engine-core/hardware-utilities.md`.
