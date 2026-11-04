---
addr: 7E1078
end: 7E1079
kind: var
name: ENTITY_SCHEDULER_FRAME_LATCH
title: Entity scheduler frame counter snapshot latch
lifetime: frame
confidence: confirmed
tags: [engine, entity, scheduler, frame]
evidence: ["rom-asm: $8F:DC53 reads frame counter LDA $0100, decrements DEC A, and compares against CMP $1078", "rom-asm: detects missed VBlank or frame drops when difference is non-zero"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/107a.md]
---
16-bit latch storing the previous frame counter value for frame-drop detection:
- At `$8F:DC53`, the current frame counter (`$7E:0100`) minus 1 is compared against `$7E:1078`.
- If equal, execution was continuous without dropped frames, and lag counter `$7E:107A` is cleared (`STZ $107A`).
- If not equal, a frame drop occurred, diverting to lag handler logic.

