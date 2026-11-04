---
addr: $7E:253B
name: FLIGHT_LANDING_ARG
type: u16
tags: [overworld, flight, landing]
confidence: verified
evidence: ["cdl", "disasm"]
---
Overworld flight landing parameter word ($7E:253B, values {$00,$0A}; read by flight transition handler $8C:9FFB, written in script $93:DC39).

