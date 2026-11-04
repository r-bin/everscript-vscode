---
addr: $7E:3C0E
name: COMPANION_HEADING_DIR
type: u16
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: final steering angle index (0..15) inverted by 180 deg (EOR #$08) written to $3C0E,X in companion_breadcrumb_advance_step ($8F:9967)", "c: reconstructed-c/8F/8F9937_companion_navigation.c"]
---
Active steering heading direction (16-direction angle index: 0=Up, 4=Right, 8=Down, 12=Left) applied to companion Dog physics.

