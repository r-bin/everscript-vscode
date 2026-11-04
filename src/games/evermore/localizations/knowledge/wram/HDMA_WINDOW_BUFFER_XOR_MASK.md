---
addr: $7E:158C
name: HDMA_WINDOW_BUFFER_XOR_MASK
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
Toggle XOR mask ($6869 ^ $6A7D = $0214) for double-buffered window coordinates ($91:C7F5).
