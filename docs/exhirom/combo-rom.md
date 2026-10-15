# Combo ROM: Evermore and a second game on one ExHiROM cartridge

Status: 💡 **concept, nothing built.** The ExHiROM base it needs: [port.md](port.md).
Labels: *(hardware)* = generic SNES bus facts, *(repo)* = read in our code/docs,
*(to verify)* = believed, not checked; check the partner's own ROM header before relying on it.
Moved here from `docs/todo/romhacks-and-ports.md` §2.

Legal: a combo image may only be built **at runtime from the user's own ROMs** (a converter
like `tools/exhirom/convert.js`). No partner-game bytes, tables or layouts enter the repo, and
nothing is copied from SMZ3 or other combo projects (AGENTS.md rule 0.1).

---

## 1. Where the partner game can go

Evermore stays where it runs today: file `0x000000–0x2FFFFF`, bus `$C0–$EF` and `$80–$AF`
*(repo: [port.md](port.md) §3)*. Under ExHiROM that leaves *(hardware; bus map in [port.md](port.md) §2)*:

| Space | Bus | Speed | Notes |
|---|---|---|---|
| file `0x300000–0x3FFFFF` (1 MB) | `$F0–$FF`, `$B0–$BF:8000+` | FastROM | Not empty space: Evermore reads past its 3 MB (`knowledge/rom/80d113.md`), and patches claim `$F0`/`$FE` (`docs/patches/README.md`). Not a home for a second game. |
| file `0x400000–0x7FFFFF` (4 MB) | `$40–$7D` full banks; `$00–$3F:8000–FFFF` = upper halves | SlowROM | **The partner's home.** The lower halves of `$7E`/`$7F` (file `0x7E0000–0x7E7FFF`, `0x7F0000–0x7F7FFF`) are hidden by WRAM. Bank `$00` also holds the shared vectors and the dispatcher. |

So the partner gets a little under 4 MB of **slow** ROM, and its code can run only from
`$00–$3F:8000+` or `$40–$7D`.

## 2. Do LoROM and HiROM go together?

Yes. The cartridge has one mapping (ExHiROM), and Evermore is HiROM inside it. The real question
is how far the partner's own mapping is from where it has to live.

### 2.1 A LoROM partner fits by rearranging the file, not by changing its code

A LoROM bank is 32 KB, seen at `$xx:8000–FFFF`. ExHiROM shows the upper halves of the second
4 MB at exactly those addresses *(hardware)*:

| CPU address | LoROM file offset | ExHiROM file offset |
|---|---|---|
| `$00:8000` | `0x000000` | `0x408000` |
| `$01:8000` | `0x008000` | `0x418000` |
| `$1F:8000` | `0x0F8000` | `0x5F8000` |
| `$3F:8000` | `0x1F8000` | `0x7F8000` |

Put LoROM bank *n* into the upper half of file bank `0x40 + n`, and the CPU sees **the same bytes
at the same addresses**. Pointers, long jumps and bank bytes stay valid. The vectors land in the
right place by themselves: LoROM `0x7FE0` becomes `0x40FFE0` = `$00:FFE0`. (A dispatcher then
takes over the vectors to choose the game.) The lower halves stay free for data.

What still has to be patched:
- **SRAM.** LoROM boards put SRAM at `$70–$7D:0000–7FFF` *(hardware)*. Under ExHiROM that is ROM.
  Every SRAM access moves to the partner's own SRAM area (§4).
- **FastROM accesses through `$80–$BF`.** Evermore lives there now. A SlowROM LoROM game never
  uses them. A FastROM one needs every such access rewritten to `$00–$3F`, and it then runs slower.
- **More than 2 MB.** `$00–$3F` hold only 64 × 32 KB = 2 MB. A larger LoROM game reaches `$40+`,
  where LoROM shows mirrors or other bytes, and ExHiROM shows something else. Its pointers would
  need rewriting.
- **Enhancement chips** (DSP‑1, SuperFX, SA‑1, S‑DD1, SPC7110, …) sit on their own boards with
  their own decoding. They cannot sit next to Evermore on one ExHiROM board.

### 2.2 A HiROM partner has to move

A HiROM game reads its data through `$C0–$FF` and usually runs fast through `$80–$BF`. Evermore
owns both. The free half has the same shape (full 64 KB banks at `$40–$7D`, upper halves at
`$00–$3F:8000+`), but every bank byte in the partner's code and data has to change:
`$C0+n` → `$40+n` and `$80+n` → `$00+n`. That includes long addresses, pointer tables,
computed banks, DMA source banks and the partner's own mirror uses. It is a **relocation**,
safe only with a full CDL-style audit of that game. Code the partner already runs from
`$00–$3F:8000+` is the exception. Placed at file `0x400000`, those addresses show the same bytes
as before, so only its `$40+`/`$80+`/`$C0+` references change.

### 2.3 What "slow" costs

