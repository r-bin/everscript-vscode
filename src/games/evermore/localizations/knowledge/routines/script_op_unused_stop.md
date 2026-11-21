---
addr: 8CE8BC
size: 1
end: 8CE8BC
kind: code
category: 🧠
name: script_op_unused_stop
title: Shared STP of 20 opcodes without a handler
confidence: confirmed
tags: [script-vm]
evidence: ["rom: the opcode table entries of 0x01-0x03, 0x0F, 0x13, 0x1F, 0x2F, 0x34-0x37, 0x4F, 0x53, 0x56, 0x57, 0x67, 0x6B, 0x72, 0x8B, 0xB8 point at $8C:E8BC, an STP byte (v0.320.0, routines/script_opcode_traps_unused_opcodes_land_on_stp_b.md)"]
see: [routines/script_opcode_traps_unused_opcodes_land_on_stp_b.md, routines/SCRIPT_OPCODE_HANDLER_TABLE.md]
---
The last of the eight STP bytes: the twenty opcodes without a handler of their own dispatch here and the CPU stops. Named so the opcodes kind of Open Evermore writes every handler by name.
