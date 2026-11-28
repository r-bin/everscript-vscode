---
addr: $7E:0AC4
name: EQUIPPED_BODY_ARMOR
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
Currently equipped vest / body armor ID ($8E:926F, $8E:A64E).

## Correction (2026-11-28)
This word holds the Boy's **gloves**: the four words are collar `$0ABE`, body `$0AC0`, helm `$0AC2`, gloves `$0AC4` (operands of the
equip code from `$8E:922C`, and the order of the ring's filter), each the equipped record's offset in bank `$C4`, 0 for
none. The entry's name is older.
