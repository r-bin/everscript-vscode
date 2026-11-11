# Runtime Overlay & UI Parity — Open Tasks & Alignment Roadmap

> Domain: Unified visual language, control hierarchy, and color/feature synchronization across **Map Editor** (`src/games/evermore/rooms/webview/`), **Plugin Emulator** (`src/games/evermore/emulator/webview/`), **SecretOfEvermoreRecomp** (`SecretOfEvermoreRecomp/docs/mods/debug-overlay.md`), and **Lua Plugin** (`soestuff.lua`).
> Baseline reference: Map Editor redesign ([`docs/map-editor-redesign-plan.md`](../map-editor-redesign-plan.md)), [`map-view.css`](../../src/core/map-editor/view/map-view.css), [`map-editor-filterbar.js`](../../src/games/evermore/rooms/webview/map-editor-filterbar.js).
> Status key: 🔴 bug / desync · 🟡 feature gap · 🟢 designed, not yet built · 💡 future sync idea

---

## 1. Canonical Standard (Map Editor Baseline)

The Map Editor sets the ground truth for visual hierarchy, layout order, color semantics, and overlay stacking. All other runtimes align to this standard.

### 1.1 Control Strip Hierarchy (Left-to-Right)
```
[ BG | FG | Collision ▾ ]  [ Triggers ▾ ]  [ Objects ▾ ]  [ Special ▾ ]  [ Anim ]  [ More ▾ ]
```
1. **Layers & Geometry (Segmented Pill)**:
   - `BG`: Layer 2 terrain render
   - `FG`: Layer 1 canopy / overhangs
   - `Collision ▾`: Dropdown with `Outline` (contour contours) vs `Tile by tile` (solid fills by level)
2. **Triggers ▾**:
   - `Step trigger`: Step-on zones
   - `B trigger`: Talk / Inspect / Gourd zones
   - `Type`: 'S' or 'B' badge in top-left cell
   - `Script ID`: Hex script ID badge (e.g. `00A4`)
3. **Objects ▾**:
   - Section 3 dynamic map objects
   - `ID`: Object number & state badge (`OBJ <index>:<state>`)
   - `Sub-frames`: Alternate state bounding boxes
4. **Special ▾**:
   - `Stairs`, `Gate`, `Plane switch`, `Interact (Bit 15)`, `Step-on (Bit 14)`, `Entrances`
5. **Anim**:
   - Section 2 animated tiles & marks
6. **More ▾ (Drawer)**:
   - `Composite`: Mode 1 hardware blend
   - `NPCs / Spawns`, `Hitboxes`, `Enemies`, `Grass`
   - `Item Icons`: Loot icon overlay on B-triggers
   - `POI`: Points of interest (from `soestuff.lua`)
   - `8px Grid` / `16px Metatile Grid`
7. **Status Bar**:
   - Live coordinates (`x: __, y: __`), room size (`W × H`), interact/step bit flags.

### 1.2 Color & Alpha Palette (Canonical Reference)

