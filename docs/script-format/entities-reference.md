# Entities reference: characters, sprites, bodies, attacks, animation

One page for everything that moves on a map: who it is (the character record),
how a room places it, how it is drawn (sprite, palette, depth), how big it is,
how it hits and is hit, and how it animates. Each section gives the limits, the
ROM addresses, the code here, and the page with the evidence. The pages linked
are the authority; this is the index across them.

Enemies, NPCs, the Boy and the Dog are all the same thing to the engine: an
**entity** in WRAM made from a **character record** in ROM.

---

## 1. The character record

Table `$8EB678`, **74 bytes** per character (`CHARACTER_TABLE`/`CHARACTER_STRIDE`,
`src/maps/character-record.ts`). 141 named characters. Layout from
SoETilesViewer's `characterdata.h`, verified field by field
([character_table.md](character_table.md)).

| Offset | Field | Used for |
|---|---|---|
| `+0x00` | name pointer (24-bit) | labels |
| `+0x03` | AI script index (`JMP ($CBE0,X)`) | behaviour, not modelled |
| `+0x05` | default entity flags | `0x0002` = INVINCIBLE (every townsperson), `0x0020` INACTIVE, `0x0400` PHASING. A spawn's own flags override |
| `+0x09` | palette: an address in bank `$90` | §4 |
| `+0x0D` | **radius** in pixels (`unknown0d` upstream) | body and hurt box (§5, §6). 0 = no body |
| `+0x0F` | HP | |
| `+0x13`, `+0x15` | aggro range, aggro chance | |
| `+0x19`, `+0x1B`, `+0x1D` | attack, defence, magic defence | §7 |
| `+0x1F`, `+0x21` | evade, hit rate | §7 |
| `+0x30` | attack proc | what a landed hit does (`$8FB6A5`) |
| `+0x32`.. | animations: stand, walk `+0x34`, run `+0x36`, attack 0–3 `+0x38..+0x3E`, damage `+0x40`, death `+0x42`, then spoils, block | §8 (`ANIMATION_FIELDS`) |

EXP, money, prize chance and charge limit/speed are in the struct too; nothing
here reads them yet.

---

## 2. Placement: how a room gets its enemies and NPCs

Not in the room blob. The room's **enter script** (`$928000 + 0x1B + 5·room`)
places them with four opcodes, whose layout comes from the everscript encoder
([enemy_spawns.md](enemy_spawns.md), `src/script/entities.ts`):

| Opcode | Operands | Position |
|---|---|---|
| `0x3C` | `enemy·2, flags, x, y` | literal, map units |
| `0xBA` | `enemy, x, y` | literal, no flags |
| `0xA2` | `enemy·2, flags, x·8, y·8` | expressions, so no literal position |
| `0xC2` | `enemy, x, y` | a spawner; the count is in `$2433` |

- `enemy` is an `ENEMY` enum value whose comment names the character record.
- **Coordinates are 8px map units**, and an entity stands at exactly `8·x`
  pixels: on the unit, not in the middle of its cell (traced in room `0x38`).
- The enter script branches on story state, and every branch is walked, so the
  1606 vanilla spawns are **candidates**, not what a visit shows. Deciding the
  branch needs the simulation that does not exist yet (`simulation/`).
- Facing starts at **8 = south** for every spawn.

---

## 3. Sprites

`src/maps/sprites.ts`, ported from SoETilesViewer, the only implementation
anywhere ([sprite_format.md](sprite_format.md)).

| Layer | Where |
|---|---|
| 16×16 block pointers | `$EC0000 + 3i`, data in `$D90000` |
| 8×8 block pointers | `$D80000 + 3i`, data in `$D10000` |
| sprite infos (chunk lists) | from `$CA0003`, walked end to end |

- A block is 4bpp planar pixels; pointer bit 23 = compressed (one status byte per
  8 words, a set bit = a zero word not stored).
- A **chunk** places a block: 5 bytes `[flags][x:s8][y:s8][block:16]`. Flags are
  an OAM attribute byte: bit 0 large (16×16) block, bits 1–3 palette, bits 4–5 a
  composition order (the hardware priority comes from the tile, §4), bit 6 flip X,
  bit 7 flip Y. Symmetric sprites store one half and mirror it.
