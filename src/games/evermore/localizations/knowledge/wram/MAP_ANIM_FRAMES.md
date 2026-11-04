---
addr: 7E4FE6
size: 50
kind: table
name: MAP_ANIM_FRAMES
title: Animated tile channel current frame indices (50 channels)
lifetime: room
confidence: confirmed
tags: [graphics, vram, animation, map]
evidence: ["read: src/games/evermore/emulator/webview/overlays/06-inidisp-shadow.js reads animated tile frame indices", "read: src/games/evermore/emulator/webview/overlays/05-idle-sprites.js reads ANIM_FRAME_INDEX_ADDR at 0x7E4FE6", "disasm: animated tile VRAM cycling routine in bank $90 updates 50 channel indices at $7E:4FE6"]
see: [knowledge/wram/5018.md, docs/disassembly/engine-core/wram-map.md]
---
50-byte array (`$7E:4FE6`..`$7E:5017`) containing the current animation sequence frame index for up to 50 concurrent animated background tile channels.
Updated by the bank `$90` background animation processor to cycle water, lava, waterfalls, torches, and glowing crystal patterns.

