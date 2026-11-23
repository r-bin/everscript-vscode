# Open Evermore: Animations & Metasprites Architecture

Status: **v0.464.0 layout implemented (2026-11-23)** for `palettes/`, `sprites/`, `animations/`, and cleaned-up `characters/`. Back to [README.md](README.md); tracked under S2c and S7a–S7d2a in [progress.md](progress.md).
Related engine documentation: [../entities/animation_script.md](../entities/animation_script.md), [../entities/animation_format.md](../entities/animation_format.md), and the `animation-script` skill.

---

## 1. The Three Layers (Bottom to Top)

The graphics and motion pipeline of Secret of Evermore operates across three distinct architectural layers:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Animations (Groups, animate() IDs & Facing Records)                              │
│   • Groups in bank $C4 (1, 4, or 8 facings; 783 groups / 1,752 records)               │
│   • VM bytecode in banks $C7–$C9 (timing, hold, step, strike, palette, jumps)          │
│   • Character slots reference groups directly; 212 global animate() IDs stay vanilla   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ plays
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ Layer 2: Metasprites / Sprite Frames                                                   │
│   • Composite poses in banks $CA–$D3 (4,904 discrete frames)                           │
│   • Assembly of 16×16 and 8×8 chunks with signed (x, y) offsets relative to origin     │
│   • Chunk flags: size (8 or 16), flipX, flipY, priority (0–3), palette slot (0 or 1)   │
│   • Viewport bounding box (x, y, w, h) for hardware frustum culling                   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ references
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ Layer 1: Tiles / Sprite Blocks (Pixels)                                                │
│   • 16×16 blocks: 4,854 entries at $EC:0000 (four 8×8 4bpp SNES tiles, 128 bytes)      │
│   • 8×8 blocks: 6,265 entries at $D8:0000 (one 8×8 4bpp SNES tile, 32 bytes)           │
│   • Stored as indexed 16-color grayscale PNGs (palette applied at runtime)             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1: Tiles (Sprite Blocks)

* **Hardware Nature**:
  SNES OBJ graphics are stored as 4bpp planar tiles. In Evermore, sprite graphics are catalogued in two master tables:
  * `sprite_blocks_16`: 4,854 16×16 blocks decompressed from `$D90000+` via table `$EC:0000`.
  * `sprite_blocks_8`: 6,265 8×8 blocks decompressed from `$D10000+` via table `$D8:0000`.
* **Storage Format**:
  Indexed PNG, 16 colors grayscale (palette slot 0 = transparent, slots 1–15 = gray gradients). Gray is used because color palettes are assigned at runtime by character/entity slots.
* **Grouping & Reusability**:
  * Blocks are global and shared. Palette-swapped characters (e.g. Boy & Bad Boy, Raptor & Red Raptor) share 100% of their blocks.
  * Idle frames, step frames, and attack poses of the same character reuse common head/torso blocks.
  * Blocks are indexed through `sprites/blocks_16/<name>.png` and `sprites/blocks_8/<name>.png`.

---

## 3. Layer 2: Metasprites (Stitched Together Tiles)

### 3.1 Naming: Why "Metasprite"?
In 2D game development and SNES romhacking, a single hardware tile is an OBJ tile (8×8 or 16×16). A composite frame made of multiple hardware tiles positioned with local offsets to form a character pose is universally called a **Metasprite** (or **Sprite Frame**). Calling this layer `metasprites` eliminates ambiguity between single tiles, poses, and animated objects.

### 3.2 ROM Structure (Banks `$CA–$D3`)
Every metasprite in ROM consists of:
1. `count` (1 byte): Number of chunks (0 = empty frame).
2. `first` (1 byte): Offset to first chunk (`first = 6` if `count >= 3`; `first = 2` if `count < 3`).
3. `bounds` (4 bytes, present only if `count >= 3`): `minX: s8, minY: s8, width: u8, height: u8`. Used by `$80:9033` (`direct_sprite_draw_oam`) for fast viewport culling before submitting chunks to OAM.
4. `chunks` (`count × 5` bytes):
   * `flags` (1 byte):
     * Bit 0: size (1 = 16×16, 0 = 8×8)
     * Bits 1–3: palette slot (0–7; 0 = primary entity palette, 1 = secondary like Harry/Vigor)
     * Bits 4–5: OAM priority (0–3; determines layering relative to backgrounds and other sprites)
     * Bit 6: `flipX` (mirrored horizontally)
     * Bit 7: `flipY` (mirrored vertically)
   * `x` (1 byte, signed 8-bit): X offset from entity origin (feet anchor).
   * `y` (1 byte, signed 8-bit): Y offset from entity origin.
   * `block` (2 bytes, little-endian): Index into the 16×16 or 8×8 block table.

### 3.3 Open Evermore File Format: `open-evermore/metasprite`
Stored as concise JSON under `sprites/metasprites/<owner>/frame_<addr>.json`:

```jsonc
{
  "format": "open-evermore/metasprite",
  "version": 1,
  "bounds": { "x": -16, "y": -32, "w": 32, "h": 32 },
  "chunks": [
    {
      "block": "block_014a",
      "size": 16,
      "x": -8,
      "y": -28,
      "priority": 2,
      "flip_x": false,
      "flip_y": false,
      "palette": 0
    },
    {
      "block": "block_008c",
      "size": 8,
      "x": 8,
      "y": -12,
      "priority": 2
    }
  ]
}
```

* **Chunk Draw Order**: The order of objects in the `chunks` array matches the hardware submission order (lower OAM index renders on top when priorities are equal).
* **Automatic Bounds**: If `bounds` is omitted or `null`, the encoder automatically computes the tight bounding box from the chunk extents.
* **Clean Defaults**: `flip_x`, `flip_y`, and `palette` default to `false` / `0` and can be omitted when unused.

