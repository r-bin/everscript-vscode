---
addr: 8CCE4D
kind: code
category: 🧠
name: script_start_entity_event_script
title: Start an entity's event script as a thread
confidence: likely
tags: [script-vm]
evidence: ["disasm: X = entity +$66, $8C:CE5C looks it up in the $92:8000 table and starts it ($8C:CF18), then the reason (A) goes to the new slot's +$09 (v0.320.0)", "read: called by opcode 0x3F ($0400), $8F:C213 (hit, $0100), $90:83E4 / $90:84D2 (death, $0200)"]
see: [rom/8cdd60.md]
---
Starts the event script of an entity (Y): its trigger id at `+$66` is looked up in the script pointer
table at `$92:8000` (`$8C:CE5C`) and started as a new thread; the reason (A: `$0100` hit, `$0200` death,
`$0400` started by opcode `0x3F`) is stored in the new slot at `+$09`, where the script can read it.
