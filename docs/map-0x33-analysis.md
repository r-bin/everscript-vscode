# Map 0x33 Analysis — Prehistoria Strong Heart Exterior

Complete byte-level and tilemap analysis of map `0x33` (`Prehistoria - Strong Heart's Exterior`).
This document is ground truth for verifying the ROM decoder implementation.

## Evidence-First Dossier

Status:
- Working: fixed blob header parsing, fixed step-on table parsing, fixed B-trigger length parsing, trusted payload start at `0xADB529`, trusted blob size `0x455`, trusted enter script metadata `0x92811A -> 0x94E5FB`, byte-note ingestion from MCP sub-traces.
- In progress: evidence-only dump of the opaque payload and the trace-backed `0x7FC300 -> EE:xxxx` render path.
- Not working: full decompression algorithm, delta pass algorithm, full script/render opcode semantics.
- Confidence: 88%

Trusted scope used by `map-blob-evidence-model.js`:
- The fixed 13-byte header is trusted.
- `step_len` and `b_len` are trusted 16-bit byte counts.
- Step-on and B-trigger entries are trusted 6-byte records.
- For map `0x33`, bytes after those tables are treated as opaque payload bytes until stronger evidence exists.
- The working render pipeline checkpoints are trusted: blob payload -> WRAM `0x7FC300` -> second pass over `0x7FC300` -> `EE:xxxx` resolution -> render/tile upload.

Evidence table:

| Source | Derived constraint |
|---|---|
| User-confirmed map facts | `map[0x33] data=0xADB50C`, `size=0x455`, `step-on count=2`, `b count=0`, `enter=0x94E5FB` from `0x92811A` |
| `node tools/dump-map-blob.js 0x33` | Header layout is credible through the step-on/B-trigger boundary |
| MCP byte notes `byte_000..byte_050` | Early bytes are consumed exactly as header/config/length fields; no trigger-table compression speculation needed |
| Mesen trace summary for `7FC300` | Payload expansion targets WRAM `0x7FC300` |
| User-confirmed trace interpretation | `0x7FC300` is written twice: decompression, then delta math |
| Mesen `EE0000` decode trace summary | The post-`7FC300` path resolves into EE-space pointers used by render/tile upload code |

Current model artifacts:
- Model: `map-blob-evidence-model.js`
- Dump script: `tools/map-blob-evidence/dump.js`
- Focused tests: `test/map-blob-evidence-model.test.js`

Note:
- Legacy sections below include older exploratory tilemap interpretations. They are not the basis of the new evidence-first dump script.

---

## ROM Pointer

```
Map pointer table: ROM 0x1FFde7, 4 bytes/map
Pointer offset:    ROM 0x1FFde7 + 0x33*4 = 0x1FFf01
dataSnes:          0x2DB50C  (loaded as 3-byte LE: 0C B5 2D)
dataRom:           0x2DB50C  (bank 0x2D → offset 0x3B50C; HiROM: (0x2D & 0x3F)*0x10000 + 0xB50C = 0x2DB50C)
```

---

## Full Blob Layout (0x2DB50C – 0x2DB960)

| Offset (rel) | ROM abs      | Bytes (hex)               | Meaning                               |
|-------------|-------------|--------------------------|---------------------------------------|
| +0x00       | 0x2DB50C    | `1E`                      | trig_off_x = 30                       |
| +0x01       | 0x2DB50D    | `04`                      | trig_off_y = 4                        |
| +0x02       | 0x2DB50E    | `14`                      | mapW = 20 tiles                       |
| +0x03       | 0x2DB50F    | `10`                      | mapH = 16 tiles                       |
| +0x04       | 0x2DB510    | `17`                      | display config (TM register preset)   |
| +0x05       | 0x2DB511    | `00`                      | subscreen config                      |
| +0x06       | 0x2DB512    | `00`                      | color math config                     |
| +0x07       | 0x2DB513    | `02`                      | color window config                   |
| +0x08       | 0x2DB514    | `00`                      | unknown (→ 0x7E241F)                  |
| +0x09–0x0A  | 0x2DB515–16 | `00 00`                   | unknown 16-bit (→ 0x7E0F84)          |
| +0x0B–0x0C  | 0x2DB517–18 | (skipped in trace)        | unknown tail bytes                    |
| +0x0D–0x0E  | 0x2DB519–1A | `0C 00`                   | step_len = 12 (= 2 step-on entries)   |
| +0x0F–0x1A  | 0x2DB51B–26 | 12 bytes                  | step-on table (2 × 6-byte records)    |
| +0x1B–0x1C  | 0x2DB527–28 | `00 00`                   | b_len = 0 (no B-trigger table)        |
| +0x1D       | 0x2DB529    | (payload start)           | Payload starts here                   |

---

## Payload (starting 0x2DB529)

### 1. Tile Family List

