---
addr: 80CE0F
size: 38
end: 80CE34
kind: code
category: 🎮
name: scene_transition_step_decrement
title: Decrement scene transition step counter towards zero ($80:CE0F)
confidence: confirmed
evidence: ["disasm: checks step counter $14BA; if non-zero, decrements $14BA; callers: scene transition loop $80:CBD1"]
see: ["routines/mode7_flight_waypoint_path_step.md"]
tags: ["transition","counter","timer", "mode7"]
---
Decrements scene transition countdown counter `$14BA` until it reaches 0.
