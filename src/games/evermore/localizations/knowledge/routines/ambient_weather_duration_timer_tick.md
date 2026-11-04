---
addr: 919FF9
size: 34
end: 91A01A
kind: code
category: 🎮
name: ambient_weather_duration_timer_tick
title: Ambient weather effect duration timer tick and particle render ($91:9FF9)
confidence: confirmed
evidence: ["disasm: checks duration timer +$16,Y; if zero, calls cleanup $80:8E52 and advances bytecode PC +$14,Y by 2; else decrements timer and calls weather particle renderer $91:BE05"]
see: ["routines/obj_tile_lru_cache_reclaim_orphaned_slots.md","routines/ambient_weather_particles_frame_tick.md"]
tags: ["weather","timer","particle","ambient"]
---
Decrements ambient weather timer `+$16,Y`. If reaching zero, clears timer and advances script pointer `+$14,Y` by 2 via `func_808E52`. If still positive, decrements timer and calls weather particle renderer `func_91BE05`.
