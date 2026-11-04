---
addr: 80CE97
size: 274
end: 80CFA8
kind: code
category: 🗺️
name: camera_velocity_friction_damp
title: Camera velocity friction deceleration damp ($80:CE97)
confidence: confirmed
evidence: ["disasm: reads velocity $14B6; if positive, subtracts acceleration $1480, clamping to 0 if sign flips; if negative, adds acceleration $1480, clamping to 0 if sign flips; stores in $14B6; caller: $80:CE35"]
see: [routines/screen_scroll_and_shake_step.md, routines/camera_scroll_velocity_friction_damp.md]
tags: [camera, scroll, friction]
---
Applies friction damping to camera pan velocity `$14B6`. Decelerates velocity toward zero by rate `$1480`, clamping speed to zero when the threshold is crossed.
