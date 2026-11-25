---
addr: 8EB514
end: 8EB51F
size: 12
kind: data
category: 📦
name: data_8EB514
title: Per Dog form: which entry of $C4:5A75 the equipment ring shows for the Dog
confidence: confirmed
tags: ["data","dog","menu"]
evidence: ["CDL recorder export (out/recomp/asar/export.json)", "disasm: $8E:B4AA `lda $8EB512,x` with X = DOG_FORM_INDEX ($2363), the word then indexes tbl_C45A75 (3-byte entries); values 3, 0, 6, 9, 0, $0C for forms 2-$0C"]
---

One word per Dog form (read at `$8E:B512 + form`), used when an equipped item is the Dog's: an offset into
`$C4:5A75`. Six words; a seventh form would read the code after it.
