---
addr: 8FCBE0
end: 8FCBFD
kind: table
name: ai_behaviour_table
title: Behaviour (character +$03) → AI routine, the jump table the AI dispatcher uses
confidence: confirmed
tags: [entities, ai, tables]
evidence: ["rom: $8F:CD1A `bf 03 00 8e` lda $8E0003,x (the character record's +$03), $8F:CD1E tax, $8F:CD2E `7c e0 cb` jmp ($CBE0,x)", "rom: 15 words $D34B $D76A $D05E $D0A8 $D6FB $D76E $D4FB $D715 $D5D2 $D421 $D394 $D3DC $D380 $D52E $D708 (all bank $8F code), then $0408, not a pointer", "evs: the compiler's IDLE_BEHAVIOR enum names the 15 even values $00-$1C"]
see: [rom/8eb678.md, docs/entities/ai-behaviours.md]
---
Every tick an entity runs its AI, `$8F:CD17` reads the behaviour word of its character record
(`+$03`, from ROM, never WRAM) and jumps through this table: the value is the byte offset of
the entry, so behaviours are even, `$00`-`$1C`. Each routine is decompiled in
`docs/entities/ai-behaviours.md` and named by what it does in the `IDLE_BEHAVIOR` enum (`index.json`;
v0.342.0): `CHASE`, `NONE`, `COMPANION_BOY`, `COMPANION_DOG`, `STATIONARY`, `WANDER`, `CHASE_HOVERING`,
`STATIONARY_PLAYER`, `ROLL_OR_SHOOT`, `CHASE_OR_ROLL`, `BOUNCE`, `DRIFT_EAST`, `PURSUE_PLAYER`, `ROLL`,
`STATIONARY_DIAGONAL`. The compiler's names (`DEFAULT`, `UNKNOWN_1`…) are in each member's comment.
