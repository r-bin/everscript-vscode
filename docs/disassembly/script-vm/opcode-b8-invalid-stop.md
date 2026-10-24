# Script Opcode 0xB8: Invalid Opcode Stop

**Opcode table entry:** `$8C:EA2D`\
**Trap address:** `$8C:E8BC`\
**Instruction:** 65C816 `STP`\
**Operands:** none; execution halts before further script decoding\
**Confidence:** confirmed

The handler table routes opcodes `0x8B` (`$8C:E9D3`) and `0xB8` (`$8C:EA2D`) to
`$8C:E8BC`, a `STP` byte shared by several invalid or unused opcodes. `STP` stops
the CPU; it does not return to the script VM.

[`reconstructed-c/8C/8CE8BC_opcode_b8_invalid_stop.c`](../../../reconstructed-c/8C/8CE8BC_opcode_b8_invalid_stop.c)
represents both opcode entries as non-returning CPU-stop hooks.

The repository's grouped trap entry is [rom/8ce8b5.md](../../../src/games/evermore/localizations/knowledge/rom/8ce8b5.md).