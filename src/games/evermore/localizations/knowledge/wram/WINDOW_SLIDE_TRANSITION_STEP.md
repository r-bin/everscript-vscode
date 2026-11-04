---
addr: $7E:0E7A
name: WINDOW_SLIDE_TRANSITION_STEP
type: u16
tags: [system]
confidence: verified
evidence: ["cdl", "disasm"]
---
Dialogue window opening/closing slide transition frame step counter (0..$1C; subtracted from camera horizontal scroll delta in $80:D786, $80:DCE1).
