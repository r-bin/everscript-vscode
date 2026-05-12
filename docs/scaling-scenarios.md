# Scaling Scenarios — Everscript Extension

This document describes the damage model used in the **Scaling** tab, explains the
`scale_enemies.asm` patch, and ranks the analysis scenarios most likely to be
useful when tuning enemy scaling for a randomizer or kaizo ROM hack.

---

## Background

### Vanilla character stats (ROM)

All 142 entity records live at SNES `0x8eB678` (ROM offset `0x0EB678`, HiROM no
header), `0x4a` bytes each:

| Offset | Field         | Notes |
|--------|---------------|-------|
| 0x0f   | hp            | |
| 0x19   | attack        | physical attack |
| 0x1b   | defense       | physical defense |
| 0x1d   | magic_defense | raw ROM value; `effective_mdef = 0x40 − magic_defense` |
| 0x1f   | evade         | 0–255; reduces attacker hit chance |
| 0x21   | hit_rate      | 0–255; attacker's base accuracy |
| 0x23   | exp           | 4 bytes |
| 0x27   | money         | |

Indices 0 and 1 are the **boy** and the **dog** (their names are pointers to WRAM;
all other entries point to ROM strings).

### Physical damage formula (verified via soestuff.lua)

Formula ported from `soestuff.lua` (lsnes script, brute-forces all 65536 RNG
seeds and confirmed against observed in-game values):

```
attack_total = attacker.attack + weapon_bonus   // weapon_bonus = 0 for raw stat

// Apply charge level (weapon charge on attack):
attack_modified = attack_total >> 2   // charge < 25% (energy < 0x200)
attack_modified = attack_total >> 1   // charge < 50% (energy < 0x400)
attack_modified = attack_total        // charge = 100% (full charge)

// Core formula (all arithmetic mod 0x10000):
w = ~((floor(target.defense / 4) − attack_modified) − 1) & 0xffff
if w >= 0x8000: w = 1   // clamped: attacker far exceeds defense
wram0002 = w + 1

// RNG seed: wram000c ∈ [0, w]  (derived from 16-bit RNG state via wram0002)
damage_min = (3 × w) >> 2      // seed = 0
damage_max = (5 × w) >> 2      // seed = w
damage = min(999, damage)
```

**Why seed ∈ [0, w]:** The RNG seed `wram000c` is computed as
`floor(wram0002 × i / 65536)` for `i` ∈ [0, 65535].  Its maximum is
`floor(wram0002 × 65535 / 65536) = w`.  Therefore the damage expression
`(2·seed + 3·w) >> 2` ranges from `(3w)>>2` to `(2w + 3w)>>2 = (5w)>>2`.

**Verification:** Boy L1 + Bone Crusher (+10 weapon bonus) = atk 17 vs Wimpy
Flower (def 28): `w = ~((7−17)−1) & 0xffff = ~(−11) & 0xffff = 10`.
`min = 7`, `max = 12` — matches observed in-game damage.

> **Previous (wrong) approximation** used `damage_max ≈ base + floor(atk/4)`.
> That formula inflated max damage by ~10× for typical stats and has been removed.

### Hit chance (approximate)

```
hit% ≈ clamp(attacker.hit_rate − target.evade, 0, 100) / 100
```

Vanilla boy `hit_rate` and enemy `evade` are both in the 0–255 range.  The exact
scaling factor is unverified.

### Alchemy damage (partially verified)

The current reverse-engineering state is strong enough to document the main
inputs to offensive alchemy, but not strong enough to claim the entire cast
formula is fully solved.

**Confirmed inputs:**

- Offensive alchemy uses enemy `magic_defense`, not physical `defense`.
- Enemy `magic_defense` lives in the same vanilla stat table as the other enemy
  stats (`0x1d` within each record).
- The effective resistance term is inverted from the raw stored stat:

```
effective_mdef = max(0, floor((target.magic_defense + 20) / 4))
```

- Vanilla ROM offset `0x45E6B` contains a per-spell **alchemy might** table.
  Entries are 2 bytes each (little-endian); in vanilla the high byte is
  effectively always zero.

**Working model for offensive spells:**

```
base_might = ALCH_MIGHT_TABLE[spell_id]
scaled_spell_power = f(base_might, spell_level, cast_charge, other spell-specific state)
damage ~= max(1, scaled_spell_power - effective_mdef)
```

The subtraction against `effective_mdef` is the grounded part.  The unresolved
piece is the exact `f(...)` term: how spell level, charge level, and any
spell-specific logic transform the base might value before the final hit value
is produced.

For the tighter offensive-alchemy write-up used by the extension, see
`docs/alchemy-damage.md`.

**What the ROM table gives us today:**

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

This table explains the broad ordering that players observe in practice:
`Nitro` and `Fire Power` sit at the top, `Sting` is stronger than `Crush`, and
`Hard Ball` is materially weaker than the heavy hitters before level / charge
scaling is even applied.

**Important caveats:**

- The values above are **base might**, not guaranteed final shown damage.
- Non-damaging and support spells still have table entries; several are zero,
  but some buffs / healing spells use non-zero values.  Their exact downstream
  use is still not fully mapped.
