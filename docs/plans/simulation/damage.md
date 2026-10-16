# 1. Damage — what one entity does to another

> Status: **mostly built, in the wrong shape.** The formulas exist and are
> tested; what is missing is a single call that takes an attacker and a
> defender.

## What exists

**Physical.** The clamp path lives in
[`tests/memory/damage.test.js`](../tests/memory/damage.test.js) — as test
helpers, not as a module:

```js
chargedPhysicalAttack(atk, charge)   // <=25% -> atk>>2, <=50% -> atk>>1, else atk
inner = ((def >> 2) - atkEff) & 0xffff
w     = ~((inner - 1) & 0xffff) & 0xffff
if (w < 1 || w >= 0x8000) w = 1      // the signed clamp
damageRangeFull(w)                   // -> { min, max, pct999 }
```

It also models the **Atlas glitch**: subtracting 480 from the charged attack
and, below full charge, letting the underflow past the clamp — which is
where the 999s come from. `damageRangeFull` is already in
[`src/maps/alchemy-model.js`](../src/maps/alchemy-model.js).

**Alchemy.** Fully in `alchemy-model.js`, from
[docs/alchemy-damage.md](../docs/alchemy-damage.md): `base_might` from
`$45E6B`, the ten-entry `level_scale` table, the RNG term, and the
`(0x40 - magic_defense) / 0x40` reduction against the enemy's **magic**
defence at `+0x1d`, not its physical one. `alchemyProjectedRange` even
scales the target's defence and HP by level.

## What is missing

**1. Move the physical model out of the test.** A formula that only exists
in a test file cannot be used by a fight view. It belongs next to the
alchemy one, with the test importing it rather than redefining it.

**2. One entry point.** Everything downstream — the fight window, the route
replay — wants:

```ts
damage(attacker, defender, method): Distribution
```

where `attacker` and `defender` are entity states (party member or character
record), `method` is physical / alchemy(spell, level) / charged physical /
Atlas, and `Distribution` gives min, max, the full per-roll probabilities
and `pct999`. Distributions, not averages: "13 hits, 70%" is the question
[routes.md](routes.md) asks, and you cannot get there from a mean.

**3. The attacker side of physical.** Alchemy reads its inputs from ROM
tables; physical reads the party's **attack**, which is weapon plus level
plus equipment. That number comes out of [virtual-wram.md](virtual-wram.md),
and sourcing it is the only real unknown left on this page.

**4. Whether a swing connects at all.** Damage is not the whole answer — an
attack has to land. That is already solved and documented:
[attack_boxes.md](../docs/script-format/attack_boxes.md) (animation command
`0x47`, the `2(|dx|-r) < w` test) and
[hitboxes.md](../docs/script-format/hitboxes.md). A fight simulation that
ignores reach will report odds for a swing that misses.

## How we would know it is right

The existing damage tests are the floor and must keep passing. Beyond them:

- a trace of one real fight, comparing the damage numbers the game prints
  with the distribution's support — the number shown has to be *in* the
  range, and over enough swings the histogram has to match;
- the Atlas cases specifically, because they are the ones where an
  off-by-one in the clamp is invisible until it produces a 999.
