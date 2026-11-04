---
addr: $7E:14FE
name: WEATHER_PARTICLE_SPAWN_CURSOR
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
Cyclic write cursor into 256-byte weather particle simulation state buffer ($91:C15B, wraps at $0100).
