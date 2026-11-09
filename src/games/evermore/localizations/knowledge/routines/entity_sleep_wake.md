---
addr: 8FC40F
size: 261
end: 8FC513
kind: code
category: 🧠
name: entity_sleep_wake
title: Put far entities to sleep and wake them again (+$10 $0100 awake / $0200 asleep)
confidence: confirmed
tags: [entities, ai, widescreen, widescreen.activation]
reconstructed_c: reconstructed-c/8F/8FC40F_entity_sleep_wake.c
evidence: ["disasm: awake ($0100): unless +$10 & $0030, HP 0, or $1070 below the limit $1076, an idle entity more than 48 px off screen (camera $59/$5B, −$30…+$130) goes to sleep through $8F:C514 (or $8F:DF41 when +$8C links a deferred spawn) (v0.342.1)", "disasm: asleep: HP 0 → freed by $8F:B31E unless +$3E links it; +$10 $0008 stays asleep; & $0070 wakes at once; else wakes when $1070 + 2 < $1076 or within 16 px of the screen ($8F:C4AE → $8F:C4B1: $1070+1, $1072−1, the segment list for record +$07 bit 0, eor #$0300, restart the stand animation)", "cdl: executed", "g1: passed (38/38 reference replay, 56/56 fuzzed, mutation caught)"]
see: [docs/entities/entities-reference.md, routines/entity_go_to_sleep.md]
---
The game simulates only so many entities at once (`$1076`). Ones that drift off screen are set
aside until they come back or there is room. Spawn flags `$0010` / `$0020` keep one running.

## Widescreen notes

Windows are relative to the rendered camera `$59`/`$5B`, signed: wake inside [−16, 272) on both axes, sleep outside [−48, 304) on either axis. Both are keyed to a 256 px screen. The distance tests run only when the budget is full (`$1070` ≥ `$1076` for sleeping, `$1070` + 2 ≥ `$1076` for waking); below that every entity is awake wherever it is. `+$6C` ≥ 0 (holds a multipart/waypoint node) also wakes at once and blocks sleep (asm read 2026-11-09).
