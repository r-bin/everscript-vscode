# Secret of Mana maps as Evermore rooms

With both ROMs set (`everscript.romPath` = Evermore, a Secret of Mana ROM found by
`everscript.manaRomPath` or beside it), the Rooms tab lists every Mana map in a
**Secret of Mana** group under the vanilla rooms. Opening one converts it, cell by cell,
into a real Evermore room and shows it in the editor like a vanilla room (locked).
Code: [`src/mana-to-evermore/`](../../src/mana-to-evermore/README.md).

This page is the translation table. Each side's facts are documented on its own side
(Mana: [README.md](README.md); Evermore: `docs/map-format/`). Neither game's facts are
assumed to hold for the other. Only the SNES tilemap word is the same in both: v-flip 15,
h-flip 14, priority 13, palette 10-12, character 0-9.

## What maps onto what

| Secret of Mana | Evermore | how |
|---|---|---|
| layer A (BG1) | layer 1, the canopy (BG1) | same BG |
| layer B (BG2), repeated with its own size | layer 2, the terrain (BG2) | tiled over the map's size; no parallax |
| metatile: 4 tilemap words of 8x8 chars | one 16x16 graphic + one word | the 4 chars with their flips drawn into one graphic; equal graphics share a Block 1 slot, also mirrored (the word's flip bits) |
| a metatile mixing palettes | — | redrawn in the palette with most pixels, other colours replaced by the nearest; counted (`recolouredTiles`) |
| per-char priority | per-cell priority | the majority of opaque pixels |
| BG palettes 1-7 of palette set `s` | palette slots 1-7, family `m<s*8 + p-1>` | the same palette is the same family in every map that loads it |
| display mode: TM, TS, CGADSUB | header bytes 4-6 | CGWSEL is `$02` in Mana, written to byte 7 |
| backdrop colour (`$C8:0100` bytes 7-8) | — | Evermore keeps palette 0 for the HUD; drawn black |
| floor of level 1 / 2 (c0 = 1 / 2) | plane 1 / 2 (`$10` / `$20`) | each solid from the other level in both games |
| floor of no level (c0 = 0, or 4-7) | plane 2 + plane-transparent (`$60`) | open from every level |
| wall (c0 = 3) | geometry `$F`, plane 2 (`$2F`) | |
| diagonal half wall 4 / 5 / 6 / 7 (c2) | geometry `$2` / `$9` / `$A` / `$1` | bottom-left / top-right / top-left / bottom-right solid |
| level switch (c0 bit 3) | — | an ordinary Evermore tile sets the plane anyway |
| step event cell (`$C8:4000`) | step-on bit 14 + a step-on box | boxes: runs of one event along a row, merged with the same run above; `scriptId` = the Mana event number |
| the map's own event (byte 3 bit 2) | — | kept as `conversion.onEnter` |

Layer B's collision, animated tiles and palette effects, objects and NPCs are not
converted yet. A step-on box's `scriptId` is a Mana event number: it names no Evermore
script, and the tab labels it `Mana event NNN`.

## Where the room lives

The Rooms tab draws every room from a ROM image, so a converted room gets one of its own
(`virtual-rom.js`), built in memory and never saved: the user's Evermore ROM, copied, plus

| what | where in the image | why there |
|---|---|---|
| graphics, raw (count byte `$3F`, 128 bytes) | pointers from id 43691 at `0x300001`, data at `0x301000` | Evermore's pointer table (`$EE0000`, 3 bytes an id) reaches past the 3 MB ROM from that id |
| family colours | family ids from 41447 (`0x310002`) | the palette table (`0x1CC322`, 32 bytes an id) reaches there |
| the room blob, Evermore's own encoder | `0x328000`, room slot `0x7E` | upper half of a bank, as every vanilla blob |

Its length differs per map, so the render caches (keyed on a ROM fingerprint) never mix
two rooms. In the tab the room's id is `0x1000 + map id` (`0x1080` = Potos Falls), so no
draft or request can mistake it for a ROM room; the host answers requests for it from
its image.

## Budgets

All 408 maps convert. One map (`$0E`) has more than 264 distinct graphics; the extra
ones are drawn empty (`droppedGraphics`). Twelve 120x120 maps need more than Evermore's
32 KB WRAM window for grid and stamps (`wramBytes`); the tab shows them, but the game could
not load them.
