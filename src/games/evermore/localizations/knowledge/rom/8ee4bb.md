---
addr: 8EE4BB
kind: code
category: ⚔️
name: gameplay_frame_hud_physics_and_oam_tick
title: Gameplay frame physics, compass HUD, and OAM finalizer ($8E:E4BB)
confidence: confirmed
evidence: ["disasm: updates cutscene threads via $8C:C6CB; renders compass HUD via $90:9876 (render_map_overlay_compass_hud); renders Mode 7 vehicle cockpit via $8F:C61E; updates entity physics via $80:96BB; finalizes OAM via $80:8FEE; runs spare-time loop $8F:9817; caller: $8C:88CC"]
see: [rom/808fee.md, rom/8096bb.md, rom/8fc61e.md, rom/909876.md, rom/8f9817.md]
tags: [engine, loop, physics, oam, hud]
---
Composite gameplay frame processor. Ticks background cutscenes (`$8C:C6CB`), updates compass HUD overlay (`$90:9876`), renders Mode 7 vehicle cockpit sprites (`$8F:C61E`), steps entity physics (`$80:96BB`), blanks unused sprite slots in OAM (`$80:8FEE`), and executes the field spare-time idle loop (`$8F:9817`).
