# AI behaviours, decompiled

The 15 routines a character record's behaviour (`+$03`) selects, read from the code and written as
C. They are named in the `IDLE_BEHAVIOR` enum (`src/games/evermore/language/data/index.json`) by
what they do. The compiler's names are kept in each member's comment. The C is in
`reconstructed-c/8F/8FCD17_enemy_ai.c`, `8FD5D2_roll_or_shoot.c` and
`8FD018_companion_follow.c` (shown by `soe://rom/code/<addr>`). Done for v0.342.0. This page
replaces §4 of [enemy_ai.md](enemy_ai.md) and the old knowledge entries for these routines, which
described behaviour the code does not have.

## How it was checked

Every routine in the jump table `$8F:CBE0` and every helper it calls were disassembled in full
(`$8F:D05E`–`$8F:DC34`), with CPU widths from the vanilla CDL library. Which records use which value
comes from all 142 ROM records. The CDL saw behaviours `$00`, `$04`, `$06`, `$08`, `$0A`, `$0C`
and their helpers run. `$10`, `$12`, `$14`, `$16`, `$18` and `$1A` were not recorded (bosses and
rarer enemies), so for them this page is from the code alone. Not checked in the emulator.

## When a behaviour runs

```c
// $8F:CCFA, every tick, after charging (§ character-properties.md +$2E)
if (!(e->anim_flags6C & 0x8000)) goto keep_animating;   // only at a point where the script lets the AI decide
if (e->flags10 & 0x0021) goto idle_animation;           // hidden or inactive
if (e is not Boy/Dog && (e->state14 & 0xF000)) goto scripted_move;   // $8F:D2DA, attach_script / paths
cmd = *e->anim_resume & 0xFF;                           // the next animation command where the script stopped
behaviour_table[rec->behaviour / 2](e, cmd);            // $8F:CBE0, read live through +$60
```

`cmd == $21` (the frame-boundary `nop`) tells the routine that the current animation ended its
cycle. Several routines only re-plan then.

Common entity fields: `+$78` state, `+$7A` timer (a tick deadline against `$0B19`), `+$24` target,
`+$22` facing (0 N, 2 NE, 4 E … 8 S … `$E` NW), `+$26/+$28` spawn point, `+$40` leash. Entity
`+$12` bits 0–1 are set by the move routine for the current tick: bit 1 when a step was blocked
(`$8F:AEE1`), bit 0 when it only got through by sliding (`$8F:AF11`).

## The building blocks

