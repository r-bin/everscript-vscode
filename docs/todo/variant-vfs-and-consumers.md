# TODO: Move Variant Addresses to VFS and Connect All Consumers

> **Goal**: Replace hardcoded US ROM addresses across all subsystems with dynamic variant resolution (via VFS and `src/games/evermore/variants.json`), enabling full multi-variant support (USA, Europe, Germany, France, Spain Rev 1 & 2) in the Map Editor, Rooms tab, Memory Radar, Script Inspector, Sprites tab, and Audio tools.

---

## 1. Architectural Strategy

```
ROM Loaded (any variant)
   │
   ▼
Identify Variant (region byte $00:FFD9 / SHA-1)
   │
   ▼
Variant Descriptor & Table Resolver (src/games/evermore/variants.json)
   │
   ├───────────────────────────────┬───────────────────────────────┐
   ▼                               ▼                               ▼
Virtual File System (soe://)   Maps & Rooms Subsystem       Scripts & Language
soe://tables/*                 Dynamic MAP_LIST_ADDR        Dynamic string_keys ($91/$92)
soe://rooms/*                  Dynamic map_palettes         Dynamic enter_scripts ($92/$93)
soe://strings/*                Dynamic map_tile_graphics    Dynamic script_pointers ($92/$93)
```

1. **VFS Integration (`soe://`)**:
   - `soe://tables/` serves raw table slices and structured JSON based on the active/mounted ROM variant.
   - `soe://rooms/<id>` resolves room blobs through the variant's `map_table` (`$9F:FDE7` US vs `$A0:FDE5` PAL).
   - `soe://strings/<key>` reads string keys from `$91:D000` (US) or `$92:8000` (PAL).

2. **Consumer Decoupling**:
   - Replace static exports like `export const MAP_LIST_ADDR = 0x1ffde7;` with variant-aware resolvers: `getMapTableOffset(rom)` or table accessor functions accepting `rom` or `variantId`.

---

## 2. Consumer Subsystems & Required Adaptations

### 2.1 Map Editor & Rooms Subsystem (`src/games/evermore/maps/`, `src/games/evermore/rooms/`)
- [x] **`src/games/evermore/maps/rom.ts`**:
  - Implemented `mapTableOffset(rom)` resolving `0x1FFDE7` for US and `0x20FDE5` for PAL.
  - Updated `roomBlobOffset(rom, id)` to use `mapTableOffset(rom)`.
- [x] **`src/games/evermore/maps/room.ts`**:
  - Updated `decodeRoom(rom, roomId)` to read room pointers dynamically via `mapTableOffset(rom)`.
- [x] **Background Palettes & Tile Graphics**:
  - Updated `extractTileFamilyPalette(rom, familyId)`: dynamic via `getMapPalettesOffset(rom)` (US `0x1CC322` vs PAL `0x1DC323`).
  - Updated `decompressTile16x16(rom, tileId)`: dynamic via `getMapTileGraphicsOffset(rom)` (US/Family B `0x2E0000` vs Family A `0x2F0000`).
- [x] **Rooms Tab & Webview Editor (`src/games/evermore/rooms/`)**:
  - Verified room decoding, metatile decompression, and palette extraction across all PAL retail variants.

### 2.2 Text & Dialogue Subsystem (`src/games/evermore/language/`, `src/resources/`)
- [x] **String Key Lookup**:
  - Dynamically read `string_keys` table base from variant: `$91:D000` (US) or `$92:8000` (PAL) via `getStringKeysOffset(rom)`.
  - Supported PAL plain string key decoding (e.g. German "Reis", "Gewürz", French "riz", Spanish "Tapiz").
- [ ] **Hover & Autocomplete Providers**:
  - Hover on string IDs resolves localized text matching the active ROM variant.
- [ ] **PAL String Decompressor**:
  - Implement or port the PAL decompression routine for compressed dialogue.

### 2.3 Script Subsystem (`src/games/evermore/script/`, `src/scripts-tab/`)
- [x] **Room Enter Scripts**:
  - Dynamic enter script table address: US `$92:801B` vs PAL `$93:801B` via `getRoomEnterScriptsOffset(rom)`.
- [x] **Script Pointer Table**:
  - Dynamic base header: US `$92:8000` vs PAL `$93:8000` via `getScriptHeaderOffset(rom)`.
  - Global script pointer table: US `$92:8294` vs PAL `$93:8294` via `getScriptPointersOffset(rom)`.
- [ ] **Script Opcode Dispatcher**:
  - Opcode jump table: US `$8C:E8BD` vs PAL `$8C:ECBE`.
  - Bytecode disassembler respects opcode offsets in PAL.

### 2.4 Sprites & Entities Subsystem (`src/games/evermore/sprites/`)
- [ ] **Sprite Block Tables**:
  - 16×16 blocks: US `$EC:0000` vs Family A `$EE:0000` vs Family B `$ED:0000`.
  - 8×8 blocks: US `$D8:0000` vs Family A `$D9:0000` vs Family B `$D8:0000`.
- [ ] **Animation Records & Global Animation IDs**:
  - `animate_ids`: US `$C4:3C92` vs Family A `$C4:42D2` vs Family B `$C3:42D2`.
  - `animation_records`: US `$C4:3E3A` vs Family A `$C4:447A` vs Family B `$C3:447A`.
- [ ] **Character Records & Enemy Index**:
  - Invariant at `$8E:B678` and `$8E:B55A` across all releases.

### 2.5 Music & Audio Subsystem (`src/games/evermore/music/`)
- [ ] **Song Packages**:
  - Read from `$81:9903` (71 packages, count at `$81:9900`) across all releases.
  - Accommodate PAL sound driver entry points.

### 2.6 ROM Catalog & Memory Radar (`src/games/evermore/rom/model/catalog.js`, `src/games/evermore/memory/`)
- [ ] **`catalog.js`**:
  - Refactor `roomRegions`, `textRegions`, and `entityRegions` to obtain table regions dynamically from `variants.json` based on the loaded ROM.

---

## 3. Implementation Phasing

1. **Phase 1: Core Variant Resolver & VFS Provider**
   - Create `src/games/evermore/variant-resolver.ts` exporting `getVariant(rom)` and `getTable(rom, tableName)`.
   - Mount variant table addresses in `soe://tables/`.
2. **Phase 2: Map Editor & Rooms Tab**
   - Connect `variant-resolver.ts` to `src/games/evermore/maps/rom.ts`, `room.ts`, and `src/games/evermore/rooms/`.
   - Test opening European and German ROMs in Map Editor and verifying tile palettes and blobs.
3. **Phase 3: Text, Scripts & Hovers**
   - Wire string keys and enter script lookups to `variant-resolver.ts`.
4. **Phase 4: Sprites, Animation & Catalog**
   - Wire sprite blocks and animation record lookups. Update `catalog.js` for the ROM tab.
5. **Two variants side by side** (from `docs/architecture/multi-game.md` §7, item 5): each game has one main view, which follows its game's selected ROM, so a US and a PAL radar cannot be open at once. Needs a view per (game, ROM) in `core/game-views.js`.
