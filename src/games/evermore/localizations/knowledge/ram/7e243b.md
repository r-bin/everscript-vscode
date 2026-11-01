---
addr: 7E243B
size: 2
kind: var
name: PENDING_SOUND_COMMAND
title: Pending sound effect request mailbox
lifetime: frame
confidence: confirmed
tags: [audio, spc700, sfx, script]
evidence: ["disasm: opcodes 0x30, 0x31, 0x32 handler func_8CD6A7 loads $7E:243B, dispatches to sound driver via func_8C81FD with command $30, and clears $7E:243B with STZ"]
see: [src/games/evermore/localizations/knowledge/opcodes/30.md]
---
16-bit mailbox register holding a queued sound effect or audio driver command awaiting transmission to the SPC700 APU.
- Evaluated and flushed by Script VM opcodes `0x30`, `0x31`, and `0x32` (`func_8CD6A7`), which forward the command byte to `func_8C81FD` under driver command `$30` and clear `$7E:243B`.
