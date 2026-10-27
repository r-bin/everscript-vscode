# 2. Spawn scenarios — which enemies a room actually places

> Status: **built** (v0.358.0) as *variants*:
> [`simulation/variants.ts`](../../../src/games/evermore/simulation/variants.ts), shown as
> the Rooms tab's variant bar at the map's right edge (v0.359: the shell's side bar, 1..n,
> no "All") and as `soe://…/rooms/<id>/variants.md`.
> Where it differs from the sketch below is recorded under "What was built". Builds on
> [docs/scripts/room-simulation.md](../../scripts/room-simulation.md), which settled what
> a spawn's index and coordinates mean.

## What was built

- **Scenarios first, then enemies.** The enter script's scenarios (`room.ts`: branches
  that end, leave the room or play a scene) are split again on the conditions their
  *enemies* carry (hostile and active: `maps.enemiesAt`), never on townsfolk. Splitting
  on every character gave Fire Eyes' Village 30 variants; on enemies it gives the four a
  player meets (village, windwalker scene, credits, outro). Townsfolk behind a flag stay in
  their variant with "only if …".
- **Folded by cast.** Pieces that place the same characters are one variant; the other
  stories folded in are listed (`also`), e.g. the jungle's showcase.
- **Named from flag labels**, the ones a condition *requires* set (a condition taken as
  false names none), then the characters only that variant has: `default — Thraxx's heart`,
  `Thraxx dead · windwalker unlocked — Coleoptera's heart`.
- **Budgets keep what they cut.** A boss room's threads run past any step budget, which
  used to drop the "boss alive" path entirely. `keepCut` keeps paths still running as
  `end: 'cut'`: who they placed is known.
- **A spawner in a loop** (Thraxx's maggots) is one character with a count; only its first
  placement decides whether it is there.
- **Short titles and the lines each runs** (v0.362). `title` is what a list shows: the one or two
  characters only the variant places, a boss by its name (`Thraxx`, `Coleoptera`), `Empty` when
  nobody stands there, else the flags. `reached` is every instruction the variant can run: a
  static walk of the enter script (calls, starts and global calls followed; a visited set, so
  loops cannot hold it) that takes at each branch the condition the run recorded there
  (`RoomAnalysis.branches`, over the entry state) under each of the variant's flag assignments;
  a branch never tested, or tested differently each time round a loop, keeps both sides. Tagging
  each executed instruction with its branch condition instead was tried and dropped: the boss
  loop rejoins every 60 ticks, the conditions grew into opaque values, and the run took 4× as long.
  Both script viewers (Rooms → Trigger → Enter, Scripts → Everscript) grey the rest.
- **Polled conditions are the room going on, not a state** (v0.359). After placing Thraxx the
  enter script loops ($93D3CE, every 60 ticks): once `$2260&0x08` ("maggots triggered") is set
  mid-fight it refills up to four maggots, whose handles it keeps in `$2855..$285B` itself.
  Split on that, the chamber had five variants, two of them "maggots triggered" and one
  impossible (windwalker unlocked with Thraxx alive). A condition of a test one path reaches
  more than once is *polled*: it never splits, and a character placed only under it is
  `later` on its variant (not part of the fold key; taken only from the variant's own story,
  not the stories folded in). Thraxx's chamber: Thraxx (maggots later) / Coleoptera / empty —
  the three states the game has. Timing could not tell this apart: the enter script tests
  "Thraxx dead" itself only after an engine wait of unknown length.

Still open from below: pinning flags to collapse the list (the virtual-WRAM control), and
the emulator check that a save at a known point meets the variant its flags select.

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
script it calls — the same trick [arrivals.md](../../scripts/arrivals.md)
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
