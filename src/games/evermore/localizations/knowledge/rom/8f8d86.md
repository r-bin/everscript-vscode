---
addr: 8F8D86
end: 8F8E07
size: 130
kind: code
category: 🧠
name: enemy_archetype_animation_and_palette_setup
title: Enemy archetype animation sequence indices and palette assignment setup
confidence: confirmed
tags: [enemy, spawn, archetype, animation, palette, entities]
evidence: ["disasm: 130 bytes at $8F:8D86..$8F:8E07; unpacks animation IDs from archetype template into entity slot registers +$34..+$3A, sets up direct page pointers, jumps to $90:BE4C"]
see: [rom/8f8d80.md, rom/8f8e08.md, rom/8f8f22.md]
---
Enemy archetype animation and appearance initialization routine:
- Reads animation sequence indices from the archetype record at `$008E,Y`.
- Unpacks default idle, walking, running, and attack animation descriptors into entity record offsets `+$34`, `+$36`, `+$38`, `+$3A`.
- Jumps to `$90:BE4C` to register initial sprite frames with the graphics compositor.

