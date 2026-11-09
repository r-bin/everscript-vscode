---
addr: 7E241F
size: 2
kind: enum
name: CAMERA_SCROLL_MODE
title: Camera viewport tracking target mode enum
lifetime: room
confidence: confirmed
tags: [camera, viewport, engine-core, widescreen, widescreen.scroll, widescreen.window]
evidence: ["disasm: func_909E93 branches on camera tracking mode (0=Boy, 1=Dog, 2=Fixed script anchor)", "disasm: opcode 0x96 sets mode 2 during screen transitions"]
see: [knowledge/wram/VIEWPORT_LEFT_X.md]
---
Determines camera viewport scrolling anchor mode:
- `0`: Smooth camera tracking centered on the Boy entity (`$7E:0F42`)
- `1`: Tracking centered on the companion Dog entity (`$7E:143A`)
- `2`: Fixed / scripted target focus (`$7E:242B`)

## Widescreen notes

Index into the camera-mode table `$90:8E68`, from the room header ($90:8F80). Entry 0 (`$90:9A98`) writes BG1/BG2 scroll from `$59`/`$5B`; the others are the HDMA/window effects (window bounds A/B, heat shimmer, lighting, torch flicker). In mode 2 entity sprites are positioned against BG1 scroll instead of `$59` (`entity_sprite_depth` $8F:C773). Each effect room needs its own widescreen check (asm read 2026-11-09).
