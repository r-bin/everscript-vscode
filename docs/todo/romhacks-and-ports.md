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

## 2. Side Quest: Combo ROM (Secret of Evermore + ALttP)

Exploring the feasibility of creating an SMZ3-style single combo cartridge combining Secret of Evermore with another SNES title (e.g. A Link to the Past).

> How and why to move SoE to ExHiROM (bus map, header/vectors, audit method, order of work): `docs/architecture/exhirom-port.md`.

### 2.1 Architecture Analysis (SMZ3 Model)
- **Memory Map (ExHiROM):**
  - ALttP executes from banks `$00-$3F`.
  - Super Metroid executes from `$80/$C0`.
  - SoE is HiROM FastROM (`$31`, 3MB, 8KB SRAM). Its reset/NMI/IRQ vectors jump directly to bank `$80`.
  - Therefore, SoE could reside natively at `$C0-$EF`, leaving `$F0-$FF` spare.
- **SRAM Segregation:** Each game maintains its own dedicated SRAM bank (e.g. `$A0`, `$A1`).
- **Game Switching:** Handled by saving state and force-loading a targeted entrance coordinate in the partner game; live WRAM does not survive cartridge transition.

### 2.2 Required Engineering Steps
1. **CDL Conflict Audit:** Run the CDL recorder over a complete SoE playthrough to identify all ROM reads through `$00-$3F:8000+` or `$40-$7D`. In ExHiROM, these mirror banks collide with ALttP and must be patched to absolute upper banks (`$C0+`).
2. **SRAM Bank Relocation:** Relocate all SoE SRAM reads/writes to a dedicated SRAM bank.
3. **Transition Routine:** Flush save data to SRAM, upload the target game's SPC700 sound driver, and jump directly to the target map entrance.
4. **Shared Mechanics:** Shared item tables, cross-game pickup messages/sprites, and Everscript chest/gourd rewriting.

### 2.3 Initial Spike & Comparison
- **Prototype Spike:** Build test ExHiROM image with ALttP at `$00` and SoE at `$C0` using SMZ3's common dispatcher. Headless boot verification for both engines.
- **Alternative:** Archipelago multiworld runs SoE and ALttP as two separate ROMs communicating over network. A single cartridge combo ROM is worthwhile only if seamless in-hardware transitions are desired.

