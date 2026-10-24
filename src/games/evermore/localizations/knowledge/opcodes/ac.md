---
addr: AC
kind: opcode
title: Cast a spell (skip a dead Dog)
confidence: confirmed
tags: ["opcode.combat"]
everscript: ["cast()"]
evidence: ["disasm: $8C:D0C3 tests Dog HP at $4F37 + $2A; dead Dog is stored as the $3BC1 exclusion marker before shared cast processing at $8C:D0D3"]
see: ["rom/8cd0c3.md", "docs/disassembly/script-vm/opcode-ac-cast-skip-dead-dog.md"]
---
As `0x9E`, but initializes `$3BC1` to the Dog (`$4F37`) when its HP at `+$2A` is zero; the shared target loop skips that entity. If HP is nonzero, `$3BC1` is cleared before shared cast processing.

## Why it exists

Spells aimed at the party.
