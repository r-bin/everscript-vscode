# Script Opcodes 0x11 and 0x15: Write Temporary Byte

**Routine:** `$8C:D7FF`\
**Range:** `$8C:D7FF`–`$8C:D81B`\
**Confidence:** confirmed handler control flow and write semantics

## Behavior

Both opcode table entries (`$8C:E8DF` for `0x11` and `$8C:E8E7` for `0x15`) target `$8C:D7FF`. The handler reads a 16-bit offset from the script stream, adds it to `$2834` with 16-bit arithmetic, and advances the script pointer by two bytes. It then evaluates one expression, stores the low byte of the result at the resulting destination through data bank `$7E`, restores 16-bit accumulator/index widths, and returns with carry set.

The destination calculation wraps at 16 bits. Expression evaluation may itself advance the script pointer; that work is delegated to `$8C:EA43` in the host model.

The host-side model is [8CD7FF_opcode_11_15_write_temp_byte.c](../../../reconstructed-c/8C/8CD7FF_opcode_11_15_write_temp_byte.c). It uses the existing script operand, expression, and DBR-relative write interfaces.

## Evidence

- Vanilla VFS disassembly at `$8C:D7FF`: `LDA #$2834; BRA $D807`.
- Vanilla VFS disassembly at `$8C:D807`: `CLC; ADC [$82]; INC $82; INC $82`, followed by expression evaluation at `$8C:EA43` and `STA $0000,X` while the data bank is `$7E`.
- Vanilla VFS disassembly at `$8C:D819`: `REP #$30; RTS`.
- Opcode VFS entries for `0x11` and `0x15` both identify `$8C:D7FF` as their handler and a `u16` operand.