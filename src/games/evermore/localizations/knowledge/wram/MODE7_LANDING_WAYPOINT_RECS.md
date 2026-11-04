---
addr: $7E:237F
name: MODE7_LANDING_WAYPOINT_RECS
type: u16[5]
tags: [mode7, flight, scripts]
confidence: verified
evidence: ["disasm", "cdl"]
---
Mode 7 / Flight Subsystem: Array of 5 16-bit registers staging landing destination region ID, world X/Y landing coordinates, heading angle, and elevation parameters ($7E:237F..$7E:2388, 10 bytes; configured by Windwalker flight scripts at $92:A411 and $95:932F).

