# Cheats and movement tricks

Behaviour of the unmodified game that a player can use. Each entry says why it
happens, with the code that does it.

## Diagonal speed boost

**Moving diagonally covers the full straight-line speed on both axes at once.**
Walking or running NE moves as far up per tick as walking or running E moves
right, and just as far right. With most weapons that is faster upward than going
straight N.

### Why it happens

1. **Animations move the character.** A walk or run is an animation script, and
   its `step n` commands move the entity `n/4` px per tick
   ([animation_script.md § Movement speed](script-format/animation_script.md#movement-speed)).
   Each facing has its own script, and they don't use the same `n`: the spear
   walk steps 6 going north or south and 8 going east or west.
2. **Walk and run animations have only four poses.** The record's flags (bit 6)
   say so, and the table at `$90815B` maps NE and SE to the E script, NW and SW to
   the W script. Starting a walk does not round the facing itself (`+0x22` stays
   diagonal). Only attacks do that (`$908343`).
3. **The mover doesn't scale diagonals.** `step` passes its distance to `$8FAD51`,
   which caps it at `+0x64` and jumps through the direction table `$8FAF18`:

   | Facing | x | y |
   |---|---|---|
   | N / S | 0 | ∓d |
   | E / W | ±d | 0 |
   | NE / SE / SW / NW | ±d | ±d |

   A diagonal gets the full `d` on both axes, with no division by √2.

So facing NE plays the **E** script, with E's longer step, and the mover applies
that step both right and up. The result is E's speed upward, E's speed sideways,
and about 1.41 × E's speed overall.

### Speeds, in px per tick (60 ticks a second)

"Straight" is pressing just one direction. "Diagonal" is the speed on each axis
while holding a diagonal.

**The Boy.** Weapons fall into two groups; within a group every weapon moves
the same.

| Weapon | Walk N / S | Walk E / W | Walk diagonal | Run N / S | Run E / W | Run diagonal |
|---|---|---|---|---|---|---|
| Bone Crusher, swords, axes | 1.50 | 1.74 | 1.74 + 1.74 | 2.50 | 2.75 | 2.75 + 2.75 |
| Spears, Bazooka | 1.50 | 2.00 | 2.00 + 2.00 | 2.75 | 3.00 | 3.00 + 3.00 |

**The Dog.** Its forms differ, and some forms run faster N or S than E or W, so
for them the diagonal is *slower* vertically.

| Form | Walk N / S | Walk E / W | Run N / S | Run E / W |
|---|---|---|---|---|
| Act 0 (Podunk) | 1.00 / 1.00 | 1.00 | 3.75 / 5.25 | 5.25 |
| Act 1 (Prehistoria) | 0.75 / 1.00 | 0.75 | 4.00 / 4.00 | 3.25 |
| Act 1 with stick | 4.00 / 4.00 | 3.25 | 4.00 / 4.00 | 3.25 |
| Act 2 (Antiqua) | 1.25 / 1.00 | 1.26 | 2.73 / 3.25 | 2.73 |
| Act 3 (Gothica) | 1.50 / 1.50 | 1.75 | 2.50 / 3.25 | 2.50 |
| Act 4 (Omnitopia) | 2.00 / 1.75 | 2.00 | 6.75 / 8.00 | 6.25 |

### Which weapon and direction to pick

**Travelling horizontally:** sideways speed is the E/W speed whether you hold E
or a diagonal. So the direction doesn't matter, only the weapon (or form).

| Who | Best choice | Walk | Run |
|---|---|---|---|
| Boy | a spear or the Bazooka, E/W or any diagonal | 2.00 | 3.00 |
| Boy | Bone Crusher, sword or axe | 1.74 | 2.75 |
| Dog | Act 4, then Act 0 (run) | 2.00 | 6.25 / 5.25 |

**Travelling vertically:** zig-zag between the two diagonals (NE, NW, NE, …)
whenever E/W is faster than N/S. The sideways parts cancel out and you keep the
diagonal's vertical speed.

| Who | Up (north) | Down (south) | Gain over straight |
|---|---|---|---|
| Boy, spear or Bazooka | zig-zag diagonals | zig-zag diagonals | walk 2.00 vs 1.50 (+33%), run 3.00 vs 2.75 (+9%) |
| Boy, Bone Crusher, sword or axe | zig-zag diagonals | zig-zag diagonals | walk 1.74 vs 1.50 (+16%), run 2.75 vs 2.50 (+10%) |
| Dog Act 0 | run: zig-zag (5.25 vs 3.75, +40%) | straight (equal) | |
| Dog Act 1, with or without stick | straight | straight | diagonal is slower when running (3.25 vs 4.00) |
| Dog Act 2 | either (equal) | straight (3.25 vs 2.73) | |
| Dog Act 3 | walk: zig-zag (1.75 vs 1.50); run: either | run: straight (3.25 vs 2.50) | |
| Dog Act 4 | straight | straight | diagonal is slower when running (6.25 vs 6.75 / 8.00) |

The fastest vertical travel for the Boy is a spear or the Bazooka, running, in
diagonals. Swapping to a spear only for the trip is worth it when walking (+15%
over a sword's diagonal) and slightly when running (3.00 vs 2.75).

### Caveats

- The numbers come from running the scripts in the Characters tab's interpreter
  (speed overlay, all eight facings), averaged over the repeating part of the
  cycle. They have not been timed on hardware.
- `$8FAD51` caps every step at entity `+0x64`. The interpreter does not model
  that cap, so a form whose step exceeds it (the fast Dog runs) may be slower
  in game.
- Collision against walls is separate (`$8FAF48`): sliding along a wall can
  turn a diagonal into a straight move.
