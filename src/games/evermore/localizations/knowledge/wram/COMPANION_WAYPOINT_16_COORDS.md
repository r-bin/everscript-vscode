---
addr: $7E:3BF9
name: COMPANION_WAYPOINT_16_COORDS
type: u8[3]
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: 17th waypoint coordinate triple (+0 X metatile, +1 Y metatile, +2 elevation layer) in companion breadcrumb history ring buffer", "c: docs/disassembly/entities/companion-navigation.md"]
---
17th waypoint coordinate entry in companion Dog breadcrumb history ring buffer (X metatile grid position, Y metatile grid position, elevation layer plane).

