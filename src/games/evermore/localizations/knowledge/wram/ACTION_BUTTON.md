---
addr: 7E0B25
size: 2
kind: var
name: ACTION_BUTTON
title: Attack / talk button mask of the control setup ($4218 order; B in Configuration 1, A in 2)
lifetime: save
confidence: verified
tags: [input, boy, dog, combat]
evidence: ["disasm: $8D:A07F stores $8D:A091,X here (X = CONTROL_CONFIGURATION): $8000 or $0080", "disasm: $8F:CE0D LDA $0B25 / TRB $0104: a new press checks the metatile ahead for a B-trigger ($8000 in its attribute word) or starts a swing ($8F:CE9C)", "disasm: $8F:CD91 while the actor's +$12 bit $0800 is set and the button is held at 100 % stamina, the gauge charges by $0A54 - 3 a frame up to $0A52"]
see: [knowledge/wram/CONTROL_CONFIGURATION.md, knowledge/wram/JOYPAD1_HELD.md]
---
The button that attacks, talks and checks, as a mask over `$0104` (new press) and `$0EC6` (held). Holding it after a
swing at full stamina charges the weapon; letting go above 100 % releases the charged attack (`$8F:CE56`).
