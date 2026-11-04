---
addr: C4588E
end: C45999
size: 268
kind: table
category: 📋
name: tbl_dialogue_string_pointers_c9
title: Master dialogue and lore string descriptor pointer table for Bank $C9 (67 entries)
confidence: confirmed
tags: [dialogue, strings, pointers, text, table]
evidence: ["disasm: 268 bytes at $C4:588E..$C4:5999 containing 67 4-byte pointer descriptors [addr:16][bank:8][0] targeting uncompressed dialogue and lore strings in Bank $C9"]
see: [routines/ALCHEMY_SCRIPT_POINTER_TABLE.md, rom/c44a76.md, rom/c460ab.md]
---
Master string pointer directory holding 67 4-byte far pointers (`[addr:16][bank:8][0]`). References uncompressed dialogue strings, NPC conversation scripts, and item lore text stored across Bank `$C9`.

