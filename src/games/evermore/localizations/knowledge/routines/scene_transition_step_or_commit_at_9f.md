---
addr: 80C672
size: 15
end: 80C680
kind: code
category: 🎮
name: scene_transition_step_or_commit_at_9f
title: Scene transition step counter advance and completion check ($80:C672)
confidence: confirmed
evidence: ["disasm: checks step counter $14BA against limit $009F; if reached, jumps to $80:E002 to finalize transition; otherwise increments $14BA and returns; callers: transition coordinator $80:C4A3"]
see: ["routines/install_raster_irq_handler_at_df51.md","routines/mode7_flight_input_simulation.md"]
tags: ["transition","scene","timer", "mode7"]
---
Advances the scene transition progress counter `$14BA`. When the counter reaches threshold `$009F` (159 steps), jumps to `$80:E002` to commit room/map loading and finalize screen fading.
