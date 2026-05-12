# Offensive Alchemy Damage

This note records the part of offensive alchemy that is grounded enough to ship in the extension today.

## Confirmed inputs

- Offensive alchemy uses enemy `magic_defense`, not physical `defense`.
- Enemy `magic_defense` is the byte at offset `0x1d` in the vanilla entity record table.
- The current level-0 preview uses a reduced resistance term derived directly from the stored stat:

```text
effective_mdef = max(0, floor((target.magic_defense + 20) / 4))
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
- `effective_mdef` matches the raw `magic_defense` values shown by SoETilesViewer for Wimpy Flower, Mosquito, and Carltron's Robot.
- A level-0 Hard Ball check against raw `magic_defense = 32` gives `w = 8`, which yields a shown range of `6-10`.

Still open:

- Exact spell-level growth.
- Exact charge or cast-state scaling.
- Whether every offensive spell uses the same final `w -> shown damage` path.
- Route-grade modeling for 8-casts and spell XP.

## Scaling tab preview graphs

The Scaling tab now shows two extra offensive-alchemy preview graphs:

- `damage vs spell level` keeps the target fixed and applies a clearly labeled projected spell-power preview of `+10% base might per spell level` from level `0` to `9`.
- `damage vs target level` keeps the spell level fixed and, only for scalable targets, reuses the existing defense growth slope as a temporary stand-in for `magic_defense` growth.

These two graphs are UI previews, not newly grounded ROM math. The grounded part remains the level-0 `effective_mdef` subtraction and the final RNG spread helper.

## Docs tab manual preview

The Docs tab offensive-alchemy calculator now also exposes a `spell level` slider.
It uses the same projected preview helper as Scaling:

```text
projected_spell_power = round(base_might * (1 + 0.10 * spell_level))
```

That makes it useful for manual spot checks, but it does not make spell-level growth grounded. Right now it is still a convenience preview layered on top of the verified level-0 `effective_mdef` and RNG path.

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

Hard Ball level 0 against raw `magic_defense = 32`:

```text
effective_mdef = floor((32 + 20) / 4) = 13
w = 21 - 13 = 8
shown range = 6-10
```

That is the concrete check currently covered by `test/damage.test.js`.