# Script Opcode 0xA9: Set or Clear an Entity Attribute

**Handler entry:** `$8C:E6EA`\
**Dispatch table:** `$8C:E6F8`\
**Opcode table entry:** `$8C:EA0F`\
**Operands:** entity expression, then selector expression\
**Confidence:** selector dispatch and listed field effects confirmed

## Control Flow

The handler evaluates an entity into DP `$4C`, evaluates the selector, places the
selector in X, and jumps through the table at `$8C:E6F8`. Supported even selectors
`$00` through `$0E` write the selector to entity offset `+$22`. Selectors `$10` through
`$36` select the updates below. The handler returns carry set on modeled paths, so the
script continues in the same turn.

| Selector | Operation |
| --- | --- |
| `$10` / `$12` | Clear / set `+$10` bit `$4000` |
| `$14` / `$16` | Set / clear `+$10` bit `$0002` |
| `$18` / `$1A` | Clear / set `+$12` bit `$1000` |
| `$1C` / `$1E` | Set / clear `+$12` bit `$4000` |
| `$20` / `$22` | Set / clear `+$10` bit `$0400` |
| `$24` / `$26` | Set / clear `+$10` bit `$0080` |
| `$28` / `$2A` | Set / clear `+$12` bits `$C000` |
| `$2C` / `$2E` | Set / clear `+$14` bit `$0020` |
| `$30` / `$32` | Set / clear `+$14` bit `$0040` |
| `$34` / `$36` | Set / clear `+$14` bit `$0800` |

Setting selector `$12` also clears entity `+$76` and clears bits `$0478` in `+$12`.
Setting selector `$14` also clears entity `+$76`.

## Boundary

The indirect table ends at `$8C:E72E`. Odd selectors and selectors `$38` or above do
not name modeled table entries; their machine behavior is not reconstructed here. The C
model returns `SCRIPT_HANDLER_UNMODELED_DISPATCH` for those values instead of inventing
semantics.

## Evidence

- `$8C:E6EA` calls entity expression evaluation and selector expression evaluation,
  then dispatches with `JMP ($E6F8,x)`.
- `$8C:E6F8` contains the branch entries through `$8C:E72E`; `$8C:E730` stores the
  low-selector value at entity `+$22` and returns carry set.
- `$8C:E73A` confirms the `$12` set path, pending-damage clear, and `$FB87` status mask.
- `$8C:E735` is used by the `$14` set path to clear pending damage before the setter.
- Setter/clearer routines return carry set. The model is at
  [`reconstructed-c/8C/8CE6EA_opcode_a9_attribute_bit.c`](../../../reconstructed-c/8C/8CE6EA_opcode_a9_attribute_bit.c).