| Overlay Feature | Accent Hex | OKLCH Token | Fill (RGBA) | Stroke | Badge Style |
|---|---|---|---|---|---|
| **Step-on Trigger** | `#FF69B4` | `oklch(72% 0.19 350)` | `rgba(255, 105, 180, 0.20)` | 1px solid `#FF69B4` | Pill `rgba(0,0,0,0.65)` + pink mono text |
| **B-Trigger (Inspect/Loot)** | `#FFCC00` | `oklch(80% 0.17 95)` | `rgba(255, 204, 0, 0.20)` | 1px solid `#FFCC00` | Pill `rgba(0,0,0,0.65)` + yellow mono text |
| **Map Objects (Section 3)** | `#29B6F6` | `oklch(75% 0.14 225)` | `rgba(41, 182, 246, 0.15)` | 1px dashed `#29B6F6` (bounds)<br>1.5px solid (active state) | Pill `rgba(0,0,0,0.65)` + blue mono text |
| **Animated Tiles (Sec. 2)** | `#BF55EC` | `oklch(70% 0.19 295)` | `rgba(191, 85, 236, 0.15)` | 1.5px solid contour | Pill `rgba(0,0,0,0.65)` + purple pattern letter |
| **Collision (Solid / Wall)** | `#E53935` | `oklch(65% 0.20 25)` | `rgba(229, 57, 53, 0.25)` | 1px solid red contour | 3×5 level index (outline mode) |
| **Entrances / Start** | `#4CAF50` | `oklch(68% 0.14 150)` | `rgba(76, 175, 80, 0.18)` | 1px dashed `#4CAF50` | Directional arrow glyph |
| **Hitboxes (Combat)** | `#FF9800` | `oklch(75% 0.18 65)` | `rgba(255, 152, 0, 0.12)` | 1px solid `#FF9800` | Radius capsule / box |
| **POI (Lua Markers)** | `#00E5FF` | `oklch(85% 0.16 200)` | `rgba(0, 229, 255, 0.25)` | 1px solid `#00E5FF` | Pin / crosshair + coordinate text |
| **8px / 16px Grid** | `#FFFFFF` | — | Transparent | `rgba(255, 255, 255, 0.08)` (8px)<br>`rgba(255, 255, 255, 0.20)` (16px) | None |

### 1.3 Layer Stacking Order (Compositing Pass)
1. Backdrop color
2. BG2 Terrain (L2)
3. Section 2 Animated Tiles (Frame 0 or live tick)
4. Sprites / Entities (Player, Dog, NPCs, Enemies)
5. BG1 Canopy (L1 over sprites)
6. Collision overlay (Contours / solid tiles)
7. Trigger bounding boxes (Step-on & B-triggers)
8. Section 3 Map Object boxes (Active & sub-frames)
9. Special markers & POI pins
10. Combat Hitboxes & HP/Stamina bars
11. Badges, Text Labels & Tooltips

---

## 2. Single Source of Truth (SSOT) Architecture

### 2.1 Canonical Token Specification Manifest
- **Status: 🟢 designed, not yet built**
- **Location:** `src/core/map-editor/view/overlay-tokens.json`
- **Goal:** Define the single authoritative JSON manifest holding all overlay categories, menu order, colors (hex, OKLCH, RGBA alpha), and rendering styles.

### 2.2 Multi-Target Token Exporter
- **Status: 🟢 designed, not yet built**
- **Script:** `tools/export-overlay-tokens.mts`
- **Generated Outputs:**
  1. `src/core/map-editor/view/tokens.ts` & CSS variables for Webview Map Editor and Plugin Emulator.
  2. `SecretOfEvermoreRecomp/include/soe_debug_tokens.h` C/C++ header with `#define SOE_COLOR_*` and RGBA structs for ImGui.
  3. `snes-scripts/Secret of Evermore/tokens.lua` Lua table for `soestuff.lua`.

### 2.3 Automated Token Validation Lint
- **Status: 🟢 designed, not yet built**
- **Check script:** `tools/check-overlay-tokens.mts` added to `npm test` / `check:clean`.
- **Assertion:** Fails CI if hardcoded hex values in `overlay-toggles.js`, `soestuff.lua`, or Recomp headers drift from `overlay-tokens.json`.

---

## 3. Target Alignment Backlog

