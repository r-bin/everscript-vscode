---
addr: 7E2409
end: 7E240A
kind: var
name: SHAKE_MAGNITUDE_X
title: Maximum horizontal displacement magnitude for active screen shaking
lifetime: frame
confidence: confirmed
tags: [render, camera, shake]
evidence: ["rom-asm: $90:989C STA $7E:2409 sets horizontal shake amplitude (default 4)", "rom-asm: $90:98B2 multiplies $7E:2409 with RNG using hardware multiplier $4202/$4203 to compute jitter X offset in direct page $C5"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/SHAKE_MAGNITUDE_Y.md]
---
16-bit integer holding the horizontal displacement magnitude (amplitude) for screen shaking effects:
- Initialized alongside `$7E:240B` (`SHAKE_MAGNITUDE_Y`) by `func_909897` (typically set to 4).
- In `func_9098A5`, multiplied against pseudo-random numbers via hardware multiplication registers `$4202`/`$4203` to generate the horizontal camera displacement offset (`$C5`).

