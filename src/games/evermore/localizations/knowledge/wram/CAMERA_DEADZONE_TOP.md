---
addr: 7E2413
size: 2
kind: var
name: CAMERA_DEADZONE_TOP
title: Camera vertical deadzone top margin in room pixels
lifetime: room
confidence: confirmed
tags: [camera, viewport, engine-core]
evidence: ["disasm: $90:9FC9 (camera_deadzone_window_filter) checks if actor Y - $2413 < camera origin Y (DP $C1), scrolling up if exceeded (docs/disassembly/engine-core/camera-viewport-scroll.md)", "c: reconstructed-c/90/909FC9_camera_deadzone_window_filter.c verified 100% parity against ROM", "script: adjusted in 11 rooms (32 uses) including Thraxx, final boss, and Collosia to vertically bias camera framing"]
see: [ram/7e240f.md, ram/7e2411.md, ram/7e2415.md, rom/909fc9.md]
---
Top vertical deadzone margin threshold for camera scrolling:
When the followed entity's Y position falls below `camera_y + $2413`, the viewport scrolls up to track the player. Initialized to standard room defaults at room enter ($90:8E90) and overridden by scripts for specific room framing (e.g. Thraxx's chamber at $98, final boss at $A8).
