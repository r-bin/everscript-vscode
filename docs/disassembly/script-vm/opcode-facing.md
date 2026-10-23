# Script VM Entity Facing Direction & Orientation Subsystem

## Overview
In Secret of Evermore, scripted actor facing, compass orientations, and dynamic entity-to-entity tracking are controlled by a dedicated family of Script VM opcodes in Bank `$8C`:

What each opcode does is described once, on its opcode page; this file keeps the routines' code: [`0x74` face_north](soe://rom/assets/scripts/opcodes/74.md), [`0x77` face_east](soe://rom/assets/scripts/opcodes/77.md), [`0x75` face_south](soe://rom/assets/scripts/opcodes/75.md), [`0x76` face_west](soe://rom/assets/scripts/opcodes/76.md), [`0x70` face_target](soe://rom/assets/scripts/opcodes/70.md), [`0x71` face_away](soe://rom/assets/scripts/opcodes/71.md).

All orientation vector calculations converge on the core subroutine `$8C:DF33` (`entity_compute_facing_towards`).

---

## Compass Directions & Angles
Secret of Evermore represents 16-way entity orientations using 4-bit indices stored at `entity + 0x22` (`FACE_DIRECTION`):

| Direction Code | Compass Heading | Angle (Degrees) | Typical Animation Bank Offset |
|---|---|---|---|
| `0` (`0x00`) | North | 0° (Up) | Up-facing walk / idle |
| `4` (`0x04`) | East | 90° (Right) | Right-facing walk / idle |
| `8` (`0x08`) | South | 180° (Down) | Down-facing walk / idle |
| `12` (`0x0C`) | West | 270° (Left) | Left-facing walk / idle |

Intermediate values (`2` = North-East, `6` = South-East, `10` = South-West, `14` = North-West) are utilized during diagonal walking physics, whereas standard cutscene facing opcodes snap to the primary cardinal axes (`0, 4, 8, 12`).

---

## Vector Dominance Mathematics (`$8C:DF33`)

Given a `source` entity at `(source_x, source_y)` and a `target` entity at `(target_x, target_y)`:

$$\Delta X = \text{source}_x - \text{target}_x$$
$$\Delta Y = \text{source}_y - \text{target}_y$$

1. Calculate $|\Delta X|$ and $|\Delta Y|$.
2. Compare $|\Delta Y|$ against $|\Delta X|$:
   - **Vertical Dominance** ($|\Delta Y| \ge |\Delta X|$):
     - If $\Delta Y \ge 0$: Source is below target $\implies$ Source faces **North (`0`)**.
     - If $\Delta Y < 0$: Source is above target $\implies$ Source faces **South (`8`)**.
   - **Horizontal Dominance** ($|\Delta Y| < |\Delta X|$):
     - If $\Delta X \ge 0$: Source is right of target $\implies$ Source faces **West (`12`)**.
     - If $\Delta X < 0$: Source is left of target $\implies$ Source faces **East (`4`)**.

---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CDF33_opcode_facing.c`](../../../reconstructed-c/8C/8CDF33_opcode_facing.c).
> [View in VFS: soe://rom/code/8CDF33](soe://rom/code/8CDF33?c=1&asm=0)

