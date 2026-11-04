---
addr: $7E:245F
name: ROOM_ARRIVAL_DIALOGUE_TRIGGERED
type: u16
tags: [scripts, dialogue, event]
confidence: verified
evidence: ["disasm", "cdl"]
---
Room Script Subsystem: One-shot room arrival dialogue executed flag word ($7E:245F, values {$00,$01}; evaluated and set in Fire Eyes Village script $94:D033). Prevents the introductory greeting dialogue between the Boy and Dog from triggering again on subsequent revisits during the same room residency.

