# Offensive Alchemy Damage

This note records the part of offensive alchemy that is grounded enough to ship in the extension today.

## Confirmed inputs

- Offensive alchemy uses enemy `magic_defense`, not physical `defense`.
- Enemy `magic_defense` is the byte at offset `0x1d` in the vanilla entity record table.
- ROM offset `0x45E6B` contains the base might table used by alchemy spells.
- The spell-level high component at `7E2F98 + spell_id*2` feeds the cast-side level scale table.

## Traced projectile formula

```text
level_scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][spell_level]
spell_power_at_level = ceil(base_might * level_scale / 4)
spell_bonus_base = floor(base_might * level_scale / 4)
projectile_power = spell_power_at_level + floor(spell_bonus_base * rng16 / 65536)
shown_damage = floor(projectile_power * (0x40 - target.magic_defense) / 0x40)
```

## Projectile research notes

Recent throw-and-hit traces plus outside struct notes add one more useful anchor for
projectile-style offensive alchemy:

- Active alchemy attack slots start at `7E3564`.
- Each active slot is `0x76` bytes.
- The projectile struct field at `+0x2A/+0x2B` is labeled `POWER` or damage.

The cast-side and hit-side traces now ground both halves of the projectile path:

- `91CCF4..91CD41` reads the spell level high component and base might, computes cast-side projectile power, and writes `POWER` at `+0x2A`.
- `919C9D..919CDA` applies target `magic_defense` as a multiplier of `(0x40 - magic_defense) / 0x40` before the HP loss is stored.

This also explains why hit-only traces are incomplete for spell-level work. Once the
trace starts inside the hit routine, the relevant projectile power has already been
prepared. Full throw+hit traces are more useful because they can expose the earlier
producer path that fills the projectile slot.

## What is verified versus open

Verified:

- Spell base might comes from the ROM table.
- Spell level high component uses the traced scale table `[2, 4, 7, 11, 15, 20, 26, 32, 39, 46]`.
- Projectile power uses `ceil(base_might * scale / 4)` plus a RNG bonus based on `floor(base_might * scale / 4)`.
- Hit damage multiplies projectile power by `(0x40 - magic_defense) / 0x40`.
- Hard Ball level 0 against raw `magic_defense = 32` yields `5-10`.
- Hard Ball level 1 against raw `magic_defense = 32` yields `10-20`.

Still open:

- Whether every offensive spell uses the same projectile path.
- Route-grade modeling for 8-casts and spell XP.

## Scaling tab preview graphs

The Scaling tab now shows two extra offensive-alchemy graphs:

- `damage vs spell level` keeps the target fixed and now uses the traced projectile cast-side level table from the ROM: `scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][spell_level]`, then `spell_power_at_level = ceil(base_might * scale / 4)`.
- `damage vs target level` keeps the spell level fixed and, only for scalable targets, reuses the existing defense growth slope as a temporary stand-in for `magic_defense` growth.

The target-level graph is still a UI preview because target `magic_defense` growth is not grounded yet. The spell-level graph now uses traced cast-side spell power instead of the older `+10%` placeholder.

## Docs tab manual preview

The Docs tab offensive-alchemy calculator now also exposes a `spell level` slider.
It uses the same traced cast-side helper as Scaling:

```text
level_scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][spell_level]
spell_power_at_level = ceil(base_might * level_scale / 4)
spell_bonus_base = floor(base_might * level_scale / 4)
shown_damage = floor(projectile_power * (0x40 - magic_defense) / 0x40)
```

That grounds the spell-level power step and the target-side hit multiplier for projectile alchemy. The remaining open part is how broadly this path generalizes across every offensive spell and route setup.

The Docs tab now also calls out the projectile-slot `POWER` field so this research
context is visible in the extension, not only in external notes.

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
level_scale = 2
spell_power_at_level = ceil(21 * 2 / 4) = 11
spell_bonus_base = floor(21 * 2 / 4) = 10
projectile_power range = 11-20
shown range = floor(projectile_power * 32 / 64) = 5-10
```

That is the concrete check currently covered by `test/damage.test.js`.