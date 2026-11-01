---
addr: 7E1438
end: 7E1439
kind: pointer
name: OAM_HIGH_WATER_MARK
title: Low OAM buffer byte cursor and cleanup high-water mark
lifetime: frame
confidence: confirmed
tags: [render, oam, ppu, sprite]
evidence: ["rom-asm: $80:8FF6 compares CPX $1438 with current frame OAM usage cursor in direct page $D3", "rom-asm: loops writing #$E0E0 to $7E:ABDE,X to hide stale sprites off-screen, updating STX $1438"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit byte cursor tracking the maximum OAM low table offset written in the previous frame:
- At the end of sprite rendering in `func_808FEE`, compared with the current frame's end cursor (`$D3`).
- If fewer sprites were drawn this frame (`$D3 < $1438`), the engine loops backwards from `$1438` down to `$D3`, writing `#$E0E0` (Y=224, pushing sprites off-screen) into the low OAM mirror at `$7E:ABDE,X`.
- Updates `STX $1438` to record the new high-water mark for the subsequent frame's cleanup pass.

