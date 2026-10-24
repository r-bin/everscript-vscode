# Script Opcode 0xB9: Move an Entity by Pixel Offsets

## Routine Boundary

The vanilla entry is `$8C:E040` and its final instruction is `$8C:E08D` (`RTS`). The next handler starts at `$8C:E08E`. The reconstructed routine is in [`reconstructed-c/8C/8CE040_move_entity_by_pixel_offset.c`](../../../reconstructed-c/8C/8CE040_move_entity_by_pixel_offset.c).

## Behavior Established by the Vanilla Instructions

- `$8C:E040` evaluates an entity, then evaluates X and Y offsets into direct-page words `$46` and `$48`.
- If both offsets are zero, it writes `1` to `$7E:23E3` and returns with carry set without entering the movement probe.
- Otherwise it checks entity field `+$10` for bit `$0008`. If set, execution takes the rejection path.
- It adds the offsets to entity coordinates at `+$1A` and `+$1C`, clears bit `$0800` in field `+$10`, then calls `$8F:AF48`.
- A carry-clear probe result takes the rejection path. A carry-set result calls `$8F:C2E4` to commit the target position.
- The success/no-op path writes `1` to `$7E:23E3`; the rejection path at `$8C:E089` writes `0`. Both paths set carry before returning.

The probe and position-commit routines are represented as external calls in the C reconstruction; their internals are not duplicated here.

## Vanilla Evidence

- [Entry `$8C:E040`](soe://bus/8ce040.asm?rom=vanilla)
- [Probe call and commit/rejection branches `$8C:E077`–`$8C:E08D`](soe://bus/8ce077.asm?rom=vanilla)
- [Next handler entry `$8C:E08E`](soe://bus/8ce08e.asm?rom=vanilla)