- Sprites anchor at their feet: the entity's position is the point the body
  box, hurt box and depth test all use.
- The parser stops at 64 chunks per sprite (`MAX_CHUNKS`).

---

## 4. Drawing: palettes and depth

**Palettes** ([palettes.md](palettes.md)). Sprites use the upper half of CGRAM, so
they never disturb the map's colours. Eight 16-colour sprite palettes; the Boy
and the Dog hold two. The allocator `$90CD80` reuses a slot holding the same
palette, else takes one of **4 free slots**, else **steals slot offset 4**
(`$90CE92`), which alchemy effects also use: the glitch. So the budget is
**4 distinct palettes per room**, however many characters share them. 90 distinct
palettes cover 134 characters; 27 are shared (e.g. 8 villagers on `$90B06B`).
7 vanilla rooms list more than 4 across all branches (up to 6, room `0x09`).
The Rooms tab shows the budget per room.

**Depth** ([sprite_priority.md](sprite_priority.md), `spriteDepth()` in
`src/maps/collision.ts`). Each frame `$8FC780` reads the collision word under the
entity's feet (entity `+0x3C`, filled at `$8FAFE5`):

| Test, in order | OAM priority |
|---|---|
| gate nibble = 8 | not drawn at all |
| entity's plane below the tile's | 3 (in front of everything) |
| entity's plane above the tile's | 2 (behind the canopy) |
| same plane, bit 12 set | 3 |
| same plane, bit 12 clear | 2 |

An entity keeps its plane while standing on a bit-13 or bit-6 tile (`$8FA914`),
so its depth there depends on where it came from. Room effect 2 (header byte 8)
also sorts sprites by camera distance (`$8FC7E8`).

---

## 5. Bodies: what entities bump into

[hitboxes.md](hitboxes.md), checked against 925 traced moves, all agreeing.
`$8FB46D` → `$8FB4AB`. Two entities collide when

```
|dx| < r1 + r2    and    2·|dy| < r1 + r2          (r = record +0x0D)
```

