# Offensive Alchemy Damage

This note records the part of offensive alchemy that is grounded enough to ship in the extension today.

## Confirmed inputs

- Offensive alchemy uses enemy `magic_defense`, not physical `defense`.
- Enemy `magic_defense` is the byte at offset `0x1d` in the vanilla entity record table.
- The stored stat is inverted before subtraction:

```text
effective_mdef = max(0, 0x40 - target.magic_defense)
```

- ROM offset `0x45E6B` contains the base might table used by alchemy spells.

## Current extension model

The extension currently exposes a conservative level-0 preview:

```text
base_might = spell_might_table[spell_id]
w = max(1, base_might - effective_mdef)
shown_damage = physical_rng_spread(w)
```

The last line means the same verified RNG helper used by the physical-damage docs is reused once `w` is known.

## What is verified versus open

Verified:

- Spell base might comes from the ROM table.
- `effective_mdef` is the grounded resistance term.
- A level-0 Hard Ball check against raw `magic_defense = 51` gives `w = 8`, which yields a shown range of `6-10`.

Still open:

- Exact spell-level growth.
- Exact charge or cast-state scaling.
- Whether every offensive spell uses the same final `w -> shown damage` path.
- Route-grade modeling for 8-casts and spell XP.

## Vanilla spell might table

| Spell | Base might |
|---|---:|
| Acid Rain | 17 |
| Atlas | 25 |
| Barrier | 25 |
| Call Up | 0 |
| Corrosion | 25 |
| Crush | 62 |
| Cure | 0 |
| Defend | 15 |
| Double Drain | 50 |
| Drain | 25 |
| Energize | 0 |
| Escape | 0 |
| Explosion | 87 |
| Fireball | 62 |
| Fire Power | 112 |
| Flash | 27 |
| Force Field | 0 |
| Hard Ball | 21 |
| Heal | 32 |
| Lance | 50 |
| Laser | 0 |
| Levitate | 0 |
| Lightning Storm | 87 |
| Miracle Cure | 37 |
| Nitro | 112 |
| One Up | 0 |
| Reflect | 0 |
| Regrowth | 2 |
| Revealer | 0 |
| Revive | 12 |
| Slow Burn | 1 |
| Speed | 25 |
| Sting | 75 |
| Stop | 0 |
| Super Heal | 62 |

## Example check

Hard Ball level 0 against raw `magic_defense = 51`:

```text
effective_mdef = 0x40 - 51 = 13
w = 21 - 13 = 8
shown range = 6-10
```

That is the concrete check currently covered by `test/damage.test.js`.