# 2. Spawn scenarios — which enemies a room actually places

> Status: **not built.** The superset is shipped and labelled as such;
> picking among it is the job here. Builds on
> [docs/room-simulation.md](../docs/room-simulation.md), which settled what
> a spawn's index and coordinates mean.

## The problem, restated

Rooms are reused. The same map is entered at several points in the story
with different occupants, and the enter script chooses with `IF` on saved
flags. There is no literal answer in the bytes — the answer is *which branch
runs*. So the tab shows every placement reachable by any branch (1606 across
the ROM, all named) and says so.

## What to build instead of one answer

Not "the" spawn list. **Every distinct outcome, as a list of scenarios the
user picks from.**

Walk the enter script symbolically: at each `IF` whose condition the model
cannot decide, fork. Each leaf is a scenario — a set of placements plus the
conditions that had to hold to reach it. The UI shows them as named chips
above the map; clicking one re-renders the spawns.

```
map 0x2a
  ├─ default                  8 spawns   (no condition)
  ├─ $7E2A0C bit 3 set        3 spawns   "credits"
  └─ $7E2A0C bit 3 clear,
     $7E2A11 >= 2             8 spawns
```

Three things make this honest:

**Name scenarios from the ROM, never from a guess.** A branch's name comes
from the flag's own label where the script has one, or from the global
script it calls — the same trick [arrivals.md](../docs/script-format/arrivals.md)
uses to get "walking south" out of a prepare script's name. A branch with
nothing to name it is "branch 3", not "outro".

**Fold identical leaves.** Many forks place the same enemies; a room that
shows twelve scenarios with one difference between them is useless. Key a
scenario by its placement set, not by its path.

**Cap the fork count.** A script with ten undecidable conditions has 1024
leaves. Above a limit, stop forking, report "N conditions not explored", and
let the user pin individual flags to cut the tree down — which is the same
control as choosing a starting state in
[virtual-wram.md](virtual-wram.md).

## Pinning flags is the real UI

The scenario list is a *derived* view; the thing the user manipulates is the
flag state. Pinning `$7E2A0C bit 3 = 1` collapses the tree, and the
scenarios that remain are the ones consistent with it. That generalises to
[routes.md](routes.md), where the route's own progress pins them
automatically.

## How we would know it is right

- **Every scenario's conditions must be satisfiable together.** A leaf that
  requires a flag both set and clear means the walker mishandled a branch.
  Assert it for all 128 rooms.
- **The union of all scenarios must equal today's superset**, spawn for
  spawn. That is a free regression test against something already verified,
  and it catches a walker that silently drops a branch.
- **Against the emulator**: load a save at a known point, enter the room,
  and check the entity table matches the scenario whose conditions that save
  satisfies. This is the only test that proves the branch choice itself.
