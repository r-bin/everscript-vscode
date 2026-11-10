---
addr: 80870C
size: 75
end: 808756
kind: code
category: 🎮
name: format_16bit_integer_to_decimal_digits
title: Convert 16-bit integer into 5 ASCII/decimal tile digits ($80:870C)
confidence: verified
tags: [math, decimal, text, digits, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/80/80870C_format_16bit_integer_to_decimal_digits.c passes Gate G1 (41/41 reference states, 656/656 fuzzed, mutation caught)"]
---
Formats a 16-bit integer passed in register A into a 5-digit decimal string stored at the pointer passed in X:
1. Loops through successive powers of 10: 10000, 1000, 100, 10.
2. Uses SNES hardware divider (`$4204`/`$4206`) to compute quotient (digit) and remainder.
3. Writes ASCII digits offset by `$30` (or tile index equivalent) into buffer `0,X..4,X`.
4. Leaves Y pointing after written buffer, A = remainder, DB = `$80`.
