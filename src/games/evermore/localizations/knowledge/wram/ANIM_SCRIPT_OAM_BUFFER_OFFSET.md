---
addr: $7E:15D0
name: ANIM_SCRIPT_OAM_BUFFER_OFFSET
type: u16
tags: ["animation", "oam"]
confidence: verified
evidence: ["cdl", "disasm"]
---
Animation Script VM: Byte cursor offset into OAM shadow queue buffer ($08CC), advancing in 4-byte steps ($90:8A40, $90:8A51).
