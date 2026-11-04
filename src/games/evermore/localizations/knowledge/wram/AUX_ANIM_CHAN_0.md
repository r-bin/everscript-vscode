---
addr: 7E0858
end: 7E0867
size: 16
kind: struct
name: AUX_ANIM_CHAN_0
title: Auxiliary / spell animation channel 0 state (16 bytes)
lifetime: room
confidence: confirmed
tags: [combat, graphics]
evidence: ["disasm: auxiliary and target cursor animation dispatch routines in bank $90 at $90:80CE..$90:842F operate on 16-byte channel descriptors"]
---
Auxiliary / spell animation channel 0 state (16 bytes).

## Fields
| offset | size | name | meaning |
|---|---|---|---|
| +$00 | 2 | ADDR | 16-bit bytecode address of auxiliary animation channel |
| +$02 | 1 | BANK | ROM bank byte of auxiliary animation channel bytecode |
| +$03 | 2 | BASE | Base bytecode address for looping auxiliary animation channel |
| +$05 | 1 | DELAY | Frame delay countdown timer for auxiliary animation channel |
| +$06 | 2 | SPRITE_PTR | 16-bit graphics pattern address of active sprite frame |
| +$08 | 1 | SPRITE_BANK | ROM bank byte of active sprite frame graphics pattern |
| +$09 | 1 | PARAM_BYTE | Byte operand / status flag parameter in auxiliary animation channel |
| +$0A | 2 | PARAM_WORD | Word operand / coordinate parameter in auxiliary animation channel |
| +$0C | 2 | PALETTE_FLAGS | OAM priority and palette attribute bits for auxiliary animation channel |
| +$0E | 2 | STEP | Elapsed animation step counter for auxiliary animation channel |
