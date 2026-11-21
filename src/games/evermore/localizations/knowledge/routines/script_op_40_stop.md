---
addr: 8CE8BA
size: 1
end: 8CE8BA
kind: code
category: 🧠
name: script_op_40_stop
title: Script opcode 0x40 has no handler — STP
confidence: confirmed
tags: [script-vm]
evidence: ["rom: the opcode table entry of 0x40 ($8C:E8BD + 2·0x40) points at $8C:E8BA, an STP byte (v0.320.0, routines/script_opcode_traps_unused_opcodes_land_on_stp_b.md)"]
see: [routines/script_opcode_traps_unused_opcodes_land_on_stp_b.md, routines/SCRIPT_OPCODE_HANDLER_TABLE.md]
---
The one byte opcode `0x40` dispatches to: `STP`, the CPU stops. Its own address, so a halt here names the opcode. Named so Open Evermore's opcodes kind writes every handler by name (`opcodes/unused_40.json`).
