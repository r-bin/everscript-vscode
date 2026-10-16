# Secret of Mana — RAM addresses seen so far

Every address here was read from Secret of Mana's own code (routine named) and, where
it says so, watched in the headless game (`tools/mana/*`). Nothing is taken from
Evermore or from other projects. Partial knowledge says so. Format and code:
[README.md](README.md); how to re-check: [verifying.md](verifying.md).

## Direct page (`$7E:00xx`)

| address | what | evidence |
|---|---|---|
| `$1B`, `$1C` | parameters for the set loaders: header bytes 1 / 0 / 2 in turn | `$00:C481` |
| `$1B` | while a character moves: its `+$0B` (bit 7 layer B, bit 3 "just flipped layer", bits 0-1 level) | `$00:D864`, written back `$00:D8AE` |
| `$1E`, `$1F` | while a character moves: its x / y step this frame, bit 7 = negative, bits 0-6 pixels | `$00:D7F7`, `$00:D3DD` |
| `$1D`-`$1F` | 24-bit pointer to the map header (bank `$C8`) while loading | `$00:C481` |
| `$30` | display mode (header byte 5) | `$00:C4E7` |
| `$4D` | `$C0 - (byte 3 & 3)`: the lowest cell value that runs a step event | `$00:BEC9`; read `$C0`/`$BF` in game |
| `$56` | facing of the attacking entity, picks the probe's reach | `$01:D29F` |
| `$0E`, `$1C` | after the attack probes: target (`$8000` + event for a strike cell) and attacker; `$01:CD95` runs the event | `$01:D389`; interpreter |
| `$95` | sound request, bit 7 pending; pan in `$0118`/`$0119` | `$00:BB11`, `$00:B565` (→ `$7E:1E00`) |
| `$94` | header byte 6 | `$00:C4F9` |
| `$9C`/`$9D`, `$A0`/`$A1` | layer A / layer B size in cells | `$00:CB90`, `$00:D03E` |
| `$B8` | header byte 3: bits 0-1 step-event offset, bit 2 the map's own event | `$00:C49C`; 4 at map `$10`, 1 at `$11`, 5 at `$3E` (game) |
| `$C0`, `$C2` | x / y bounds the cut probe wraps at | `$01:D31C` |
| `$D0` | non-zero: no step events (`$00:B630`, `$01:B9C2`). 133 right after a forced map load, 0 once the player has control | game |
| `$DC`/`$DD` | map id the loader reads | `$00:C483`; written by `check-map.js` |
| `$ED` | bit 7 = header byte 7 was `$FF`; the party's attack probe (cut, strike cells) runs only with it set. `$00:BEAA` clears it while `$CF00` is 0 | `$00:C52E`, `$01:CDDF`; game: `$ED` = 0 on map `$3E` with `$CF00` = 0, `$80` with `$CF00` = 1 |
| `$F4`/`$F5` | frame counter | `$00:B0BB` |

## Bank `$7E`

| address | what | evidence |
|---|---|---|
| `$C000`-… | the sprite list built each frame (not map tiles) | stores at `$00:FA4B`, `$01:90DA`, `$02:A5EC`, `$02:AC3A` |
| `$C800` + 16 n | the map's objects: +0 = 1 in use / `$81` spawned, +3 entity slot, +7 flags (`$80` byte 3 bit 7, `$40` byte 2 bit 7), +8..+15 the 8-byte record | `$00:DCE3`, `$00:DD55`; all 22 of map `$10` seen copied |
| `$CF00` + flag | event flags, one byte each; pieces are placed by them | `$00:CB90`; all 0 except `$CF0C` = 1 after the intro |
| `$CD00`-`$CDFF`, `$CE00`-`$CEFF` | current place / saved return point (`$CD08`/`$CE08` map id); `$01:CBCF` saves, a return cell (c1 bit 4) restores and loads | `$01:CBCF`, `$01:CCF5`; game |
| `$D000` + slot/8 | three small objects per character (spawned by animation command `$FB`), with a height checked against collision c0 bits 4-5; not seen on screen | `$02:BF1D`, `$02:C26C` |
| `$E000`, `$E200`, `$E400` | the three party characters, `$200` apart | `$00:B637` loops over them |
| `$E600`, `$E800`, … | spawned characters, same layout | map `$81`: four at `$E600`-`$EC00` |
| `$E800`/`$E802`/`$E804` | object list count / address / bank, set by the loader — the count is reused later, do not read it after the load | `$00:C50C`, `$00:C51F` |

