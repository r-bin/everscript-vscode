---
addr: 808838
size: 38
end: 80885D
kind: code
category: 🧠
name: joypad_button_typematic_repeat
title: Joypad Button Typematic Auto-Repeat Engine
confidence: verified
tags: [system, joypad, input, reconstructed-c, g1-pass]
evidence: ["disasm: $80:8838 compares button mask A with held buttons $0345, decrements repeat timer $0343, reloads sustained rate $0349 upon expiry, or resets initial delay $0347 upon new press", "g1: 33/33 real states match ROM (100%), 528/528 fuzzed states match ROM, mutation caught: yes, rated 1e07c77046e071c1"]
see: [routines/script_op_97_palette_transfer.md, engine-core/hardware-utilities.md]
---
Processes joypad button input with typematic auto-repeat acceleration:
- Evaluates active button mask against latched held buttons `$7E:0345`.
- On initial press: latches mask and arms countdown timer `$7E:0343` with initial delay `$7E:0347` (e.g. 24 frames / 400 ms).
- While held: decrements `$7E:0343`, suppressing repeated execution (`returns 0`).
- Upon timer expiry: reloads sustained repeat rate from `$7E:0349` (e.g. 6 frames / 100 ms) and fires the button action.
- Powers rapid scrolling across Ring Menu carousels, Shop inventory lists, and dialogue message boxes.

## Reconstructed C
Source: [`reconstructed-c/80/808838_joypad_button_typematic_repeat.c`](../../../../../../reconstructed-c/80/808838_joypad_button_typematic_repeat.c).
Differential parity: Verified with Gate G1 against clean ROM on live Replay 02 states and fuzzed inputs.
Full clean C decompilation: `docs/disassembly/engine-core/hardware-utilities.md`.
