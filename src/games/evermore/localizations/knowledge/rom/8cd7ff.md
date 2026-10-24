---
addr: 8CD7FF
end: 8CD81B
kind: code
category: 🧠
name: script_op_11_15_write_temp_byte
title: Script opcodes 0x11 and 0x15 write a temporary byte
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: vanilla VFS shows $8C:E8DF and $8C:E8E7 both target $8C:D7FF; handler reads a u16 offset, adds it to $2834, evaluates a value, stores its low byte through DBR $7E, and returns with carry set", "opcode-vfs: entries 0x11 and 0x15 both specify a u16 operand and handler $8C:D7FF"]
see: [docs/disassembly/script-vm/opcode-11-15-write-temp-byte.md]
---
Opcodes `0x11` and `0x15` share this handler. It fetches a 16-bit destination offset, adds it to `$2834`, evaluates an expression, stores the expression's low byte to the computed address through data bank `$7E`, and returns carry set for same-turn continuation. The surrounding expression evaluator owns any pointer advancement caused by the expression itself.