so one body is `2r` wide and `r` tall (the game's 2:1 perspective). Also
required: heights (`+0x1E`) within `$230`, and the same elevation plane unless
either is plane-transparent (bit 6). Radius 0 = no body (Statue, Bridge, the
Stone Cobras, Rimsala…). The Boy is 8; radii run to 40 (Aegis). A move that
starts already overlapping is allowed, so a spawn on top of you cannot trap you.
Walls come first: the collision word (`room-reference.md` §9) is checked before
entities.

---

## 6. Attacks: strike box and hurt box

[attack_boxes.md](attack_boxes.md), `src/maps/character-animation.ts`.

| | Body | Hurt box | Strike box |
|---|---|---|---|
| From | `+0x0D` | `+0x0D` | animation command `0x47 dx dy w h` |
| Size | `2r × r` | `2r × 2r` | per animation frame, per facing |
| Centre | position | position + `$0042`/`$0044` (command `0x50`; reset by `0x52`) | attacker + `(dx, dy)` |

A strike lands when `2(|dx| − r) < w` and `2(|dy| − r) < h` (`$8FB63D..$8FB672`),
after filters: not the attacker's side, HP left, not invulnerable, not already hit
by this attacker, not dying (`$8FB61E..$8FB638`); then heights within `$460` and
the plane rule. The Boy's east sword swing is 23×17 centred 30 px east.

**Contact damage** needs no strike box: a charging entity that is blocked by
another's body deals damage through `$8FB52C`. 45 of 141 characters declare a
strike box; 54 have no attack animation; 42 attack without `0x47` (shooters use
`0x4C`, a projectile).

---

## 7. Damage

| Step | Where | Status |
|---|---|---|
| to-hit: target evade (`+0x1F`) vs attacker hit rate (`+0x21`) | `$8FB75A` | read from the code |
| damage from attack (`+0x19`) and defence (`+0x1B`), added to pending `$0076` | `$8FC067` | formula modelled in `tests/memory/damage.test.js` (helpers, not a module yet) |
| pending damage subtracted from HP on the target's next turn | `$8FC237` | read from the code |
| charged attacks, the Atlas 999 glitch | | modelled, same test |
| alchemy: `base_might`, level scale, RNG, `(0x40 − magic_def)/0x40` | | `src/maps/alchemy-model.js`, [../alchemy-damage.md](../alchemy-damage.md) |

What is missing (one `damage(attacker, defender, method)` entry point, the
party's attack value) is in `simulation/damage.md`. A box hitting and damage being
dealt are separate questions: the traced sword hit on a Wimpy Flower did 0.

---

## 8. Animation

[animation_format.md](animation_format.md), `src/maps/characters.ts`,
`character-animation.ts`.

- **Chain:** record animation field (e.g. `+0x32` stand) → 24-bit script pointer
  at `$C40000 + field` → a command stream.
- **Facing:** the animation record's flags pick a pose per facing. Bit 7: eight
  poses, `+2·facing` (7 characters). Bit 6: four poses through the table at
  `$90815B` (85). Neither: one pose (49). Entity `+0x22` is the facing.
- **Commands** (dispatch `(cmd & 0x7F)·2`; **bit 7 set = end of frame**):
  `0x01–0x1E` hold for that many ticks, `0x20 n` hold n ticks, `0x22–0x2B` set
  sprite (bank `cmd + 0xA8`, 3 bytes), `0x2D` restart (loop), `0x47` strike box,
  `0x4C` projectile, `0x50` move hurt box, `0x52` reset. The frame timer is entity
  `+0x05`. Lengths for every command but `0x57` are known.
- Coverage: 139 of 141 idle walks end on their own loop; 126 resolve to a
  sprite; `0x57` (Bone Snake, Salabog) is unknown.

---

## 9. Entity fields in WRAM

The entity struct, as far as the traces and handlers read it:

| Offset | Meaning | Source |
|---|---|---|
| `+0x05` | animation frame timer | animation_format.md |
| `+0x10` | flags (side, INVINCIBLE, INACTIVE…) | attack_boxes.md |
| `+0x14`, `+0x16` | state (dying/closed `& 0x070D`; invulnerable `& 0x0020`; charging `& 0xC000`) | attack_boxes.md |
| `+0x18` | elevation plane (`& 0x0030`), bit 6 transparent | hitboxes.md |
| `+0x1A`, `+0x1C` | X, Y in pixels | hitboxes.md |
| `+0x1E`, `+0x20` | probably height and its velocity (unconfirmed) | hitboxes.md |
| `+0x22` | facing (8 = south) | animation_format.md |
| `+0x2A` | HP | attack_boxes.md |
| `+0x36` | who hit it last | attack_boxes.md |
| `+0x3A`, `+0x3C` | the tile under it, and that tile's collision word | sprite_priority.md |
| `+0x42`, `+0x44` | hurt box offset | attack_boxes.md |
| `+0x76` | pending damage | attack_boxes.md |

---

## 10. Where to look in the code

| Question | Code | Tests |
|---|---|---|
| a character's record, radius, palette, flags | `src/maps/character-record.ts` | `tests/memory/map-parity.test.js` (`checkHitboxes`) |
| sprite pixels | `src/maps/sprites.ts` | same file |
| idle and attack animation walks, strike boxes | `src/maps/characters.ts`, `character-animation.ts` | `checkStrikeBoxes` |
| depth against the canopy | `src/maps/collision.ts` (`spriteDepth`, `spawnDepth`) | |
| spawns, transitions, arrivals, loot | `src/script/entities.ts`, `transition.ts`, `arrivals.ts`, `loot.ts` | `tests/memory/script-parity.test.js`, `script-units.test.js`, `script-loot.test.js` |
| damage | `src/maps/alchemy-model.js`; physical in `tests/memory/damage.test.js` | `damage.test.js` |
| drawing enemies over a map | `docs/map-format/enemy-sprites-on-maps.md` | |
