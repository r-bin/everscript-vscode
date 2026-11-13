# Secret of Mana maps as Evermore rooms

With both ROMs set (`everscript.romPath` = Evermore, a Secret of Mana ROM found by
`everscript.manaRomPath` or beside it), the Rooms tab lists every Mana map in a
**Secret of Mana** group under the vanilla rooms. Opening one converts it, cell by cell,
into a real Evermore room and shows it in the editor like a vanilla room (locked).
Code: [`src/games/evermore/imports/mana/`](../../src/games/evermore/imports/mana/README.md).

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
| a metatile mixing palettes | — | redrawn in the palette its other pixels move least to (most pixels on a tie), other colours replaced by the nearest still one (never a colour a cycle rotates: it would blink); counted (`recolouredTiles`). Potos Falls' foam (`$9C`: palette 7 over palette 6, half and half) stays in palette 7 |
| per-char priority | per-cell priority | the majority of opaque pixels |
| BG palettes 1-7 of palette set `s` | family `m<s*8 + p-1>` | only the palettes the map draws with, in slots 1..k by palette number; the same palette is the same family in every map |
| display mode: TM, TS, CGADSUB | header bytes 4-6 | CGWSEL is `$02` in Mana, written to byte 7 |
| backdrop colour (`$C8:0100` bytes 7-8) | — | Evermore keeps palette 0 for the HUD; drawn black |
| floor of level 1 / 2 (c0 = 1 / 2) | plane 1 / 2 (`$10` / `$20`) | each solid from the other level in both games |
| floor of no level (c0 = 0, or 4-7) | plane 2 + plane-transparent (`$60`) | open from every level |
| wall (c0 = 3) | geometry `$F`, plane 2 (`$2F`) | |
| diagonal half wall 4 / 5 / 6 / 7 (c2) | geometry `$2` / `$9` / `$A` / `$1` | bottom-left / top-right / top-left / bottom-right solid |
| layer switch (c0 bit 3: the walker moves to the other layer, A↔B) | — | not converted |
| split sprite priority (c1 bits 0-2 = 2: marked pieces in front, the rest behind; README "Half-hidden characters") | gate nibble 4 with bit 12 clear (`docs/map-format/wading.md`) | not converted yet: the Evermore side is read from the code but not seen in the game |
| step event cell (`$C8:4000`) | step-on bit 14 + a step-on box | boxes: runs of one event along a row, merged with the same run above; `scriptId` = the Mana event number |
| the map's own event (byte 3 bit 2) | — | kept as `conversion.onEnter` |
| weapon-cut cell (c2 `$Cn`, becomes c3) | cuttable layer (Section 4) | the cell's words until cut, then metatile c3's; one source per (cell, beneath) pair, Evermore's own `buildDictionary`. Which weapons may cut it is lost: Evermore's grass has no weapon test |
| event-flag piece (placed while flag in range) | object (Section 3) | per flag: state 0 = every flag 0 (the picture), one state per other flag value that changes the cells; area = box around every changed cell. The Potos ground (map `$66`, flag `$10` >= 6) is object #0. Which flag value a state is, is kept as `values` |
| objects (character records after the header) | spawn markers in the Rooms tab | `Mana object C001` at the cell; nothing in the blob (Evermore spawns characters from scripts) |
| colour rotation: a run of colours in one BG palette, each taking its neighbour's value every *n* frames (`paletteRotations`, read off the traced animation) | palette-cycle descriptor `[slot<<4 \| first, count, ±n]` (`$90D50F`, ticked by `$90D58C`) | rate = frames per shift; Mana's "colours move up" is a positive rate. Two per Evermore palette at most (more: `droppedCycles`). Potos Falls' waterfall: palette 7, colours 8-15, down every 4 frames → rate −4 |
| animated characters (`$01:B0EC` blocks, `$01:B17E` pixel effects) | Section 2 channels, slots after Block 1 | every metatile whose characters change is drawn at each moment of the 480-frame trace; its shortest repeating loop is one channel (a frame per state, delay = frames it is held, ≤ 255 each). Equal loops share a channel, mirrored ones too (the word's flip bits). Every loop is cut at the same moment of the recording (frame 0), ordered for Evermore's start (frame 0 one frame, then frame 1), so Mana's phase between channels is kept; the families' colours are taken at that moment too |

Layer B's collision is not converted yet. A step-on box's `scriptId` is a Mana event number: it names no Evermore
script, and the tab labels it `Mana event NNN`.

## Where the room lives

The Rooms tab draws every room from a ROM image, so a converted room gets one of its own
(`virtual-rom.ts`), built in memory and never saved: the user's Evermore ROM, copied, plus

| what | where in the image | why there |
|---|---|---|
| graphics, raw (count byte `$3F`, 128 bytes): Block 1, then the animation frames | pointers from id 43691 at `0x300001`, data at `0x301000` (476 at most, up to the families) | Evermore's pointer table (`$EE0000`, 3 bytes an id) reaches past the 3 MB ROM from that id |
| family colours | family ids from 41447 (`0x310002`) | the palette table (`0x1CC322`, 32 bytes an id) reaches there |
| the room blob, Evermore's own encoder | `0x328000`, room slot `0x7E` | upper half of a bank, as every vanilla blob |

Its length differs per map, so the render caches (keyed on a ROM fingerprint) never mix
two rooms. In the tab the room's id is `0x1000 + map id` (`0x1080` = Potos Falls), so no
draft or request can mistake it for a ROM room; the host answers requests for it from
its image.

## Maps that cannot be ported as they are

All 408 maps convert and open in the editor. These would not work as Evermore rooms in
the game, or lose something on the way (measured 2026-10-15 over every map):

| maps | why |
|---|---|
| `$92`, `$A2`, `$A3`, `$A4`, `$A7`, `$DF`, `$E0`, `$191`-`$195` (120x120) | grid + stamps need 33 656-42 672 bytes; Evermore's WRAM window is 32 768 (`budget.ts` MAX_WRAM). Evermore rooms are at most 128 cells a side, but the grid alone is 28 800 bytes here |
| `$0E` | more distinct 16x16 graphics than the 264 a tilemap word can name; the rest are drawn empty |
| `$C6` | one event flag swaps the whole 120x120 map; that object alone overflows the 32 KB bank half a blob may use, so it is left out |
| `$04`, `$05`, `$1FF` | more than 64 special cells (174, 174, 481): `$02:B517` keeps writing slots past 64, over layer B's collision (`$7F:BC00`) and metatile table (`$7F:C800`), while the slot number wraps; the conversion follows the wrap for events but not the overwrite. These maps are probably never shown in this state |
| 43 maps | layer B has its own size and is repeated; Mana scrolls it on its own (parallax), Evermore draws it fixed |
| 32 maps (`$1C`: palette 2 colours 2, 3, 4, 6, 8, 9) | 199 colours change, but not as one run of neighbours: Mana rotates the colours whose ROM word has bit 15 (gaps allowed, README "Animation"), Evermore only a run. Left still (`unconvertedColours`); reordering a family's colours would make them a run |
| `$80` (chars `$360-$363`) and other maps with random holds (`$01:B033` mode `$C0`) | the 480 traced frames are looped as they are (`aperiodicTiles`): the burst comes back every 8 s instead of at random |
| every animated map | A cycle shifts first after \|rate\| frames, so each cycle runs up to a period behind Mana's (`$80`'s waterfall: 2 frames). A metatile drawn by pixel effects (`$01:B17E`) shows its load picture once in Mana and never again, so it starts at a state the game shows while it runs. In the game Evermore uploads 10 channels a frame: Mana updates one block a frame, but several channels can share a frame (`peakUploads`; `$80`: 23 at load, when every channel advances); the late ones catch up a frame later. Map `$80`: 23 channels, 233 frame graphics; vanilla rooms run at most 42 |
| `$1FF` | its trace never returns from `$01:B17E`: drawn still |
| every map | the backdrop colour (Evermore draws black: the gaps in `$80`'s cuttable grass), mixed-palette tiles (one palette per cell, ~12 per map), per-8x8 priority, layer B's collision, the weapon a cut needs, character objects |

## Changing a converted room, and keeping the work

A converted room is a **view of the Mana map**, rebuilt from the user's Mana ROM each time:
- Unlock it (the lock in the tool pill) and edit it like any room. **Nothing is saved**: a notice
  says so once the draft has a change. Only custom maps are written to disk.
- **Copy map** makes a custom Evermore map from it and that copy is saved. It *borrows* the
  converted room as its donor (the id `0x1000 + map id`, its families `m<n>` / ids from 41447), so
  it needs the Mana ROM to be found when it is opened again; without it the copy opens with an
  error and nothing is lost on disk. No Mana data is stored in the copy beyond cell indices.
  Whether the copy would fit an Evermore ROM slot is the Evermore export's rule, not checked here.
- The native Mana map is edited in the Mana Maps panel instead ([README.md](README.md)); the two
  editors never share data.

## The editor for Mana rooms

A converted room opens in the same editor as a vanilla room, locked. What each tab shows,
and what is missing:

| tab | shows | missing |
|---|---|---|
| Tile | the families (`m<n>`) with their art, the room's stamps, collision sub-tab, Animation (the channels and palette cycles) | Mana names for tiles |
| Special | Evermore specials read off the collision words | Mana's special-cell kinds (c1) and layer switches. Seen in the game by the owner (map `$80`, not yet read from the data): the water is full of forced-movement cells, the bridge uses stairs and probably the levels (collision planes) |
| Trigger | step-on boxes, each `Mana event NNN` | what an event does (Mana's event scripts are not decoded); the map's own event (`onEnter`); B-triggers (none known in Mana) |
| Object | event-flag pieces as objects, with their states' tiles | the flag value per state in the UI (it is in `values`) |
| Widgets, Info | as for any room; Info's budgets show the overflows above | — |
| map view | the map, played with its animation (chip Animation), collision overlay, cuttable cells, step boxes, objects; Mana's character objects as spawn markers | sprites for those characters |

Editing a converted room is not saved: it opens locked, and nothing writes back to the Mana ROM.

## Playing it in Evermore

**Play in emulator** (and **Export ROM…**) on a converted room builds a 4 MB Evermore ROM in
which the intro goes straight to the map, as for a custom map ([rom-export.md](../map-format/rom-export.md)
"A converted map"): the Boy (and the dog) arrive at the **start marker**, which a converted room
has like a custom map: picked by the host as the open floor cell nearest the middle (open
around it too), moved with the Select tool even while the room is locked, or the Special tab's
Start pick. Checked in the game (Potos Falls, v0.405.0): room `$15`, every still cell on screen
equal to the editor's picture; the animation follows the editor's timeline within a frame.

| what | in the played ROM | why |
|---|---|---|
| graphics (Block 1, animation frames) | bank `$F0` on; the **highest vanilla graphic ids** point at them | the game reads `$EE:0000 + 3·id` in 16 bits: the image's ids (43691+) wrap, and the table has no free entries past 6690 |
| family colours | written over the **highest vanilla families** (`358..364` for seven) | `$9C:C322 + 32·id`, 16 bits, bank `$9C` fixed |
| the room | Evermore's own encoder, in room `$15`'s slot at `$BD:8000` | as a custom map |
| step-on events | left out (and the step bit cleared) | Mana's event numbers would run whatever Evermore script has that id |
| edits made in the editor | not in it (the note says so) | the ROM is built from the converted map, not the draft |

Taking over vanilla ids is safe for a test ROM, which shows no other room. Still missing in the
game: Mana's characters and enemies, its events and doors (a converted map is a closed room),
the specials it has no translation for (forced movement in water, layer switches).
