---
addr: $7E:0125
name: VBLANK_CALLBACK_PTR
type: u24
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
24-bit indirect execution vector ($7E:0125..$7E:0127) called during NMI via jml [$0125].
