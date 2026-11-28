# The cheat menu demo

An Open Evermore demo ([demos.md](demos.md)) that adds a full-screen cheat menu to Evermore (US 1.0), in the style of
the game's alchemy screen. One new routine file,
[cheat_menu.asm](../../tools/open-evermore/demos/cheat_menu/files/code/cheat_menu.asm), and one changed line of the
field loop. The engine calls it uses: [full-screen-menus.md](../disassembly/ui/full-screen-menus.md).

## Controls

Hold **L and R** in the field. The world pauses; the screen shows one category.

| Button | Does |
|---|---|
| L / R | previous / next category (the icon strip under the title) |
| Up / Down | row (the list scrolls and wraps) |
| Left / Right | amount or level; off / on where a row has neither |
| B or A | owned on / off (weapons, alchemy, charms); party: maximum; elsewhere: maximum / none |
| X | every row of the category to its maximum |
| Y or Start | back to the game |

## Categories

Every change is written to WRAM at once and stays in the save. Names, descriptions and icons are read from the ROM.

| Page | Rows | Value | WRAM | After a change |
|---|---:|---|---|---|
| Weapons | 13 | owned (B), level 1-3 (Left / Right; the Bazooka: on / off only) | bits `$22DA/$22DB`, level in the high byte of `$0ADD + 2·weapon` | taking the held weapon away gives the Boy another; the last one owned stays; stats rebuilt |
| Bazooka | 3 | 0-99 | `$2345-$2347` | the weapon reloads |
| Alchemy | 35 | known (B), level 0-9 | bits from `$2258`, level `$2F98 + 2·formula` (experience cleared) | a forgotten formula leaves the selected nine (`$0AD2`) |
| Ingredients | 22, alphabetical (the game's ids run backwards through the alphabet) | 0-99 | `$22FF + id` | |
| Items | 8 | 0-6; Call Beads up to their capacity (99 if it is 0) | `$2315 + id` | |
| Armor | 40 | 0-6 | `$231D + id` | the last of a worn piece is taken off; stats rebuilt |
| Charms | 20 | on / off | bits `$2261-$2264` | stats rebuilt |
| Trade Goods | 13 | 0-99 | words from `$2517` | |
| Money | 4 | 0-999,999, steps of 100 | 3 bytes each from `$0AC6` | |
| Player Status | 4 | level 1-99 and HP of the Boy and the Dog | `$0A50`, `$4EB3`, `$0A9A`, `$4F61` | a level sets its experience, rebuilds the stats and fills HP |

A script's "no weapon" state (`PACIFIED`) is left alone. Editing Call Beads while their capacity is still 0 sets it to 99.

It is a cheat menu: the six key items on the Charms page are story flags, and X turns them on too, which can skip or
break story events.

## Building it

```sh
T=tools/open-evermore/open-evermore.mts
node $T demo verify cheat_menu                         # build with the test scene, check it in headless MesenCE
node $T explode --out out/cheat                        # your own build, without the scene:
node $T demo apply cheat_menu out/cheat --no-scene
node $T implode out/cheat                              # → out/cheat/_build/evermore.sfc
```

With the scene (`demo apply` without `--no-scene`) the game boots into an empty room.

## How it hangs in the game

- The field loop's `jsl per_frame_field_tick` (`$8E:E543`) becomes `jsl cheat_menu_hook`, applied with the demo op
  `replaceText`, so the repository holds no line of the vanilla routine but the call it replaces. Dialogues and
  full-screen menus run other loops, so the combination does nothing there.
- The hook reads the raw pad (`$0EC6`), opens once a press, only on a fully lit screen with no ring open.
- WRAM: the shop menu's variables `$0D0D-$0D60` while the screen is open, the ring's animation records from `$06A3`
  (the last one reaches the weapons ring's buffer, which is rebuilt when it opens), and two words nothing else uses
  (`$0F7C` the last category, `$0F7E` the held combination).

- The hook costs a few cycles a frame, so a build with this demo does not play in lockstep with vanilla
  (`prove`): the engine is time-sliced ([code.md](code.md) §4 h).

## Checking it

`verify.lua` changes something on every page and reads WRAM back, removes the held weapon, walks the long charm
descriptions, taps two quick presses during a redraw, watches that a changed row is never blank, compares icon palettes
with the ROM (after the ring menu was open, and on the money page), and walks after leaving. One-off checks on
2026-11-28, not stored: every frame after a press showed the old picture, an emptied list or the new one; one-row
scrolling matched a full redraw on six pages; a populated room's picture came back unchanged; seven seeds of 500 random
presses (before the redraw was reworked) never ran the field inside the menu.

## Drawing

Nothing is shown half drawn. The list window has eight row slots for seven screen rows: a row is printed into the
hidden one, then the window layer's map points at it in the same vertical blank as the sprites. A new category shows
its title over an empty list, then every row at once. The title and the description are printed into unused VRAM
(`$0400`, the stone layer's map is only 32 × 32) and uploaded whole.

Icons: ring items bring their own; charms and trade goods use the pause screen's pictures (`$C4:5A12`, `$C4:5A4E`,
palette `$D0:AB0B`); the currencies the money window's palette (`$D0:AACB`).

## Limits

- US 1.0 only. Vanilla's entries only: ingredients, consumables or formulas that another demo adds are not listed
  (the demos still build and play together).
- It can open while a script holds the player still, which the game's own ring cannot; no harm was seen.
- `$0D0D-$0D60` are written by number: a tree that moves the shop menu's variables (`wram`) and puts something else
  there would be overwritten while the menu is open.
- Its own words are in the routine: "Weapons", "Armor", "Money", "Charms", "ON", "OFF", "Lv", "Defense:", "level", "HP" and
  the help lines. Every other string is the game's.
