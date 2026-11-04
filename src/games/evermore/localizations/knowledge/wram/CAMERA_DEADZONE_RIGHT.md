---
addr: 7E2411
size: 2
kind: var
name: CAMERA_DEADZONE_RIGHT
title: Camera horizontal deadzone right margin in room pixels
lifetime: room
confidence: confirmed
tags: [camera, viewport, engine-core]
evidence: ["disasm: $90:9FC9 (camera_deadzone_window_filter) checks if actor X + $2411 - 256 > camera origin X (DP $BF), scrolling right if exceeded (docs/disassembly/engine-core/camera-viewport-scroll.md)", "c: reconstructed-c/90/909FC9_camera_deadzone_window_filter.c verified 100% parity against ROM", "script: adjusted on entering rooms with wide framing or transitions (e.g. Desert of Doom, Collosia, Mungola)"]
see: [ram/7e240f.md, ram/7e2413.md, ram/7e2415.md, rom/909fc9.md]
---
Right horizontal deadzone margin threshold for camera scrolling:
When the followed entity's X position exceeds `camera_x + 256 - $2411`, the viewport scrolls right to track the player. Initialized to standard room defaults at room enter ($90:8E90) and overridden by scripts for specific room framing.
