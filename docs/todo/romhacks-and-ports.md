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

---

## 2. Side Quest: Combo ROM (Secret of Evermore + a second game)

Moved to [`docs/exhirom/combo-rom.md`](../exhirom/combo-rom.md): where a second game fits, LoROM vs HiROM
partners, candidate games, SMZ3-shaped architecture, steps. ExHiROM itself: [`docs/exhirom/`](../exhirom/README.md).

---

## 3. Multiplayer mod (2–4 players, drop-in)

Design draft: [`docs/plans/multiplayer-mod.md`](../plans/multiplayer-mod.md). Builds on FuSoYa's
2P patch ([`soe-2player-patch-analysis.md`](../soe-2player-patch-analysis.md)); phases from a crash-free
boy + dog 2P to ported Mana/Terranigma characters and netplay.
