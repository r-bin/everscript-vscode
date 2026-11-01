---
addr: 7E14C8
size: 2
kind: var
name: MODE7_CAMERA_FOCAL_DISTANCE
title: Mode 7 camera focal distance and altitude scale factor
lifetime: room
confidence: confirmed
tags: [mode7, flight, camera, math]
evidence: ["disasm: func_80CFA9 adds $14C8 to each 16-bit word fetched from $80:E293,X and stores to $7E:2050..$7E:208E", "disasm: func_80D113 documents $7E14C8 offset addition in ExHiROM perspective transformation"]
see: [src/games/evermore/localizations/knowledge/rom/80cfa9.md, src/games/evermore/localizations/knowledge/rom/80d113.md]
---
16-bit focal distance / altitude offset added to ROM perspective matrix entries during Mode 7 rendering calculations.
- Evaluated by `func_80CFA9` across 32 matrix scanline positions (`$7E:2050`..`$7E:208E`) to project ground terrain against camera altitude.
