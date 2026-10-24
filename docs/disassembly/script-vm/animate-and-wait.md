# Script Opcode 0x79: Animate and Wait

**Handler:** `$8C:E156`–`$8C:E179`\
**Opcode table entry:** `$8C:E9AF`\
**Operands:** `E u16 E` (consumed by opcode `0x78`)\
**Confidence:** direct control flow and writes confirmed

## Control Flow

The handler first calls `$8C:E0B0`, the opcode `0x78` animation handler. That handler
evaluates the entity expression and leaves its address in direct-page word `$4C`. The
wrapper then reads the entity's word at `+$88`:

- If it is nonzero, the wrapper skips the wait setup.
- If it is zero, the wrapper reads the current script-slot pointer from direct-page word
  `$7E` and performs the writes below.

| Address | Write |
|---|---|
| entity `+$88` | current script-slot pointer |
| script slot `+$03` | `$0006` |
| entity `+$8A` | `$0020` |
| script slot `+$05` | `$0020` |
| script slot `+$09` | `$0000` |

Both paths reach `CLC; RTS` at `$8C:E178`–`$8C:E179`, yielding the current script turn.
This reconstruction preserves the tested offsets and values without assigning additional
meaning to the entity fields or wait parameters.

## Reconstruction

The low-level control-flow model is in
[`reconstructed-c/8C/8CE156_opcode_79_animate_and_wait.c`](../../../reconstructed-c/8C/8CE156_opcode_79_animate_and_wait.c).
Opcode `0x78` remains an opaque call in that model.

## Evidence and Boundaries

- The opcode table at `$8C:E9AF` points to `$8C:E156`.
- The handler's direct call to `$8C:E0B0` is followed by the conditional branch and writes
  through `$8C:E175`; `$8C:E178` clears carry and `$8C:E179` returns.
- Direct-page `$4C` is the entity-expression result; `$7E` is the current script-slot
  pointer.
- The entry and end addresses come from address-aligned disassembly of the vanilla ROM.