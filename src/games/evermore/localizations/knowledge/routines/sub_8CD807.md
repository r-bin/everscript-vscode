---
addr: 8CD807
end: 8CD81B
size: 21
kind: code
category: 🧠
name: sub_8CD807
title: Script opcodes 0x10, 0x11, 0x14, 0x15 shared byte-write core
confidence: verified
tags: [script-vm, reconstructed-c, g1-pass]
evidence: ["disasm: `clc : adc [$82] : inc $82 : inc $82 : pha : jsl $8CEA43 : plx : sep #$21 : sta $0000,x : rep #$30 : rts` at $8C:D807", "g1: 21/21 real states match ROM (100%), 21/21 snes9x oracle agreement, 201/201 fuzzed states match ROM, mutation caught: yes, rated 394b007f9cff7419"]
see: [routines/script_op_10_14_write_byte.md, routines/sub_8CD7D4.md]
---
Shared byte-write execution core for script opcodes 0x10, 0x11, 0x14, 0x15:
- Consumes 16-bit inline offset from script instruction pointer `[$82]`.
- Adds incoming base address in A (`$2258` or `$2834`).
- Evaluates script expression via `$8C:EA43`.
- Writes the low byte of the result into `$0000,x` in Data Bank.
- Returns with Carry set and N/Z set from target address (`PLX`).

## Reconstructed C
Source: [`reconstructed-c/8C/8CD804_opcode_10_14_write_byte.c`](../../../../../../reconstructed-c/8C/8CD804_opcode_10_14_write_byte.c).
Differential parity: Verified with Gate G1 against clean ROM on live 8,414-frame reference states and fuzzed inputs.
