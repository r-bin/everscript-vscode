---
addr: $7E:0623
name: DIALOGUE_TOKEN_CALL_STACK
type: u16[8]
tags: [dialogue, ui]
confidence: verified
evidence: ["cdl", "disasm"]
---
4-frame call stack ($7E:0623..$7E:0632, 16 bytes) storing return string offset and format flags during nested dialogue token expansion ($8C:A472, $8C:A7C6).

