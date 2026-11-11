---
addr: 80CE35
size: 61
end: 80CE71
kind: code
category: 🗺️
name: screen_scroll_and_shake_step
title: Subpixel camera scroll velocity accumulator and screen shake dispatcher ($80:CE35)
confidence: confirmed
evidence: ["disasm: adds 16.16 velocity word $14B2 into camera scroll accumulator $14B0; rounds to integer pixel offset in DP $BB; inspects screen shake flags in $0104; dispatches horizontal shake $80:CE72 and vertical shake $80:CE97; callers: $80:C1A2, $80:C95B"]
see: [routines/camera_scroll_velocity_friction_damp.md, routines/camera_velocity_friction_damp.md]
tags: [camera, scroll, screen-shake, mode7]
---
Accumulates subpixel camera scrolling motion and dispatches screen shake offsets each frame. Adds 16.16 fractional velocity `$14B2` into camera position accumulator `$14B0`, rounding to an integer pixel coordinate in direct page `$BB`. Checks screen shake configuration word `$0104`, invoking horizontal shake handler `$80:CE72` when bits `$0300` are clear and vertical shake handler `$80:CE97` when bits `$0C00` are clear.
