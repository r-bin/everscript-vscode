---
addr: 8FC8DE
end: 8FC904
kind: code
category: 🧠
name: spell_script_payload_unpack
title: Unpack dynamic bytecode spell payload into hit segment descriptor slot
confidence: confirmed
tags: [combat, alchemy, script-vm]
evidence: ["disasm: reads byte count from [$5D]; advances pointer; copies depth offset into +$03,X; copies target word into +$04,X; copies sprite slice into +$0C,X; updates DP $5D"]
see: [docs/disassembly/combat/spell-collision.md, rom/8fc86c.md]
---
Unpacks dynamic spell bytecode instructions from DP `[$5D]` into projectile hit segment descriptors,
configuring depth parameters, target entity bitmasks, and OAM sprite slices.
Full disassembly and clean C reconstruction: `docs/disassembly/combat/spell-collision.md`.
