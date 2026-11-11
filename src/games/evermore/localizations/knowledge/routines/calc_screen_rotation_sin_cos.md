---
addr: 80DAA6
size: 38
end: 80DACB
kind: code
category: 🧠
name: calc_screen_rotation_sin_cos
title: Screen rotation angle 16-bit sine and cosine resolver ($80:DAA6)
confidence: confirmed
evidence: ["disasm: tests camera pan velocity $14B6; if non-zero, uses rotation angle DP $BB to look up 16-bit sine from $80:88A3 into $14A6 and cosine from $80:8923 into $14A4; if zero, clears $14A4 and $14A6; caller: $80:DA9A"]
see: [routines/calc_rotated_velocity_vector.md]
tags: [camera, trig, rotation, mode7]
---
Resolves 16-bit sine and cosine factors for camera rotation. When camera pan velocity `$14B6` is active, indexes sine table `$80:88A3` into `$14A6` and cosine table `$80:8923` into `$14A4` based on screen angle `$BB`. Clears both components when camera motion is halted.
