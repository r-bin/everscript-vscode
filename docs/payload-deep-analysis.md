# Map Payload Deep Analysis: Strong Heart's Exterior

## The Complete Picture

### What Is A Map Payload?

A **map payload** is the binary blob stored in the ROM for each map that contains:
1. **Tile Family References** - pointers to graphics data (CHR-VRAM addresses)
2. **Compressed Bitstream** - variable-length encoded data (optional on some maps)
3. **Tilemap Data** - the 2D grid of tile indices
4. **Metadata** - region markers, layer divisions, optional structures

---

## Strong Heart's Exterior (Map 0x33): Complete Breakdown

This is a **20×16 tile map** - a mid-sized exterior location with multiple visual layers.

### 1. TILE FAMILIES (13 bytes total)

```
Count: 6 families
  Family 0: 0x00B9 ← CHR address for jungle grass
  Family 1: 0x00BA ← CHR address for jungle vines/walls
  Family 2: 0x0020 ← CHR address for cave floor
  Family 3: 0x0091 ← CHR address for stone
  Family 4: 0x0090 ← CHR address for stone variation
  Family 5: 0x0092 ← CHR address for stone variation 2
```

**What this means**: The ROM contains 6 sets of 16×16 pixel graphics somewhere else in memory. These addresses point to where the tile graphics are loaded. Each tile **index** (0-5) in the tilemap below refers back to one of these families.

### 2. COMPRESSED SECTION (164 bytes) 

```
Bytes: 00 a4 00 03 c2 00 80 40 30 50 2a 2c 06 03 00 00 ...
```

**This is a bitstream-compressed data structure.** We know:
- It's **NOT** 3-byte RLE records (tried and failed)
- It's **NOT** plain opcodes (too high entropy)
- It's **likely** a compressed encoding of something that unpacks to ~160+ bytes

**Candidates for what it encodes:**
- **Layer flags**: Which tiles belong to which visual layer
- **Animation data**: Frame counts, timing
- **Collision properties**: Walkability, damage, etc.
- **Tile placement deltas**: Alternate tile arrangements for specific conditions

**Current status**: FORMAT UNKNOWN - needs SoETilesViewer source analysis

### 3. SENTINEL MARKER (7 bytes)

```
Bytes: 30 00 00 00 01 00 FF
```

**Purpose**: Hard boundary between variable-length compressed data and fixed-structure data.

