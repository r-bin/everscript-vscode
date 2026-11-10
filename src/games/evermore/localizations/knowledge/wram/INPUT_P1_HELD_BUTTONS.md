---
addr: $7E:0EC6
name: INPUT_P1_HELD_BUTTONS
type: u16
tags: [input]
confidence: verified
evidence: ["cdl", "disasm", "disasm: the joypad matcher $8C:F121 compares it with its one entry $2000 = Select, so the word is in $4218 order (B $8000 .. R $0010)", "measure: recomp headless 2026-11-10, save in room $51: Start held 30 field frames, the field counter $0B19 kept counting (a pause or a menu would stop it); Start + a direction read here once per press drives the recomp practice hotkeys (SecretOfEvermoreRecomp docs/cheats.md)"]
---
Player 1 held button mask filtered for current gameplay mode and entity interaction ($80:8985, $8F:B3D4).

Bits in `$4218` order: B `$8000`, Y `$4000`, Select `$2000`, Start `$1000`, Up `$0800`, Down `$0400`, Left `$0200`,
Right `$0100`, A `$0080`, X `$0040`, L `$0020`, R `$0010`. Start does not stop the field (measured: no pause, no menu): free for
hotkeys, as everscript's `hacks/hotkeys` and the recomp's practice hotkeys use it.
