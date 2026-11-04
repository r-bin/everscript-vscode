---
addr: $7E:23C7
name: STATUS_CLEANSE_MODE
type: u16
tags: [scripts, status, magic]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script VM Subsystem: Status cure dispatch mode word ($7E:23C7; evaluated in opcode 0xAA cure handler func_CCE7EF at $8C:E7EF). When non-zero, triggers full status ailment cleanse across both party characters (Boy and Dog) with carry clear before self-clearing to zero; when zero, executes standard selective ailment removal with carry set.

