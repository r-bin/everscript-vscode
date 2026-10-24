# Script Opcode 0x89: Add a Shop Item

**Handler:** `$8C:E2B5`–`$8C:E310`\
**Opcode table entry:** `$8C:E9CF`\
**Operands:** item expression, then price expression\
**Confidence:** direct control flow confirmed; lookup-table extent and out-of-range behavior unresolved

## Control Flow

The handler scans byte positions beginning at `$7E:0B95` until it finds a byte with bit 7
set. The scan begins with X = `$FFFF` followed by `INX`, so the first examined offset is
zero. There is no explicit list bound in this loop; this reconstruction does not invent
one.

It then evaluates the item expression and sets a category bit in `$7E:0E6C` according to
the sign flag produced by 16-bit `CMP`/`BPL` tests:

| Branch result | Bit ORed into `$0E6C` |
|---|---:|
| `CMP #$0008` is negative | `$0002` |
| Otherwise, `CMP #$0030` is negative | `$0004` |
| Otherwise | `$0008` |

For the ordinary nonnegative item values shown by the opcode's reachable examples, these
correspond to `< 8`, `8..$2F`, and `>= $30`. The branch implementation is retained in the
C model so the sign-flag behavior is not silently replaced with an unsigned comparison for
all possible 16-bit expression results.

The item expression is then used as X to read a byte at long address `$8C:E311 + item`.
That byte is stored at `$7E:0B95 + slot`; `$FF` is stored at `$7E:0B96 + slot` as the next
sentinel. The handler doubles the slot index, evaluates the price expression, and stores
the resulting word at `$7E:0BC5 + 2*slot`. It sets carry and returns.

The bytes at `$8C:E311` are accessed as an indexed lookup, but their total table extent and
out-of-range behavior are not established here.

## Reconstruction

The control-flow model is in
[`reconstructed-c/8C/8CE2B5_opcode_89_add_shop_item.c`](../../../reconstructed-c/8C/8CE2B5_opcode_89_add_shop_item.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9CF` points to `$8C:E2B5`.
- The handler ends at `$8C:E310`; `$8C:E30F` sets carry and `$8C:E310` returns.
- `$8C:E311` begins the indexed ROM lookup data as accessed by `LDA $8CE311,X`; it is
  outside this handler.