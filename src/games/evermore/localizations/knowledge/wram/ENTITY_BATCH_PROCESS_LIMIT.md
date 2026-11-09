---
addr: 7E1076
end: 7E1077
kind: var
name: ENTITY_BATCH_PROCESS_LIMIT
title: Awake-entity budget (5..6, lowered on lag)
lifetime: room
confidence: confirmed
tags: [engine, entity, scheduler, performance, widescreen, widescreen.activation]
evidence: ["rom-asm: $8F:DC6A LDA $1076 checks current slice limit against upper bound CMP #$0006", "rom-asm: increments INC $1076 after 1800 lag-free frames ($7E:107C reaching #$0708)", "rom-asm: controls loop slice count in round-robin entity scheduler ($8F:DC9F)", "disasm: $8F:DCA5 loads #$0006 as the loop count of the round-robin pass, independent of $1076; $8F:C40F compares $1070 with $1076 (asm read 2026-11-09)"]
see: [docs/disassembly/engine-core/wram-map.md, knowledge/wram/ENTITY_ROUND_ROBIN_CURSOR.md, knowledge/wram/ENTITY_SCHEDULER_STABILITY_TIMER.md]
---
The most entities that may be awake at once, Boy and Dog included. Set to 6 at room reset (`$90:8E90`). The scheduler tick `$8F:DC34` lowers it to the current awake count (when that is at least 5) after three frames that missed the frame counter (`$7E:0100 − 1 ≠ $7E:1078`), and raises it by one (cap 6) after 1800 frames without a miss. The round-robin pass always visits 6 slots per frame; this word is not that count. Previously believed: the number of slots updated per frame (asm read 2026-11-09).

