---
addr: $7E:3DE1
name: ACTIVE_COMPANION_HEAD
type: u16
tags: [entity]
confidence: verified
evidence: ["disasm: head pointer to secondary active entity linked list (companion Dog / auxiliary actors); checked alongside primary entity head $3DDF in entity loop ($8F:B2BE) and palette reclaim ($90:CEB6)"]
---
Head pointer of singly-linked list chaining secondary active entities (companion Dog and auxiliary multipart actors).

