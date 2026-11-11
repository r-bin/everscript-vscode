---
addr: $7E:0B1D
name: MODE7_FLIGHT_HUD_VISIBLE
type: u16
tags: [mode7]
confidence: verified
evidence: ["cdl", "disasm"]
---
Active toggle flag for Mode 7 flight instrument panel and HUD gauge overlay, toggled via controller R button ($80:C1F7, $80:C5DB).
