---
addr: $7E:2471
name: FE_VILLAGE_NPC_DIALOGUE_STAGE
type: u16
tags: [scripts, dialogue, npc]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Fire Eyes Village NPC conversation progression stage word ($7E:2471, values {$00..$04}; initialized to 0 in $92:CC67, evaluated and incremented in $94:C837). Determines which dialogue lines are delivered on successive conversations when talking to the villager.

