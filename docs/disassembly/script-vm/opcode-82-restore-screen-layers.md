# Script Opcode 0x82: Restore Screen Layers

**Handler:** `$8C:E20F`–`$8C:E246`\
**Opcode table entry:** `$8C:E9C1`\
**Operands:** none\
**Confidence:** direct byte reads, writes, and control flow confirmed

## Control Flow

With the accumulator in 8-bit mode, this handler copies the room snapshot bytes to PPU
register shadows in this order:

| Source | Destination |
|---|---|
| `$7E:235B` | `$212C` |
| `$7E:235C` | `$212D` |
| `$7E:235D` | `$2131` |
| `$7E:235E` | `$2130` |

It then executes `TRB $0B29` with accumulator value `1`, clearing bit 0 of `$0B29` while
preserving its other bits. If `$7E:22EA & $80` is nonzero, it stores byte value `1` to
`$0B29`. Finally it restores 16-bit accumulator mode, sets carry, and returns, so the VM
continues in the same turn.

## Reconstruction

The byte-level model is in
[`reconstructed-c/8C/8CE20F_opcode_82_restore_screen_layers.c`](../../../reconstructed-c/8C/8CE20F_opcode_82_restore_screen_layers.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9C1` points to `$8C:E20F`.
- The handler ends at `$8C:E246`; `$8C:E245` sets carry and `$8C:E246` returns.
- The adjacent handler at `$8C:E247` is opcode `0x83`.