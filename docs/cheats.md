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

---

## Walking through enemies (Hitbox phase glitch)

**While running, in rare situations the Boy can phase directly through an advancing enemy without being blocked or damaged.**
This glitch is most commonly observed when running North while an enemy moves South, particularly with Volcano Lizards (Vipers) and Act 3 Slimes.

### Why it happens

1. **The 2:1 squashed hitbox (`$8FB4AB`).** Body collision between two entities tests:
   ```
   |dx| < r1 + r2      and      2 * |dy| < r1 + r2
   ```
   Because vertical delta `|dy|` is doubled (`ASL A` at `$8FB4C5`), the vertical collision band is **half** the horizontal width:
   ```
   |dy| < (r1 + r2) / 2
   ```
   The Boy's radius is $r = 8$ (Character Record `+0x0D`). Both Volcano Lizards (Vipers `#91`/`#92`) and Slimes (Lime Slime `#62`, Blue Goo `#63`, Red Jelly `#61`) have radius $r = 10$.
   - **Horizontal width:** $r_1 + r_2 = 18 \implies |dx| \le 17$ (a **35 px** wide box).
   - **Vertical height:** $2 \cdot |dy| < 18 \implies |dy| \le 8$ (an **only 17 px tall** box, from $-8$ to $+8$ px relative to center).

2. **High closing speed & discrete tick sampling.**
   Collision is evaluated at discrete positions on each tick (not swept continuously).
   - Running straight moves the Boy at $2.50$ to $2.75$ px/tick (with spear/bazooka); running diagonally moves up to $3.00$ px/tick vertically. Steps dither between 2 and 3 px (`$8FB090` cycles `3, 2, 0, 1`).
   - An enemy advancing toward the player adds another $1.5$ to $3.0$ px/tick.
   - Closing velocity along the vertical axis is **$5$ to $6+$ px per tick**. Across a collision zone only 17 px tall, the two entities spend only 2–3 ticks near the threshold.

3. **Subframe update order and the "already overlapping" rule (`$8FB4FD`).**
   Entities update sequentially within each tick:
   1. Player (Boy at `$7E4E89`)
   2. Companion (Dog at `$7E4F37`)
   3. Active enemies (linked list from `$7E3DDF`)

   Suppose the Boy runs North and lands just outside the collision boundary (e.g. distance $|dy| = 9$ or $10$ px, where threshold is $8$). The move is outside the box and succeeds (`SEC` at `$8FB4A9`).

   Later in the *same tick*, the enemy updates and moves South by 2–3 px. The distance drops to $|dy| \le 8$ px. If the enemy is in an animation that does not trigger contact damage or deflection:
   
   On the **next tick**, the Boy steps North again. His destination $(X', Y')$ is inside the enemy's box. The engine checks whether the prospective destination hits: it does (`CMP $18$`). But then it evaluates the Boy's **starting position** at `$8FB4FD`–`$8FB520`:
   ```assembly
   8FB4FD  LDX $4C          ; mover (Boy)
   8FB4FF  LDA $001C,Y      ; candidate Y (Enemy)
   8FB503  SBC $001C,X      ; mover current Y (Boy current Y)
   ...
   8FB50C  ASL A            ; 2 * |dy_current|
   8FB50D  CMP $18          ; was current |dy| < (r1 + r2) / 2?
   8FB51E  CMP $18          ; was current |dx| < (r1 + r2)?
   8FB522  RTS              ; IF BOTH WERE ALREADY INSIDE: ALLOW MOVE!
   ```
   Because the enemy stepped toward the Boy on the previous subframe, the Boy's current position is **already inside** the enemy's collision box.
   
   To ensure that overlapping spawns never permanently trap the player, the engine allows any move that begins inside an existing overlap (`RTS` at `$8FB522`). The move is approved! On subsequent frames, the Boy continues moving North until exiting cleanly on the far side.

### Does it depend on the enemy hitbox?

**Yes.**
- **The 2:1 aspect ratio makes it almost exclusively vertical:** Horizontally ($E \leftrightarrow W$), the threshold is 35 px wide. Approaching horizontally takes 6–7 ticks, ensuring that the mover hits the outer boundary and gets blocked. Vertically, the threshold is only 17 px tall, so high closing speed can cross from outside to inside in a single interleaved subframe.
- **Enemy radius:** Enemies with radius $r=10$ (Lizards, Slimes) or smaller ($r=6$ Frippo/spiders) produce narrow vertical collision bands (13–17 px). Enemies with large radii ($r=16$ Bad Dawg, $r=20$ Raptors/Megataur, $r=30$ Salabog) produce vertical bands of 25 to 39+ px, which are too wide for standard running steps to jump the boundary into an overlapping state.
- **Elevation plane mismatch (`+0x18`):** In multi-plane rooms (like Volcano room `0x3B` or Sewers room `0x3D`), if an enemy steps on a transition tile that changes its elevation plane, planes differ (`$8FB4F3 EOR $44 != 0`), causing body collision to be skipped entirely.

### Why Volcano Lizards and Act 3 Slimes?

