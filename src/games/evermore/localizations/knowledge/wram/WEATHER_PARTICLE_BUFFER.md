---
addr: 7E2110
size: 256
kind: array
name: WEATHER_PARTICLE_BUFFER
title: Weather particle trajectory and simulation state buffer
lifetime: room
confidence: confirmed
tags: [weather, particles, simulation]
evidence: ["disasm: func_91C15B increments cursor $14FE by 4 (wrapping at 256 / $100), calls RNG func_80859B, and writes random vector words into $7E:2110,X", "disasm: func_91BE05 coordinates weather particle updates and camera relative displacement against $14EE/$2110"]
see: [knowledge/wram/WEATHER_PARTICLE_PREV_Y.md, knowledge/wram/WEATHER_PARAMS_ALIGN_PAD.md]
---
256-byte cyclic state buffer holding simulation records for up to 64 active weather particles (rain streaks, snow flakes, drifting ash, falling leaves).
- Each particle entry is 4 bytes:
  - `+$00`: Horizontal position / velocity delta relative to camera
  - `+$02`: Vertical position / fall rate relative to camera
- Allocated and spawned cyclically by `func_91C15B` using cursor `$14FE` (increments by 4, wraps at `$0100`).
- Integrated each frame by `func_91BE05` with camera displacement (`$14E6`..`$14EC`) to project environmental particle effects.
