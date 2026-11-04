---
addr: 808821
end: 808837
size: 23
kind: code
name: format_formatted_number_dispatcher
title: Formatted decimal number printing dispatcher
confidence: confirmed
tags: [math, string, dispatcher, format]
evidence: ["disasm: LDA $04 / BEQ + / JSL $808757 / LDA $02 / JSL $8087CB / BRA ++ / LDA $02 / JSL $808757 / RTL (out/recomp/asar/rom.bin:0x008821)"]
see: [src/games/evermore/localizations/knowledge/routines/format_signed_16bit_integer_to_decimal_digits.md, src/games/evermore/localizations/knowledge/routines/format_fixed_width_decimal_digits_padded.md]
---
Number formatting dispatcher that routes between signed decimal conversion and fixed-width padded formatting based on direct-page format parameters:
- Evaluates format configuration flag in DP `$04`.
- If set: invokes `format_signed_16bit_integer_to_decimal_digits` (`JSL $80:8757`), then loads secondary parameter and invokes `format_fixed_width_decimal_digits_padded` (`JSL $80:87CB`).
- If clear: invokes direct signed decimal formatter with default width.
- Returns via `RTL`.
