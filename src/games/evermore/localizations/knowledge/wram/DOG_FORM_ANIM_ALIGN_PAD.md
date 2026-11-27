---
addr: $7E:1441
name: DOG_FORM_ANIM_ALIGN_PAD
type: u8[2]
tags: [dog, unused]
confidence: verified
evidence: ["cdl: 0 hits in vanilla attract/gameplay traces", "disasm: alignment padding / buffer", "cdl library 2026-11-27 (wram-census.mts): read as the high byte of the word read lda $1440 at $CD:8843 (DOG_SPRITE_ANIM_BANK, the far pointer read as two words with $CD:883E lda $143E); no write seen"]
---
2-byte alignment buffer ($7E:1441..$7E:1442) between Dog sprite animation far pointer and Dog form animation records (unused to our knowledge).

> **Note**: Not written by anything seen, but not untouched: `$CD:8843` reads the bank byte `$1440` as a word, which takes
> `$1441` too (its value is probably dropped). So it moves with `DOG_SPRITE_ANIM_RECORD` and `DOG_SPRITE_ANIM_BANK` as one
> group in Open Evermore (`$7E:143E`-`$1442`, docs/open-evermore/wram.md §0.2).
