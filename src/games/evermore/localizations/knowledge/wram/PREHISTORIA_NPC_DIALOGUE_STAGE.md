---
addr: $7E:246F
name: PREHISTORIA_NPC_DIALOGUE_STAGE
type: u16
tags: [scripts, dialogue, npc]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Prehistoria jungle NPC dialogue progression stage word ($7E:246F, values {$00..$03}; initialized to 0 in $92:CC4F, evaluated and incremented in $94:C41F). Cycles through sequential text boxes before repeating the final dialogue state.

