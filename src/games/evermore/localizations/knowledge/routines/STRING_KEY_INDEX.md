---
addr: 91D000
end: 91D7FF
size: 2048
kind: table
category: ⚙️
name: STRING_KEY_INDEX
title: Master string key index table ($91:D000)
confidence: confirmed
tags: ["strings","dialogue","index"]
evidence: ["disasm: read by $8C:CCF5 and its twin $8C:CD35: sta $26 (the key), lda #$0091 : sta $28 : ldy #$D000, lda [$26],y (docs/reverse-engineering/asm-to-c-port.md §11)", "test: Open Evermore grows it past 3,002 keys elsewhere in one bank with both readers' immediates rewritten; string #3003 decodes in WRAM like the string it copies (tests/open-evermore/in-game.test.mts, 2026-11-20)"]
---

3,002 entries × 3 bytes, one per string: bits 0–14 the address in a lower half, bits 15–22 the bank above `$C0`,
bit 23 compressed. A key is id·3, added to the table's 16-bit offset, so the table holds up to 21,845 keys if it
starts a bank (data follows it in place). The bank and the offset are immediates in both readers, not an operand.

The table really runs to `$91:F32D` (3,002 × 3 bytes); this entry still covers only its first 2 KiB because the
ROM map cuts the rest into entries that overlap it (`alchemy_deduct_ingredients_and_award_xp` at `$91:D800`,
`tbl_string_key_index_part_2` at `$91:D888`, `dialogue_dictionary_tables` at `$91:F300`): those need sorting out
first (`tools/check-maps.mts` checks overlaps).
