---
addr: $7E:507D
name: MAP_ANIM_DESCRIPTORS
type: u16[16]
tags: [maps, animation, vram]
confidence: verified
evidence: ["disasm: scanned by map background tile animation search routine at $90:A2A2 via LDY $507D,X (bank_D0.asm line 6196)", "docs: docs/disassembly/maps/tile-animation.md §1 (16 descriptor slot pointers)"]
---
Background tile animation ROM descriptor slot pointers (16 channels × 16-bit offset into active room blob).
