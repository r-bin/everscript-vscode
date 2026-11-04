---
addr: $7E:245D
name: FALL_ANIMATION_DELAY
type: u16
tags: [scripts, animation, timing]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Falling / swirling exit animation duration parameter word ($7E:245D, values {$00,$40,$44,$62}; written in volcano chute script $93:E515, read in $93:E899). Specifies the frame count to wait in swirl animation before transitioning character sprites to the freefall animation state.

