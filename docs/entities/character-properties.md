# Character properties, decompiled

Every field of the 74-byte character record (the Characters tab's Stats cards), traced to the
code that reads it and written as C. The field map in short is the knowledge entry
`rom/8eb678.md`; this page has the code and the evidence behind it. Done for v0.340.1.

## How it was checked

1. **Find every reader.** A scan of the whole ROM for long-indexed operations on bank `$8E`
   (`lda/ora/and/adc/sbc/cmp $8E00xx,x`) with `xx` < `$4A`, grouped by field. The Boy's and the
   Dog's records live in WRAM (`$0A26`, `$0A70`). Bank `$8E` mirrors low WRAM, so the same reads
   reach them. A second scan looked for absolute reads of `$0A26`–`$0AB9`, the code that touches
   only the party.
2. **Read each one.** Every hit disassembled in context with its CPU widths from the vanilla CDL
   library (US, SHA-1 `79e773…`). A hit in a data block (bank `$8E` also holds ring-menu tables
   that use the same addressing) was dropped.
3. **Check it ran.** The CDL code bit confirms most readers ran in recorded play. Not recorded:
   the bank `$91` effect handlers (Speed, regeneration, full heal, damage ticks), the second
   aggro path `$8F:D715` and some projectile handlers. Their reading is from the code alone.
4. **Check the data.** Each field across all 142 ROM records: range, distinct values, which bits
   are used (§ Data).
5. **Entity fields.** A copied field means nothing until something reads its copy. For entity `+$2C`
   and `+$40`, the CDL WRAM flags were checked across all 57 entity slots.

The charge, engage, to-hit and damage rules were already measured in the game
([combat.md](combat.md) §8). The rest here is static: code plus data.

Reading the C: `e` is the entity (WRAM, `$8E` or `$AE` bytes), `rec` its record
(`e->record`, entity `+$60`), `rand()` the 16-bit generator `$80:859B`, `rand_below(n)` `$80:AD62`
(0 … n−1).

## The fields

### +$00 name pointer (24-bit)

```c
// $8C:89F3: the target window's banner
text = targets > 1 ? MULTIPLE_TEXT : rec->name;   // $8C:8A1C is the "several" text
```

The Boy's and the Dog's point at their name buffers `$7E:2210` / `$7E:2234`. Tab: shown as the
character's name. ✔

### +$03 behaviour

```c
// $8F:CCFA, every tick while idle (e+$6C bit 15) and not hidden/inactive (e+$10 & $21)
if (e < BOY_ENTITY && (e->state14 & 0xF000)) goto other;     // $8F:D2DA
x = rec->behaviour;                                           // read live, not copied
anim_byte = *e->script & 0xFF;
goto behaviour_table[x / 2];                                  // $8F:CBE0, 15 entries $00..$1C
```

Read through `+$60` on every tick, **not copied at spawn**: changing the entity's `TYPE` (`+$60`)
changes its behaviour too. (Previously believed in [runtime_stats.md](runtime_stats.md): probably
copied, unaffected by a TYPE swap.) Vanilla records use all 15 values. Tab: drop-down by the
compiler's `IDLE_BEHAVIOR` names. ✔

### +$05 spawn flags

```c
// $8F:B0B8
e->record = rec;
e->flags10 |= dp_spawn_flags | rec->flags05;
```

Bits as the tab lists them (`docs/entities/entities-reference.md`). Vanilla uses only `$0002`,
`$0010`, `$0020` and `$0400`. Tab: a 16-bit drop-down. ✔ The card's button shows 16 bits plus
spaces, wider than the half-width card (cut off in the narrow panel).

### +$07 flags

| bit | read by | what it does |
|---|---|---|
| 0 | `$8F:C4BA` | on a layer change the entity takes one of ten `$82`-byte side records at `$58AF` (pointer in entity `+$86`, cleared by `$8F:C554`); its use is open. Records 105, 106 |
| 1 | `$8F:BA46` | its hit rate drops by 30 **only against the party member the player does not control** (the target is `$0F42 ^ $01BE`). 8 records |
| 2 | `$8C:86DA` | the target filter `$8C:8658` may pick it although it is friendly (`+$10` bit 1), when the request mask `$05AD` has `$0020`. Record 23 |
| 3 | `$8C:86A6` | required by the target filter when the mask has `$4000`. Record 28 |
| 4 | `$8F:B9FB` | projectiles cannot hit it (`$8F:B9F8`, only the projectile procs 2, 4, 6 call it). Record 135 |

```c
// $8F:BA37: hit rate for the roll
hit = (target == other_party_member(controlled) && arec->flags07 & 2) ? arec->hit - 29 : arec->hit + 1;
```

Bits 5–7 are never set. Tab: an 8-bit drop-down. ✔ (bits 2–3 relabelled "target filter").

### +$09 palette, +$0B second palette

```c
// $90:CCF6, at spawn
if (rec->palette2) {                       // a two-palette character (records 46, 82, 106)
    if (slot[1] != rec->palette2) load(slot 1, rec->palette2);
    if (slot[0] != rec->palette)  load(slot 0, rec->palette);
    e->palette_offset = 0;
} else if (!rec->palette) {
    e->palette_offset = 8;                 // fixed: slot 4
} else {
    e->palette_offset = alloc_palette(rec->palette);   // $90:CD80
}
```

The allocator reuses a slot already holding the same address (slots 4, 5, 0, 1, 2), then a free
one (4, 5, 0, 1), then steals one. Slots 6 and 7 are the Boy's and the Dog's. (Previously
believed in `rom/90cd80.md`: 0 and 1 pinned for them.) Tab: index and colours. ✔

### +$0D collision radius

- body overlap `$8F:B4AB`: |dx| < r₁+r₂ and 2·|dy| < r₁+r₂ (so a box 2r wide, r tall); 0 = no body;
- strike boxes `$8F:B63A`: (|dy| − r)·2 < box height and (|dx| − r)·2 < box width, around the feet;
- the attack reach of an enemy aiming at this one uses r/2 + 5 (`$8F:DA10`).

Tab: `r px (2r×r)`. ✔

### +$0F maximum HP

```c
e->hp = rec->max_hp;                          // $8F:B15B, spawn
heal(e, n): e->hp = min(e->hp + n, rec->max_hp);       // $8F:C09A (signed compare)
hud: draw(e->hp, "/", rec->max_hp);           // $8F:9144
full_heal(e): heal(e, rec->max_hp);           // $91:A76B
regenerate: if (e->hp != rec->max_hp) e->hp++;          // $91:B17B, status $40
poison tick: deal(rec->max_hp / 16 + rand(-2..1));       // $91:B46E, status $90 (30 s)
```

The field is the **maximum**, the entity's `+$2A` the current HP. Tab: relabelled "Max HP".

### +$11 (unused)

Copied into entity `+$2C` at spawn (`$8F:B162`). Across all 57 entity slots the CDL WRAM flags
show no CPU read of `+$2C` (one byte read by DMA, a block copy). Nothing in the vanilla code
reads it. 78 records hold 1–100. Tab: "+0x11 (unused)".

### +$13 aggro range

```c
// $8F:D69B, while idle and fully charged
if (e->stamina >= 0x400 && (rand() & 0xFF) < rec->aggro_chance)
    for (p in {boy, dog}) if (p->hp && abs(p->x - e->x) < rec->aggro_range && abs(p->y - e->y) < rec->aggro_range)
        { face(e, p); engage(e, p); }                           // $8F:DC1D

// $8F:D9D1, once engaged: attack when lined up
s = trec->radius / 2 + 5;
in_reach = abs(dz) < 0x140 && abs(dx) < rec->aggro_range &&
           (abs(dx) < s ? abs(dy) < rec->aggro_range : abs(dy) < s);
```

Engaging uses a square. The attack waits until the target is in a plus-shaped region along an axis.
For the Boy, the weapon loader writes the weapon's reach (`C4` entry `+$06`) here (`$8F:81E0`).
Tab: px. ✔

### +$15 aggro chance

See above: one roll per idle tick, at full charge only. 256 (used) = every tick. Tab: /256. ✔
**Only the stationary behaviours roll it** (`$08`, `$0E`, `$1C`). A chaser's target pick (`$8F:D879`)
has no range and no chance, so for roaming enemies `+$15` does nothing and `+$13` is only the
attack reach ([ai-behaviours.md](ai-behaviours.md)).

### +$17 leash radius

```c
e->leash = (spawn_leash_override >= 0) ? spawn_leash_override : rec->leash;   // $8F:B169, $8F:DEAB; $23DD
// $8F:DAA7, from behaviours 0, $0A, $12
limit = e->state == 6 ? e->leash / 2 : e->leash;
if (e->leash && abs(e->x - e->home_x) + abs(e->y - e->home_y) >= limit) { e->state = 6; go_home(e); }
```

A Manhattan distance from the spawn point. 0 = no leash. Vanilla values 0–1000. A room script can
override it for its spawns (`$23DD`, reset to `$FFFF` per room). (Previously believed: an
animation / sprite pointer.) Tab: "Leash" in px.

### +$19 attack, +$1B defence

```c
// $8F:C02B: attack power of x
p = (x == boy && weapon == BAZOOKA) ? bazooka_power : xrec->attack;
s = x->stamina;
p = s < 0x200 ? p / 4 : s < 0x400 ? p / 2 : s < 0x800 ? p : s < 0xC00 ? p * 2 : p * 4;

// $8F:C067: melee damage
base = max(1, p - trec->defence / 4);
dmg  = (3 * base + 2 * rand_below(base + 1)) / 4;     // 3/4 … 5/4 of base
apply: if (target shielded, e+$12 & $2000) dmg /= 2; dmg = min(dmg, 999);   // $8F:C0D3
```

Tab: numbers. ✔ ([combat.md](combat.md) §5 had 3w/2 for the top; it is 5w/4.)

### +$1D magic defence

```c
// $91:9CA6: alchemy damage on each target
if (target is boy or dog) dmg = power - trec->mdef;
else                      dmg = power * (int8_t)(0x40 - (uint8_t)trec->mdef) / 64;   // PPU multiply
dmg = clamp(dmg, 1, 999);
```

For an enemy only the low byte counts, as a signed byte. A magic defence of 64 or more makes the
factor 0 or negative, so every spell does 1 (vanilla values reach 64). Records 103, 104 and 135 have `$FFC1` (−63): factor
127/64, about double damage. Tab: number. ✔

### +$1F evade, +$21 hit rate

```c
// $8F:BA06
target->struck_by = attacker; target->struck_timer = 20;
row  = hit_table[(trec->evade + 1) >> 2];                              // $8F:BAAF, 16 rows
hit  = attacker_hit (see +$07) − (enemy && party buff $2262 & $20 ? 10 : 0);
col  = clamp(hit, 0, 100) >> 2;
return row[col] && (rand() & 0x7FFF) < row[col];
```

The game's own stats card (`$8C:8A25`) shows both as percentages, with HP, attack and defence.
Three records have hit above 100 (clamped). Tab: numbers. ✔

### +$23 experience (32-bit)

```c
// $8F:827A, on the enemy's death
if (!(party_flags & 2) && boy.level < 99) boy.exp += rec->exp, level_up_check();
if (dog.hp && !(party_flags & 1) && dog.level < 99) dog.exp += rec->exp, level_up_check();
```

Both get the full amount. The high word is 0 or 1 in vanilla. Tab: number. ✔

### +$27 money

```c
// $8F:8689
money[era] += rec->money;          // $0AC6 + $2348, 32-bit
if (rec->money >= 500) message(received, rec->money, currency_name[era]);   // $8F:8704
```

Paid in the **current era's currency**, so "Talons" was wrong in three of four eras. Tab:
relabelled "Money".

### +$29 prize chance (byte)

```c
// $90:8567
if ((rand() & 0x7F) < rec->prize) { e->drop = ...; play(rec->anim_spoils); }   // +$44
else play(rec->anim_death);                                                     // +$42
```

Vanilla: 0, 4, 8, 12 or 128 (always). Tab: /128. ✔

### +$2A level

The Boy's (`$0A50`) and the Dog's (`$0A9A`) level: read by the EXP code (cap 99) and the stat
rebuild (`$8F:839E`), saved by `$8D:B26B`. Enemy records hold 1–50, but nothing reads them. Not
on the tab.

### +$2C charge limit

```c
// $8F:CD88 (Boy) / $8F:CECC (Dog), while the attack button is held
if (s->stamina >= 0x400) s->stamina = min(s->stamina + rec->charge_speed - 3, rec->charge_limit);
// $91:AED1, the Speed status, each tick for $E10 ticks
e->stamina = min(e->stamina + 0x3C, rec->charge_limit);
```

The Boy's is his weapon's level × `$400` (`$8F:8262`). The Dog's is its attack level × `$400`
(`$8F:97C0`). The AI partner charges toward its own setting instead (`$8F:DDB3`:
`$40`, `$400`, `$800`, `$C00`, capped by the weapon level). Enemy records hold `$400`, `$800`
or `$C00`, which only the Speed status uses. Tab: % of `$400`. ✔

### +$2E charge speed

```c
// $8F:CC44, every tick, alive and e+$16 has neither $10 nor $08
if (e->stamina < 0x400) e->stamina = min(e->stamina + rec->charge_speed, 0x400);
```

Past `$400` the held charge uses speed − 3 (above). A 16-bit word: the compiler's
`CHARGE_RATE = 0x2f` names its high byte (a value of `$400` occurs). Tab: number. ✔

### +$30 attack proc

```c
// $8F:B564: body contact between a and b
if (!(a->flags10 & 2)) { attack_proc_table[arec->proc](a, b); a->stamina = 0; }
// and b on a when b is charged, attacking (e+$16 & $C000) and a can be hit
// $8F:B5E6: a strike
attack_proc = arec->proc;          // $0E9A, then each target in the box
```

The handlers are decoded in `rom/8fb6ae.md`: plain, skill on a kill (Boy, Dog), swallow, no
knockback, poison 1/4 or always, plague 1/8, plague or confound 1/4, and projectile kinds that
records never use. A body contact empties the toucher's charge. Tab: drop-down by `ATTACK_PROC`. ✔

### +$32–+$48 animations

Unchanged, see `rom/8eb678.md` and [animation_script.md](animation_script.md). Read live through
`+$60`, plus `$8F:C2C4` (knockback `+$40`), `$8F:C1D6` (`+$48`, played by the hit reaction when its
request bit is set) and the AI (`$8F:D322`, `$8F:DBDF` walk; `$8F:D4BB` attack 3).

## Data (all 142 ROM records)

| field | range | note |
|---|---|---|
| behaviour | 0–`$1C`, 15 values | every table entry is used |
| spawn flags | `$0`, `$2`, `$10`, `$22`, `$400` | |
| flags | `$0`–`$1F` | bits 5–7 unused |
| radius | 0–40 | |
| max HP | 1–30000 | |
| aggro range / chance | 0–250 / 0–256 | |
| leash | 0–1000 | |
| magic defence | 0–64 and `$FFC1` ×3 | see +$1D |
| evade / hit | 0–50 / 0–2000 | hit > 100 in 3 records |
| prize | 0, 4, 8, 12, 128 | |
| level (+$2A) | 1–50 | unread |
| charge limit | `$400`, `$800`, `$C00` | |
| charge speed | 4–1024 | |
| attack proc | 0, 8, `$A`, `$C`, `$E`, `$12`–`$18`, `$1C` | |

## Still open

- what the `$58AF` side records (flags bit 0) hold;
- who sets the target mask `$05AD`, so which requests use flags bits 2 and 3;
- what `$2261` bits 0–1 (no experience) and `$2262` bit 5 (−10 enemy hit) are named in game terms;
- a run in the emulator for the leash, the magic-defence edge cases and the Speed status.
