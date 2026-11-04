---
addr: $7E:247B
name: QUICKSAND_STAGE_OBJECT_0
type: u16
tags: [scripts, quicksand, object]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Quicksand vortex primary object index staging word ($7E:247B, values {$00,$04,$08,$0D,$0F}; written in script $93:9797). Staged directly into QUICKSAND_TRIGGER_OBJECT_INDEX ($7E:2491) prior to invoking quicksand sink logic routine $93:9B29.

