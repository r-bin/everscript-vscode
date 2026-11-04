---
addr: CC8442
end: CC84D3
size: 146
kind: table
category: 📋
name: MUSIC_TRANSLATION_TABLE
title: Music translation table
confidence: confirmed
tags: [audio, script, table]
evidence: ["disasm: the music handler $8C:D6D6 (opcode 0x33) reads it as lda.l $8C8442,x with X = the operand byte; a negative word is skipped"]
---
opcode 0x33 (music): 73 words → song id.
