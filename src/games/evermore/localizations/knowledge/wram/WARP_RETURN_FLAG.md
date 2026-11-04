---
addr: $7E:2551
name: WARP_RETURN_FLAG
type: u16
tags: [scripts, event, flag]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script Subsystem: Warp / return transition branch flag word ($7E:2551, values {$00,$01,$FF}; read across multiple room scripts including $94:A591, $95:BEB2, $96:DC3E).