| Payload off | ROM abs   | Bytes    | Meaning                                      |
|------------|-----------|---------|----------------------------------------------|
| +0x00      | 0x2DB529  | `06`    | tileCount = 6                                |
| +0x01–0x02 | 0x2DB52A  | `B9 00` | slot[0] = tile family 0x00B9                 |
| +0x03–0x04 | 0x2DB52C  | `BA 00` | slot[1] = tile family 0x00BA                 |
| +0x05–0x06 | 0x2DB52E  | `20 00` | slot[2] = tile family 0x0020                 |
| +0x07–0x08 | 0x2DB530  | `91 00` | slot[3] = tile family 0x0091                 |
| +0x09–0x0A | 0x2DB532  | `90 00` | slot[4] = tile family 0x0090                 |
| +0x0B–0x0C | 0x2DB534  | `92 00` | slot[5] = tile family 0x0092                 |

Tile family IDs reference the global tile catalog (indexed by `EE0000` pointer table, 6687 entries).

### 2. Compressed Bitstream

| Range                    | Meaning                               |
|-------------------------|---------------------------------------|
| 0x2DB536 – 0x2DB5D9     | 164 bytes of compressed/opaque data   |
| Format                  | Unknown (not uniform 3-byte records)  |
| Purpose                 | Likely tile placement commands/layers |

### 3. Sentinel

```
ROM abs: 0x2DB5DA
Bytes:   30 00 00 00 01 00 FF
Type:    0x30 variant
relOff from compressStart: 164
```

### 4. Position Table

```
ROM abs: 0x2DB5E1
posCount = 0  (no position table entries for this map)
```

Map 0x33 is a simple small map — no position table. Maps with multiple huts (0x51) use a position table with step-6 entries.

### 5. Tilemap (Nibble-Packed)

```
tilemapStartAbs: 0x2DB5E2
size:            160 bytes  (20×16=320 tiles, 2/byte)
format:          byte[i]: lo=nibble(tile 2i), hi=nibble(tile 2i+1)
```

**First 24 raw bytes at 0x2DB5E2:**
```
b5 00 07 80 02 33 88 88 88 88 99 9d 05 20 ff a6
43 40 e6 66 66 66 66 81
```

**Decoded to nibble pairs:**
```
b5 → [5, b]   00 → [0, 0]   07 → [7, 0]   80 → [0, 8]
02 → [2, 0]   33 → [3, 3]   88 → [8, 8]   88 → [8, 8]
88 → [8, 8]   88 → [8, 8]   99 → [9, 9]   9d → [d, 9]
05 → [5, 0]   20 → [0, 2]   ff → [f, f]   a6 → [6, a]
43 → [3, 4]   40 → [0, 4]   e6 → [6, e]   66 → [6, 6]
66 → [6, 6]   66 → [6, 6]   66 → [6, 6]   81 → [1, 8]
```

**First row decoded:** `[5, 11, 0, 0, 7, 0, 0, 8, 2, 0, 3, 3, 8, 8, 8, 8, 8, 8, 8, 8]`

This matches the expected first row from `docs/map-loading.md` exactly.

---

## Full 20×16 Tilemap

Columns C00–C19. Values are hex nibbles (0-f). Values 0-5 have declared families (listed below); values 6-f are VRAM slots without a declared family in this map's header (but ARE rendered by the game — their source is not yet determined).

| Row | C00 | C01 | C02 | C03 | C04 | C05 | C06 | C07 | C08 | C09 | C10 | C11 | C12 | C13 | C14 | C15 | C16 | C17 | C18 | C19 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| R00 |   5 |   b |   0 |   0 |   7 |   0 |   0 |   8 |   2 |   0 |   3 |   3 |   8 |   8 |   8 |   8 |   8 |   8 |   8 |   8 |
| R01 |   9 |   9 |   d |   9 |   5 |   0 |   0 |   2 |   f |   f |   6 |   a |   3 |   4 |   0 |   4 |   6 |   e |   6 |   6 |
| R02 |   6 |   6 |   6 |   6 |   6 |   6 |   1 |   8 |   8 |   6 |   2 |   5 |   1 |   4 |   2 |   1 |   9 |   1 |   9 |   9 |
| R03 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   e |   a |   0 |   0 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |
| R04 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |   8 |   6 |   8 |   6 |   6 |   8 |   2 |   8 |   6 |   6 |   6 |   6 |
| R05 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |   6 |   8 |   6 |   4 |   1 |   3 |   1 |   3 |   3 |   3 |   3 |
| R06 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |   5 |   3 |   9 |   5 |   9 |   9 |
| R07 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   9 |   b |   a |   c |   c |   d |   c |   4 |   0 |
| R08 |   6 |   6 |   6 |   6 |   c |   0 |   c |   c |   c |   c |   c |   c |   d |   c |   8 |   c |   6 |   6 |   6 |   6 |
| R09 |   6 |   6 |   6 |   6 |   6 |   6 |   4 |   e |   3 |   3 |   3 |   3 |   3 |   3 |   7 |   3 |   3 |   2 |   0 |   9 |
| R10 |   3 |   0 |   3 |   3 |   3 |   3 |   3 |   3 |   9 |   3 |   9 |   9 |   9 |   9 |   9 |   9 |   3 |   f |   3 |   4 |
| R11 |   0 |   9 |   4 |   3 |   4 |   1 |   c |   c |   c |   c |   d |   c |   4 |   6 |   3 |   3 |   3 |   3 |   5 |   3 |
| R12 |   1 |   9 |   4 |   6 |   b |   9 |   a |   0 |   8 |   6 |   1 |   0 |   1 |   1 |   3 |   0 |   3 |   3 |   1 |   6 |
| R13 |   d |   0 |   6 |   7 |   5 |   3 |   0 |   9 |   0 |   a |   6 |   0 |   8 |   6 |   c |   c |   c |   c |   8 |   c |
| R14 |   6 |   6 |   c |   6 |   4 |   8 |   c |   c |   d |   c |   6 |   7 |   3 |   3 |   6 |   3 |   c |   8 |   c |   c |
| R15 |   d |   c |   0 |   0 |   0 |   a |   6 |   0 |   8 |   6 |   1 |   0 |   9 |   9 |   9 |   9 |   b |   9 |   a |   6 |

