# Script Opcode 0x83: Apply Screen Layers

**Handler:** `$8C:E247`–`$8C:E27A`\
**Opcode table entry:** `$8C:E9C3`\
**Operands:** none\
**Confidence:** direct byte reads, writes, and control flow confirmed

## Control Flow

With the accumulator in 8-bit mode, this handler copies the current layer settings to PPU
register shadows in this order:

| Source | Destination |
|---|---|
| `$7E:0F80` | `$212C` |
| `$7E:0F81` | `$212D` |
| `$7E:0F82` | `$2131` |
| `$7E:0F83` | `$2130` |

It then executes `TRB $0B29` with accumulator value `1`, clearing bit 0 of `$0B29` while
preserving its other bits. If `$7E:22EA & $80` is nonzero, it stores byte value `1` to
`$0B29`. Finally it restores 16-bit accumulator mode, sets carry, and returns, so the VM
continues in the same turn.

## Reconstruction

The byte-level model is in
[`reconstructed-c/8C/8CE247_opcode_83_apply_screen_layers.c`](../../../reconstructed-c/8C/8CE247_opcode_83_apply_screen_layers.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9C3` points to `$8C:E247`.
- The handler ends at `$8C:E27A`; `$8C:E279` sets carry and `$8C:E27A` returns.
- The register mapping is directly visible in the handler's byte-sized loads and long
  stores.