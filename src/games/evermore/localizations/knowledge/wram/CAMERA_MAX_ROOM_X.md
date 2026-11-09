---
addr: $7E:08F6
name: CAMERA_MAX_ROOM_X
type: u16
tags: [widescreen, widescreen.camera, widescreen.room_bounds]
confidence: verified
evidence: ["cdl", "disasm"]
---
Maximum allowed horizontal camera scroll limit based on active room metatile dimensions.

## Widescreen notes

room pixel width − 256 ($90:8F80). `camera_smooth_tracking_filter_and_screen_bounds` clamps the rendered camera `$59` to [0, this] after adding the shake offset `$C5` ($90:9F8B..$90:9F9B). A wider view needs a renderer-side policy at these clamps (world mirror or pillarbox); changing the value would change the game (asm read 2026-11-09).
