---
addr: 7E0ADA
size: 2
kind: var
name: RING_EQUIPPED_ALCH_8
title: 16-bit word storage of current room / map ID
lifetime: room
confidence: confirmed
tags: [room, map]
evidence: ["read: inline-adapter.ts evaluates <0x0ADA> ($7E:0ADA) as current room word", "disasm: high byte at $7E:0ADB stores CURRENT_MAP_ID"]
see: [ram/7e0adb.md, ram/7e0b3c.md]
---
16-bit word storage for the current room/map ID. High byte at `$7E:0ADB` holds the active room index into the master room table at `$9FFDE7`.
