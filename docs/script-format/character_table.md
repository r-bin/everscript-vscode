# The character table

> Status: **solved.** Base `$8EB678`, stride **74** bytes. Layout from
> SoETilesViewer's `characterdata.h`; verified field by field against its
> editor.

## Verification

Record **109** (Wimpy Flower) matches the editor exactly on palette
(`0xb1ab`), HP (18), aggro range (70) and `anim_stand` (`0x495e`). Record
**113** (Mosquito) matches on palette (`0xb34b`), HP (1), aggro range (20)
and `anim_stand` (`0x4a36`).

## Offsets used here

| Offset | Field | Used for |
|---|---|---|
| `+0x00` | name pointer (24-bit) | — |
| `+0x05` | default entity flags | [hostility](#hostility) |
| `+0x09` | palette | a 16-bit address **within bank `$90`** |
| `+0x0f` | HP | — |
| `+0x13` | aggro range | — |
| `+0x32` | `anim_stand` | [the idle animation](animation_format.md) |
| `+0x34`.. | `anim_walk`, `anim_run`, `anim_atk0..3`, `anim_damage`, `anim_death`, `anim_spoils`, `anim_block` | — |

The struct also carries attack, defence, magic defence, evade, hit rate,
EXP, money, prize chance, charge limit/speed and an attack proc — see
`characterdata.h` for the full list. Only the fields above are read.

## The palette

`+0x09` is a 16-bit value that is an address inside **bank `$90`**: 16
BGR555 words, widened as the PPU does (`(c & 31) * 8`). Index 0 is
transparent.

Found by probing candidate banks and looking: `$90B1AB` for the Wimpy
Flower gives a purple ramp, and `$90B34B` for the Mosquito gives blues —
which the rendered sprites confirm.

## Hostility

`+0x05` is the character's **default entity flags** — the same bit field
`add_enemy(enemy, x, y, flags)` passes per spawn, which the everscript
compiler calls `CHARACTER_FLAG_ENEMY`. Bit 1 is `INVINCIBLE`, and it splits
the table cleanly:

| Value | Count | Who |
|---|---|---|
| `0x0002` | 39 | every townsperson — villagers, Fire Eyes, Horace, Strongheart, Madronius, Gomi, Tinker, the Professor, plus the rocks and the bridge |
| `0x0000` | 97 | every monster, plus the Boy and the Dog |
| `0x0010` | 2 | Spark, Salabog |
| `0x0400` | 2 | the two Mosquitoes (`PHASING`) |
| `0x0022` | 1 | `PLACEHOLDER` |

No monster carries bit 1 and no townsperson lacks it, which is what makes it
usable as "does this fight back". `0x0020` is `INACTIVE`: placed, but not
acting until a script wakes it.

A placement can override the default — `0x3c` and `0xa2` carry their own
flags word, so `add_enemy(FIRE_EYES, …, INACTIVE_IMORTAL)` places a character
with no flags of her own as a harmless one. The Rooms tab uses the spawn's
flags when it has them and the record's otherwise, and says which in the
tooltip.

## Reaching a character

Scripts do not name characters directly; they name an `ENEMY` enum value,
whose comments carry the character number. See
[enemy_spawns.md](enemy_spawns.md).
