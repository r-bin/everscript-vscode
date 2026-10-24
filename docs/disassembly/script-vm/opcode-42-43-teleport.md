# Script Opcodes 0x42 and 0x43: Teleport an Entity

**Shared movement tail:** `$8C:E01D`\
**Confidence:** confirmed

## Opcode 0x42: Teleport to a Tile

`$8C:DFEE` evaluates an entity and reads one packed word. The low byte is X tile and the high byte is Y tile; each is shifted left three bits into pixel coordinates before entering the shared movement tail.

## Opcode 0x43: Teleport to Coordinates

`$8C:E00D` evaluates an entity, then evaluates X and Y pixel coordinates and enters the same movement tail.

## Shared Movement Behavior

The tail checks entity field `+$10`; when bit `$0008` is set, it returns without moving the entity or consuming the layer override. Otherwise, if `$7E:23DB` is nonnegative, it copies that value to DP `$44`, resets `$7E:23DB` to `$FFFF`, and calls `$8F:C2E4`. If the override is negative, it calls `$8F:C2D1`. Both opcodes return carry set.

The host-side handlers and shared movement model are in [8CDFEE_opcode_42_43_teleport.c](../../../reconstructed-c/8C/8CDFEE_opcode_42_43_teleport.c). The two engine placement routines remain represented by named helpers.

## Evidence

- Opcode table entries `$8C:E941` and `$8C:E943` dispatch to `$8C:DFEE` and `$8C:E00D` respectively.
- `$8C:DFEE` fetches a word, separates its bytes, and shifts each coordinate left three bits.
- `$8C:E00D` evaluates two coordinate expressions and stores them in DP `$46`/`$48`.
- Shared code at `$8C:E01D` skips when entity `+$10` has bit `$0008`.
- For nonnegative `$23DB`, the shared tail writes DP `$44`, clears `$23DB` to `$FFFF`, and calls `$8F:C2E4`; otherwise it calls `$8F:C2D1`.