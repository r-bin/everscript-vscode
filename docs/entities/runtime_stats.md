# Changing a character's stats at runtime

> Status: **mostly derived, partly inferred.** Each row says where its
> answer comes from. The field reads come from
> [character_table.md](character_table.md), and the writes come from
> everscript's `03_sprite.evs` and the `ATTRIBUTE*` enums in `03_sprites.evs`.

The Sprites tab's *Character Stats & Engine Meanings* card shows the
**character record**: 74 bytes in ROM at `$8EB678 + 74·n`. Script code cannot
write to ROM, so the question for each stat is whether the entity keeps its
own RAM copy of it.

- **Copied into the entity at spawn.** The entity's slot (`$7E3DE5…`, `$8E`
  bytes each) owns the value from then on, and a script can write to it
  directly: `<ENTITY>[OFFSET] = value`.
- **Read live through the entity's record pointer** at entity `+0x60`
  (`ATTRIBUTE.TYPE`): `LDX $0060,Y` then `LDA $8E00xx,X`. These stats can only
  change by pointing the entity at a different record, so they change together
  with everything else on that record.

## The table

| Card field | Record | Entity copy | Change it at runtime by | Source |
|---|---|---|---|---|
| HP | `+0x0F` | `+0x2A` `HP` | `<E>[HP] = n`; `damage(E, n, anim)` (`92`/`93`); `heal(E, n, anim)` (`94`/`95`) | copied at `$8FB15B`; used throughout everscript |
| max HP | `+0x0F` | — | The Boy and Dog only, through their RAM records ([below](#the-boy-and-the-dog)). For an enemy, the max is whatever HP it spawned with | `<0x23e5>[0x0f]` in the `MAX_HP` comment |
| attack | `+0x19` | — | `TYPE` swap. The Boy and Dog also have `BOOST_ATTACK` `+0xA0` | damage routine `$8FC042` |
| defense | `+0x1B` | — | `TYPE` swap. The Boy and Dog also have `BOOST_DEFEND` `+0xA2`. `FLAGS_4` bit `$20` (shield) halves damage | `$8FC072` |
| m. defense | `+0x1D` | — | `TYPE` swap. No boost field is known | `$919CB3` |
| evade | `+0x1F` | — | `TYPE` swap. The Boy and Dog also have `BOOST_EVADE` `+0xA4` | `$8FBA27` |
| hit rate | `+0x21` | — | `TYPE` swap. The Boy and Dog also have `BOOST_HIT` `+0xA6` | `$8FBA53` |
| aggro range | `+0x13` | — | `TYPE` swap | `$8FD72D`, `$8FDA25` |
| aggro chance | `+0x15` | — | `TYPE` swap | `$8FD6AD` |
| EXP | `+0x23` | — | `TYPE` swap before it dies (the value is read at death) | `$8F8292` |
| money | `+0x27` | — | `TYPE` swap before it dies | `$8F868E` |
| prize chance | `+0x29` | — | `TYPE` swap before it dies | `$908567` |
| collision radius | `+0x0D` | — | `TYPE` swap | `$8FB472`, `$8FB651` |
| spawn flags | `+0x05` | `+0x10` `FLAGS_1` (OR'd) | Per spawn: the `flags` argument of `add_enemy` (`3c`/`a2`). Afterwards: `attribute(E, BIT, on)` (`a9`), or a direct write to `FLAGS_1`…`FLAGS_7` (`+0x10`…`+0x16`) | `$8FB0C3` |
| palette | `+0x09` | `+0x0C` `PALETTE` (slot offset) | `<E>[PALETTE] = <DONOR>[PALETTE]`: point it at a slot that already holds the colours. See [Changing the palette](#changing-the-palette) | `$90CD1B`; kaizo `add_palette_donor` |
| palette 2 | `+0x0B` | — | Loaded into slot 2 at spawn. *Not known* whether a later swap reloads it | `$90CD01` |
| charge limit | `+0x2C` | — | `TYPE` swap | `$91AEDE` |
| charge speed | `+0x2E` | — | `TYPE` swap. To change the meter itself, write `<E>[STAMINA]` (`+0x2E`, 0…`$400`) | `$8FCC5D` |
| attack proc | `+0x30` | — | `TYPE` swap | `$8FB6A5` |
| behaviour | `+0x03` | `+0x00`/`+0x03` (`POINTER_BEHAVIOR_*`)? | *Unverified.* everscript names two behaviour pointers on the entity, so behaviour is probably copied at spawn and not affected by a `TYPE` swap. Use `attach_script` (`3d`/`3f`) for scripted control | `$8FCD1A` |
| flags (+0x07) | `+0x07` | — | `TYPE` swap. Bit 4 (immune to projectiles) is read when a hit lands | `$8FB9FB` |
| +0x11 | `+0x11` | `+0x2C` | `<E>[0x2C] = n`. The meaning is still open | `$8FB162` |
| +0x17 | `+0x17` | `+0x40` | `<E>[0x40] = n`, unless `$23DD` overrides it at spawn | `$8FB169` |
| level (+0x2A) | `+0x2A` | — | The Boy and Dog only, through their RAM records. everscript's `SCALING_LEVEL` `+0x8A` is a **romhack** field, not vanilla | everscript `ATTRIBUTE_GENERAL.LEVEL` |
| animations | `+0x32…+0x48` | — | `animate(E, mode, id)` for a one-off. A `TYPE` swap changes the whole set | [animation_script.md](animation_script.md) |

The entity also has state that is not on the record: position `X`/`Y`/`Z`
(`teleport`), `FACE_DIRECTION` (`face`), `VELOCITY`, four status slots
(`STATUS_ID/TIMER/BONUS_1…4`, `+0x46…+0x5C`) and `GENERAL_PURPOSE` `+0x30`,
which is free for scripts to use.

## Changing the palette

Entity `+0x0C` holds no colours. It holds a **slot offset** (0, 2 … 14) into
the eight sprite palettes ([palettes.md](palettes.md)). Writing it re-colours
the entity straight away, but only to colours that some slot already holds.
To get colours that aren't loaded yet, spawn a **donor**: an invisible,
inactive entity of the record you want. Spawning it makes the allocator load
its palette. Then copy the donor's slot:

```
add_enemy(BOY_BLACK, 0d0, 0d0, INVISBLE_INVINCIBLE_INACTIVE);   // donor
<E>[PALETTE] = <LAST_ENTITY>[PALETTE];
```

That is everscript kaizo's `add_palette_donor` (`10_general_helper/08.evs`),
also used in the temple and town-level-3 bosses and the Rimsala arena.

- **The write doesn't stick for long.** `add_palette_donor` writes the slot
  again every 5 frames for as long as the entity is `DISABLED`, and puts the
  old slot back at the end. So something in the engine resets `+0x0C`. The
  likeliest candidates are the damage flash and the grey-out during the ring
  menu or stop. *Inferred, not traced.*
- **A donor costs a slot** from the budget of 4. If it is the fifth distinct
  palette, it lands in the slot that alchemy steals.
- **Arbitrary colours** (not taken from any record) would mean writing CGRAM
  or the slot table `$7E1278`. Nothing here shows a script doing that.

### Three palette fields, and the home slot

An entity names its palette by **slot offset** (0, 2 … 14 into `$7E1278`, the
`PALETTE_SLOT_*` table) in three bytes:

| Field | everscript | What it is |
|---|---|---|
| `+0x0C` | `PALETTE` | The slot it is drawn with now. |
| `+0x74` | `PALETTE_COPY_1` | A copy of the current slot, written together with `+0x0C`. |
| `+0x75` | `PALETTE_COPY_2` | The **home slot**: what the game restores `+0x0C` to. |

everscript's `[Byte]` sizes are right: every writer below is in 8-bit mode. Its
comment ("copy palette slot offset") is right too, but it misses the one fact
that matters: `+0x75` is the value the game goes back to.

**Restoring** (`$90CDDC`): reads `+0x75` and writes it to `+0x0C` and `+0x74`.
When that slot is `$0C` (`PALETTE_SLOT_BOY`), it also reloads the slot from
`$0A2F`, the Boy's current colours (his weapon's palette). `$0E`
(`PALETTE_SLOT_DOG`) does the same for the Dog. This is why writing `PALETTE`
alone does not stick, and why kaizo's `add_palette_donor` rewrites it every 5
frames.

**Loading** (animation command `4B`, `palette $p`: `$90885A` → `$90CD5C`):
1. sets `+0x74` to `$0404`;
2. finds `$p` in a slot, or claims the first free one (`$90CD80`/`$90CDA9`).
   It looks at offsets `$08`, `$0A`, `$00`, `$02`, `$04` (`PALETTE_SLOT_5`, `_6`,
   `_1`, `_2`, `_3`), never `$0C` or `$0E`. When none is free it goes on to
   `$90CE92`, which is not traced;
3. writes the slot offset to `+0x0C`, `+0x74` **and `+0x75`**.

Step 3 moves the home slot. So `animate(BOY, …, ANIMATION_ENEMY.MAGMAR_ENTER)`,
whose script starts with `palette $b68b`, leaves the Boy in Magmar's colours for
good: every later restore puts Magmar's slot back. 75 animation records load a
palette this way (the placeholder effects, the Windwalker, the Pigoodle,
`MAGMAR_ENTER`); the Characters tab marks them "palette loaded by the script".

**Resetting.** Write the old slot offset (not a palette address like `$ad0b`)
back into all three fields:

```
<BOY>[PALETTE] = 0x0c;
<BOY>[PALETTE_COPY_1] = 0x0c;
<BOY>[PALETTE_COPY_2] = 0x0c;
```

For the Dog, use `0x0e`. For the Boy and the Dog this is safe: `4B` never loads
into their slots, and the next restore reloads their colours anyway. For any
other entity, its old slot may meanwhile hold another palette; then get the
colours loaded again with a donor (above) and point all three fields at the
donor's slot. Derived from the code above, not yet tried in game.

## Swapping `TYPE`

`<E>[TYPE] = CHARACTER_TYPE.X` swaps every live-read row above at once,
including stats, radius, rewards and animations. everscript already does this
in `add_colored_enemy` and in `practice_experimental.evs`, where a boss
changes form. It does not touch HP, the flags or anything else the entity
copied at spawn. So to give a Rat a Mosquito's defense, you would also give
it a Mosquito's EXP, radius and animations.

## The Boy and the Dog

`CHARACTER_TYPE.BOY = 0x0a26` ("extended struct"), and
`ATTRIBUTE_GENERAL.POINTER_BOY/DOG = 0x0a26/0x0a70`. Their record pointer is
below `$2000`. In the banks the engine reads records from, that range mirrors
low WRAM, so `LDA $8E0019,X` with X = `$0A26` reads **RAM**. This is why
every record field is writable for the two heroes:
`<0x0a26>[ATTRIBUTE_GENERAL.ATTACK] = n`. (This explanation is inferred from the
SNES memory map and agrees with everscript's names. It has not been traced.)

The same trick could probably give an enemy a writable record: copy 74 bytes
into free low WRAM and point its `TYPE` there. This is **untried**, and low
WRAM is mostly in use.

## A unified helper (proposal)

`attribute(character, ATTRIBUTE_BITS, on)` already exists for flag bits
(opcode `a9`). A value-level counterpart would dispatch on where the stat
lives:

```
fun stat(entity, field:STAT, value) {
    // entity-owned → direct write
    if(field == STAT.HP)      { entity[HP] = value; }
    else if(field == STAT.STAMINA) { entity[STAMINA] = value; }
    // hero record in low WRAM → write the record
    else if(entity == BOY)    { <0x0a26>[field] = value; }
    else if(entity == DOG)    { <0x0a70>[field] = value; }
    // enemy, record-only field → not writable; needs a TYPE swap
}
```

This only sketches the decision. `STAT` does not exist yet, and the enemy
branch has no answer short of the RAM-record experiment above.
