# Open Evermore: how easy is it to add content? (2026-11-25)

Back to [README.md](README.md). This page checks five requests against the tree that `explode` writes today
(v0.470.0) and against the engine code behind each request. The requests are a new Dog form, the missing Act 0 Dog
animations, a fixed Laser, a new formula, and new items. For each one it says what is data, what is missing as a
kind, and what needs engine code. Addresses are US. Facts found while writing this page went into the knowledge
entries named in §7.

Scale: 🟩 works today by editing files · 🟨 one missing kind or hook, the same pattern as one that is built ·
🟥 needs engine code or a new kind of mechanism.

| Request | Verdict | What stands in the way |
|---|---|---|
| A new Dog form | 🟨 (a recolour) / 🟨 (new art) | `dog_forms` built (v0.472.0) but fixed at 6; no free byte in bank `$8F` for a 7th entry; three other per-form tables |
| Act 0 Dog's missing animations | 🟨 engineering, 🟥 art | the same `dog_forms` kind; about 85 poses still have to be drawn; new sprites are not yet proven in game (G2) |
| Fix Laser | 🟩 (borrowed effect) / 🟨 (own look) / 🟥 ("halves HP") | the `$91` effect programs are not a kind; no op halves HP |
| A new formula | 🟨 | formulas fixed at 35; ring items; formula WRAM packed 35 wide |
| New consumables, key items | 🟩 (built v0.461.0) with limits | counts in `temp[]` (lost on room load), 11 spare ring items, no shops |

## 1. A new Dog form

**What a form is.** It is one 40-byte entry in bank `$8F` (`routines/dog_load_form.md`, `wram/DOG_FORM_ANIM_9.md`):

| Offset | What | In the tree today |
|---|---|---|
| `+0` | the Dog's picture on its behaviour menu page (24-bit sprite; 0 for Act 0) | a metasprite, but the entry is in `_base/` |
| `+3` | the HUD portrait (24-bit sprite, `$CC:3C72`…) | preview only (`graphics/hud/portraits/`) |
| `+6` | palette (bank `$90`) | `palettes/sprites/dog_act0` … `dog_act4` (named, the entry in `_base/`) |
| `+8` | a word for Dog record `+$13` (`$20`, Act 4 `$FA`) | role not read |
| `+$0A`-`+$26` | 15 animation slots: stand, walk, run, 3, knockback, attack 0-3, then 9-14 for the Dog's AI | `animations/dog/*` exist; the slots that pick them are in `_base/` |

The form number is `2·(n+1)`. A room's script writes it to `$2443`. The `wram` kind calls that word
`ROOM_METATILE_DESCRIPTOR_PTR`, an old wrong name; its entry's title says what it is. The loader `$8F:946B`/`$9471`
copies it to `DOG_FORM_INDEX` (`$2363`), which is saved. The pointer table `$8F:945D` (word 0 means no form) is read
with a long operand, so it can move. The entries are read with 16-bit offsets in bank `$8F` (`lda $8F0000,x`, 20
reads), so they cannot leave `$8F`. Forms differ only in their looks. Behaviour, stats and AI belong to the one
`characters/records/dog.json`. The one exception is the Toaster's +80/+250 bonus, which is code (`$8F:866B`
`cpx #$000C`).

**What is missing:**

1. **A `dog_forms` kind** *(built, v0.472.0: [resources.md](resources.md) §dog_forms; scripts by name still open)*: `characters/dog_forms/<name>.json` with `palette`,
   `portrait`, `menu_sprite`, the 15 slots by animation name and `unknown_08`. It is in place for the six vanilla
   forms, and scripts would write the form by name (`write_word DOG_FORM_REQUEST, characters/dog_forms/act0`), the
   way `PRIZE` takes items by name.
2. **Room for a 7th entry.** Bank `$8F` is code and has no proven free byte. Moving the 14-byte pointer table out
   frees too little. The pattern the repo already uses is a hook (`ingredient-hooks.mts`): a `jsl` at `$8F:9477`
   to a generated loader that reads a generated table of 24-bit entry pointers, so entries can go anywhere. This
   has to be generated only when the kind has grown, and give vanilla's bytes otherwise.
