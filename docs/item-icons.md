# Item icons: ingredients, consumables, weapons, armour, alchemy

> Status: **located and decoded, not implemented.** Every icon the ring menu
> shows can be drawn straight from the ROM with code the extension already
> has. Checked pixel-exact: the Crystal decoded from the vanilla ROM matches a
> reference screenshot on all 576 pixels (24×24 at 2×, zero mismatches).
> Supersedes [ingredient-icons.md](ingredient-icons.md), which went looking in
> VRAM and the font and did not find them.

## What an icon is

An item icon is an ordinary **sprite**, not a tile or a font glyph. The ring
menu draws each slot as an entity running a short animation script, just like
an enemy, so an icon goes through the same pipeline as a character's idle
frame:

```
ring icon id ─► $CE8000 + id ─► entry (8 bytes, bank $CE)
                                  ├─ +2  animation record ─► $C40000 + record ─► script ─► sprite(s)
                                  └─ +4  palette          ─► $D0xxxx, 16 colours
```

Everything after "script" is already solved and ported:
[script-format/animation_format.md](script-format/animation_format.md) and
[script-format/sprite_format.md](script-format/sprite_format.md),
`src/maps/character-animation.ts` and `src/maps/sprites.ts`. The two new
pieces are the `$CE8000` table and the palette word.

## The icon id

The ids are the ones the sibling `everscript` repo already names as
`RING_MENU_ICON` in
`in/core/[group] 00_general_enums/[group] 05_everscript/08_ring_menus.evs`.
They step by 2 from `0x0000` to `0x0142`, **162 ids**. These are the values a
ring menu stores per slot (`RING_MENU.ITEM_n`).

| Ids | What |
|---|---|
| `0x0000`–`0x0026` | UI: spinning ball, dog, digits and letters, `STAT.` / `ACT.` / `EDIT.` / `EQUIP` / `LEVEL` labels, target reticle |
| `0x0028`–`0x0046` | Weapons: 4 swords, 4 axes, 4 spears, 4 bazooka |
| `0x0048`–`0x008c` | Alchemy, first 35 formulas (**animated**, see below) |
| `0x008e`–`0x009c` | Consumables: petal, nectar, honey, biscuit, wings, essence, pixie dust, call bead |
| `0x009e` | Pouch |
| `0x00a0`–`0x00ee` | Armour: 12 chest, 12 helm, 12 glove, 4 collar |
| `0x00f0`–`0x00f6` | Portraits: Fire Eyes, Horace, Queen, Professor |
| `0x00f8`–`0x0116` | Alchemy, remaining 16 formulas |
| `0x0118`–`0x0142` | Ingredients, alphabetical: ash … wax, acorn |

The everscript enum marks the ingredient block `// glitchy: offset`. The ROM
does not bear that out: all 22 ingredient ids resolve to the right icon
through the table below.

## The pointer table: `$CE8000`

162 little-endian words at `$CE8000`–`$CE8143`, one per icon id, each the
address of an entry in bank `$CE`. `$CE8000 + id` is the word, because the id
is already doubled.

The entries themselves start at `$CE8144`. They are **not** in id order: the
ingredient block sits between the first alchemy set and the consumables, and
the ids inside a block are shuffled too. So the pointer table has to be
followed, not skipped. Every id has its own entry; three pairs of UI ids share
an animation record (`0x00`/`0x04`, `0x12`/`0x24`, `0x16`/`0x18`).

### The entry, 8 bytes

