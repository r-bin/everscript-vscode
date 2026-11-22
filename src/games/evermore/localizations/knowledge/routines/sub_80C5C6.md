---
addr: 80C5C6
end: 80C5CD
size: 8
kind: code
category: 🧠
name: sub_80C5C6
title: Mode 7 Flight: Abort / landing button check and scene fadeout trigger ($80:C5C6)
confidence: confirmed
tags: ["code", "subroutine", "mode7", "flight", "joypad", "transition"]
evidence: ["disasm: tests button bit $4000 (X button); if pressed, jumps via jmp $C6BF to fadeout exit handler in scene_transition_timer_decrement_or_loop; otherwise falls through to speed/HUD handler $80:C5CE; caller: $80:C6A6"]
---

Evaluates controller input during Mode 7 flight transitions (`bit #$4000`, testing button X). If pressed, branches via `jmp $C6BF` into `scene_transition_timer_decrement_or_loop` to initiate screen and audio fadeout (`screen_fade_out_to_black_sync` / `fade_audio_and_video_to_black_sync`) and transition out of the flight scene; otherwise falls through to speed and HUD controller evaluation at `$80:C5CE`.
