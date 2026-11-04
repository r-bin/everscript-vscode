---
addr: $7E:3C5C
name: OBSTACLE_TARGET_COORDS
type: u8[9]
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: secondary waypoint node intermediate sub-target and target coordinates used during active obstacle evasion pathfinding", "c: reconstructed-c/8F/8F9937_companion_navigation.c"]
---
Intermediate coordinate block (sub-target X/Y, target X/Y, interpolation flag) guiding companion Dog around environmental obstacles.

