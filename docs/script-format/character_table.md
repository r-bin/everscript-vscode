# The character table

> Status: **solved.** Base `$8EB678`, stride **74** bytes. Layout from
> SoETilesViewer's `characterdata.h`; verified field by field against its
> editor.

## Verification

Record **109** (Wimpy Flower) matches the editor exactly on palette
(`0xb1ab`), HP (18), aggro range (70) and `anim_stand` (`0x495e`). Record
**113** (Mosquito) matches on palette (`0xb34b`), HP (1), aggro range (20)
and `anim_stand` (`0x4a36`).

## Every field, from the code that reads it

Each meaning below comes from a read of `$8E00xx,X` where X is an entity's
character pointer (`LDX $0060,Y`). The address is where to look.

| Offset | Size | Field | What the code does with it |
|---|---|---|---|
| `+0x00` | 3 | name pointer | 24-bit; `$8C89FD` |
| `+0x03` | 2 | behaviour | selects the AI script (`$8FCD1A`) |
| `+0x05` | 2 | spawn flags | OR'd into entity `+0x10` at spawn (`$8FB0C3`); bit 1 = non-hostile ([hostility](#hostility)); the hit test compares the party bits (`$5006`) |
| `+0x07` | 2 | flags | bit 0: registered in a list at `$58AF` (`$8FC4BA`) · bit 1: −30 on the hit rate (`$8FBA46`) · bits 2–3: tested by the script engine (`$8C86A6`, `$8C86DA`) · **bit 4: immune to weapon projectiles**, automatic miss in physical to-hit check (`$8FB9FB`; magic projectiles bypass this and never miss) |
| `+0x09` | 2 | palette | an address in bank `$90` ([below](#the-palette)); `$90CD1B` |
| `+0x0B` | 2 | second palette | when non-zero, loaded into palette slot 2 (`$90CD01` → `$90CF3A`) |
| `+0x0D` | 2 | radius | body box `2r × r` (`$8FB472`); hurt region half-size `r` round the feet (`$8FB651`) |
| `+0x0F` | 2 | HP | → entity HP `+0x2A` at spawn (`$8FB15B`) |
| `+0x11` | 2 | ? | → entity `+0x2C` at spawn (`$8FB162`). 0–100; 20 on 52 characters. *Open* |
| `+0x13` | 2 | aggro range | px, compared with the distance to the controlled character (`$8FD72D`, `$8FDA25`) |
| `+0x15` | 2 | aggro chance | compared before pursuing (`$8FD6AD`) |
| `+0x17` | 2 | ? | → entity `+0x40` at spawn unless `$23DD` overrides it (`$8FB169`, `$8FDEAB`). 0–1000. *Open* |
| `+0x19` | 2 | attack | damage routine `$8FC042` |
| `+0x1B` | 2 | defence | damage routine `$8FC072` |
| `+0x1D` | 2 | magic defence | alchemy damage scales by `($40 − m.def) / $40` (`$919CB3`) |
| `+0x1F` | 2 | evade | as the target: indexes the to-hit table `$8FBAAF` (`$8FBA27`) |
| `+0x21` | 2 | hit rate | as the attacker: the other side of the to-hit roll (`$8FBA53`) |
| `+0x23` | 4 | EXP | added to the Boy's (`$0A49`) and the Dog's (`$0A93`) totals (`$8F8292`, `$8F82D4`) |
| `+0x27` | 2 | money | talons (`$8F868E`) |
| `+0x29` | 1 | prize chance | on death a drop when `rand & $7F` < value: value / 128 (`$908567`) |
| `+0x2A` | 2 | ? | no direct read. 1 on 115 characters, 2–50 on the rest: possibly a base level. *Unverified* |
| `+0x2C` | 2 | charge limit | cap on the charge meter, entity `+0x2E` (`$91AEDE`) |
| `+0x2E` | 2 | charge speed | added to the meter every tick; full at `$400` (`$8FCC5D`) |
| `+0x30` | 2 | attack proc | what a hit does, dispatched at `$8FB6A5` via `$8FB6AE` |
| `+0x32` | 2 | stand | animation record ([the idle](animation_format.md)) |
| `+0x34` | 2 | walk | |
| `+0x36` | 2 | run | `$908286` |
| `+0x38`–`+0x3E` | 2 each | attack 0–3 | |
| `+0x40` | 2 | damage | started by `$8FC2C4` (the shared knock-back `$3E6A` for most) |
| `+0x42` | 2 | death | played when the prize roll fails (`$90858D`) |
| `+0x44` | 2 | death with spoils | played when it succeeds (`$908587`) |
| `+0x46` | 2 | cast | alchemy or an item (Boy, Bad Boy, Verminator); `$90829B`; plays invulnerable (`mode $0120`) |
| `+0x48` | 2 | ? | only on Bad Dawg, Bad Boy, Dark Toaster; started at `$8FC1D6` when state `+0x12` bit `$40` is raised while alive. *Open* |

The struct is 74 bytes; `+0x4A` is the next record.

### The Boy's weapons and the Dog's forms

The Boy's record leaves his walk, run, attack and knockback fields empty; his
animations come from the equipped weapon. The weapon table is at ROM offset
`$0438E6` (bank `$C4`; not `$8838E6`): 15 entries of 36 bytes.

| Offset | Field | Notes |
|---|---|---|
| `+0x04` | palette | The Boy is drawn in it, whatever he is doing. Not traced to a reader; matches the art |
| `+0x08` | idle | |
| `+0x0A` | walk | |
| `+0x0C` | run | |
| `+0x0E`..`+0x14` | attack Lvl 0–3 | Picked by stamina at `$9082D8`: < 100%, 100%, 200%, 300% |
| `+0x16` | dodge | Sets mode `$20` (invulnerable). Not a charging stance: the record's script is the dodge |
| `+0x18` | knockback | |

The Dog's counterpart is its forms: 6 entries via the pointer table at `$CF945F`,
a 10-byte header (palette at `+6`) and 15 animation slots
(`src/sprites/dog-forms.js`). Acts 0–3 put one record in all four attack slots.

Attack power scales with the attacker's stamina too (`$8FC02B`): ÷4 under 50%,
÷2 under 100%, ×1, ×2 from 200%, ×4 from 300%.

### Against everscript's enums

`everscript/in/core/[group] 00_general_enums/[group] 05_everscript/03_sprites.evs`
names many of the same things. Where the two meet:

| everscript | Here | Agrees? |
|---|---|---|
| `ATTRIBUTE_GENERAL.LEVEL = 0x2a` | `+0x2A` | yes — names the field this page could only guess at |
| `XP = 0x23`, `CHARGE_MAX = 0x2c` | `+0x23`, `+0x2C` | yes |
| `CHARGE_RATE = 0x2f` | `+0x2E` | **no** — `$8FCC5D` adds the word at `+0x2E`; `0x2f` looks one byte off |
| `POINTER_SPRITE_RUNNIN = 0x46` | `+0x46` | **no** — `+0x46` is casting (Boy, Bad Boy, Verminator, `mode $0120`); run is `+0x36` (`$908286`) |
| `POINTER_SPRITE_ATTACK_DEFAULT/LEVEL_1..3 = 0x38..0x3e` | attack 0–3 | yes; level 0 is "charged below 100%", level 1 "charged ≥ 100%" |
| `FLAG_ENEMY` | spawn flags `+0x05` | yes: `$0001` inactive+invisible, `$0002` invincible, `$0004` party/bombable, `$0020` inactive, `$0040` mosquito, `$0400` phasing, `$1000` invisible+invincible+inactive. The hit test's side mask `$5006` is exactly `$0002 | $0004 | $1000 | $4000` |
| `ATTRIBUTE.DAMAGE_SOURCE = 0x36`, `DAMAGE_SOURCE_TIMER = 0x38` | entity `+0x36/+0x38` | yes — the 21-tick hit cooldown |
| `ATTRIBUTE.STAMINA = 0x2e` | entity `+0x2E` | yes — the charge meter the aggro check waits on |
| `ATTRIBUTE_FLAGS.FLAGS_7` (entity `+0x16`) | `mode` | yes: `$01` knockback, `$04` walking, `$08` running, `$10` attacking, `$20` casting / dodging — the bit the hit test refuses |

Record `+0x07`, `+0x0B`, `+0x11` and `+0x17` have no everscript name yet.

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
