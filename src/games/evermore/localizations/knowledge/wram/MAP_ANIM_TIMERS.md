---
addr: 7E5018
size: 50
kind: table
name: MAP_ANIM_TIMERS
title: Animated tile channel cycle hold delay timers (50 channels)
lifetime: room
confidence: confirmed
tags: [graphics, vram, animation, map]
evidence: ["disasm: animated tile VRAM cycling routine in bank $90 decrements 50 countdown timers at $7E:5018", "see: wram-map.md line 960"]
see: [knowledge/wram/MAP_ANIM_FRAMES.md, docs/disassembly/engine-core/wram-map.md]
---
50-byte array (`$7E:5018`..`$7E:5049`) holding countdown tick delay timers for each of the 50 animated tile channels.
When a channel's timer reaches zero, the animation engine advances its frame counter in `$7E:4FE6` and reloads the channel's frame hold duration from ROM descriptors.

