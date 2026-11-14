# Romhacks, Ports & Cross-Game Integrations — Explorations

> Domain: Long-term Romhacking, Cross-Game Engine Ports & Multigame Architecture
> Status key: 💡 concept / architectural research

---

## 1. Secret of Mana (SoM) Content Port to Secret of Evermore

Investigating the technical feasibility of porting Secret of Mana rooms, enemies, and art into the Secret of Evermore engine.

### 1.1 Requirements & Prerequisites
1. **Decode SoM Map Data:** Decode SoM rooms into BG layers, 8×8/16×16 tiles, palettes, and collision structures.
2. **ROM Asset Budgets:**
   - Free ROM space for ported assets.
   - Master tile table slots (`$EE0000`).
   - Character and animation table entries (`$C4` records, `$CF` form tables).
   - SPC700 sample directory slots (`$0200`).
   (See `.agents/skills/map-editor-rules/SKILL.md` for ROM budget constraints).

### 1.2 Open Questions
- **Map Porting:** Both engines utilize the SNES PPU Mode 1 background architectures. Can SoM metatile layouts and collision priority bits cleanly map onto SoE's collision bitfield (`docs/map-format/map_collision_mechanics.md`)?
- **Enemy Porting:** Convert SoM sprite frames into SoE animation bytecode scripts (`.agents/skills/animation-script/SKILL.md`), mapping body/hurt/strike boxes. Since SoM AI logic differs, ported enemies would borrow SoE AI scripts with new visuals.
- **Tooling Reuse:** Survey open-source SoM map editors and decoders to avoid reverse engineering SoM binary formats from scratch (verify license compatibility before borrowing logic).

### 1.3 Converted maps: open work (2026-11-14)

The conversion (`src/games/evermore/imports/mana`, table: [evermore-rooms.md](../mana/evermore-rooms.md)).
Rule from the owner: a cell carries the flag Mana's data gives it; where Evermore then behaves
differently, measure it and report it, do not reshape the data.

- 🟡 **The party's layer from the door.** `partyLayer` picks layer B only where only layer B has
  return cells (7 maps: `$A5`, `$101`, `$102`, `$105`, `$118`, `$11A`, `$12A`), else A. In the game
  the door that leads in sets the layer (`$7E:E00B` bit 7). Decode the map change in Mana's
  event scripts (destination map, cell, layer) and take the layer from there.
- 🟡 **Layer switches (c0 bit 3).** Only the party layer's collision is converted; maps where a
  walker changes layer lose the other one. Pair both layers with Evermore planes.
- 🟡 **Potos Falls bridge, upper row.** With the shear on every Mana stair cell, the Boy crosses
  from the lower row but sticks at the stair along the upper row, both ways (Evermore climbs
  twice Mana's slope into the wall above the deck's end). Owner to decide: accept, or change
  the walls beside the deck ends (not the stair flags).
- 🟡 **Black backdrop pixels left.** ~3000 on `$17`, 48 on `$10`: one layer-B graphic lies under
  layer A in one cell and not in another, so it cannot be filled for both. Per-cell copies of
  such graphics, or set Evermore's backdrop (CGRAM 0) instead of filling: find who writes
  palette 0's colour 0 (not a plain table in the ROM).
- 🟡 **Doors the rule misses.** Doors are told by their surroundings (`mapEvents` `looks`); 3 of
  24 samples were doors in unusual walls and stay step-on. Decoded door events would settle it.
- 🟡 **Potos 3 (`$104`).** No events and no return cells on either layer: no triggers. Find how
  it is entered and left.
- 🟡 **Stairs on Potos' path.** `$66` (36,19)-(36,21) carry `$21` (stairs and slopes) under the
  north-east house: marked as vertical stairs. Check whether `$2n` covers more than stairs.
- 💡 **Events in Evermore.** Step-on and B-trigger boxes name Mana event numbers (return cells
  `$1000`); Play in emulator leaves them out. Doors and exits between converted maps need
  Evermore scripts written for them.

---

## 2. Side Quest: Combo ROM (Secret of Evermore + a second game)

Moved to [`docs/exhirom/combo-rom.md`](../exhirom/combo-rom.md): where a second game fits, LoROM vs HiROM
partners, candidate games, SMZ3-shaped architecture, steps. ExHiROM itself: [`docs/exhirom/`](../exhirom/README.md).

---

## 3. Multiplayer mod (2–4 players, drop-in)

Design draft: [`docs/plans/multiplayer-mod.md`](../plans/multiplayer-mod.md). Builds on FuSoYa's
2P patch ([`soe-2player-patch-analysis.md`](../soe-2player-patch-analysis.md)); phases from a crash-free
boy + dog 2P to ported Mana/Terranigma characters and netplay.
