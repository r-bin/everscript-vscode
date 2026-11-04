---
addr: $7E:0E65
name: APU_IPC_MUTEX_LOCK
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
Queue mutex lock word guarding APU communication during streaming transfers ($8C:81FD, $8C:81D4).
