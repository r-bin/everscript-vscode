---
addr: $7E:3BFC
name: COMPANION_LATCHED_OBSTACLE
type: u16
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: initialized to $FFFF by companion_waypoint_anchor_init ($8F:9937) via STA $3BFC,X; stores active collision obstacle descriptor index when dog navigation encounters an impediment", "c: reconstructed-c/8F/8F9937_companion_navigation.c"]
---
Latched obstacle collision descriptor index for companion Dog waypoint navigation ($FFFF = path clear / no obstacle).

