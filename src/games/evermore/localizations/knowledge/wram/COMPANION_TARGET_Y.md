---
addr: $7E:3C08
name: COMPANION_TARGET_Y
type: u16
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: companion_breadcrumb_advance_step ($8F:9967) loads waypoint Y from $3BC5,Y and writes to $3C08,X", "c: reconstructed-c/8F/8F9937_companion_navigation.c"]
---
Active target world vertical coordinate toward which companion Dog steers during breadcrumb navigation.

