---
addr: 7E4FCB
size: 4
kind: var
name: DOG_EXP_POINTS
title: Companion character (Dog) 32-bit accumulated experience points
lifetime: save
confidence: confirmed
tags: [companion, stats, exp, progression]
evidence: ["disasm: func_8DA9A0 performs 32-bit subtraction on $7E:4FCB (low word) and $7E:4FCD (high word) against next level requirements", "disasm: func_8DB1D2/func_8DB4FA save and restore $7E:4FD1..$7E:4FD5 immediately following companion EXP words"]
see: [src/games/evermore/localizations/knowledge/ram/7e4f37.md]
---
32-bit double-word tracking accumulated experience points for the companion dog (`+$94` low word `$7E:4FCB`, `+$96` high word `$7E:4FCD` in struct at `$7E:4F37`).
- Evaluated by `func_8DA9A0` against breed-specific level threshold tables to compute the remaining EXP required for the next dog level increase.
- Formatted into decimal digits for status screen presentation.
