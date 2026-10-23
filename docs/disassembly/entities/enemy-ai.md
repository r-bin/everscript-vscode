# The AI dispatcher and the roaming behaviours ($8F:CD17, $8F:D34B, $8F:D69B, $8F:D6FB)

> Superseded (v0.342.0). This page described behaviour the code does not have (an aggro roll in every chaser). The routines
> are decompiled in [docs/entities/ai-behaviours.md](../../entities/ai-behaviours.md), and the C is
> in [`reconstructed-c/8F/8FCD17_enemy_ai.c`](../../../reconstructed-c/8F/8FCD17_enemy_ai.c).
> [View in VFS: soe://rom/code/8FCD17](soe://rom/code/8FCD17?c=1&asm=1)

- `$8F:CD17` dispatches through `$8F:CBE0` by the record's `+$03`, read live every idle decision.
- `$8F:D34B` (`$00` CHASE) always has a target (`$8F:D879`: no range, no chance), retreats while recharging,
  attacks when lined up within `+$13`, and goes home past its leash.
- `$8F:D69B` is the engage test (charge, `+$15` roll, `+$13` square) only the stationary behaviours use;
  `$8F:D6FB` (`$08` STATIONARY) is one of them.
