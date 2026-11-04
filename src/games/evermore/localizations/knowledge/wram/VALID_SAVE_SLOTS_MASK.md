---
addr: $7E:0B39
name: VALID_SAVE_SLOTS_MASK
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
16-bit validation bitmask of detected battery SRAM save slots (bits 0..3 for slots 0..3; $80:8B6C, $8D:C905).
