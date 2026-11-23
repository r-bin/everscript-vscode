---
addr: 908C09
size: 39
end: 908C2F
kind: code
category: 🎮
name: animation_script_branch_if_entity_active
title: Conditionally branch animation script if linked entity is active ($90:8C09)
confidence: confirmed
evidence: ["disasm: checks linked entity $0080,Y; if active and flags +$10,X bit 8 set and +$16,X bit 6 set, branches script PC to target [<$5D] without changing bank $5F; else skips target by 2 bytes", "rom: all 141 vanilla 0x54 commands carry $0075 (111x) or $0078 (30x) — the bank-$C7 linked-hold helper offset — emitted verbatim into banks $C8 (10x) and $C9 (71x); mode bit $0040 is never set in vanilla, so $C8:0075 (mid-instruction `3b 02 80` → $C8:8002 music data) is unreached at runtime"]
see: []
tags: ["animation","entity","branch","active"]
---
Inspects linked entity `$0080,Y`. If active and flags `$0010,X` has bit 8 set with `$0016,X` bit 6 asserted, branches script PC `<$5D` to target address `[<$5D]`; otherwise skips target operand by 2 bytes.