---

## Nibble Distribution

| Value (hex) | Value (dec) | Count | Declared family      |
|-------------|-------------|-------|----------------------|
| 0           | 0           | 27    | 0x00B9 (slot 0)      |
| 1           | 1           | 13    | 0x00BA (slot 1)      |
| 2           | 2           | 6     | 0x0020 (slot 2)      |
| 3           | 3           | 54    | 0x0091 (slot 3)      |
| 4           | 4           | 12    | 0x0090 (slot 4)      |
| 5           | 5           | 7     | 0x0092 (slot 5)      |
| 6           | 6           | 74    | (undeclared)         |
| 7           | 7           | 4     | (undeclared)         |
| 8           | 8           | 23    | (undeclared)         |
| 9           | 9           | 46    | (undeclared)         |
| a           | 10          | 7     | (undeclared)         |
| b           | 11          | 4     | (undeclared)         |
| c           | 12          | 30    | (undeclared)         |
| d           | 13          | 7     | (undeclared)         |
| e           | 14          | 3     | (undeclared)         |
| f           | 15          | 3     | (undeclared)         |
| **Total**   |             | **320** |                    |

**119 / 320 cells (37%) have declared families. 201 / 320 cells (63%) reference undeclared VRAM slots.**

This is a confirmed property of the format — the declared families cover only the map-specific tiles. The remaining slots (6–15) are VRAM positions loaded by the game from a shared/common tileset. Their origin is not yet decoded.

---

## Key Findings

### What the decoder gets right
- Sentinel found at correct location: relOff=164 from compressStart ✓
- posCount = 0 ✓
- Decoded first row `[5, 11, 0, 0, 7, 0, 0, 8, 2, 0, ...]` matches `docs/map-loading.md` ground truth ✓
- All nibble values 0–15 are syntactically valid 4-bit indices — they are never "invalid"

### What "unresolved" means
Tilemap nibble value >= `tileCount` means: no tile family was declared for this VRAM slot. The slot exists and is rendered by the game (all 320 tiles render in-game), but the current decoder has no data for those slots.

Correct term: **unresolved** (not **invalid**). `invalidRefs` should always be 0 for a correctly-decoded nibble tilemap.

### Open questions
1. What tiles do VRAM slots 6–15 contain? They may come from:
   - A global background tileset loaded for all maps
   - The position table (which is empty for this map, but present for others)
   - An implicit "fill" derived from the compressed bitstream
2. Why does map 0x01 use sequential IDs `0x07..0x0d` — suggesting VRAM slots start at 7, not 0?
3. Does `posCount > 0` change which slots are filled first?

---

## Comparison: Raw Payload vs Trace vs Render

| Aspect | Raw payload | Trace (confirmed) | Our decoder |
|--------|-------------|-------------------|-------------|
| tileCount | 6 | 6 | 6 ✓ |
| families | B9, BA, 20, 91, 90, 92 | not traced | B9, BA, 20, 91, 90, 92 ✓ |
| sentinel type | 0x30 | 0x30 | 0x30 ✓ |
| compressedSize | 164 bytes | not traced | 164 ✓ |
| posCount | 0 | not traced | 0 ✓ |
| tilemap row 0 | [5,b,0,0,7,0,0,8,2,0,...] | confirmed in map-loading.md | [5,11,0,0,7,0,0,8,2,0,...] ✓ |
| nibble range | 0–15 (all 16 values present) | n/a | rendered for 0–5 only |
| visible tiles | 320 of 320 (in-game) | n/a | 119/320 (37%) — slots 6–15 blank |
