# Terranigma rooms as Evermore rooms

With both ROMs in the ROM library (an Evermore ROM and the European Terranigma ROM, the one the decoder
reads), the Rooms tab lists every Terranigma room picture in a **Terranigma** group under the vanilla rooms
(and Secret of Mana). Opening one converts it, cell by cell, into a real Evermore room and shows it in the
editor like a vanilla room (locked); the Boy's start marker and Play in emulator work as for a Mana map.
Code: [`src/games/evermore/imports/terra/`](../../src/games/evermore/imports/terra/README.md).

This page is the translation table. Each side's facts are documented on its own side (Terranigma:
[README.md](README.md); Evermore: `docs/map-format/`). Neither game's facts are assumed to hold for the other.
Only the SNES tilemap word is the same in both: v-flip 15, h-flip 14, priority 13, palette 10-12, character 0-9.

## What maps onto what

| Terranigma | Evermore | how |
|---|---|---|
| the layer on BG1 / on BG2 (`$0836`/`$0838` against `$2107-$210A`; layer 0 is on BG1 in ~340 pictures, on BG2 in ~170) | layer 1 (BG1) / layer 2 (BG2) | by the BG, not the layer index; a layer smaller than the map is repeated over it (no parallax) |
| a layer smaller than the map on the sub screen only (light, haze) | — | left out, as the room picture leaves it out (README §4) |
| a layer on neither screen as the room loads (`$060`'s BG2) | — | left out; when no layer is on a screen (`$004`, `$1D5`: a script turns them on later) all are put on the main screen, so the editor has something to show |
| a BG2 layer on the sub screen only, added to the backdrop without halving (`$13F`'s cave) | layer 2 on the main and sub screens, priority 0 | the same picture; the backdrop leaves colour math. Its tint over the layer is lost when the backdrop is not black (`lostBackdropTint`; `$13F`: `$0443`). Not BG1: added onto BG2 (`$04C`'s haze), on the main screen it would cover it |
| metatile: 4 tilemap words over the BG's characters | one 16x16 graphic + one word | the 4 chars with their flips drawn into one graphic; equal graphics share a Block 1 slot, also mirrored. The most used first: past Evermore's 264 graphics the rarest are drawn empty (11 pictures: `$0F1`, `$1D6`, `$1D7`, `$28A`-`$28C`, `$36F`, `$3D8`, `$3FA`, `$41E`, `$435`) |
| background palettes 0-7 | families `t<n>`, slots 1-7 | the seven most drawn (Evermore keeps palette 0 for its HUD); the same 16 colours are the same family in every room. A tile mixing palettes is redrawn in the one its other pixels move least to, other colours the nearest (`recolouredTiles`) |
| per-char priority | per-cell priority | the majority of opaque pixels (`mixedPriority`) |
| backdrop (colour 0, a copy of colour 32: `$8D:8C52`) | — | Evermore's is black: filled into layer 2's transparent pixels (as for Mana: a priority-0 tile's all, a priority-1 tile's where no priority-0 layer-1 pixel lies over it in any cell; with BG2 on the sub screen only where no layer-1 pixel covers it, and not when BG2 or the backdrop takes part in colour math), its exact colour written into an index no tile of that palette draws with; an empty cell or a room without layer 2 gets one solid graphic |
| TM, TS (`$212C`, `$212D`) | header bytes 4, 5 | BG1, BG2 (when converted) and sprite bits kept; BG3 on in TM, as in every vanilla Evermore room (its HUD and text) |
| CGADSUB with the sub screen (CGWSEL bit 1) | header byte 6; byte 7 `$02` as in every vanilla room | BG3/BG4 bits cleared; dropped when no converted layer is left on the sub screen (it would mix with Evermore's fixed colour) |
| CGADSUB with the fixed colour (CGWSEL bit 1 clear; always black in the base ROM, 144 pictures) | — | adding or subtracting black changes nothing: dropped. Halving (`$C3`, 13 pictures) halves every colour of both layers: done to the families' colours instead (`halvedColours`) |
| cell type (map word bits 9-13 of layer 0, what movement reads, README §3.6): open in every direction | floor, plane 2 (`$20`) | |
| a wall in every direction | geometry `$F` (`$2F`) | also past layer 0's size |
| a type only some moves pass (8 a ledge, `$1F` a drop, `$1A`) | floor (`$20`) | Evermore has no one-way cells and no jump; left a wall it would cut maps in two |
| slope 6 (`/`) | geometry `$1` (SE solid) or `$A` (NW) | the type gives the line, the walls around it the solid half (README §3.6, walked in the game): the side with more wall neighbours |
| slope 7 (`\`) | geometry `$2` (SW solid) or `$9` (NE) | as above |
| ground word bit 0 (`$80:E11C`: drawn with sprite priority `$3000`; types `$11`, `$16`) | bit 12 (in front) | which characters the ground table applies to is not checked (README §6) |
| no layer 0 (`$005`) | floor everywhere | nothing to collide with |
| exit (`$81:8000`, README §3.7) | step-on bit 14 + a box per exit | `scriptId` = the exit's index; the tab labels it `Terranigma exit to $XXX` (choices by flag listed) |
| chest (`$99:D859`, README §3.9) | wall + bit 15 + a B-trigger box | B facing the cell; labelled with its contents word. Pressed with A in Terranigma, from the cell in front |
| map change (`$99:D4E7`, README §3.8) | object (Section 3): state 0 as loaded, state 1 the change applied | area = the box around the changed cells; a layer-0 change gives the cell its new collision. `flag` = the change's bit of `$7E:0710` |
| where the game's exits into the room arrive (every room's exit list) | the Boy's default start | the floor cell holding the arrival point, else the nearest within two cells; else the cell nearest the middle |

Not converted: tile and palette animation (not decoded, README §6: the room is still), characters (the room
script past its header is not decoded: no spawn markers), BG3/BG4, windows, parallax. Play in emulator leaves the
exits and chests out (bits 14 and 15 too): their numbers are Terranigma's, and as Evermore script ids they would run
whatever Evermore keeps there.

## Where the room lives

As for Mana ([docs/mana/evermore-rooms.md](../mana/evermore-rooms.md) "Where the room lives"): an in-memory image
(`imports/common/virtual-rom.ts`), never saved. Tab room id `0x2000 + room id`; family ids from Mana's end
(`TERRA_FAMILY_BASE`, 1024 of them, colours up to `0x320002`).

## Checked

`tests/terra/terra-evermore.test.js`: all 511 pictures convert and decode. Evermore's render of the converted
room against Terranigma's render, 5 bits per channel (November 2026): median 98.3 %, 473 of 511 at 90 % or more.
Below that: the rooms whose own picture is blank as loaded (shown here), colour-math rounding (`$1A4`-`$1A9`:
the same picture to the eye), the lost backdrop tint, and `$0FD`-`$0FF` (not looked into).
`tests/terra/terra-play.test.js`: Crysta (`$00A`) played in Evermore: room `0x15` on screen as the editor draws it,
the Boy walking up stops at the wall. `tests/terra/terra-editor-dom.test.js`: the rail, the Tile, Trigger and
Object tabs, the start marker and Play, in the real page.
