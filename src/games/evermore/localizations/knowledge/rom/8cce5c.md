---
addr: 8CCE5C
kind: code
category: 🧠
name: launch_trigger_script
title: Launch script thread from trigger activation
confidence: confirmed
tags: [script-vm, triggers]
evidence: ["disasm: offsets scriptId from table base $92:8000 + word[0]; reads 24-bit packed script pointer into DP $26-$28; calls script_vm_alloc_slot ($8C:CF18); binds triggering entity at slot +0x0D; appends newly allocated slot to active run list $7E:2F28,x and updates null terminator", "triggers: jumped to from scan_room_triggers ($8F:ACCE) when an actor activates a bounding box"]
see: [docs/disassembly/maps/trigger-scanner.md, rom/8facce.md, rom/8ccffd.md]
---
Spawns a new script thread in the Script VM when an event trigger or B-button interaction activates.
Resolves the 24-bit packed script address from the ROM table at `$92:8000`, allocates a thread slot
via `script_vm_alloc_slot` (`$8C:CF18`), attaches the triggering entity to slot `+0x0D`, and appends
the slot to the active thread run list at `$7E:2F28,x`, scheduling it for execution in the next turn pass.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/trigger-scanner.md`.

