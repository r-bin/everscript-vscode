---
addr: $7E:247F
name: QUICKSAND_STAGE_OBJECT_2
type: u16
tags: [scripts, quicksand, object]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Quicksand vortex tertiary object index staging word ($7E:247F, values {$00,$0C}; written in script $93:99BB). Staged directly into QUICKSAND_TRIGGER_OBJECT_INDEX ($7E:2491) prior to invoking quicksand sink logic routine $93:9BA7.

