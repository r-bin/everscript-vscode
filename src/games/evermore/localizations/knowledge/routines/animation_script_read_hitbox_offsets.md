---
addr: 90887B
size: 51
end: 9088AD
kind: code
category: 🎮
name: animation_script_read_hitbox_offsets
title: Read character/projectile collision hitbox bounding box offsets ($90:887B)
confidence: confirmed
evidence: ["disasm: calls hitbox calculator $8F:C905; extracts horizontal offset +$0B,X with sign extension into +$42,Y; extracts vertical offset +$0D,X with sign extension into +$44,Y"]
see: ["routines/entity_animation_sprite_direction_and_offset_init.md"]
tags: ["animation","hitbox","collision","physics"]
---
Reads character/projectile collision hitbox bounding box offsets. Calls hitbox calculator `func_8FC905` (`$8F:C905`), resolves horizontal offset `+$0B,X` with sign extension into `+$42,Y`, and vertical offset `+$0D,X` into `+$44,Y`.
