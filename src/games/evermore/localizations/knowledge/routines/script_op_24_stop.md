---
addr: 8CE8B6
size: 1
end: 8CE8B6
kind: code
category: 🧠
name: script_op_24_stop
title: Script opcode 0x24 has no handler — STP
confidence: confirmed
tags: [script-vm]
evidence: ["rom: the opcode table entry of 0x24 ($8C:E8BD + 2·0x24) points at $8C:E8B6, an STP byte (v0.320.0, routines/script_opcode_traps_unused_opcodes_land_on_stp_b.md)"]
see: [routines/script_opcode_traps_unused_opcodes_land_on_stp_b.md, routines/SCRIPT_OPCODE_HANDLER_TABLE.md]
---
The one byte opcode `0x24` dispatches to: `STP`, the CPU stops. Its own address, so a halt here names the opcode. Named so Open Evermore's opcodes kind writes every handler by name (`opcodes/unused_24.json`).
