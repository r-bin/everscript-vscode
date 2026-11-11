---
addr: 80CE72
size: 37
end: 80CE96
kind: code
category: 🗺️
name: camera_scroll_velocity_friction_damp
title: Camera scrolling velocity friction damping step ($80:CE72)
confidence: confirmed
evidence: ["disasm: reads velocity $14B2; if positive, subtracts friction $1476 twice, clamping to 0 if sign flips; if negative, adds friction $1476 twice, clamping to 0 if sign flips; stores damped velocity in $14B2; caller: $80:CE35"]
see: [routines/screen_scroll_and_shake_step.md]
tags: [camera, scroll, friction, mode7]
---
Applies friction damping to camera scroll velocity `$14B2`. Subtracts or adds double friction drag `$1476 * 2` depending on motion direction, clamping velocity to zero when speed drops below the friction threshold.
