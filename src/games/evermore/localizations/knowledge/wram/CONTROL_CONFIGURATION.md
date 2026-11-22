---
addr: 7E0B21
size: 2
kind: var
name: CONTROL_CONFIGURATION
title: Control Prefs configuration (0 = Configuration 1, 2 = Configuration 2)
lifetime: save
confidence: verified
tags: [input]
evidence: ["disasm: $8D:9FD4 in the Control Prefs screen loop flips it with EOR #$0002 on Up/Down ($0104 & $0F00), then reloads the buttons ($8D:A07F) and the description ($8D:9F1C, text table $8D:9FB2: \"Configuration 1\" / \"Configuration 2\")", "disasm: $8D:A07F loads ACTION_BUTTON from $8D:A091,X and RUN_BUTTON from $8D:A095,X; called at session init ($80:8D1D), after a save loads ($8D:B4B1) and from that screen"]
see: [knowledge/wram/ACTION_BUTTON.md, knowledge/wram/RUN_BUTTON.md]
---
The controller setup chosen in Control Prefs, a word index into the two-entry button tables at `$8D:A091`
(action) and `$8D:A095` (run). Configuration 1 (0): action B, run A. Configuration 2 (2): action A, run B.
Up or Down in that screen switches it; the game copies the two masks into `$0B25` and `$0B23`.