### A character (`$7E:E000 + $200 * slot`)

| offset | what | evidence |
|---|---|---|
| `+$02`, `+$04` | x, y in pixels; a spawned object stands at cell * 16 + 4 | game, maps `$10` and `$81` |
| `+$0B` | bit 7: on layer B (the cut probe uses `$7F:4000` / `$BC00`) | `$01:D2F3` |
| `+$0B` | also bits 0-1 the level, flipped by c0 bit 3 cells | `$00:D864`; game (2 → `$82`) |
| `+$1C` | with `+$2C` set, a special cell blocks while `$D0` or `+$1C` is non-zero (and `$FF` is 0) | `$01:B9BE`-`B9C7` |
| `+$2C` | 0: a special cell whose c1 bit 6 is clear blocks this party member; non-zero: see `+$1C` | `$01:B9AE` |
| `+$45` | must be 0 for a step event to run | `$00:B63C` |
| `+$4B`, `+$4C` | the cell value just entered (`$00:D682`), and the last one; `+$4B` is cleared when its event runs | `$00:B642`; game (`check-events.js`) |
| `+$48`, `+$49`, `+$4D` | c2 and c3 of the cell entered when c2 changed, and that c2 (for the change test); `$00:D359` acts on `+$48` | `$00:D8B3`; game |
| `+$4A` | `$80`: entered a return cell; the main loop goes back to `$7E:CE00` | `$00:D692`, `$00:B613`; game |
| `+$8B` | the character's own OAM attribute high byte (priority 2 for the party: `$2B`/`$2D`/`$2F`) | `$00:F6CC`; game |
| `+$8E` | sprite priority from collision c1 bits 0-2; 1-3 split the sprite by each piece's mark bit (README "Half-hidden characters") | `$00:D6A6`, `$00:F6D6`; game |
| `+$88` | bits 7 / 6: the character's vertical / horizontal flip, applied to every piece | `$00:F6F6`, `$00:F71B`, `$00:F730` |
| `+$90`-`+$93` + 4 n | piece n as built for OAM: offsets, tile, attribute (priority already split) | `$00:F742`, `$00:F760`, `$00:F765` |
| `+$68` | weapon type of the attack, matched against collision byte 2 (`$Cn`) | `$01:D3C3`; which weapon each number is: not read yet |
| `+$C0` | the attack's reach offset (x, y bytes) | `$01:D295` |
| `+$C2` | non-zero while the attack is out: the cut probe runs | `$01:CE19` |

Not watched in the game yet: `+$0B`, `+$1C`, `+$2C`, `+$45`, `+$68`, `+$C0`, `+$C2`
(read from the code; the cut probe was run on the interpreter with them set). "Blocks"
means `$01:B9A3` returns with carry set, which the movement code treats as solid — read
from the code, not watched.

## Bank `$7F`

| address | what | evidence |
|---|---|---|
| `$0000` + y*`$80` + x | layer A cells (metatile ids; special cells `$C0+k`) | `$00:CB90`, `$00:D03A`; game |
| `$4000` + y*`$80` + x | layer B cells | same |
| `$B800` + n*4 | layer A collision per metatile; specials at `$BB00 + 4k` | `$02:A043`, `$02:B517` |
| `$BC00` + n*4 | layer B collision; specials at `$BF00 + 4k` | same |
| `$C000` + n*8 | layer A metatile tile words; specials at `$C600 + 8k` | `$02:A069`, `$02:B517` |
| `$C800` + n*8 | layer B metatile tile words; specials at `$CE00 + 8k` | same |
| `$FF20` | piece stamp marks (at most 56) | `$00:CD93` |

More than 64 special cells in one layer (maps `$04`, `$05`, `$1FF`) push the slots past
`$BC00`/`$C800` into layer B's tables.
