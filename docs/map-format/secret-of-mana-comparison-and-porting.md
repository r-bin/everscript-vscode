# Secret of Mana vs. Secret of Evermore: Map Architecture & Porting Guide

This document explains the internal architecture of **Secret of Mana (SoM)** maps, compares it with **Secret of Evermore (SoE)**, and provides an end-to-end technical assessment of **porting maps from Secret of Mana to Secret of Evermore**.

---

## References & Authoritative Sources

The technical specifications in this document are derived from reverse-engineering sources, disassembly notes, and randomizer implementations:

1. **Moppleton / Secret of Mana Randomizer**:
   - [`SomMapCompressor.cs`](https://github.com/Moppu/SecretOfManaRandomizer/blob/main/SoMRandomizer/processing/common/SomMapCompressor.cs): Full C# implementation of Mana's 2D spatial map decompressor and compressor.
   - [`VanillaMapUtil.cs`](https://github.com/Moppu/SecretOfManaRandomizer/blob/main/SoMRandomizer/processing/common/VanillaMapUtil.cs): Loading and manipulating composite maps, piece references (`0xFE`/`0xFF`), objects, headers, and raster triggers.
   - [`SomVanillaValues.cs`](https://github.com/Moppu/SecretOfManaRandomizer/blob/main/SoMRandomizer/processing/common/SomVanillaValues.cs): Constants for all 436 composite maps, boss object IDs, Mode 7 / Layer 2 rendering requirements, and door replacement indices.
2. **Enker's Secret of Mana ROM & Memory Disassembly**:
   - [`som-banks.txt`](http://www.darkwoodinc.com/~enker/misc/som-banks.txt): ROM bank-by-bank layout (Banks `$00` through `$1F`).
   - [`som-memmap.txt`](http://www.darkwoodinc.com/~enker/misc/som-memmap.txt): Zero-page, WRAM (`$7E/$7F`), OAM, CGRAM, and Ring Menu memory map.
   - [`banks.php`](http://www.darkwoodinc.com/~enker/banks.php) / [`somB.txt`](http://www.darkwoodinc.com/~enker/banks/somB.txt) / [`som2.txt`](http://www.darkwoodinc.com/~enker/banks/som2.txt): Bank `$0B` collision tables and Bank `$02` decompressors / boss AI.
3. **smkerz Secret of Mana Tools**:
   - [`smkerz/secret-of-mana-hacking`](https://github.com/smkerz/secret-of-mana-hacking): Excel/VBA tools for room decompression/compression (`RoomCompress.bas`), tileset extraction, and palette extraction.
4. **Standalone Desktop Editor**:
   - **SoM Editor Beta 1.24** (`SoM Editor Beta 1.24.exe`): Reverse-engineered Qt 6/C++ binary exposing `TabMap`, `TabTileset16`, `TabTileset8`, `TabCollision`, `TabDoor`, `TabEvent`, and Mode 7 Flammie tools.
5. **Secret of Evermore Specification**:
   - Verified room decoder and encoder in `everscript-vscode` ([`docs/map-format/room-reference.md`](room-reference.md), [`map_encoding.md`](map_encoding.md), [`map_collision_mechanics.md`](map_collision_mechanics.md)).

---

## 1. How Secret of Mana Maps Work

In Secret of Mana, what the player perceives as a "room" or "map" is an assembled composite structure with distinct layers, reusable chunks, raster-scanned trigger tables, and bank-swapped tileset definitions.

```
                  SECRET OF MANA MAP PIPELINE

   Bank $0B / $0C                 Banks $0C, $0D, $0E, $0F
┌──────────────────┐            ┌───────────────────────────┐
│  Tileset8 (8×8)  │            │ Compressed Map Pieces     │
└────────┬─────────┘            │ (2D Chunks, 4 Banks)      │
         │ 4 Subtiles           └─────────────┬─────────────┘
         ▼                                    │
┌──────────────────┐                          │ Placed by 0xFE (BG)
│ Tileset16 (16×16)│                          │ and 0xFF (FG) streams
└────────┬─────────┘                          │ with Event Visibility Flags
         │                                    ▼
         │                      ┌───────────────────────────┐
         └─────────────────────►│ Composite Map (Layer 1&2) │
                                └─────────────┬─────────────┘
   Bank $0B Table (256 entries)               │
┌──────────────────────────────┐              │
│ 4-Byte Collision Segments    │◄─────────────┤ Raster-Scan Trigger Check
│ (Solid, Stairs, Switch)      │              │ (Top-to-Bottom, Left-to-Right)
└──────────────────────────────┘              ▼
                                ┌───────────────────────────┐
                                │ Trigger & Door Lists      │
                                │ (Events 0..7FF, Doors 800)│
                                └───────────────────────────┘
```

### 1.1 Composite Map Architecture (Pieces & Placement Streams)

Unlike games with a static matrix per area, Secret of Mana builds full maps out of **Map Pieces** (reusable compressed chunks stored across ROM Banks `$0C`, `$0D`, `$0E`, and `$0F`):
- Pointers to map piece chunk lists for each composite map live in Bank `$08` (`$85000` / `$85468`).
- A composite map is assembled via two byte streams:
  - **`0xFE`**: Marker for Background (Layer 1/2 terrain) pieces.
  - **`0xFF`**: Marker for Foreground (overhead/canopy) pieces.
- Each piece is referenced by a **5-byte placement record**:
  ```
  Byte 0: eventVisibilityFlagId      (Event flag governing visibility)
  Byte 1: [low_val:4 | high_val:4]   (Event flag valid value range)
  Byte 2: pieceIndex LSB             (Low 8 bits of chunk ID)
  Byte 3: (xPos << 1) | bit_0x100    (X coordinate on map, bit 0 = chunk ID bit 8)
  Byte 4: (yPos << 1) | bit_0x200    (Y coordinate on map, bit 0 = chunk ID bit 9)
  ```
- **Dynamic Chunking**: The engine hides or reveals entire chunks based on story event flags. For example, a destroyed village, a drained palace, or an opened bridge does not require reloading a different map; the engine evaluates the piece's event flag range during composite assembly.

### 1.2 Tileset Hierarchy (Tileset8 to Tileset16)

Secret of Mana enforces a strict two-tier metatile hierarchy:
1. **Tileset8**: 8×8 character cells stored in ROM graphic banks.
2. **Tileset16**: 16×16 metatiles constructed from **four 8×8 subtiles**.
   - Construction tables live in Bank `$0B` (`$CB:4000` pointers, `$CB:4080` assembly data).
   - Each of the 4 subtiles has its own:
     - 8×8 Tile Index
     - Palette Index (`0..7`)
     - Flip X bit
     - Flip Y bit
     - Priority bit (Mode 1 tile priority)

### 1.3 Map Headers, Objects & Boss Rendering Modes

As documented in `SomVanillaValues.cs` and `VanillaMapUtil.cs`:
- The pointer table at `0x87000` (`MAP_OBJECT_OFFSETS`) points to an object list for each composite map.
- The **first 8 bytes** of the list form the **Map Header**:
  - `tileset16`: Which 16×16 tileset definition to load.
  - Palettes: Background and entity palette assignments.
  - Music track ID.
  - Flammie flight permission flag.
- The remaining 8-byte entries define entity spawns and interactive objects.
- **Rendering Modes**:
  - Most bosses and maps run on standard Mode 1 compositing.
  - Specific bosses require **dedicated Layer 2 rendering maps**: Wall Face (`88`), Doom's Wall (`97`), Watermelon (`110`), Snow Dragon (`115`), Red Dragon (`117`), Blue Dragon (`119`), Dark Lich (`121`).
  - Specific bosses run in **Mode 7**: Lime Slime (`106`), Dread Slime (`124`), Mana Beast (`127`).

### 1.4 The 2D Spatial Map Compression Algorithm (`SomMapCompressor.cs`)

Secret of Mana uses a specialized 2D spatial run-length and sliding-window compression format for its map chunks:

```
                      SOM 2D COMPRESSION OPCODES

   Byte Range         Operation
   ──────────────────────────────────────────────────────────────────────────
   0x00 .. 0xBF       Literal uncompressed metatile byte.
   0xC0 .. 0xC7       Repeat 1..8 times: previous decoded byte (decomp - 1).
   0xC8 .. 0xCF       Repeat 1..8 times: 2nd previous decoded byte (decomp - 2).
   0xD0 .. 0xD7       Repeat 1..8 times: 3rd previous decoded byte (decomp - 3).
   0xD8 .. 0xDF       Repeat 1..8 times: 4th previous decoded byte (decomp - 4).
   0xE0 + param m     Copy from row above:
                      - if m < 0x80: repeat (m+1) times copying (decomp - width).
                      - if m >= 0x80: repeat (m%0x80 + 1) times copying (decomp - 2*width).
   0xE1 .. 0xE7       Repeat 2..8 times: copy tile from row above (decomp - width).
   0xE8 .. 0xEF + m   Pattern repeat from sliding buffer of previous 16 bytes.
   0xF0 + param m     Sequential arithmetic run of length (m%0x80 + 1):
                      - if m < 0x80: tile index increment (+1 per step).
                      - if m >= 0x80: tile index decrement (-1 per step).
   0xF1 .. 0xF7       Repeat 1..7 times: sequential tile increment (+1).
   0xF8 .. 0xFF       Repeat 1..8 times: sequential tile decrement (-1).
```

This algorithm exploits 2D tilemap characteristics:
1. **Horizontal runs**: Repeated ground tiles (`0xC0..0xDF`).
2. **Vertical 2D coherence**: Repeating vertical walls or tree canopies by looking back exactly one or two full row strides (`0xE0..0xE7`).
3. **Sequential tile structures**: Metatiles that form borders or roads numbered contiguously in ROM (`0xF0..0xFF`).

### 1.5 Collision Model (Bank $0B 4-Byte Segments)

Mana does not store collision geometry per grid cell on the map. Instead, collision is tied to the **16×16 metatile**:
- Bank `$0B` contains a master array of **256 4-byte collision structs** at `$CB:0000` (loaded into WRAM at `$7FB800`).
- At `$CB:0400`, each 16×16 tile in the tileset is assigned a single byte indexing one of these 256 collision entries.
- The 4-byte segment defines:
  - Movement passability (solid vs walkable edges)
  - Interactive switches (e.g. wall buttons, floor pressure plates)
  - Return / stairs (`collision 0x16`)
  - Trigger designations

### 1.6 Triggers and the Door Table

In Mana, triggers are evaluated through a combination of **collision scanning** and a central **Door Table**:
- **Raster-Order Triggers**: The engine scans tiles across the composite map from left to right, top to bottom. When it encounters a tile whose collision marks it as a trigger, it consumes the next 16-bit word from the map's trigger table:
  - Values `0x000..0x7FF`: Event Script ID
  - Values `0x800+`: Door ID (where `0x800` = Door `0x000`)
- **Global Door Table (`TabDoor`)**: 1,024 entries (`0x000..0x3FF`) stored at `$C83000`. Each record specifies:
  - Destination composite map ID
  - Target landing coordinates $(X, Y)$
  - Arrival layer (`Land on layer 2 when checked / Y Raw odd`)
  - Door animation flag (`X Raw bit 7`)
- **Door Replacement Rules**: In boss arenas, exit door tiles are dynamically overwritten with floor tiles (e.g. in `replacementDoorTileIndexes` in `VanillaMapUtil.cs`) to prevent escaping during combat.

---

## 2. Comparison: Secret of Mana vs. Secret of Evermore

While both games share the Square SNES engine lineage, Brian Fehdrau and Square USA substantially overhauled the map and script subsystem for *Secret of Evermore*.

| Feature | Secret of Mana (SoM) | Secret of Evermore (SoE) | Why the Difference Matters |
| :--- | :--- | :--- | :--- |
| **Map Storage Unit** | **Composite Maps** formed by assembling reusable chunks (*Map Pieces*) from Banks `$0C..$0F`. | **127 Monolithic Room Blobs** (`0x00..0x7E`) with fixed $W \times H$ matrices. | SoE maps cannot dynamically swap chunks; SoE uses separate rooms or Section 3 map objects instead. |
| **Metatile Packaging** | Independent Layer 1 and Layer 2 16×16 tile arrays. | **Stamp Dictionary** (`{layer1: canopy, layer2: terrain, collision}`). | In SoE, canopy, terrain, and collision are bound into an atomic 8-byte entry in a 32 KB WRAM window. |
| **Compression Pipeline** | Single-stage 2D spatial opcode compressor (`SomMapCompressor.cs`) with row-above lookbacks. | Two-stage pipeline across 3 blocks: Markov model byte predictor + LZSS bitflag compression. | Evermore's compression is general-purpose data compression, while Mana's is tailored to 2D grid geometry. |
| **VRAM Tile Budgets** | Bank-switched tileset pointers for 8×8 and 16×16 data. | **Strict 7 Tile-Family Limit** per room (slot 0 reserved for HUD). | SoE limits rooms to 7 palette families; adopting an 8th family requires sacrificing an existing one. |
| **Collision Representation** | 1-byte collision index per 16×16 tile referencing Bank `$0B` (256 4-byte structs). | **16-bit Bitfield Word per Stamp**: 4 elevation planes, transparency, drift, entity gates, 16 slopes. | SoE decouples collision from graphics: identical tiles can have different elevations, passabilities, or conveyor speeds. |
| **Trigger Mechanism** | Raster scan of collision tiles matching entries in a trigger list + Door Table (`$C83000`). | Explicit 6-byte **Bounding Boxes** in room header: `(y_min, x_min, y_max, x_max, script_id)`. | SoE triggers do not depend on tile placement; they are spatial rectangles evaluated against player coordinates. |
| **Interactive Objects** | Tile replacement tables (e.g. boss door tiles) and event chunk swapping. | **Section 3 Map Objects**: cuttable grass (`$90A6EF`), bushes, rocks, pots, gourds. | Evermore has a dedicated engine loop for foliage chopping, drop tables, and destructible geometry. |
| **World Map Flight** | **Mode 7 3D Overworld** with Flammie landing/takeoff coordinates. | **2D Segmented Overworld** (Windwalker flight uses standard Mode 1 compositing). | Evermore contains no Mode 7 world map rendering engine or flight matrix math. |
| **Script VM** | Bytecode event scripts (`Banks $09, $0A`), opcodes for subroutines, flags, cannon travel. | **Everscript VM** (`Banks $8F, $90`): stack-based VM with local variables, math expressions, and 200+ opcodes. | Evermore script logic is significantly more expressive, handling physics, cutscenes, and entity AI directly. |

---

## 3. Can Mana Maps Be Ported to Evermore?

**Yes.** Porting maps from Secret of Mana to Secret of Evermore is technically and mathematically feasible. Because Evermore’s rendering engine uses SNES Mode 1 (BG1 terrain, BG2 canopy, BG3 HUD) like Mana, Mana’s visual artwork and layout can be converted into Evermore’s room format.

However, because the two engines store maps differently, conversion requires an automated pipeline to bridge the architectural gaps.

```
                 MANA TO EVERMORE PORTING PIPELINE

   1. Composite Flattening       2. Stamp Generation         3. Palette Clustering
┌───────────────────────────┐  ┌───────────────────────┐  ┌────────────────────────┐
│ Assemble Map Pieces (FE)  │  │ Pair Layer 2 (Terrain)│  │ Decompose to 8×8 CHRs  │
│ into unified (W × H) grid │─►│ with Layer 1 (Canopy) │─►│ Cluster into ≤ 7       │
└───────────────────────────┘  │ and collision byte    │  │ Evermore Tile Families │
                               └───────────────────────┘  └───────────┬────────────┘
                                                                      │
   6. ROM Blob Packaging         5. Triggers & Doors         4. Collision Word
┌───────────────────────────┐  ┌───────────────────────┐  ┌───────────▼────────────┐
│ Block 1: CHR Slot Indices │  │ Merge adjacent raster │  │ Map Bank $0B structs   │
│ Block 2: Stamp Dictionary │◄─│ trigger tiles into    │◄─│ to 16-bit Bitfields    │
│ Block 3: Grid + Triggers  │  │ 6-byte Bounding Boxes │  │ (Planes, AW, Geometry) │
└───────────────────────────┘  └───────────────────────┘  └────────────────────────┘
```

---

## 4. Step-by-Step Porting Pipeline

### Step 1: Composite Flattening
1. Select the base state of the Mana map (evaluate the initial event flag condition).
2. Read the composite map's piece placement table (from `$85000` / `$85468`).
3. Decompress each background piece (`0xFE` stream) and foreground piece (`0xFF` stream) via `SomMapCompressor.DecodeMap()`.
4. Paint them into a unified 2D grid of size $W \times H$ (in 16×16 metatiles).

### Step 2: Tile De-duplication and Stamp Generation
1. For every coordinate $(X, Y)$ on the flattened map:
   - Extract the Layer 2 metatile (Terrain).
   - Extract the Layer 1 metatile (Canopy / Overhead, or empty `$A800` if none).
   - Extract the tile's collision byte from Bank `$0B`.
2. Group identical `{layer1, layer2, collision}` combinations into a unique **Stamp Dictionary**.
3. *Budget Check*: Ensure the number of unique stamps plus the grid size fits within Evermore’s **32,768-byte WRAM buffer** (`grid_w * grid_h * 2 + stamp_count * 8 <= 32768`). Most Mana rooms easily fit within this window.

### Step 3: Palette Clustering & The 7 Tile-Family Budget (The Major Bottleneck)
* **The Constraint**: Evermore rooms allow a maximum of **7 Tile Families** (slot 0 is reserved for the HUD). Each family is a 16-color palette paired with graphic CHRs loaded into VRAM. Furthermore, Block 1 allows at most **264 CHR graphic slots**.
* **The Conversion**:
  1. Decompose Mana’s 16×16 tiles into four 8×8 tiles.
  2. Extract the palettes used across the map (Mana typically uses 4 BG palettes for area tiles).
  3. Form Evermore Tile Families by grouping CHR tiles sharing the same 16-color palette.
  4. If a Mana composite map uses more than 7 palette configurations or more than 264 distinct 8×8 tiles:
     - Merge redundant 8×8 tiles (e.g. blank or solid color tiles).
     - Cluster near-identical palette entries using RGB distance minimization.

### Step 4: Collision Translation
Translate Mana’s Bank `$0B` 4-byte collision structs into Evermore’s **16-bit collision words**:

| Mana Collision Type | Evermore Collision Word (`AW | Gate | PT | Plane | Geometry`) | Value |
| :--- | :--- | :--- |
| **Walkable ground** (`0x00`) | Plane 0, all-walkable geometry | `$0000` |
| **Solid wall / barrier** (`0x04`) | Plane 0, solid block geometry | `$0001` |
| **Water currents / chutes** | Set `AW` (bit 13) + drift direction low nibble | `$200x` |
| **Stairs / Elevation ramps** | Transition ramp geometry between Plane 0 and Plane 1 | `$001x` |
| **Overhead bridges / canopy** | Plane 1 walkable (`bits 4..5 = 1`) | `$0010` |
| **Sloped hill / ledge** | Sub-tile slope geometry (`0x02`..`0x0F`) | `$0002`..`$000F` |

### Step 5: Triggers and Door Conversion
1. **Raster to Bounding Box**:
   - Locate all trigger collision tiles on the Mana map.
   - Group contiguous trigger tiles into rectangular bounding boxes $(y_{min}, x_{min}, y_{max}, x_{max})$.
   - Generate Evermore **Step-on Trigger** records (6 bytes each: `$1064`).
2. **Door Table to Everscript**:
   - For each door entry referenced by Mana's trigger table (`0x800 + door_id`), look up the destination in Mana's Door Table (`$C83000`).
   - Emit an Everscript function in `.evs`:
     ```everscript
     // Auto-generated door transition from Mana Door #0x12
     fun trigger_door_12() {
         transition(MAP_DESTINATION, DEST_X, DEST_Y, DIRECTION_DOWN);
     }
     ```

### Step 6: Interactive Objects & Foliage
- Map Mana’s cuttable bushes and grass tiles to Evermore **Section 3 map objects**:
  - Assign cuttable metatiles to Evermore's `$90A6EF` grass-cut swap table.
  - Convert Mana treasure chests into Evermore chest/gourd object records with appropriate alchemy ingredient or item drops.

### Step 7: Packaging & Encoding
Feed the converted room structures into the Evermore room encoder (`src/maps/map-packer.ts` / `tools/encode_room.py`):
1. Encode Block 1: CHR tile slot indices.
2. Encode Block 2: Stamp dictionary (Canopy word, Terrain word, Collision word).
3. Encode Block 3: Grid matrix and Section 3 object definitions.
4. Compress via Markov model + LZSS bitflag compression.
5. Write the 13-byte room header (`origin_x`, `origin_y`, `width_tiles`, `height_tiles`, PPU flags).

---

## 5. Hard Roadblocks & Where Automation Needs Human Intervention

While visual geometry, collision, and basic transitions can be converted 100% automatically, certain game-specific mechanics require human design:

1. **Dynamic Chunk Swapping**:
   - Mana swaps pieces on the fly using event flags (e.g. before and after a boss destroys a room).
   - In Evermore, this cannot be done within a single room blob. You must export **two separate Evermore room IDs** and trigger a room transition script when the story flag flips.
2. **Mode 7 World Map & Mode 7 Bosses**:
   - Mana's overworld and Mode 7 boss arenas (Lime Slime `106`, Dread Slime `124`, Mana Beast `127`) cannot be imported as an Evermore room blob. Overworld areas would need to be divided into segmented 2D region maps.
3. **Multi-layer Bridge Traversal**:
   - Mana handles bridges through separate layer rendering or return collision codes (`0x16`).
   - In Evermore, multi-level bridges should be manually verified using Evermore's **Elevation Plane system** (Plane 0 under the bridge, Plane 1 over the bridge, with plane-swap ramps at the entrances).
4. **NPC & Enemy AI**:
   - Mana’s 3-party character tables and enemy AI routines (Banks `$01`, `$02`, `$10`) do not map directly to Evermore. Enemies must be re-pointed to Evermore sprite records, collision boxes, and damage formulas.

---

## 6. Summary

Porting Secret of Mana maps into Secret of Evermore is an achievable project:
- **Visuals & Layout**: Translates cleanly by flattening composite pieces into a 2D metatile grid.
- **Graphic Assets**: Fits within Evermore's Mode 1 compositing, provided the tiles are clustered into **7 Tile Families** and under **264 CHR slots**.
- **Collision**: Translates directly into Evermore's 16-bit collision bitfield words.
- **Scripting & Warps**: Mana's Door Table and raster triggers can be compiled directly into high-level **Everscript (`.evs`)** transition scripts.
