# Behaviours $10, $1A, $02, $0E ($8F:D5D2, $8F:D52E, $8F:D76A, $8F:D715)

> Superseded (v0.342.0). This page described behaviour the code does not have (submerge timers, an HP-512 enrage, shield checks). The routines
> are decompiled in [docs/entities/ai-behaviours.md](../../entities/ai-behaviours.md), and the C is
> in [`reconstructed-c/8F/8FD5D2_roll_or_shoot.c`](../../../reconstructed-c/8F/8FD5D2_roll_or_shoot.c).
> [View in VFS: soe://rom/code/8FD5D2](soe://rom/code/8FD5D2?c=1&asm=1)

| value | routine | what it does |
|---|---|---|
| `$10` ROLL_OR_SHOOT | `$8F:D5D2` | at full charge: a shot, or curl and roll diagonally at the target (Magmar) |
| `$1A` ROLL | `$8F:D52E` | at full charge: curl and roll (Megataur) |
| `$02` NONE | `$8F:D76A` | nothing; boss hearts and cores move only by scripts |
| `$0E` STATIONARY_PLAYER | `$8F:D715` | engage test against the controlled character only (Tar Skull, Salabog) |

None of them reads HP. Phases, submerging and lunges are room scripts and animation scripts.