Bus speed applies **only to ROM accesses** *(hardware)*. A SlowROM byte takes 8 master cycles,
a FastROM byte 6. WRAM accesses take 8 either way, and internal cycles 6. Code fetched and
reading data entirely from ROM is at most 8/6 → **+33 %** CPU time. Real code mixes in WRAM and
internal cycles and loses less, typically somewhere around **+10–25 %** *(estimate)*. DMA, the
PPU and the SPC700 are not affected at all. A game that was **SlowROM already**
(e.g. Secret of Mana, §3) loses **nothing**.
For Evermore the price can be measured: the CDL records cycles per instruction
([layout-options.md](layout-options.md) §5). But Evermore keeps its FastROM place anyway.

**In short:** a LoROM game of up to 2 MB with no chip and no FastROM fits almost without code
changes: rearrange the file and move the SRAM. A HiROM game fits only after relocating its bank
references. That job is smaller when its code already runs from `$00–$3F` (Secret of Mana).

## 3. Candidates

Sizes and mappings are from memory *(to verify)*. Check each against the user's ROM header
before relying on them, as `docs/mana/` does for Secret of Mana.

| Game | Mapping / size | Verdict |
|---|---|---|
| **The Legend of Zelda: A Link to the Past** | LoROM, 1 MB, SlowROM | **Best fit.** Rearrange the file and move SRAM. SMZ3 shows the shape works. |
| Super Mario World | LoROM, 512 KB | Fits easily. |
| ActRaiser, Soul Blazer, Illusion of Gaia | LoROM, ≤ 2 MB | Probably fit. Same genre. |
| **Secret of Mana** | HiROM, 2 MB, **SlowROM** (header `$21`, never writes `$420D`; `docs/mana/README.md`) | Better than a typical HiROM game. Its code already runs in `$00–$02` *(repo: `docs/mana/README.md`)*. Put the game at file `0x400000`, and `$00–$1F:8000+` show the same code bytes again, unchanged. Only its data references through `$C0+` (e.g. `$C8:7000`) must become `$40+`. **No speed loss**: it was SlowROM all along. Still needs its own audit for `$80+`/`$C0+` uses (rule 0.4). The content port (`src/mana-to-evermore`) already brings Mana maps into Evermore without a combo ROM. |
| Final Fantasy VI | HiROM, 3 MB | Like Secret of Mana, but bigger. Possible, a lot of work. |
| Super Metroid | LoROM, 3 MB | **Poor.** Over 2 MB, so it needs `$80+`/`$40+` banks Evermore or ExHiROM take. |
| Chrono Trigger, Terranigma, Tales of Phantasia | HiROM, 4–6 MB | **No room.** Together with Evermore over 8 MB. |
| Yoshi's Island, Star Fox, Super Mario RPG, … | SuperFX / SA‑1 | **Impossible** (chip, §2.1). |

## 4. Architecture (SMZ3 shape)

Taken as an idea only, no code or layout (§ legal note above; [port.md](port.md) §3):

- **Front end in bank `$00`:** shared reset/NMI/IRQ vectors and a dispatcher that picks the game.
  Evermore's own vectors leave bank `$00` at once: reset after 13 bytes, NMI and IRQ with a single
  `JML` to `$80` *(repo: `knowledge/rom/00ffe0.md`, `80823a.md`)*.
- **SRAM split:** each game gets its own SRAM area. Evermore keeps its 8 KB at
  `$20–$3F:6000–7FFF`/`$A0–$BF` *(repo: [port.md](port.md) §2 item 4)*, so the partner's must move.
- **Switching game** means saving and reloading through the front end. WRAM, the SPC700 driver
  and the PPU state do not survive the handover.

Believed, not verified *(to verify from public documentation before using)*: in SMZ3, ALttP runs
from `$00–$3F` and Super Metroid from `$80`/`$C0`.

## 5. Engineering steps

1. **Evermore's mirror audit** ([port.md](port.md) §4 step 1; `knowledge/rom/00ffe0.md`).
   Evermore uses `$00–$3F` only for the reset entry and the NMI `JML`, plus the read past 3 MB.
2. **Partner audit:** the same CDL bus-form audit on the partner's ROM. Find FastROM `$80+` uses,
   SRAM uses and any `$40+` reads.
3. **Converter:** a runtime tool like `tools/exhirom/convert.js` that takes both ROMs, rearranges
   the partner (§2.1), writes the front end and moves the partner's SRAM.
4. **Transition routine:** save to SRAM, upload the target game's SPC700 driver, jump to its entrance.
5. **Shared mechanics (optional):** shared item tables, cross-game pickup messages and sprites,
   and rewriting Everscript chests and gourds.
6. **Proof:** each game alone plays like its original under lockstep (`npm run exhirom:prove` style).

## 6. Alternative

Archipelago multiworld already supports Evermore. It links it with any other game over the
network, two separate ROMs, no cartridge work. A combo ROM is worth it only when the game switch
must happen on the hardware without a network.
