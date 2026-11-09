---
addr: 8FD82F
size: 74
end: 8FD878
kind: code
category: 🎮
name: ai_companion_evaluate_target_candidate
title: Evaluate candidate entity validity and distance for companion AI ($8F:D82F)
confidence: confirmed
evidence: ["disasm: validates HP +$2A,X != 0; checks targetable flags +$10,X (rejecting mask $4106); computes Manhattan distance from candidate to Boy (+$1A,Y, +$1C,Y); returns BCS if outside radius <$12; callers: AI targeting $8F:D787", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 44 entry states sampled from the 2:20 no-input reference and 695 fuzzed ones; snes9x agrees with the interpreter on 44; a mutation is caught"]
see: ["routines/ai_companion_pick_target.md"]
tags: ["dog","companion","ai","targeting"]
---
Validates target candidate X for companion dog attack targeting. Checks HP `+$2A,X != 0`, targetable state flags `+$10,X` (rejecting hidden/untargetable flags), and distance from candidate `(+$1A,X, +$1C,X)` to Boy `(+$1A,Y, +$1C,Y)` against maximum aggro radius `<$12`.
