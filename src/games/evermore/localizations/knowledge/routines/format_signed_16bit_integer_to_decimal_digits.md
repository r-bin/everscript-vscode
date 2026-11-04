---
addr: 808757
end: 8087CA
size: 116
kind: code
name: format_signed_16bit_integer_to_decimal_digits
title: Hardware Signed 16-Bit Integer to Decimal Digit Formatter
confidence: confirmed
tags: [math, decimal, string, format]
evidence: ["disasm: CMP #0 / BPL +12 / LDA #$2D / STA 0,X / TYA / EOR #$FFFF / INC A / INX / magnitude check / division loop via $4204/$4206 (out/recomp/asar/rom.bin:0x008757)"]
see: [src/games/evermore/localizations/knowledge/rom/80870c.md]
---
Signed 16-bit integer to ASCII decimal character formatter:
- Tests sign bit of input integer (`CMP #$0000; BPL`).
- If negative: writes ASCII '-' character (`$2D`) to output buffer (`STA 0,X`), negates integer (`EOR #$FFFF; INC A`), and advances buffer index (`INX`).
- Determines magnitude scale (powers of 10: 10, 100, 1000, 10000).
- Performs iterative division by 10 using SNES hardware division registers `$4204` / `$4206`.
- Converts remainder to ASCII decimal character (`ADC #$30`) and writes to destination stream.
- Terminates string buffer with `$00` byte.
