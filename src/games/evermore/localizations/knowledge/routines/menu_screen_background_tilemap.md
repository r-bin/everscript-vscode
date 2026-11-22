---
addr: C42FF4
size: 1792
end: C436F3
kind: data
category: 🎨
name: menu_screen_background_tilemap
title: Menu screen BG1 tilemap (32×28 entries)
confidence: confirmed
tags: [graphics, menu, tilemap]
evidence: ["disasm: $8C:B804 uploads $700 bytes from $C4:2FF4 to VRAM $0000 (jml $80:8650); $8C:B76C sets BG1SC ($2107) = 0: BG1's tilemap is at VRAM $0000; $700 bytes = 32×28 words"]
see: [routines/menu_stone_background_tileset_c41f74.md]
---
How the stone background's 8bpp tiles are laid out on the menu screens (mode 4, BG1). Was called window frame
tiles (a guess). The 16 bytes after it, up to `$C4:3703`, are not read here.