3. **Three more per-form tables**, all sized for vanilla's forms. A 7th form reads whatever bytes follow each one:
   `$80:BF0E` (the Windwalker flight's Dog palette: five words, and the Toaster already reads past its end),
   `$80:C707` (the flight's Dog animation), and `$8E:B512` (the equipment ring's entry of `$C4:5A75` for the Dog).
   Each needs a generated copy and its one reader redirected.

**Effort.** A recolour (a new palette plus vanilla's slots) costs the kind, the hook and three small tables, about
one session like v0.461.0. A form with new art costs the same plus everything in §2.

## 2. The Act 0 (Podunk) Dog's missing animations

12 of the Act 0 form's 15 slots are the Act 1 wolf's records ([../todo/act0-dog-animations.md](../todo/act0-dog-animations.md)).
In the tree, `animations/dog/act0_*` holds only `idle`, `walk`, `run`, `bark`, `eating`, and `used_by` shows the
wolf's `dog/sit`, `dog/sleep`, `dog/slot_9`, … as used by `dog_form:act0`. What Open Evermore already gives:

| Layer | Kind | Adding one | Proven |
|---|---|---|---|
| pixels | `sprites/blocks_16/`, `blocks_8/` (PNG per block, limit 21,845) | a new PNG and a line in `_enum.json` | round trip; 🟥 in game (progress §2, G2) |
| sprites | `sprites/metasprites/<owner>/` (chunks by block name) | a new JSON, placed anywhere in `$CA`-`$D3` | G0; 🟥 a new one in game |
| animation + script | `animations/<owner>/<name>.json` (scripts inline) | copy `dog/attack_0.json`, swap the `sprite` lines | seed 5 grown (`vacate_c4`: 26 four-facing groups in `$C4`, enough for the ~9 needed); 🟥 in game |
| palette | `palettes/sprites/dog_act0` | none needed: the new poses use these 16 colours | — |
| form slot | none (`_base/`) | — | — |

**Settled since the old plan:** sprite blocks reach VRAM on demand, through an LRU cache of 16×16 slots
(`obj_16x16_tile_allocate` `$80:96FE`). New poses need no tile set loaded with the form, which was the plan's
"one engine question". `anim_4522` (no user in the tree) is the Podunk Dog's flight sprite from `$80:C707`, not a
lost pose. It should get a name, as `anim_4402` should (the greyhound and poodle flight sprite).

**What the slots do**, from the code that reads them (it replaces the plan's "?" columns):

| Slot | WRAM | Read by | Act 1 record (what Act 0 borrows) |
|---|---|---|---|
| 0-2, 4-8 | Dog record `+$32`… | the shared character code | own: 0-2; borrowed: knockback, attack 0-3 |
| 3 | `+$48` | not traced | `$42AE` |
| 9, 10 | `$1443`, `$1445` | sniffing: `$90:8260` plays 10 when the Dog's `+$64` byte is set, else 9; 10 is also the idle cycle's look-around (state `$0D`) | `$425E`, `$427E` |
| 11 | `$1447` | standing while the player steers the Dog with no direction held, and two companion routines | `$42EE` (one facing) |
| 12 | `$1449` | idle cycle, state `$0B` (after 60-315 frames) | `$4302` |
| 13 | `$144B` | idle cycle, state `$0C` | `$4312` |
| 14 | `$144D` | no code reader (the bytes occur once: the loader's store) | `$433A`; Act 0's own bark `$4526` is not in it |

**What is left, in order:**

1. ~~The `dog_forms` kind (§1)~~ built (v0.472.0): Act 0's slot 14 → `dog/act0_bark` is a one-word edit by name (tried: it lands).
2. A first G2 proof for art: one new block, one metasprite, one animation, played in game. Nothing new of these
   three has been seen in game yet. A grown layout must also keep room in `$CA`-`$D3` for new metasprites: the
   allocator places tight rules first, but this has not been tried.
3. Art. There is no hidden Act 0 art: about 85 poses in 16 colours, roughly 110 + 110 blocks (the plan's count).
   Drawing them is the real cost. The attack scripts' strike boxes may need shrinking for the smaller dog.
4. Naming debt seen on the way: ~~one form has three names~~ (v0.472.0: `act0` everywhere, `dog_act0` portrait and palette), and `characters/records/dog.json` has `"name": "$7E2234"`, a raw WRAM address.

## 3. Fixing Laser

Vanilla Laser (`alchemy/formulas/laser.json`) shares Acid Rain's block. It has power 0, costs Crystal + Brimstone,
targets `enemies_nearest_three`, is learned by `ALCHEMY_KNOWN_FLAGS+2` bit `$0010`, casts through
`alchemy_cast_action_direct_targeting`, and shows ring item `alchemy_laser`. Its text promises "Halves target's HP".

| Level | What | How | State |
|---|---|---|---|
| A | Laser deals damage with another spell's effect | `"block": "lance", "power": 60`, a cost, a script that sets the learned bit (or an alchemist's script) | 🟩 writes and round-trips (v0.456.0); **not cast in game yet**, which is the first thing to try |
| B | Laser with a look of its own | a new animation (kind ready) and an effect program that spawns it | 🟨 needs an `alchemy/blocks` kind |
| C | Laser halves the target's HP | a new op in the effect VM | 🟥 engine code |

**Finding: the `$91` blocks are programs, not records.** The knowledge called them "data, not code", which is
true only in that they are not 65816. Each block is word-threaded bytecode for an **alchemy effect VM**. An effect
slot holds its program counter at `+$14`. Every frame `$91:98F7` calls `$91:9750` (`lda $910000,x : tax :
jsr ($8000,x)`) for as long as the handler returns carry set. The handler table at `$91:8000` has **83 ops**.
Operands follow inline. In Acid Rain's `0034 0052 0002 583E …`, op `$52` acquires the targets and op `$02` spawns
animation record `$583E`. Op `$48` (`$91:9E66`) applies damage from the slot's power, `$36` plays a sound and `$4A`
branches. That is why `block` already works as a reference by name: formulas, consumables (Wings play `escape`)
and Call Bead spells all run these programs.

**What level B needs:** an `alchemy/blocks` kind that explodes the 53 programs as lines (`spawn
animations/alchemy/acid_rain_drop`, `damage`, …). Each op's operand count comes from reading its handler; the
ones above are known, the rest are not. A program's animation operands become names. That is the same step the
event scripts and the animation scripts took. The constraints are that programs are read in bank `$91` (16-bit
block table, `lda $910000,x`), which is a code bank with no proven free byte. So a longer or a new program needs
room taken from `$91`, or the dispatcher patched to read a long pointer (one site, `$91:9750`).

**What level C needs:** a new handler (65816) and a slot in the op table. The block table follows the op table at
`$91:80A6`, so the op table has to move. Its one reader is `jsr ($8000,x)` in `$91:9750`, and a moved table must
stay in bank `$91` for `jsr (abs,x)`. Without code as a kind (S9), this is a generated patch like the item hooks.
Damage that depends on the target's HP has no op today.

The name and description are texts (`strings/menu/laser`). Each can be as long as vanilla's; a longer one needs
free `$C4`, and there is none ([resources.md](resources.md) §texts).

## 4. A new formula (a 36th)

What is already there: `menus/alchemy_actions/` has **36** entries, and the 36th (`unused_46`, direct targeting)
has no formula. A 36th formula therefore has a cast action without any code change. Blocks can be any of the 53.

| What | Holds it at 35 | Path |
|---|---|---|
| nine `$C4` tables (target, learned word and mask, block, power, cost, name, description, ring item) | packed, code and texts after them | every reader is a long operand: generated tables, as ingredients do (I2) |
| ring item | formula ring items are a fixed range | one of the 11 `debug_*` ring items until ring items grow (growable-items S4) |
| learned bit | `$2258`-`$225C` | saved spare bits in `$225C` (bit 7 is a Call Bead caller's: [../todo/growable-items.md](../todo/growable-items.md)) |
| experience, level, casts | `$2F52`, `$2F98`, `$2FDE`: 35 words each, back to back | `temp[]` (owner's rule), **so the level resets on every room load**; saved cells wait for W2 ([wram.md](wram.md)) |
| alchemy screen list | its loops and layout | as I4 did for ingredients: bounds generated; where a 36th row goes is not checked |
| teaching | scripts | set the learned bit by name |

**Effort.** This is the ingredient path (I1-I5 in [../todo/growable-items.md](../todo/growable-items.md)) applied
to `codecs/alchemy.mts`: about one session. A formula that keeps its level needs W2 first.

## 5. New items

Built in v0.461.0 ([resources.md](resources.md) §items). The rest of the work is tracked in
[../todo/growable-items.md](../todo/growable-items.md).

- **Consumables** (to 16): a new file plus a `debug_*` ring item gives target, block and power. "Restores 400 HP"
  is a heal block at the right power, and this has been seen in game (ring, use, heal). Limits: the count is a
  `temp[]` cell, **wiped on every room load and not saved** (T1, the biggest practical gap); 11 spare ring items are
  shared by every new consumable, ingredient and formula (S4); shops cannot sell one (S1-S3); loot branches are
  written by hand (L1). What a use does is limited to what an effect program does (§3).
- **Key items** (named items, to 40): a flag in a saved spare bit, given by scripts and listed in the Pouch. Works.
  More than 20 held at once is not handled (T2).
- **Charms that do something**: a charm's effect is code reading its bit (Moxa Stick `$91:9DC0`, Armor Polish in
  `$8F:8398`), so a new charm is a key item until code is a kind.
- **Weapons and armour**: weapons are fixed at 14. Armour is fixed at 40, because the slot of each id range is code
  (`$8E:9DAE`). Both are records in place ([resources.md](resources.md) §equipment).

## 6. What blocks the most, across all five

1. **WRAM that is saved** (W2, [../todo/wram-allocation.md](../todo/wram-allocation.md)): new counts and new formulas'
   levels live in `temp[]` today.
2. **Growable ring items** (S4): every new item or formula needs one, and 11 spare ones are shared.
3. **Kinds still in `_base/`**: `dog_forms` (§1) and `alchemy/blocks` (§3). Both are small tables with typed
   references waiting to be named.
4. **G2 in game for new art**: no new sprite block, metasprite or animation has been played yet.
5. **Fixed banks with no free byte** (`$8F`, `$91`, `$C4`, `$8E`, `$CA`-`$D3`). The repo's answer is a generated
   `jsl` hook that reads a generated long table. It is used for ingredients and consumables and would serve Dog
   forms and effect programs too.
6. **Code as a resource** (S9): needed for anything that *behaves* differently, such as a new op ("halves HP"), a
   charm's effect or a form's ability.

## 7. Knowledge corrected on the way

- `wram/DOG_FORM_ANIM_9`, `DOG_FORM_ANIM_10`, `dog_form_base_magic_def`, `dog_form_base_evade`,
  `dog_form_base_hit_rate`, `dog_form_scent_radius` (`$1443`-`$144D`) are the form's animation slots 9-14, not stats.
  The last four keep their old names until a `wram` rename to `DOG_FORM_ANIM_11`…`14`. That rename touches
  `reconstructed-c/include/soe_ram.h` and the WRAM map.
- `wram/DOG_SPRITE_ANIM_RECORD` (`$143E`) is the Dog's picture on its menu page. `routines/DOG_FORM_POINTERS` is the
  same table as `dog_form_entries`, not a stat record.
- `routines/ptrs_918000` is the effect VM's 83-op handler table. `ALCHEMY_BLOCK_TABLE` says the blocks are programs.
- `routines/data_8EB514` is the per-form equipment ring entry. `routines/dog_load_form` lists the per-form tables.
