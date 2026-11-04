---
addr: 8087cb
end: 808820
size: 86
kind: code
name: format_fixed_width_decimal_digits_padded
title: Fixed-width padded decimal digit stream formatter
confidence: confirmed
tags: [math, decimal, string, format]
evidence: ["disasm: STX $12 / INX / INX / INX / STA $4204 / SEP #$20 / LDA #10 / STA $4206 / REP #$20 / hardware divide loop / ADC #$30 / pad with zero digits (out/recomp/asar/rom.bin:0x0087CB)"]
see: [src/games/evermore/localizations/knowledge/routines/format_signed_16bit_integer_to_decimal_digits.md]
---
Fixed-width decimal number formatter with leading digit alignment:
- Formats integer values into a fixed-width digit field.
- Iteratively divides input using SNES hardware division registers `$4204` / `$4206`.
- Adds ASCII base offset (`ADC #$30`) for each decimal digit.
- Zero-pads remaining unwritten field positions up to specified width threshold.
- Appends null terminator `$00` byte.
