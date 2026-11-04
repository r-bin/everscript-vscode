---
addr: $7E:1459
name: DOG_ROAM_WAYPOINT_ACTIVE
type: u16
tags: ["companion", "ai"]
confidence: verified
evidence: ["cdl", "disasm"]
---
Companion Mechanics: Flag indicating whether an autonomous roaming / sniffing destination waypoint is currently active (0 = inactive/arrived, 1 = active; $8F:DCD0, $8F:DD22, $8F:DDAF).
