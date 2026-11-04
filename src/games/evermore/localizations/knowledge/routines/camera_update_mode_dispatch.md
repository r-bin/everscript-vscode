---
addr: 80C192
size: 374
end: 80C307
kind: code
category: 🎮
name: camera_update_mode_dispatch
title: Camera transition state mode dispatcher ($80:C192)
confidence: confirmed
evidence: ["disasm: inspects camera transition mode word $0E70; if equal to 5 or >= 10, jumps to $80:C95B (Mode 7 / boundary clamp); otherwise branches to $80:C1A2; callers: camera master loop $80:BC00"]
see: ["routines/camera_update_mode_dispatch.md","routines/sub_80C95B.md","routines/mode7_flight_scene_hardware_init.md"]
tags: ["camera","scroll","mode7"]
---
Inspects camera transition state `$0E70`. Jumps to boundary/Mode 7 handler `$80:C95B` if state is 5 or >= 10, otherwise proceeds to standard camera scroll tracker `$80:C1A2`.