### 3.1 Plugin Emulator (`src/core/emulator/` & `src/games/evermore/emulator/`)
- **Status: 🟡 feature & visual gap**
- **Current State:** Uses isolated flat toggle chips (`MAP EXT`, `TRIGGERS`, `OBJECTS`, `ANIM TILES`, `COLLISION`) in [`overlay-toggles.js`](../../src/games/evermore/emulator/webview/overlay-toggles.js) and hardcoded RGBA strings in [`01-extend-map-enabled.js`](../../src/games/evermore/emulator/webview/overlays/01-extend-map-enabled.js) and [`02-render-objects-overlay.js`](../../src/games/evermore/emulator/webview/overlays/02-render-objects-overlay.js).
- **Tasks:**
  - [ ] Replace isolated toggle buttons with the shared segmented pill (`[ BG | FG | Collision ▾ ]`) and dropdown chips (`Triggers ▾`, `Objects ▾`, `Anim`, `More ▾`) using `view-chips.js`.
  - [ ] Scope emulator controls with `.rg-theme` to inherit styling tokens from `map-view.css`.
  - [ ] Replace hardcoded color strings in `01-extend-map-enabled.js` and `02-render-objects-overlay.js` with exported constants from `tokens.ts`.
  - [ ] Support `Outline` vs `Tile by tile` collision view modes on the live canvas overlay.
  - [ ] Render dark backing pills (`rgba(0,0,0,0.65)`) behind all trigger script IDs and object labels.

### 3.2 Native Recomp (`SecretOfEvermoreRecomp`)
- **Status: 🟡 menu & color parity gap**
- **Current State:** ImGui debug overlays (`docs/mods/debug-overlay.md`) use separate developer hotkeys and ad-hoc menus.
- **Tasks:**
  - [ ] Unify ImGui menu bar order to match Map Editor: `[Layers] [Triggers] [Objects] [Special] [Animation] [More]`.
  - [ ] Include generated `soe_debug_tokens.h` for all ImGui draw list calls (`ImDrawList::AddRect`, `AddRectFilled`, `AddText`).
  - [ ] Align trigger box alpha to `0.20` and object box alpha to `0.15`.
  - [ ] Implement object sub-frame state bounding boxes and active-state highlights matching `02-render-objects-overlay.js`.
  - [ ] Add coordinate readout in the ImGui status bar matching Map Editor format (`x: __ y: __ · interact: _ · step-on: _`).

### 3.3 Lua Plugin (`soestuff.lua`)
- **Status: 🟡 visual & coordinate sync gap**
- **Current State:** Uses legacy TAS script colors and draws boxes via `gameDrawPoint` / `gameDrawBox` with sub-pixel math (`* 16`).
- **Tasks:**
  - [ ] Import `tokens.lua` and replace legacy colors with canonical `#FF69B4` (Step) and `#FFCC00` (B-trigger).
  - [ ] Add dark backing rectangle `0xAA000000` behind all on-screen trigger script ID text.
  - [ ] Structure hotkeys / GUI checkboxes into matching categories: `Layers`, `Triggers`, `Objects`, `Collision`, `POI`.
  - [ ] Ensure point-of-interest (POI) coordinate annotations rendered by `soestuff.lua` match the exact pixel registration in Map Editor's POI overlay (`hide-poi`).

---

## 4. Verification & Continuous Synchronization

### 4.1 Automated Token Consistency Check
- **Status: 🟢 planned**
- Run `npm run check:overlay-tokens` to assert that all color codes, alpha levels, and feature flag names match across TS, CSS, C, and Lua files.

### 4.2 Visual Regression & Snapshot Smoke Tests
- **Status: 🟢 planned**
- Utilize headless Chromium (`feature-validation` skill) to capture snapshot images of a reference room (e.g. Room 0x00 Podunk or 0x33 Strong Heart) in:
  1. Map Editor webview with all overlays enabled.
  2. Plugin Emulator webview paused at room entry with all overlays enabled.
- Verify zero color drift, matching font metrics, and identical trigger/object box alignment.

### 4.3 Coordinate Normalization Verification
- **Status: 🟢 planned**
- Verify that live camera offset registers (`$7E:0E8E / $7E:0E90`) and room origin registers (`$7E:0F86 / $7E:0F88`) translate to the exact same screen pixel coordinates across Plugin Emulator, Recomp, and Lua as the static metatile grid in the Map Editor.

