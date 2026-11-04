---
addr: $7E:245B
name: CUTSCENE_ACTOR_ENTITY
type: u16
tags: [scripts, entity, cutscene]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Cutscene NPC actor entity handle word ($7E:245B, values {$00,$E5,$FD}; evaluated in Prehistoria room scripts $94:DCFA, $94:DD08). Holds the transient entity slot pointer for the active NPC coordinated during choreographed walk and turn actions in story sequences.

