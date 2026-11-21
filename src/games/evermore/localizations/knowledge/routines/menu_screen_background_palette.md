---
addr: C42F74
size: 128
end: C42FF3
kind: data
category: 🎨
name: menu_screen_background_palette
title: Menu screen stone background palette (64 colours to CGRAM 32)
confidence: confirmed
tags: [graphics, menu, palette]
evidence: ["disasm: video_subsystem_hardware_registers_and_ppu_reset ($8C:B797) loads $80 bytes from $C4:2F74 to CGRAM $20 through $80:85FA", "rom: the 8bpp stone tiles ($C4:1F74) use indices 32-95"]
see: [routines/menu_stone_background_tileset_c41f74.md]
---
The stone background's colours. Was called window corner tiles (a guess).
