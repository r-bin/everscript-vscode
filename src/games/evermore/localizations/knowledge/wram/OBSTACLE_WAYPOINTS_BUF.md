---
addr: $7E:3C24
name: OBSTACLE_WAYPOINTS_BUF
type: u8[52]
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: secondary waypoint node breadcrumb ring buffer used for obstacle evasion navigation coordinates and intermediate routing targets", "c: reconstructed-c/8F/8F9937_companion_navigation.c"]
---
Secondary waypoint breadcrumb ring buffer used by companion Dog obstacle evasion routines (stores X/Y/layer coordinate entries and collision descriptor).