| routine | what it does |
|---|---|
| `$8F:D879` pick target | the controlled character, unless the other party member is alive and more than 20 px closer (\|dx\|+\|dy\|); then `$8F:D8D2` drops it if its `+$10` bit 5 or `+$14` bit `$0100` is set. **No range and no chance** |
| `$8F:D9BB` fight | stamina < `$400`: retreat. Else lined up within reach (`$8F:D9D1`, the record's `+$13`): attack. Else approach |
| `$8F:DA6D` approach | state 8; path-finds toward the target (`$8F:9877`), or heads straight for it when phasing or no path is found (`$8F:AB92`); walk animation |
| `$8F:DBCC` retreat | state 3; walks away from the target, turned by a random offset from `$8F:DB4C`; keeps going until it hits something |
| `$8F:DA4B` / `$8F:DA5C` attack | face the target (4 directions / 4 diagonals), then engage |
| `$8F:DC1D` engage | remember the target, mark it as attacked by us (target `+$80`), state 7, attack animation by charge (`$90:82D8`) |
| `$8F:D69B` engage test | for stationary ones: full stamina, `(rand & $FF) < +$15`, a living party member within `+$13` on both axes |
| `$8F:DAA7` leash | `rom/8fdaa7.md` |
| `$8F:D917` wander | alternates state 4 (stand 20–147 ticks) and state 5 (walk 30–93 ticks in a random cardinal direction) |
| `$8F:D988` keep going | if a path is set (`+$6A`), follow it and stop here; otherwise stop here unless the entity hit something and `+$0E` ≥ 20, in which case the caller re-plans |
| `$80:ADF0` / `$80:AE78` / `$80:AE5C` | 8-way / cardinal / diagonal direction-code helpers. `$80:ADF0` reads signed `dx`/`dy` from DP `$02`/`$04` (set as target minus entity at `$8F:D715`); its thresholds are quadrant-specific, and some branches return the live D register via `TDC`. `$80:AE78` reads signed `dx`/`dy` from DP `$02`/`$04` (set as target minus entity at `$8F:D6CE`); it returns N `$00`, E `$04`, S `$08`, or W `$0C` according to the dominant axis. For `dy >= 0`, horizontal wins ties; for `dy < 0`, vertical wins ties. `$80:AE5C` reads the same deltas and returns `$06` for (+,+), `$0A` for (+,-), `$0E` for (-,+), and `$02` for (-,-); zero follows the nonnegative branch. |

So **aggro range and chance are not used by roaming enemies.** A chaser always has a target. Its
`+$13` is only its attack reach. Chance matters only for the three stationary behaviours.

## The behaviours

| value | name (was) | routine | records | what it does |
|---|---|---|---|---|
| `$00` | `CHASE` (`DEFAULT`) | `$8F:D34B` | 53 | wander → chase the nearer party member, retreat while recharging, attack when lined up, leash home |
| `$02` | `NONE` (`UNKNOWN_1`) | `$8F:D76A` | 20 | nothing: back to the idle animation. Moved only by scripts |
| `$04` | `COMPANION_BOY` (`UNKNOWN_2`) | `$8F:D05E` | 1 | the Boy when not controlled: follow, pick targets by the AI setting |
| `$06` | `COMPANION_DOG` (`DOG_IDLE`) | `$8F:D0A8` | 1 | the same for the Dog, plus sniffing and idle sitting |
| `$08` | `STATIONARY` (`UNKNOWN_3`) | `$8F:D6FB` | 12 | engage test, face the target in 4 directions, attack |
| `$0A` | `WANDER` (`UNKNOWN_4`) | `$8F:D76E` | 36 | townsfolk: wander and pause; follow a path or a target if given one |
| `$0C` | `CHASE_HOVERING` (`HOVERING`) | `$8F:D4FB` | 5 | bob up or down 16 each decision, then `CHASE` |
| `$0E` | `STATIONARY_PLAYER` (`UNKNOWN_5`) | `$8F:D715` | 2 | engage test against the controlled character only, 8 directions |
| `$10` | `ROLL_OR_SHOOT` (`MAGMAR_ROLL_SHOOT`) | `$8F:D5D2` | 2 | at full charge: shoot, or curl and roll at the target |
| `$12` | `CHASE_OR_ROLL` (`VIPER_ROLL`) | `$8F:D421` | 2 | `CHASE`, but half the time it rolls at the target instead of closing in |
| `$14` | `BOUNCE` (`UNKNOWN_6`) | `$8F:D394` | 3 | keeps walking; at an obstacle turns toward the player or anywhere. Never attacks |
| `$16` | `DRIFT_EAST` (`UNKNOWN_7`) | `$8F:D3DC` | 1 | keeps walking; at an obstacle or every 16 px picks east (3/4), north or south |
| `$18` | `PURSUE_PLAYER` (`UNKNOWN_8`) | `$8F:D380` | 1 | approach the controlled character when charged, retreat otherwise. Never engages |
| `$1A` | `ROLL` (`MEGATAUR_ROLL`) | `$8F:D52E` | 1 | at full charge: curl and roll at the target |
| `$1C` | `STATIONARY_DIAGONAL` (`UNKNOWN_9`) | `$8F:D708` | 2 | `STATIONARY`, facing one of the 4 diagonals |

Records: `$02` the rocks, statue, bridge, boss hearts and cores, fan, speaker, bomb; `$08` the
flowers, stone cobras, claws, tiny tentacles, sphere bot; `$0E` Tar Skull and Salabog; `$10` Magmar;
`$12` the vipers; `$14` Rimsala; `$16` record 75; `$18` Mini-Taur; `$1A` Megataur; `$1C` the
tentacles; `$0C` the mosquitoes, Old Nick, Mephista, the floating fan.

### `$00` CHASE

```c
void chase(Entity *e, int cmd) {                         // $8F:D34B
    if (e->flags10 & 0x0002) return wander(e, cmd);      // a friendly one acts as townsfolk
    if (cmd != 0x21 && e->state != 0) {
        if (e->state == 8) { if (pick_target(e)) fight(e); else wander_step(e); return; }
        keep_going(e);                                   // returns only after hitting something
    }
    leash(e);
    if (pick_target(e)) fight(e); else wander_step(e);
}
```

The chaser never stands waiting for the player: unless its target is left out of targeting or the
leash sends it home, it closes in, attacks when lined up within `+$13`, and walks away while it
recharges. The retreat is why enemies back off after a swing. A friendly record or spawn
(spawn flag bit 1) with this behaviour acts as `WANDER`.

### `$02` NONE

```c
void none(Entity *e, int cmd) { idle_animation(e); }     // $8F:D76A: jml $90:828E
```

All the boss parts, props and the bomb: whatever they do comes from room scripts and their
animation scripts.

### `$04` COMPANION_BOY, `$06` COMPANION_DOG

```c
void companion(Entity *e, int cmd) {                     // $8F:D05E (Boy), $8F:D0A8 (Dog)
    if (e == controlled) return player_control(e);       // $8F:CD88 / $8F:CECC
    follow(leader);                                      // breadcrumbs, $8F:A78A
    if (dog && !e->hp) return follow_fainted(e);         // $8F:D28C: wider tether, the form's $1447 animation
    if (dog && (buttons & L|R)) return sniff_here(e);    // $8F:D018: walk to the sniff spot $1453.., or sniff
    tether(e);                                           // $8F:D1BF: too far from the leader → drop the target, run back
    if (pick_by_setting(e, setting)) {                   // $8F:D787; setting $0B09 / $0B0D
        if (e->stamina < charge_goal[$0B0B / $0B0F]) retreat(e);     // $8F:DDB3: $40 $400 $800 $C00
        else if (in_reach(e)) attack(e); else approach(e);
    } else if (dog) dog_idle(e);                         // sniff spot, else sit / wander / pause (states $B, $D, $C)
    else idle(e);
}
```

The AI setting 0 never attacks. 1–5 engage an enemy within 50 / 70 / 90 / 110 / 130 px (a square,
`$8F:D821`) of the controlled character. A forced target (`$144F`) wins, then whoever attacked
the companion, then its current target, then the nearest. The tether (`$8F:D1BF`) measures the
distance to the leader in breadcrumb steps against four limits (10 / 6 / 8 / 3; 4 / 3 / 3 / 1 while
`$23C3` is set) and, past them, drops the target and walks or runs after the leader. How
`$8F:AB0B` measures is not decoded.

### `$08` STATIONARY, `$1C` STATIONARY_DIAGONAL, `$0E` STATIONARY_PLAYER

```c
void stationary(Entity *e) {                             // $8F:D6FB ($1C: $8F:D708)
    if (!engage_test(e)) return idle_animation(e);       // $8F:D69B: full, (rand & $FF) < +$15, Boy or Dog alive within +$13
    e->facing = face_cardinal(dx, dy);                   // $1C: face_diagonal
    engage(e, target);
}
void stationary_player(Entity *e) {                      // $8F:D715: its own copy of the test
    if (e->stamina < 0x400 || (rand() & 0xFF) >= rec->aggro_chance) return idle_animation(e);
    p = controlled;                                      // only the controlled character, alive or not
    if (abs(p->x - e->x) < rec->aggro_range && abs(p->y - e->y) < rec->aggro_range)
        { e->facing = face_8(dx, dy); engage(e, p); }
}
```

They never move. Burrowing, submerging and lunging are their animation scripts.

### `$0A` WANDER

```c
void wander(Entity *e, int cmd) {                        // $8F:D76E
    if (cmd != 0x21) { keep_going(e); return start_pause(e); }       // hit something: stand still a while
    if (e->target) return approach(e);                  // a script gave it someone to follow
    leash(e);
    wander_step(e);                                      // stand 20–147 ticks, walk 30–93 ticks, repeat
}
```

### `$0C` CHASE_HOVERING

```c
void chase_hovering(Entity *e, int cmd) {                // $8F:D4FB
    if (e->z < 0x50) e->z += 16;
    else if (e->z >= 0x280) e->z -= 16;
    else e->z += coin() ? -16 : 16;
    chase(e, cmd);
}
```

### `$10` ROLL_OR_SHOOT, `$1A` ROLL, `$12` CHASE_OR_ROLL

```c
void roll(Entity *e) {                                   // $8F:D52E (Megataur)
    if (e->stamina < 0x400) { if (e->state == 15) stop_rolling(e); else idle_animation(e); return; }
    switch (e->state) {
    case 0:  e->state = 14; play(0x546A); break;         // curl up
    case 14: e->timer = now + 30 + (rand() & 31);        // when the curl hands back
             pick_target(e); e->facing = face_diagonal(dx, dy);
             e->state = 15; play(0x4DCE); break;         // roll
    case 15: roll_on(e); break;
    }
}
void roll_on(Entity *e) {
    d = face_diagonal(to the target) ^ e->facing;        // 0 ahead, 4 adjacent diagonal, 8 behind
    if (hit something) { if (d & 4) turn(e); else return stop_rolling(e); }
    else if (now >= e->timer) { if (d & 8) return stop_rolling(e); turn(e); }   // overshot
    play(0x4DCE);
}
stop_rolling: e->stamina = 0; e->state = 0; play(0x546A);           // uncurl
```

`ROLL_OR_SHOOT` (`$8F:D5D2`, Magmar) is the same with its own curl `$4DCA`. At full charge in state
0 a coin decides between the roll and a shot: face the target in 4 directions and play `$4DE6`
when facing south, else `$4DDA`. Its stop does not empty the meter.

`CHASE_OR_ROLL` (`$8F:D421`) runs `CHASE` up to the fight. Charged and not in reach, it closes in
or, on a coin, starts a roll: state `$F` for 90–121 ticks, facing a diagonal toward the target,
animation `$4C26`, then the record's attack-3 animation `+$3E` each decision while it rolls, by the
same `roll_on` rules. It ends with `$4C86`. In reach it attacks facing a diagonal.

### `$14` BOUNCE, `$16` DRIFT_EAST, `$18` PURSUE_PLAYER

```c
void bounce(Entity *e) {                                 // $8F:D394 (Rimsala)
    if (hit something) e->facing = coin() ? face_8(to the controlled character) : rand() & 0xE;
    walk(e);
}
void drift_east(Entity *e) {                             // $8F:D3DC (record 75)
    if (slid along something || ((e->x + e->y + 8) & 15) == 0) {
        r = rand() & 15;
        e->facing = r < 2 ? SOUTH : r < 4 ? NORTH : EAST;
    }
    walk(e);
}
void pursue_player(Entity *e) {                          // $8F:D380 (Mini-Taur)
    e->target = controlled;
    if (e->stamina >= 0x400) approach(e); else retreat(e);
}
```

None of these three engages. Their damage has to come from contact: their walk scripts set the
contact bits of `mode` (`$4000` / `$8000`, [animation_script.md](animation_script.md) § mode). Mini-Taur's
walk is `$8004` and Rimsala's `$4000`.

## Still open

- what `+$0E` (compared with 20 in `keep_going`) and `$23C3` (the tight tether) are;
- `+$14` bit `$0100`, which removes a party member from targeting;
- the names of the animation ids the roll routines play (`$546A`, `$4DCA`, `$4DCE`, `$4C26`, `$4C86`, `$4DDA`, `$4DE6`);
- an emulator run of the behaviours the CDL never saw.
