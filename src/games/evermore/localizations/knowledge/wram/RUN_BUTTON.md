---
addr: 7E0B23
size: 2
kind: var
name: RUN_BUTTON
title: Run button mask of the control setup ($4218 order; A in Configuration 1, B in 2)
lifetime: save
confidence: verified
tags: [input, boy, dog]
evidence: ["disasm: $8D:A07F stores $8D:A095,X here (X = CONTROL_CONFIGURATION): $0080 or $8000", "disasm: $8F:CE7C BIT $0B23 against JOYPAD1_HELD picks the run step $90:82A8 over the walk ($90:824B) while a direction is held; the Dog's control does the same at $8F:CFB5", "disasm: the run step clears it from $0104 ($90:82CD, TRB through $80:8597) when the stamina falls below 0"]
see: [knowledge/wram/CONTROL_CONFIGURATION.md, knowledge/wram/JOYPAD1_HELD.md]
---
The button the player runs with, as a mask over `$0104`. Running needs the Jaguar Ring (`$2262` bit 1, tested at
`$90:82AB`); without it the run step walks. Each run frame costs stamina: the first one halves the gauge (`+$2E`:
LSR, DEC), the next ones take 4 (with the entity's `+$16` bit `$08` set), and once it would go below 0 the gauge is
set to 0 and the run button is acknowledged, so the player has to press it again to run on.
