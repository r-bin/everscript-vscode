---
addr: 8FAEEA
end: 8FAF17
size: 46
kind: code
category: 🧠
name: sub_8FAEEA
title: Try step entity candidate position from DP $1A/$1C offsets ($8F:AEEA)
confidence: verified
tags: ["code","entity","movement","collision"]
evidence: ["disasm: computes candidate X/Y from DP $1A/$1C offsets relative to entity +$1A/+$1C into DP $46/$48, calls $8F:AF48 passability check; on carry set sets flag bit $0002 at +$12 and tail-jumps to $8F:C2E4; on carry clear sets bit $0001 and returns", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 40/40 states match ROM, mutation caught"]
---

Advances an entity's candidate X/Y position (`DP $46`/`$48`) by signed displacement hints in `DP $1A`/`$1C` and invokes terrain check `$8F:AF48`. When movement succeeds (Carry set), sets bit `$0002` in `+$12,Y` and commits coordinates via `$8F:C2E4`; when blocked, sets bit `$0001` and returns.
