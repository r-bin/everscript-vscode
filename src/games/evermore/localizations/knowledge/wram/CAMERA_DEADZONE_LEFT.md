---
addr: 7E240F
size: 2
kind: var
name: CAMERA_DEADZONE_LEFT
title: Camera horizontal deadzone left margin in room pixels
lifetime: room
confidence: confirmed
tags: [camera, viewport, engine-core]
evidence: ["disasm: $90:9FC9 (camera_deadzone_window_filter) checks if actor X - $240F < camera origin X (DP $BF), scrolling left if exceeded (docs/disassembly/engine-core/camera-viewport-scroll.md)", "c: reconstructed-c/90/909FC9_camera_deadzone_window_filter.c verified 100% parity against ROM", "script: adjusted on entering rooms with wide framing or transitions (e.g. Desert of Doom, Collosia, Mungola)"]
see: [ram/7e2411.md, ram/7e2413.md, ram/7e2415.md, rom/909fc9.md]
---
Left horizontal deadzone margin threshold for camera scrolling:
When the followed entity's X position falls below `camera_x + $240F`, the viewport scrolls left to track the player. Initialized to standard room defaults at room enter ($90:8E90) and overridden by scripts for specific room framing.
