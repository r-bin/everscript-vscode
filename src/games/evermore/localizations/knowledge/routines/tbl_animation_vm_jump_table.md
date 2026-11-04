---
addr: 908000
end: 9080CD
size: 206
kind: table
category: 🧠
name: tbl_animation_vm_jump_table
title: Animation bytecode VM opcode execution vector table
confidence: confirmed
tags: [animation, sprites, vm, dispatcher]
evidence: ["disasm: indexed by (cmd & 0x7F) * 2 by interpreter $90:80CE; 103 valid jump vectors (0x00..0x66) pointing to animation opcode handlers in Bank $90", "docs: docs/entities/animation_script.md and docs/disassembly/engine-core/rom-tables.md", "cdl: the vanilla CDL library (2026-11-03) never saw the targets of entries $64-$66 ($90:8E09, $8E5E, $8E68) run; the bytes at $90:8E68 read as 16-bit values $9A81-$9D45 (a pointer table?) and $8E5E's REP/LDA/ORA/STA runs into them, so $65 and $66 may not be real handlers (unverified). The recomp seeds list only entries whose targets ran (everscript v0.387.31)"]
see: [rom/9080ce.md, docs/entities/animation_script.md]
---
Vector jump table for the Secret of Evermore sprite animation bytecode VM interpreter (`$90:80CE`).
Contains 103 16-bit jump vectors (`0x00`..`0x66`, 206 bytes) mapping opcode numbers to their bank `$90` handler routines.
Opcodes above `0x66` fall into non-code data boundaries.
Command byte bit 7 signifies the end-of-frame execution boundary.
