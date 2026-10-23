# Combat: ticks, randomness and behaviour

How a melee fight plays out in time, and every place the game rolls dice in it. The rules are read
from the game's code (each section names the routine and its knowledge entry). The model built on
them is `src/games/evermore/simulation/combat/`, and §8 checks it against the game itself. Boxes
(what a swing can touch) are in [attack_boxes.md](attack_boxes.md) and [hitboxes.md](hitboxes.md);
the AI's target search is in [enemy_ai.md](enemy_ai.md).

## 1. The tick

Every entity runs once per frame: an exec breakpoint on the per-tick pass (`$8F:CC44`) fired 207
times for each entity over about 209 frames of gameplay, with an occasional double or missed frame
(lag). Animation `sleep`/`hold` counts are in these ticks. So 60 ticks ≈ 1 s.

## 2. Charge

`+$2E` is the charge; `$400` is full (100 %). Each tick, `$8F:CC44` adds the character record's
`+$2E` (charge speed) while the entity is alive and its `mode` word `+$16` has neither bit `$10` nor
`$08` (`rom/8fcc40`).

- An attack script's `mode` has bit `$10`: **nothing charges while swinging**. Knockback's `mode`
  (`$0801` for the Wimpy Flower, `$0005` for the Boy) does not stop it: **the meter fills during
  knockback**.
- The attack script's last command, `4E`, empties the meter. An attack **cut short by a hit never
  reaches `4E` and keeps its charge**, so a struck enemy may attack again right after recovering.
- A spawned enemy starts **full** (`$8F:B14C` writes `$400`).
- The Boy or Dog the player does not control charges past `$400` (speed − 3 a tick) up to the cap
  its AI setting picks (`$8F:DDB3`: 100 / 200 / 300 %; a fresh game sets both to 100 %).
- `$90:82D8` picks the attack animation by charge: below `$400`, `$800`, `$C00`, above.

Speeds read so far: Boy and Dog 10 a tick (103 ticks to full), Wimpy Flower 15 (69 ticks).

## 3. When an enemy attacks — the first random wait

The behaviour routine runs every tick while the entity is idle (`$8F:CCFA`: entity `+$6C` bit 15
set, `+$10 & $21` clear). For the stationary plants (behaviour 8, `$8F:D6FB`) it is the engage test
`$8F:D69B` (`rom/8fd69b`):

1. charge must be full;
2. **`rand & $FF` < the record's `+$15`** — 5 for the Wimpy Flower, so about one tick in 51;
3. the Boy, then the Dog, within the record's `+$13` pixels on both axes (70 for the flower).

On success `$8F:DC1D` remembers the target and starts the attack (`rom/8fdc1d`). An enemy's wait
between attacks is therefore **its recharge plus a geometric wait**: for the flower 34 ticks of
attack + 69 of recharge + on average 51 more. In the game: never under 102 frames, 154 on average
(§8).

## 4. Does a swing hit — one roll per swing

For each strike box, `$8F:B615` walks the entity list and skips the attacker's own side and, when
the attacker is an enemy, anything with `+$10` bit 5 ("left out of targeting"); `$8F:B61E` then
drops the dead, the invulnerable (`+$16 & $20`), closed states and **the one this attacker already
struck** (`+$36`) (`rom/8fb5fc`). Before rolling, `$8F:BA06` writes the attacker into the target's
`+$36` with a 20-tick timer (`+$38`) (`rom/8fba06`). So an attack whose strike frames come close
together (the flower's at ticks 6, 12 and 18) **rolls once per target, hit or miss**.

The chance comes from the table behind `$8F:BAAF` (rows by the target's evade, words by the
attacker's hit rate, `$7FFF` certain). Read for the opening: Boy (hit 30) and Dog (33) against the
flower (evade 0) 100 %; flower (hit 40) against the Boy (evade 34) 58.8 %, against the Dog (38)
54.3 %. Measured in the game: 56.4 % of the flower's attacks hit the Boy.

## 5. How much — the damage roll

`w = attack − defence/4` (at full charge; clamped to 1 when it falls below 1), then one 16-bit
random number `r`: `a = (w+1)·r/65536 + w`, damage = `(2a + w) / 4`. So damage spans `3w/4` to
`5w/4`, nearly uniform (corrected from 3w/2; the decompiled routine is in
[character-properties.md](character-properties.md) § +$19). It is taken from HP on the **target's next tick**. Opening
values: Boy or Dog (attack 17) on the flower (defence 28): 7–12; flower (attack 9) on the Boy
(defence 5): 6–10, on the Dog (defence 10): 5–8. The formula and its Atlas variant are in
`src/games/evermore/scaling/` and [../plans/simulation/damage.md](../plans/simulation/damage.md).

## 6. Knockback — the second random wait

A hit starts the target's knockback animation (record `+$40`; the Boy's comes from his weapon, the
Dog's from its form). Its length has a `hold_random r, base` in it: base + the high byte of
`r × random byte`, so **base … base + r − 1 ticks** ([animation_script.md](animation_script.md)).

| Who | Knockback | Push |
|---|---|---|
| Wimpy Flower | 1 + 40…79 ticks | none (it is rooted) |
| Boy (Bone Crusher) | 54 + 8…47 = 62…101 ticks | 80 px back over the first 32 ticks |
| Dog (Act 1) | 33 + 8…47 = 41…80 ticks | 80 px back |

Knockback does not protect: its `mode` has no bit `$20`, so a knocked-back entity can be hit again
by another attacker. A hit during the target's own attack cancels that attack (§2).

## 7. Swings

Attack lengths and their first strike frame, from the animation VM:

| Who | Attack at full charge | First strike |
|---|---|---|
| Wimpy Flower | 34 ticks | tick 6 (then 12, 18) |
| Boy, Bone Crusher | 24 ticks | tick 5 |
| Dog, Act 1 | 33 ticks (lunges 19 px) | tick 12 |

## 8. Checked in the game

`node tools/routes/fight-in-game.mts --trials 80` boots room `0x38` through the intro hook (in
memory), puts the Boy right under the first Wimpy Flower with the Dog out, and walks him back after
each knockback. 80 deaths against the model's 10,000:

| | game | model |
|---|---|---|
| median | 16.5 s | 15.9 s |
| 10–90 % | 9.8–27.2 s | 9.7–25.6 s |
| fastest | 7.1 s | 5.6 s |
| hits to die | 4 (73 %), 5, rarely 3 | 4 (72 %), 5, rarely 3 |
| frames between attacks | ≥ 102, 154 on average | ≥ 103, 154 on average |

Not checked yet: the Boy and Dog killing a flower together; anything with movement, reach or walls.

**Trap**: starting straight in a room skips the opening scene, which leaves the Boy's `+$10` bit 5
set — no enemy can hit him until it is cleared (the tool does).

## 9. What the model leaves out

- Positions: everyone starts in reach and stays there; the 80 px push and the walk back are not
  modelled (the check walks back at once, and still matches).
- The random numbers are uniform draws, not the game's generator (`$80:859B`), so a model run is
  a distribution, not a replay of a particular game.
- Enemy drops, experience and levels between fights.
