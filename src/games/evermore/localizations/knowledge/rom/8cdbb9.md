---
addr: 8CDBB9
end: 8CDBEF
kind: code
category: 🧠
name: script_op_21_restart_room
title: Script opcode 0x21 restarts the current room
confidence: confirmed
tags: [script-vm, camera, maps]
evidence: ["disasm: vanilla VFS at $8C:DBB9 calls $80:85D8, $8C:CEE9, $8F:B38E, $8F:B434, and $8C:CE99; reads two u8 tile coordinates; resets DP $83/$80; returns with CLC", "opcode table: $8C:E8FF maps 0x21 to $8C:DBB9; operands u8 u8"]
see: [docs/disassembly/script-vm/opcode-21-restart-room.md, rom/8fb434.md, rom/8cdb71.md, rom/8cdbf0.md]
---
This same-room restart stops script threads and room entities, places Boy and Dog at the requested tile, starts the room-enter script, resets the scheduler registers, and returns with carry clear.
