---
addr: 8CDBF0
end: 8CDC0F
kind: code
category: 🧠
name: script_op_20_teleport_party
title: Script opcode 0x20 teleports the party to a tile
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: vanilla VFS at $8C:DBF0 converts two u8 tile coordinates to pixel coordinates by multiplying by 8, clears layer DP $44, calls $8F:B434, and returns carry set", "engine: $8F:B434 centers the camera and places Boy and Dog at the spawn coordinates"]
see: [docs/disassembly/script-vm/opcode-20-teleport-party.md, rom/8fb434.md]
---
The handler reads X and Y tile bytes, scales each by eight, selects layer zero, and calls `$8F:B434` to place Boy and Dog and center the camera.
