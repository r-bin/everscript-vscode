---
addr: 7E0104
size: 2
kind: var
name: JOYPAD1_HELD
title: Joypad 1 held buttons, minus the presses code has acknowledged
lifetime: boot
confidence: verified
tags: [input, nmi]
evidence: ["disasm: NMI $80:847A computes ~($0EC6 xor $0104) and stores it, then ANDs it with the new held word after the read (CDL export, v0.201.18)", "disasm: $80:8597 is TRB $0104 / RTL, used to consume a press", "recomp headless 2026-11-12, inn keeper in room $51: with B held after the press that opened it, the text box does not go on; pressed again (B let go for a frame between) it does"]
see: [knowledge/wram/INPUT_P1_HELD_BUTTONS.md, knowledge/wram/ACTION_BUTTON.md, knowledge/wram/RUN_BUTTON.md]
---
A new press sets its bit, holding keeps it, and code that has acted on the press clears it with `TRB $0104`
(`$80:8597`); the NMI then keeps it clear until the button is released. So a held button counts once: the run step
clears RUN_BUTTON when the stamina runs out, the dialogue's waits clear `$D0C0` (B, Y, Start, A, X) before and after
each wait. In the title's load-game list one B press selects the slot and a second B confirms it.
