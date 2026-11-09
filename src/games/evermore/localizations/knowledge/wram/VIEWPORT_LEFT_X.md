---
addr: 7E2401
size: 8
kind: struct
name: VIEWPORT_LEFT_X
title: Active on-screen camera viewport boundaries in world coordinates
lifetime: room
confidence: verified
tags: [camera, rendering, viewport, widescreen, widescreen.camera]
evidence: ["disasm: func_D09E93+$011E writes base X ($BF) to $2401, X+256 to $2403, base Y ($C1) to $2405, Y+224 to $2407", "disasm: func_CCEC8E reads $2401/$2405 to test if entity is on-screen for rendering and AI execution"]
---
Stores the 4-word bounding box representing the active screen camera viewport in room world coordinates:
- `$7E:2401`: Viewport left X (`$BF`)
- `$7E:2403`: Viewport right X (`$BF + 256`)
- `$7E:2405`: Viewport top Y (`$C1`)
- `$7E:2407`: Viewport bottom Y (`$C1 + 224`)
Entities and script triggers check these bounds to cull off-screen processing.

## Widescreen notes

Written at the end of `camera_smooth_tracking_filter_and_screen_bounds` from the target camera `$BF`/`$C1` (before shake and clamp to `$08F6`). No engine routine reads it directly; scripts can (the script operand table read at `$8C:EC8E` covers it). Widening it would change script-visible state (asm read 2026-11-09).
