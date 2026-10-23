# The companion behaviours ($8F:D05E, $8F:D0A8, $8F:D018, $8F:D1BF)

> Superseded (v0.342.0). This page described behaviour the code does not have (pixel zones of 32 / 128 / 384 and a teleport; $1443/$1445 read as coordinates). The routines
> are decompiled in [docs/entities/ai-behaviours.md](../../entities/ai-behaviours.md), and the C is
> in [`reconstructed-c/8F/8FD018_companion_follow.c`](../../../reconstructed-c/8F/8FD018_companion_follow.c).
> [View in VFS: soe://rom/code/8FD018](soe://rom/code/8FD018?c=1&asm=1)

- `$04` COMPANION_BOY (`$8F:D05E`) and `$06` COMPANION_DOG (`$8F:D0A8`) run the party member the player
  does not control: follow the leader by breadcrumbs, the tether `$8F:D1BF` (limits in breadcrumb steps),
  targets by the AI setting (`$0B09` / `$0B0D`: 0 never, 1-5 within 50-130 px of the leader, `$8F:D787`),
  charge to `$8F:DDB3[$0B0B / $0B0F]` before attacking.
- `$8F:D018`: the Dog with L or R held walks to the sniff spot (`$1453`-`$1459`) or sniffs in place.
  `$1443`-`$144B` are the Dog form's animation ids.
