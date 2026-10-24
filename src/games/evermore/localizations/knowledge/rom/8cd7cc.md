---
addr: 8CD7CC
end: 8CD7E5
kind: code
category: 🧠
name: script_op_19_1d_write_temp_word
title: Script opcodes 0x19, 0x1d — write temp word
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: vanilla VFS at $8C:D7CC selects base $2834, then shared tail $8C:D7D4 adds a u16 offset, evaluates an expression, and writes a word", "dispatch: opcode table entries $8C:E8EF and $8C:E8F7 both target $8C:D7CC", "vm: returns carry set after the word store"]
see: [docs/disassembly/script-vm/opcode-19-1d-write-temp-word.md]
---
The shared handler reads a 16-bit offset, evaluates an expression, and writes the resulting word to `$7E:2834 + offset`. Opcodes `0x19` and `0x1D` use this routine and continue in the same turn.
