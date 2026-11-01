---
addr: 7E22EE
size: 2
kind: var
name: SCRIPT_EXECUTION_LOCK_FLAGS
title: Script execution suspend gate and transition lock word
lifetime: room
confidence: confirmed
tags: [script, vm, flags, transition]
evidence: ["disasm: func_8CCEE9 clears bit 0 (AND #$FFFE) during room transition VM reset, unfreezing actors and script slots", "disasm: func_8DB4FA sets bit 0 (ORA #$0001) during dialogue sequences to lock background script processing", "disasm: func_80C4A3 tests and clears bit 0 of high byte $7E:22EF (bit 8: AND #$FFFE) during Mode 7 flight transitions"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit word managing script VM execution locks and actor interaction freeze states across room transitions.
- **Bit 0 (`0x0001`)**: Master script execution suspend gate. Set by `func_8DB4FA` when initiating dialogue or cutscene sequences. Cleared by `func_8CCEE9` (`AND #$FFFE`) during room transition cleanup, concurrently clearing script thread slots (`$7E:28FC`), script run lists (`$7E:2F28`), and entity freeze status (`+$3E` on Boy `$7E:4EC7` and Dog `$7E:4F75`).
- **Bit 8 (`0x0100`, accessed as bit 0 of high byte `$7E:22EF`)**: Mode 7 flight navigation suspend and landing trigger latch. Checked and cleared (`AND #$FFFE` on `$7E:22EF`) in `func_80C4A3` to resume standard collision physics upon disembarking aircraft.