| Offset | Size | Meaning |
|---|---|---|
| `+0` | u16 | Name: a pointer to the item's name text (not plain text in bank `$CE`; goes through the game's text encoding, unread here) |
| `+2` | u16 | **Animation record**, an offset into `$C40000`, same as a character's `anim_stand` |
| `+4` | u16 | **Palette**, an address in bank `$D0` |
| `+6` | u16 | **Item index** within the category (see [joining a reward to its icon](#joining-a-reward-to-its-icon)) |

Crystal, for example:

```
$CE8120  9c 83           ; id 0x0120 -> entry $CE839C
$CE839C  9b 6c  3e 59  4b aa  0f 00
         name   record palette index
```

Record `$593E` → script → sprite `$CC3D91`, one 16×16 block, palette
`$D0AA4B`.

## The animation record and script

A record at `$C40000 + record` is the usual `[scriptLow:u16][bank:u8][flags:u8]`.
Every icon record has flags `0`: none is directional. Two script shapes occur:

**A still icon** (weapons, armour, ingredients, consumables, most UI): the
first set-sprite command (`0x22`–`0x2b`, bank = `cmd + 0xA8`) is the icon.
All of them land in one run of 273 consecutive 16×16 sprites from `$CC3BAE`,
except the digit and letter glyphs (`0x06`–`0x14`, from `$CC32E3`, just
before the run) and the dog (`0x02`, `$CB1B8F`).

**An animated icon** (the 35 alchemy ids `0x0048`–`0x008c`):

```
$C8029F  56 2a 00   30   24 0e 40  10  80   24 15 40  10  80   2d
         check      loop frame A   hold end frame B   hold end restart
```

| Cmd | Width | Handler | Effect |
|---|---|---|---|
| `0x56` | 3 | `$90878C` | Reads a word (the formula index, `0x2a` here), calls `$91CE38`; if it returns < 1, loads palette `$D0A8EB` into entity `+0x0C`. That palette is all greys, so this is the greyed-out "can't cast" look. What `$91CE38` counts is not traced. |
| `0x30` | 1 | `$908AE0` | Saves the current position as the loop point (`$0003,Y`), so the check runs once and only the frames loop |

Neither command was in the animation walker's table before. Both widths come
from their handlers (`INX INX` after the operand in `0x56`; `0x30` touches
nothing but `$5D`), the method
[animation_format.md](script-format/animation_format.md) uses for the rest.

So an alchemy icon is **two frames, 16 ticks each**, with a greyed variant.
A static view can use frame A.

## The palette

All icon chunks use chunk palette 0, so colour comes from the entity, and the
entry's `+4` word supplies it. It is 16 BGR555 words at `$D0xxxx`, index 0
transparent, widened `×8`: the same format and reading as
`characterPalette()` in `src/maps/character-record.ts`. The `$D0` bank is the
`$90` bank character palettes already use, through the HiROM mirror.

| Palette | Used by |
|---|---|
| `$D0A94B` | UI labels, digits, letters |
| `$D0AA8B` | Weapons |
| `$D0AA0B` | Consumables, pouch |
| `$D0AA4B` | Ingredients |
| `$D0C3AB` | Armour |
| `$D0C30B`, `$D0C32B` | Alchemy (two palettes, split per formula), portraits |
| `$D0A8EB` | Greyed alchemy, set at run time by `0x56` |
| `$D0C00B`, `$D0AE0B` | Spinning ball, dog |

The ingredient palette is
`F8F8F8 F0F0F8 00D0F8 0078F8 0020F8 38F038 10A810 006800 F8B800 A86000
603000 F87000 E00000 7888B8 284868 000808`, and index 15, the near-black
`#000808`, is the outline every icon has.

**Everscript's `ANIMATION` notes** (`03_sprites.evs`) list menu animation
pointers such as `$90AA0D` "menu consumables" and `$90AA8D` "menu weapons".
Those sit two bytes past these palette addresses, which is probably the same
data seen from another angle. Not needed here.

## Joining a reward to its icon

`src/script/` already decodes a pickup's reward as a 16-bit id
(`names.json → lootRewards`): the high byte is the category, the low byte the
index. The entry's `+6` word is that index, so the join is a lookup, not a
hand-written map:

| Reward | Icon ids | Rule | Example |
|---|---|---|---|
| `0x02xx` ingredient | `0x0118`–`0x0142` | entry `+6` == `xx` | `0x020F` CRYSTAL → `+6 = 0x0F` → id `0x0120` |
| `0x08xx` consumable | `0x008e`–`0x009c` | entry `+6` == `xx` | `0x0800` PETAL → id `0x008e` |
| `0x04xx` armour | `0x00a0`–`0x00ee` | entry `+6` == `xx * 2` | `0x0401` CHEST_1_1 → `+6 = 2` → id `0x00a0` |
| `0x1010` bazooka | `0x0040` | by name | |
| `0x10xx` trade goods and charms, `0x0001` money | none | not in this table | |

Build the reverse map once, by scanning the 162 entries and keying each
category's range by `+6`, rather than hard-coding the alphabetical order.
That keeps it right for randomized and hacked ROMs whose table moved things.

**Not covered:** trade goods (`CERAMIC_POT`, `RICE`, …), charms and money have
no ring icon. The tracker package in
`evermizer-tracker-package/images/items/charms` has charm art, but it is not
the ROM's and this doc does not propose using it. Their in-game graphics, if
any, are still an open question.

## What the plugin needs to use them

1. **A pure decoder, `src/maps/item-icons.ts`.** Given the ROM and an icon id
   it returns `{ frames: SpritePixels[], ticks, palette, greyPalette? }`,
   composed with the existing `readSpriteInfo` / `composeSprite`. It should
   walk the script with the character walker's rules plus `0x56` (3) and
   `0x30` (1), not with a new ad-hoc skip. Put the widths in
   `COMMAND_LENGTH` in `character-animation.ts` so there is one table, and
   check that no character walk changes, the way
   [animation_format.md](script-format/animation_format.md) checked the last
   batch.
2. **A reward → icon id map** built from the table as above, next to the
   decoder, so `src/script/` and the webview never need to know the ids.
3. **Rasterise on the host, not in the webview.** Encode each icon once per
   ROM with `encodePngDataUri` (`src/maps/png.ts`) and send the data URIs with
   the room payload, keyed by reward id. That is 70 small PNGs for all
   ingredients, consumables and armour, cached per ROM path. The webview then
   draws `<image href="data:…" style="image-rendering:pixelated">` exactly
   where `ingrSvgImg()` draws the asset today.
4. **Retire the assets-folder path.** `INGR_MAP`, `INGR_BASE`, `INGR_FILES`
   in `src/rooms/webview/utils.js` and the `ingredients/` listing in
   `src/extension.js` become unnecessary once a ROM is configured. Keep the
   emoji (`INGR_EMOJI`) only as the no-ROM fallback. The keyword match on the
   trigger name (`getIngrKey`) still has a job for *live* rooms whose
   triggers are named but not yet decoded, and should then resolve to a
   reward id rather than to a filename.
5. **Tests**, in the style of the existing `src/maps` ones:
   - all 162 ids resolve to at least one sprite;
   - all 22 ingredients, 8 consumables and 40 armour pieces join to a reward;
   - Crystal (`0x0120`) matches a stored 16×16 index grid pixel-for-pixel:

     ```
     ......f.........
     .....f1f........
     ....f155f.......
     ...f5f5f6f......
     ...f55f66f......
     ...f55f66f......
     ...f55f66f......
     ...f55f66f......
     ...f5f7f6f......
     ....f777f.......
     .....f7f........
     ......f.........
     ```

     (hex palette index per pixel, `.` transparent). This is what was checked
     against the screenshot.

Nothing here needs new ROM access. The `everscript.romPath` setting the
Rooms tab already reads is enough. No ROM-derived image should be committed;
the icons are rendered from the user's ROM at run time, like the maps are.

## How it was found

For the next person, since the earlier note's approach (tracing VRAM uploads
on the Formulas screen) did not get there:

1. Walking all 5128 sprites and measuring each composed size turned up one
   run of **273 consecutive 16×16 sprites** at `$CC3BAE`. Rendered as a
   contact sheet, it is obviously the ring-menu art.
2. Resolving every `$C40000` record through its script to its first sprite
   showed contiguous record blocks landing on that run: `$C4592E`–`$C45982`
   on the 22 ingredients, `$C457B6`–`$C457F2` on the 16 weapons, and so on.
3. Searching the ROM for the raw word `$57B6` (the first weapon record) found
   the 8-byte entry table at `$CE8144`, and the words just before it are the
   162-entry pointer table at `$CE8000`, the exact size of `RING_MENU_ICON`.
4. The palette word matched a 16-colour block at `$D0AA4B` holding all five
   colours of a reference Crystal screenshot, and the decoded Crystal then
   matched it pixel-exact.

**Not yet seen in code:** no instruction reads `$CE8000` as a literal long
address. The engine most likely loads it into a direct-page pointer. The
evidence is the data: the table's size, its entries resolving to the right
art for every category, and the palette match. A Mesen read breakpoint on
`$CE8000`–`$CE8143` while opening any ring menu would name the routine.

The Alchemy **Formulas screen** is a separate path. Its text and icons are
composited by the bitplane blitter at `$8CA6AB` into WRAM, as
[ingredient-icons.md](ingredient-icons.md) found. Whether it reads these same
sprite blocks is not checked, and nothing in the plugin needs it to.