### 3.4 Grouping & Attribution
Metasprites are organized by owner attributed through `animation_groups`:
* Single-owner frames: `sprites/metasprites/<owner>/` (e.g. `boy/`, `dog/`, `skelesnail/`).
* Multi-owner frames (shared poses/effects): `sprites/metasprites/shared/`.
* Spells and alchemy visuals: `sprites/metasprites/alchemy/`.
* UI / HUD icons & projectiles: `sprites/metasprites/icon/`, `sprites/metasprites/projectile/`.
* Unreferenced or script-only effect frames: `sprites/metasprites/effect/`, `sprites/metasprites/misc/`.

---

## 4. Layer 3: Animations & Top-Level Shared Palettes

### 4.1 Facing Groups in `$C4` (`animations/groups/`)
* All **783 groups / 1,752 four-byte records** in `$C4:3E3A–$5999` live at `animations/groups/<owner>/<name>.json` (`open-evermore/animation-group`):
  * `"facing_mode"`: `"any"` (1 record, flags `$00`), `"4_way"` (4 records, flags `$40`, indexed via `$90:815B` as `north`, `east`, `south`, `west`), or `"8_way"` (8 records, flags `$80`: `north`, `northeast`, `east`, `southeast`, `south`, `southwest`, `west`, `northwest`).
  * `"facings"`: compass direction → 24-bit script start address `"$C7:xxxx"`–`"$C9:xxxx"`.
  * `"palettes"` and `"used_by"`: derived programmatic attribution (ignored by implode).
* Vanilla groups stay pinned at their `$C4` home offsets (61 code immediates name record offsets). Adding a brand-new group marks `animations/_table` to vacate `$C4:3C92–$3E39`, opening 424 bytes inside bank `$C4` (26 four-facing groups).

### 4.2 `animate()` IDs (`animations/animate_ids/`) and Modes (`animations/modes/`)
* `animations/animate_ids/<character>/<name>.json` (`open-evermore/animate-id`) keeps vanilla's **212** global `animate()` IDs (growing up to 2,048). Each entry names `"animation"` in `animation_groups/` plus optional `"facing"` (e.g. id 24 targeting slot `west` of its group).
* `animations/modes/<mode>.json`: the six `$8C:E100` mode handlers (`once`, `once_freeze`, `loop`, `freeze`, `clear_script_pointers`, `pause`).
* Animation scripts in `$C7–$C9` remain in `_base/` until exploded symbolically. Note: opcode `0x54` (`jump_if_linked`) is never taken in vanilla (`mode & $0040` is unset) and carries the `$C7:0075` helper offset verbatim in `$C8`/`$C9` (`$C8:0075` lands mid-instruction → `$C8:8002` music data), so static walkers must not follow `0x54` targets.

### 4.3 Top-Level Shared Palettes (`palettes/`)
Because sprite palettes are shared across characters, weapons, Dog forms, projectiles, HUD portraits, ring icons, and animation opcode `0x4B`, palettes live at the top level:
* `palettes/backgrounds/` (365 map tile families at `$9C:C322`, JSON or PNG stripe via `--palettes png`).
* `palettes/sprites/` (269 sprite/icon palettes in bank `$90`/`$D0` at `$90:A7EB–$C98A`, 32 bytes each, JSON with derived `used_by` or PNG stripe via `--palettes png`).

`animation-groups.mts` derives group palettes programmatically from:
1. **Script Opcode `0x4B`**: Explicit palette embedded in script bytecode.
2. **Weapon / Ammo Records**: Equipped weapon or Bazooka ammo slot `+$04` (Boy).
3. **Dog Forms**: Dog form header `+$06` (`$CF:945F`).
4. **Character Records**: Primary `+$09` and (when metasprite chunks use OAM palette 1) secondary `+$0B`.
5. **Ring Items & Projectiles**: Icon palette (`+$04`), projectile palette (`+$02`), or thrower fallback.
6. **Inferred Fallback**: `animate()` targets (`CHAR`), shared metasprite votes, and nearest-character record proximity.

### 4.4 Linking Characters, Equipment, Projectiles & Ring Items
* `characters/records/<name>.json` stores each 74-byte character record as one file (redundant `animations.json` dumps removed): `palette`/`palette2` reference `palettes/sprites/` and the 12 `animations` slots (`stand`..`dodge`) reference `animations/groups/`.
* `equipment/weapons/`, `equipment/bazooka_ammo/`, `characters/projectiles/`, and `menus/ring_items/` likewise reference `sprite_palettes` and `animation_groups` by name instead of raw `$90`/`$D0`/`$C4` hex pointers.
* Event scripts call `animate(entity, mode, @animation_name)`.

---

## 5. Extensibility, Moving, and Imploding

1. **Lossless Round-Trip (G0)**:
   * `implode --strict` reassembles palettes, sprite blocks, metasprites, animation groups, animate IDs, characters, equipment, projectiles, and ring items to the identical vanilla ROM SHA-1.
2. **Editing & Adding**:
   * Authors can edit character palettes, swap animation group slots across `boy/`, `dog/`, or enemies, add brand-new `animation_groups/` entries (automatically vacating `$C4:3C92` into the upper banks), or extend `animations/animate_ids/` up to 2,048 entries.
3. **Relocatability**:
   * *Phase 1 (In-Place)*: While animation scripts remain in `_base/`, vanilla `animation_groups` and `metasprites` stay pinned to their ROM offsets.
   * *Phase 2 (Relocatable)*: Once animation scripts in `$C7–$C9` are exploded into symbolic names, metasprites can relocate freely across banks `$CA–$D3` and new animation scripts can generate metasprites.
