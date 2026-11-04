---
addr: $7E:247D
name: QUICKSAND_STAGE_OBJECT_1
type: u16
tags: [scripts, quicksand, object]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Quicksand vortex secondary object index staging word ($7E:247D, values {$00,$09,$0E}; written in script $93:98F1). Staged directly into QUICKSAND_TRIGGER_OBJECT_INDEX ($7E:2491) prior to invoking quicksand sink logic routine $93:9B68.

