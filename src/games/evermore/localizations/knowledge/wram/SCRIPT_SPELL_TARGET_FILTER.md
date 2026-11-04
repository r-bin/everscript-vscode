---
addr: $7E:3BC1
name: SCRIPT_SPELL_TARGET_FILTER
type: u16
tags: [script, magic, combat]
confidence: verified
evidence: ["disasm: cleared by script_op_9e_cast_all ($8C:D0D0) via STZ $3BC1; compared against target expressions via EOR $3BC1 at $8C:D0FF and $8C:D1A9 to skip null/self matches before enqueuing target entity"]
---
Target entity filter / exclusion value during script opcode 0x9E (cast spell) target list evaluation. Cleared to 0 at entry to skip null/self targets.

