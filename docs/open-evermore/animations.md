# Open Evermore: Animations & Metasprites Architecture

Status: **design & implementation in progress (2026-11-23)**. Back to [README.md](README.md); tracked under step S7 in [progress.md](progress.md).
Related engine documentation: [../entities/animation_script.md](../entities/animation_script.md), [../entities/animation_format.md](../entities/animation_format.md), and the `animation-script` skill.

---

## 1. The Three Layers (Bottom to Top)

The graphics and motion pipeline of Secret of Evermore operates across three distinct architectural layers:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Animations (Scripts & Facing Records)                                         │
│   • Groups in bank $C4 (1, 4, or 8 facings; 783 groups / 1,752 records)               │
│   • VM bytecode in banks $C7–$C9 (timing, hold, step, strike, palette, jumps)          │
│   • Linked to character slots (stand, walk, run, attacks, etc.) and global animate()   │
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
  * Blocks are indexed through `characters/sprite_blocks_16/<name>.png` and `characters/sprite_blocks_8/<name>.png`.

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
Stored as concise JSON under `characters/metasprites/<character>/<name>.json`:

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
Metasprites are organized into folders by primary owner:
* Single-owner frames: `characters/metasprites/<character>/` (e.g. `boy/`, `dog/`, `skelesnail/`).
* Multi-owner frames (shared poses/effects): `characters/metasprites/shared/`.
* Spells and alchemy visuals: `characters/metasprites/alchemy/`.
* UI / HUD icons: `characters/metasprites/icon/`.
* Miscellaneous or unassigned frames: `characters/metasprites/misc/`.

---

## 4. Layer 3: Animations (Playback & Scripting)

### 4.1 Facing Groups in `$C4`
* 783 groups across 1,752 records in `$C4:3E3A–$5999`.
* Flags indicate facing direction counts:
  * **8 facings**: Full omnidirectional walks, runs, and combat stances (N, NE, E, SE, S, SW, W, NW).
  * **4 facings**: Cardinal directions (N, E, S, W; diagonal movement reuses E/W scripts).
  * **1 facing**: Static or nondirectional effects (spells, projectile impacts, stationary objects).
* Each facing points to an entry point in an animation script.

### 4.2 Animation Scripts in `$C7–$C9`
Unlike simple GIF-like timelines, animations are tick-accurate scripts executed by an in-engine VM:
* `sprite <metasprite>`: Sets current metasprite frame.
* `hold <ticks>`: Sets frame display duration.
* `step <dist>`: Moves entity along its current facing vector.
* `strike`: Arms hitbox for 1 tick to evaluate melee damage.
* `palette <pal>`: Dynamically sets display palette (used by spells and flash effects).
* `sound <sfx>`: Triggers audio effects.
* `jump`, `dec_jnz`, `loop`: Control flow, loop counters, and state loops.
* `end_check!`: Retires one-shot animations upon landing/finishing.

### 4.3 Palette Resolution Hierarchy
Because not all animations define an inline palette opcode, palettes are resolved using the precedence logic modeled in `src/games/evermore/sprites/animation-catalog.ts`:
1. **Script Opcode `0x4B`**: Explicit palette embedded in script bytecode.
2. **Equipped Weapon**: Boy attack animations use the equipped weapon's palette slot (`+$04`).
3. **Dog Form**: Dog act animations use the current Dog form's palette (`$CF945F`).
4. **Character Record Primary**: Record offset `+$09`.
5. **Character Record Secondary**: Record offset `+$0B` (used for dual-palette entities like Harry and Vigor).
6. **Inferred Fallback**: Proximity and shared block analysis for orphaned or cutscene animations.

### 4.4 Linking Characters to Animations
In `characters/records/<character>/character.json`, animation slots replace raw `$C4:xxxx` pointers with symbolic names:
* Standard 12 slots: `stand`, `walk`, `run`, `attack_0`, `attack_1`, `attack_2`, `attack_3`, `knockback`, `death`, `death_with_drop`, `cast`, `dodge`.
* Weapons and Dog forms reference their animation groups by name.
* Event scripts call `animate(entity, mode, @animation_name)`.

---

## 5. Extensibility, Moving, and Imploding

1. **Lossless Round-Trip (G0)**:
   * Exploding all 4,904 metasprites extracts ~202 KB out of `_base/unexploded.bin` into structured JSON files.
   * `implode --strict` reassembles all chunks, bounds, and flags to yield the identical vanilla ROM SHA-1.
2. **Editing Metasprites**:
   * Authors can edit chunk positions, swap blocks, change priorities, or flip tiles.
   * New chunks can be added up to SNES OAM limits.
3. **Relocatability**:
   * *Phase 1 (In-Place)*: While animation scripts remain in `_base/`, metasprites stay at their original ROM home offsets (like `projectiles` and `menus`).
   * *Phase 2 (Relocatable)*: Once animation scripts are exploded into symbolic names (`sprite @frame_name`), metasprites can be relocated freely within banks `$CA–$D3`, and new metasprites can be created.
4. **Extending Animations**:
   * Authors can author new animation scripts combining existing or new metasprites.
   * New animation records can be placed into the pool freed by the relocated `animate()` ID table.