**Variants**:
- `30 00 00 00 01 00 FF` ← Map 0x33 (Strong Heart's Exterior)
- `C8 00 00 00 01 00 FF` ← Map 0x51 (Village Huts)

The leading byte (0x30 vs 0xC8) might indicate:
- Different compression types
- Layer count
- Feature flags
- Unresolved mystery

### 4. POSITION TABLE (1 byte)

```
Count: 0 entries
```

**This map has ZERO position entries.** Maps with more complex layouts have many:
- Map 0x33: 0 entries (simple)
- Map 0x01 (Blimp's Hut): 12 entries
- Map 0x51 (Village Huts): 25 entries

**Hypothesis**: Position table encodes:
- **Byte offsets into tilemap** for seeking to regions
- **Cache boundaries** for efficient rendering
- **Row markers** for multi-row chunks
- **Layer boundaries** for separating visual layers

### 5. TILEMAP DATA (160 bytes, nibble-packed)

```
Total tiles: 20 columns × 16 rows = 320 tiles
Format: 2 tiles per byte (4 bits each)
```

**Raw bytes (first 32):**
```
B5 00 07 80 02 33 88 88 88 88 99 9D 05 20 FF A6
43 40 E6 66 66 66 66 81 68 52 41 12 19 99 99 99
```

**Decoded nibbles (rows 0-3):**
```
Row 0:  5 B | 0 0 | 7 0 | 0 8 | 2 0 | 3 3 | 8 8 | 8 8 | 8 8 | 8 8
Row 1:  9 9 | D 9 | 5 0 | 0 2 | F F | 6 A | 3 4 | 0 4 | 6 E | 6 6
Row 2:  6 6 | 6 6 | 6 6 | 1 8 | 8 6 | 2 5 | 1 4 | 2 1 | 9 1 | 9 9
Row 3:  9 9 | 9 9 | 9 9 | 9 9 | E A | 0 0 | 6 6 | 6 6 | 6 6 | 6 6
```

**THE MYSTERY**: Nibbles range from 0-F (0-15), but there are only 6 tile families (0-5). This means:
- **Option 1**: High nibbles encode layer/property information
- **Option 2**: Nibbles reference a 16-entry composite palette (not just 6 families)
- **Option 3**: The low 2-3 bits select family, high bits encode flags

---

## Comparing with Visual Layers (Mesen Screenshots)

Looking at the Mesen tilemap viewer showing Layers 1-4, each layer has distinct visual elements. The question is: **where is this layer information encoded?**

### Possibility 1: Multi-Nibble Encoding
Each nibble could be decomposed as:
```
Nibble = [Layer (2 bits)] [Family Index (3 bits)]
Example: 0x5 = Layer 0, Family 5
Example: 0xA (1010b) = Layer 2, Family 2
```

This would explain why we see values 0-F with only 6 families.

### Possibility 2: The Unidentified 516 Bytes Are Additional Layers
After the main tilemap (160 bytes), there are 516 bytes of data. This could be:
- **Layer 2**: Another 162-byte tilemap (with own families/sentinel)
- **Layer 3**: Another tilemap
- **Collision grid**: 160 bytes for 20×16 walkability
- **Animation data**: Frame sequences
- **Object spawn table**: Creature/item placement

### Possibility 3: Compressed Section Unpacks to Layer Data
The 164-byte compressed section might decompress to the additional layer tilemaps or collision data.

---

## Strong Heart's Hut (Map 0x34): Simplified Structure

This is an **18×18 interior map** with visible objects.

### Key Differences from Map 0x33:

1. **NO COMPRESSED SECTION** - jumps directly to position table
   - Suggests compression is optional
   - Simple interiors may not need it

2. **7 TILE FAMILIES** - matches the 7 distinct wall/floor types visible

3. **SIGNIFICANT EXTRA DATA**: 809 bytes after tilemap
   - B-trigger table lists 18 interactive regions
   - These 809 bytes likely encode:
     - Object positions and types
     - NPC spawn points
     - Collision boundaries for interiors
     - Dialog/interaction data

4. **TILEMAP SHOWS 0-F VALUES AGAIN**
   - Despite only 7 families (0-6)
   - Must encode layer/property data in nibble

---

## Decoding the 4 Test Maps: ROM Address Trace

From `maps2.txt`:

```
Map 0x38 (South Jungle)     → 0x9E8000
Map 0x33 (Strong Heart Ext) → 0xADB50C ✓ Analyzed
Map 0x34 (Strong Heart Hut) → 0xADBD79 ✓ Analyzed
Map 0x5C (Raptors)          → 0xA8F590
```

**SNES to ROM conversion**: `ROM = ((SNES_BANK & 0x3F) << 16) | SNES_OFFSET`

All four maps should follow the same structure:
1. 13-byte header
2. Step-on table (variable count)
3. B-trigger table (variable count)
4. Payload (families + optional compressed + optional sentinel + optional position + tilemap + extra)

---

## What Each Part Means In Practice

### For The Map Editor
- **Tile Families**: Load graphics from ROM and display as tileset palette
- **Tilemap**: Edit the grid, save modified nibbles back to ROM
- **Position Table**: Preserve region markers when editing
- **Compressed Section**: Preserve as binary blob (don't decode yet)
- **Extra 516/809 bytes**: Don't lose when saving - might contain layer/collision data

### For Visual Rendering
- **Tile Families**: Load CHR graphics
- **Tilemap**: Use nibbles as indices
- **Compressed Section**: Might indicate layer membership or animation
- **Position Table**: Might optimize rendering (only draw certain regions)
- **Layers 1-4**: Must be encoded somewhere in the payload

### For Gameplay
- **B-Trigger Table**: Objects that trigger scripts when stepped on
- **Step-On Table**: Entrances/exits
- **Collision Data**: (Unknown location - might be in extra bytes)
- **Object spawns**: (Unknown location - might be in extra bytes)

---

## Still Unknown

1. **Compressed section format**: What's the decompression algorithm?
2. **Nibble high bits**: How do layers map to nibble values?
3. **Position table semantics**: What do the offset values point to?
4. **The 516/809 extra bytes**: What do they encode?
5. **Layer architecture**: Single-layer with flags, or multiple-tilemap stacking?
6. **Collision data**: Where? Embedded in nibbles, separate grid, or in compressed section?
7. **Sentinel variants**: Why does 0x30 vs 0xC8 prefix exist?

---

## Next Steps to Complete Map Editor

1. **Decode compressed section**: Study SoETilesViewer's rendering pipeline
2. **Understand nibble encoding**: Cross-compare rendered output with raw nibble values
3. **Extract collision data**: Identify the 516/809 bytes' format
4. **Map objects**: Understand how 18 B-triggers in map 0x34 translate to 3 visible objects
5. **Test round-trip**: Modify tilemap, repack nibbles, verify in emulator

---

## Code Implementation Status

### ✅ Complete
- Read ROM map blob from 3-byte SNES pointer
- Parse 13-byte header
- Parse step-on and B-trigger tables
- Extract tile families
- Find sentinel marker
- Extract position table
- Decode nibble-packed tilemap
- Display preview in VS Code (Rooms tab)
- Decode family tiles with SoETilesViewer-compatible map-tile codec and render full room canvas at `map_w_tiles*16` x `map_h_tiles*16`
- Apply SoETilesViewer map palettes (`Jungle 1`, `Hut Int. 1`, `Hut Ext. 1`, etc.) in render pass

### ⏳ Pending
- Decompress bitstream section
- Decode nibble high bits for layer information
- Understand position table offsets
- Extract additional layers from extra bytes
- Collision data location
- Object placement data
- Round-trip encoding (modify → repack → ROM)

### 🔍 Research Needed
- Direct emulator comparison (Snes9x live memory)
- Reverse-engineering of compression algorithm
- Cross-reference with in-game behavior

---

## SoETilesViewer Source-Verified Findings

This section is based on direct code inspection in `/Users/v/Documents/GitHub/SoETilesViewer`.

### 1) "Map Files" tab vs actual tab in source

- In this repository snapshot, the tab is implemented as **Map Tiles**, not "Map Files".
- UI wiring is in `ui_mainwindow.h` (`tabMapTiles`, `tilesMapTiles`, `lstMapTiles`).
- The visible tab title is set to `Map Tiles`.

### 2) 16-color palettes and relevant sets

- Each map palette is a 16-color SNES palette (`uint16_t snescolors[16]`).
- Relevant predefined map palettes are hardcoded in `mainwindow.cpp` and include:
   - `Jungle 1`
   - `Hut Int. 1`
   - `Hut Ext. 1`
- These are not read from ROM at runtime in this UI path; they are static presets used for preview.

### 3) 6687 map tiles

- `mainwindow.cpp` loads map tiles with:
   - `for (int i=0; i<6687; i++) { Tile tile(i, _rom); ... }`
- So `6687` is currently a fixed application bound, not discovered dynamically.

### 4) Graphics decompression algorithm (map tile graphics)

- Implemented in `tile.h` (`Tile::loadPixels`).
- Tile pointer table base: `0xEE0000`, one 24-bit pointer per tile (`ptraddr = 0xee0000 + i*3`).
- Tile data begins with `tileInfo` byte at `dataaddr`:
   - bit 7: compressed flag
   - bits 0-6: mode-dependent parameter
- Uncompressed path:
   - `wordCount = (tileInfo & 0x7f) + 1`
   - Reads that many 16-bit words and repeats the last word until tile buffer is full.
- Compressed path:
   - Uses a control stream of compression-indicator bytes and 4-bit command nibbles.
   - Supports 16 command modes (`0..15`), including constants (`0x0000`, `0x00ff`, `0xff00`, `0xffff`), byte-injection patterns, RLE-like repeat-last-word commands, and mixed previous/data forms.

### 5) Address flow verified in source

- ROM address mapping in viewer uses `addr & ~(0xC00000)` (`rom.h::mapaddr`), matching HiROM-style bank masking used by this codebase.
- Map script dumper constants (`SoEScriptDumper/data.h`):
   - US map list pointer table: `0x9FFDE7`
   - DE map list pointer table: `0xA0FDE5`
- Map data parser in `SoEScriptDumper/list-rooms.cpp` confirms:
   - 13-byte header
   - `step_len` at `dataptr+0x0d` (byte length)
   - `b_len` after step table (byte length)
   - 6-byte trigger records

### 6) Cross-check against raw ROM for the four trace maps

Using the US ROM and your four target maps (`0x38`, `0x33`, `0x34`, `0x5c`):

- Family IDs from each map payload correctly resolve through the map-tile pointer table at `0xEE0000 + family*3`.
- Example (map `0x33`): families `0x00b9, 0x00ba, 0x0020, 0x0091, 0x0090, 0x0092` all resolve to valid tile data pointers (`0x8bxxxx`) with valid `tileInfo` headers for the `tile.h` decompressor.
- Both compressed (`tileInfo` high bit set) and uncompressed family tiles are present across these maps.

### 7) Important clarification

- This SoETilesViewer snapshot provides **map tile graphics browsing** and tile decoding, but does not itself provide the full room layer compositor for "Layer 1..4 room view" in this code path.
- So it is excellent for verifying tile-family -> graphic decode, but not sufficient alone to explain room-layer composition from map payload tails.

## Is this enough for a map editor?

Short answer: **enough for a solid phase-1 editor, not enough for a full-featured room editor yet**.

### Enough now

- Read/write room blob header and trigger tables.
- Decode/encode tile-family list.
- Decode/encode nibble-packed base tilemap section.
- Preview/edit using known map palettes and tile graphics.
- Preserve unknown sections losslessly when saving.

### Still required for full editor

- Definitive decode of compressed room payload section.
- Definitive decode of post-tilemap tail sections (likely layer/collision/object metadata).
- Layer compositor rules matching in-game Layer 1..4 output.
- Collision/object semantics for gameplay-safe edits.
