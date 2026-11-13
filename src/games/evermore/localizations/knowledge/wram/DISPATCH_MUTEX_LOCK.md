---
addr: 7E1436
end: 7E1437
kind: var
name: DISPATCH_MUTEX_LOCK
title: Event and trigger callback queue re-entrancy mutex lock
lifetime: room
confidence: confirmed
tags: [engine, event, dispatch, mutex, script-vm]
evidence: ["rom-asm: $8C:CFFD checks LDA $1436 and exits if non-zero to guard callback execution", "rom-asm: sets INC; STA $1436 while iterating queue at $7E:2F28,X, clearing with STZ $1436 upon exit"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit mutex lock guarding the map event and script callback dispatch loop:
- Evaluated at `$8C:CFFD` before processing pending action entries in `$7E:2F28`.
- If non-zero, prevents nested or re-entrant dispatch cycles from corrupting queue state.
- Set to 1 upon entering the dispatcher and cleared to zero (`STZ $1436`) upon completion.

