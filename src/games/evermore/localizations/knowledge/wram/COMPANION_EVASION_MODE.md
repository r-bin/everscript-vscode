---
addr: $7E:3C66
name: COMPANION_EVASION_MODE
type: u8
tags: [companion, dog, navigation]
confidence: verified
evidence: ["disasm: mode latch byte paired with evasion counter at $3C65 and direction at $3C67 in dog pathfinding handler"]
---
Active evasion mode flag regulating companion Dog obstacle avoidance and detour state.

