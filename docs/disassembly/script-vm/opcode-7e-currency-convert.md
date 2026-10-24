# Script Opcode 0x7E: Convert Currency

**Handler:** `$8C:D5AA`\
**Operands:** divisor expression, source currency offset expression, multiplier expression, destination currency offset expression\
**Reachability:** 12 statically reachable instructions\
**Confidence:** confirmed for nonzero byte divisors; zero-divisor result unmodeled

The handler reads the source's three-byte balance, multiplies it by the low byte of the multiplier, divides by the low byte of the divisor, writes the remainder back to the source, then adds the quotient to the destination's three-byte balance. Balances and the destination addition are 24-bit; the destination wraps on overflow. The ROM implements the multiplication and division in byte-sized stages using SNES math registers `$4202`-`$4216`. A zero divisor is not guarded in the ROM; its exact multi-stage hardware result is intentionally left unmodeled here.

The host-side model is [8CD5AA_opcode_7e_currency_convert.c](../../../reconstructed-c/8C/8CD5AA_opcode_7e_currency_convert.c). It returns `SCRIPT_HANDLER_UNMODELED_DIVISOR_ZERO` for a zero low-byte divisor instead of fabricating the hardware result.

## Evidence

- Opcode table entry `$8C:E9B9` dispatches to `$8C:D5AA`.
- The first three expressions are divisor, source offset, and multiplier; the fourth destination expression is evaluated only after the source remainder is stored.
- Multiplication is performed bytewise with `$4202/$4203`; division stages use `$4204/$4206` and read `$4214/$4216`.
- The handler stores the remainder in the source balance, adds the quotient to the destination, then returns carry set.