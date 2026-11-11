---
addr: 80DA9A
size: 12
end: 80DAA5
kind: code
category: 🗺️
name: camera_rotated_pan_step
title: 2D rotated camera pan composite update step ($80:DA9A)
confidence: confirmed
evidence: ["disasm: executes 3-step sequence: $80:DAA6 (calc_screen_rotation_sin_cos), $80:DACC (calc_rotated_velocity_vector), $80:DB04 (apply_rotated_camera_translation_step); callers: $80:C1A2, $80:C95B"]
see: [routines/calc_screen_rotation_sin_cos.md, routines/calc_rotated_velocity_vector.md, routines/apply_rotated_camera_translation_step.md]
tags: [camera, rotation, pan, mode7]
---
Master per-frame step for 2D rotated camera panning. Chains sine/cosine lookup (`$80:DAA6`), velocity vector projection (`$80:DACC`), and coordinate displacement translation (`$80:DB04`).
