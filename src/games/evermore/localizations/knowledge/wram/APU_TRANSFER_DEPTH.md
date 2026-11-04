---
addr: $7E:0E51
name: APU_TRANSFER_DEPTH
type: u16
tags: [audio]
confidence: verified
evidence: ["cdl", "disasm"]
---
APU streaming transfer recursion / active depth counter ($7E:0E51..$7E:0E52; incremented on entry, decremented on exit in $8C:81D4).
