---
addr: 80B20F
end: 80B21E
size: 16
kind: table
category: 📋
name: tbl_hex_ascii_digits
title: Uppercase hexadecimal ASCII digit characters table ("0123456789ABCDEF")
confidence: confirmed
tags: [text, ascii, hex, lookup, table]
evidence: ["disasm: 16 ASCII bytes at $80:B20F..$80:B21E containing '0123456789ABCDEF'; indexed by format_hex_32bit_uppercase ($80:B1D8)"]
see: [rom/80b1d8.md, rom/80b21f.md]
---
Constant character lookup table holding 16 ASCII bytes: `"0123456789ABCDEF"`. Indexed by 4-bit nibble values `[0..15]` to map binary nibbles to their ASCII character representations.