- The supplied Atlas / Hard Ball traces are enough to justify documenting the
  might table and the magic-defense subtraction, but they do **not** yet fully
  trace the last step from `scaled_spell_power` to final shown damage for every
  offensive spell.

### Script / projectile damage (not documented)

Boss scripts and projectile routines apply damage directly via memory writes; no
formula intercept exists in vanilla.  `scale_enemies.asm` hooks
`DAMAGE_SOURCE`/`DAMAGE_SOURCE_TIMER` for partial attribution but the details are
incomplete (see `TODO` comments in the ASM).

---

## `scale_enemies.asm` — what it does

When the patch line is **not commented out** in a `main.evs` file:

```evs
"scale_enemies(!ROM_EXTENSION=$FE8000, !WITH_DEBUG_PALETTE=0)"
```

The patch:
- Hooks the HP, attack, defense, magic defense, EXP, and money calculations.
- Reads the enemy's **level** (an injected sprite slot byte) and uses it as an
  index into per-entity tables stored at `$FE9000+`.
- Each table has **37 entries** (levels 0–36) of 2 bytes per entity — 142 entities
  × 37 levels × 2 bytes = `0x4000` bytes per stat.
- The **boy and dog are excluded** from scaling (their vanilla stats are preserved).
- `magic_defense` is stored **inverted** in the table: `table_value = 0x40 −
  desired_effective_mdef`.

If `scale_enemies` is active the Scaling tab will prefer scaled stats over vanilla
ROM stats when plotting per-level curves.

---

## Scenario Ranking

### Tier 1 — Most immediately useful

| # | Scenario | X-axis | Y-axis | Notes |
|---|----------|--------|--------|-------|
| 1 | **Physical damage: boy → enemy** | Enemy defense (or scaled enemy level) | Damage band (min/max) | Core balance check; most common question |
| 2 | **All physical weapons vs one enemy** | Weapon / charge tier | Damage band | Compare weapon viability at a fixed enemy defense |
| 3 | **Physical damage: enemy → boy** | Scaled enemy level | Damage band | How dangerous is this enemy per level? |
| 4 | **Hit chance: boy → enemy** | Enemy evade | Hit % | Enemies with very high evade feel unfair |
| 5 | **Hits to kill (boy → enemy)** | Scaled enemy level | Expected hit count | More intuitive than raw damage numbers |

### Tier 2 — Useful for alchemy / boss tuning

| # | Scenario | X-axis | Y-axis | Notes |
|---|----------|--------|--------|-------|
| 6 | **Alchemy damage vs enemy** | Magic defense | Damage per cast | Base might table is known; exact level / charge scaling is still TBD |
| 7 | **Alchemy burst: N casts × M charges** | Pre-cast count (0–20) | Total damage range | e.g. 32 Hard Balls + 8 Storms with 20 precasts |
| 8 | **Alchemy damage band by charge level** | Charge level | Damage range | Shows how much pre-charging matters |
| 9 | **All enemies at one level** | Entity index | Damage from boy | Identify outliers; quick balance scan |
| 10 | **Defense wall: when does weapon stop doing > 1 dmg?** | Defense threshold | N/A (single value) | Find the defense ceiling for each weapon |

### Tier 3 — Advanced / edge cases

| # | Scenario | Notes |
|---|----------|-------|
| 11 | Projectile damage vs enemy | Not properly documented; DAMAGE_SOURCE partially available |
| 12 | Script damage (boss scripted hits) | Values hardcoded in scripts; manual annotation needed |
| 13 | Poison / status tick damage | Separate mechanic, not in stat tables |
| 14 | Enemy attack mitigation by boy armor/evade | Requires boy armor stat separate from raw attack |

---

## Scenario 7 in detail: alchemy burst with precasts

> *"I cast 32 HBs and 8 Storms on an enemy, having done 20 precasts — what is the
> damage range of those 8 Storm casts?"*

Parameters:
- **Precasts** — Hard Balls or other alchemy cast to accumulate charge (each adds
  to the in-memory alchemy charge counter).
- **Batch** — 8 Storm casts all fired at once ("8casting" = 8 casts per batch).
- **Precast count** — 20 precasts means the charge counter has been raised 20×
  before the batch.

The damage for each spell cast in the batch depends on the accumulated charge
level at the moment of impact.  Because the charge counter ticks down during the
batch, the **first cast of the batch** hits at the highest charge, the last at the
lowest.

This scenario requires:
1. Alchemy spell power data per charge level (not yet in the stat tables).
2. A charge-decay model (how many ticks between each cast in the batch).

**Status: blocked on alchemy spell power data.**  Placeholder chart can show
"damage vs charge level at time of impact" as a stand-in.

---

## Implementation notes

- **No scaling support yet**: the initial tab reads vanilla ROM stats only.
- **Weapon bonuses**: hardcoded from known weapon data; charge tiers are
  labelled but not yet read from ROM.
- **Formula**: uses the approximation above; flag as unverified in the UI.
- When `scale_enemies` is detected as active (non-commented line in `main.evs`):
  - Show a highlighted badge on the tab.
  - Future: offer a "Use scaled stats at level N" slider.
