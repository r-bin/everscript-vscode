---
addr: 7E2415
size: 2
kind: var
name: CAMERA_DEADZONE_BOTTOM
title: Camera vertical deadzone bottom margin in room pixels
lifetime: room
confidence: confirmed
tags: [camera, viewport, engine-core]
evidence: ["disasm: $90:9FC9 (camera_deadzone_window_filter) checks if actor Y + $2415 - 224 > camera origin Y (DP $C1), scrolling down if exceeded (docs/disassembly/engine-core/camera-viewport-scroll.md)", "c: reconstructed-c/90/909FC9_camera_deadzone_window_filter.c verified 100% parity against ROM", "script: adjusted in 7 rooms (15 uses) including Thraxx, Vigor, and Collosia to vertically bias camera framing"]
see: [ram/7e240f.md, ram/7e2411.md, ram/7e2413.md, rom/909fc9.md]
---
Bottom vertical deadzone margin threshold for camera scrolling:
When the followed entity's Y position exceeds `camera_y + 224 - $2415`, the viewport scrolls down to track the player. Initialized to standard room defaults at room enter ($90:8E90) and overridden by scripts for specific room framing.
