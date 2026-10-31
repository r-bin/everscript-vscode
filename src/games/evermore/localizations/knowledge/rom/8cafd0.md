---
addr: 8CAFD0
kind: code
category: 🎨
name: dialogue_window_vram_blit_fullscreen
title: Dialogue/menu window 1792-byte tilemap VRAM blitter ($8C:AFD0)
confidence: confirmed
evidence: ["disasm: sets source $7F:C800 in DP $26..$28; sets VRAM destination address $0800 in DP $2E; sets byte count $0700 (1792 bytes) in X; jumps via JML to tile blitter $80:8650; callers: $8C:AF10, $8C:AF23, $8D:8000, $8D:CD5E"]
see: [rom/808650.md, ram/7fc800.md]
tags: [ui, dialogue, vram]
---
Blits 1792 bytes (`$0700`, 896 tilemap words = 28x32 tiles) from dialogue staging buffer `$7F:C800` into PPU VRAM address `$0800` using the hardware blitter `$80:8650`.
