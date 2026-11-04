---
addr: CC8362
end: CC8441
size: 224
kind: table
category: 📋
name: SFX_TRANSLATION_TABLE
title: SFX translation table
confidence: confirmed
tags: [audio, script, table]
evidence: ["disasm: the sound handler $8C:D6A7 (opcodes 0x30-0x32) reads it as lda.l $8C8362,x with X = the operand byte; a negative word is skipped"]
---
opcode 0x30 (sound): 112 words, $FFFF = muted.
