# Script Opcode 0xB5: Launch a Projectile

**Handler entry:** `$8C:E81B`\
**Movement table:** `$90:D986`\
**Projectile initializer:** `$90:DCC0`\
**Opcode table entry:** `$8C:EA27`\
**Operands:** eight expressions\
**Confidence:** expression order, direct-page staging, movement lookup, and continuation confirmed

## Control Flow

The handler evaluates eight expressions in order: movement selector, source entity,
source X, source Y, source Z, target X, target Y, and final parameter. It looks up the
movement entry at `$90:D986 + selector`, stages the values into direct-page fields, calls
`$90:DCC0`, sets carry, and returns so the script continues in the same turn.

| Value | Direct-page field |
| --- | --- |
| Target X | `$02` |
| Target Y | `$04` |
| Movement entry | `$06` |
| Final parameter | `$08` |
| Source entity | `$4C` |
| Source X | `$46` |
| Source Y | `$48` |
| Source Z | `$4A` |

The internal allocation and field writes performed by `$90:DCC0` remain opaque in this
handler model.

## Model

[`reconstructed-c/8C/8CE81B_opcode_b5_projectile.c`](../../../reconstructed-c/8C/8CE81B_opcode_b5_projectile.c)
models expression order, the movement-table lookup, staged parameters, and the opaque
initializer call.

## Evidence

- `$8C:E81B` through `$8C:E83C` evaluate the eight expressions in order; stack transfers
  place the staged values into DP `$02`, `$04`, and `$4C`.
- `$8C:E829`, `$8C:E82F`, and `$8C:E835` store source X/Y/Z in DP `$46/$48/$4A`.
- `$8C:E851` loads a word from `$90:D986 + X` into DP `$06`.
- `$8C:E857` calls `$90:DCC0`; `$8C:E85B` sets carry before return.