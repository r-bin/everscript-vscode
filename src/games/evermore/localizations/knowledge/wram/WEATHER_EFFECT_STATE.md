---
addr: 7E23C9
size: 2
kind: var
name: WEATHER_EFFECT_STATE
title: Weather particle system animation state and dispatch mode
lifetime: room
confidence: confirmed
tags: [weather, particles, visual]
evidence: ["disasm: cleared to 0 on room enter by func_908E90 ($90:8E90)", "disasm: main frame loop in func_909839 ($90:9839) checks $7E:23C9; mode 1 calls $91:BDC4 to allocate particles and transitions to 2; mode > 1 calls $91:BE05 to update particle physics and draw to OAM; negative mode clears to 0 and cleans up via $80:8E52"]
see: [ram/7e2480.md, rom/908e90.md]
---
Control state gate for atmospheric environmental particle effects (rain, snow, ash particles).
Cleared upon room transitions by `func_908E90`. When set to 1 by a room enter script or event trigger, `func_909839` invokes particle allocation routine `$91:BDC4` and transitions state to 2, which then continuously updates physics and submits particle sprites to OAM via `$91:BE05`.