1. **Both have radius 10:** Volcano Lizards (Vipers `#91`/`#92`) and Slimes (Lime Slime `#62`, Blue Goo `#63`, Red Jelly `#61`) both have radius 10, sharing the 17 px vertical collision window.
2. **Aggressive vertical pursuit:** Both enemies use homing AI that charges straight North/South when aggroed.
3. **Inert contact damage during recovery:** Contact damage at `$8FB52C` requires charging mode (`mode $4000/$8000`) **and** full stamina (`+0x2E >= $0400`). After a Slime leaps or a Viper strikes, stamina is dumped to 0 (`STZ $002E,X` via `$908461` or `$8FB584`). While stamina recharges, the enemy's body is physically passive—phasing through it deals no damage and causes no knockback.

### TAS utilization and manipulation

- **Can it be manipulated? Yes.**
  A TAS can manipulate:
  - Exact sub-pixel positioning and the 4-tick speed dither phase (`$0F36` cycling table `$8FB090`: `3, 2, 0, 1`).
  - Enemy AI step timers (`+0x7A`) and RNG rolls (`$80859B`) to force the enemy to step South immediately after the Boy stops at $|dy| = 9$ or $10$ px.
  - This guarantees that the Boy begins the subsequent frame already overlapping, cleanly passing through.

- **Can it be used to walk through all enemies? No.**
  - **Large enemies ($r \ge 16$):** Large hitboxes (Raptors, Megataur, Timberdrake) are 25–39+ px tall, making the boundary too thick to cross into overlap in one subframe without being blocked.
  - **Stationary or fleeing enemies:** If an enemy does not move toward the player, closing speed is limited to the Boy's run speed (2.5–3.0 px/tick). The Boy alone cannot cross an 8-pixel boundary without being blocked at the threshold.
  - **Full-stamina charging enemies:** If an enemy with `mode $4000/$8000` has full stamina (`+0x2E >= $0400`), entering the body box triggers contact damage at `$8FB52C`, interrupting the Boy with knockback unless protected by casting/dodging invulnerability (`mode $20`).

### Is the Dog better at tunneling?

**In casual play: No (worse odds). In a TAS: Yes, significantly (Act 4 Dog is the best tunneling vehicle in the game).**

The Dog has conflicting factors: a much larger body, but radically higher speeds.

| Character | Radius ($r$) | Hitbox vs $r=10$ Enemy | Run Speed N/S (px/tick) | Approach Window Odds ($S_E=2$) | Ticks to Cross Box |
|---|---|---|---|---|---|
| **Boy** | 8 | $35 \times 17$ px ($|dy| \le 8$) | 2.50 – 2.75 | $\frac{2}{3+2} = \mathbf{40\%}$ | $\approx 6 - 7$ ticks |
| **Act 1 Dog** | 16 | $51 \times 25$ px ($|dy| \le 12$) | 4.00 | $\frac{2}{4+2} = \mathbf{33\%}$ | $\approx 6 - 7$ ticks |
| **Act 4 Dog** | 16 | $51 \times 25$ px ($|dy| \le 12$) | 6.75 – 8.00 | $\frac{2}{8+2} = \mathbf{20\%}$ | $\mathbf{\approx 3 - 4\text{ ticks}}$ |

#### 1. Disadvantage: Larger Hitbox ($r = 16$)
The Dog's radius is $16$ (double the Boy's $8$). Against a radius 10 enemy, the combined vertical threshold is:
$$2 \cdot |dy| < 26 \implies |dy| \le 12\text{ px}$$
The Dog's collision box is **$25$ px tall** (vs the Boy's $17$ px) and **$51$ px wide** (vs $35$ px). Being $47\%$ taller makes the Dog a much larger obstacle that is harder to clear without an overlap state.

#### 2. Casual Play: Worse Random Odds ($P_{\text{spatial}} = \frac{S_E}{S_{\text{dog}} + S_E}$)
Because the Dog covers larger strides each tick ($4$ or $8$ px per tick):
- When running at an enemy stepping at $2$ px/tick, the approach step modulo is wider ($6$ or $10$ px).
- The fixed entry window ($S_E = 2$ px) represents a smaller fraction of the approach stride:
  - Act 1 Dog ($4.00$ px/tick): $\mathbf{33\%}$ spatial alignment.
  - Act 4 Dog ($8.00$ px/tick): $\mathbf{20\%}$ spatial alignment.
- Furthermore, when the Dog is AI-controlled (playing as the Boy), companion AI (`$8FD0B0`) frequently turns, hesitates, sniffs, or stops to charge bite attacks. The Dog will almost never sustain a blind dead-straight sprint through an enemy unless the player manually controls the Dog via `SELECT`.

#### 3. TAS & Crossing Advantage: Act 4 Dog clears the box in 3 ticks
Once the `$8FB4FD` overlap bypass is primed (which a TAS achieves with $100\%$ determinism via sub-pixel alignment):
- **Act 4 Dog (Omnitopia Toaster)** moves at **$6.75$ to $8.00$ px/tick** straight North—the fastest vertical displacement in the game.
- At $8$ px/tick, the Dog traverses the entire $25$ px collision interior in **only 3 to 4 ticks** (compared to 6–7 ticks for the Boy).
- Clearing the box in half the time drastically minimizes the window in which an enemy can trigger an attack frame, AI redirection, or recovery phase.
