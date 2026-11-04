---
addr: 80B1D8
end: 80B20E
size: 55
kind: code
category: 🧠
name: format_hex_32bit_uppercase
title: Format 32-bit integer into 8-character uppercase hexadecimal ASCII string
confidence: confirmed
tags: [text, hex, ascii, format, debug, ui]
evidence: ["disasm: loops Y from 3 down to 0 at $80:B1D8..$80:B20E; extracts upper and lower nibbles of each byte at $0002,Y, looks up uppercase character in $80:B20F,X, writes to buffer at $0000,X, appends null terminator, returns via RTL"]
see: [routines/tbl_hex_ascii_digits.md, routines/format_32bit_integer_to_decimal_ascii.md]
---
Converts an unsigned 32-bit integer located at direct page `$02..$05` into an 8-character uppercase hexadecimal string followed by a null terminator byte.
- Iterates byte index `Y` from 3 down to 0 (big-endian digit emission order).
- Extracts upper 4-bit nibble via `LSR #4; AND #$0F`, queries lookup table `tbl_hex_ascii_digits` (`$80:B20F`), stores ASCII byte into buffer at `$0000,X`, and increments `X`.
- Extracts lower 4-bit nibble via `AND #$0F`, queries lookup table, stores ASCII byte, and increments `X`.
- Emits terminating null byte via `STZ $0000,X`, restores 16-bit Accumulator mode (`REP #$20`), and returns via `RTL`.
