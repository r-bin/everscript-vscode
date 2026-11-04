---
addr: $7E:3C06
name: COMPANION_TARGET_X
type: u16
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: companion_breadcrumb_advance_step ($8F:9967) loads waypoint X from $3BC3,Y and writes to $3C06,X", "c: reconstructed-c/8F/8F9937_companion_navigation.c"]
---
Active target world horizontal coordinate toward which companion Dog steers during breadcrumb navigation.

