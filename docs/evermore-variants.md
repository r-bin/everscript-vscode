# Secret of Evermore — Variant Tables & Pointer Mapping

This document records the exact ROM locations, SNES addresses, entry counts, and reader instructions for the core content tables across all Secret of Evermore releases (USA, Europe, Germany, France, Spain Rev 1, and Spain Rev 2).

The machine-readable definitions live in [`src/games/evermore/variants.json`](../src/games/evermore/variants.json).
The analysis and discovery tool is [`tools/variants/analyze-variant.js`](../tools/variants/analyze-variant.js).

---

## 1. Master Variant Comparison Table

All 6 retail releases were analyzed via static signature scanning and verified via headless emulation boot traces in `snes9x2005-wasm`:

| Variant | Region | Version | SHA-1 | `string_keys` | `map_table` | `room_enter_scripts` | `script_pointers` |
|---|---|---|---|---|---|---|---|
| **USA (Base)** | `$01` | `$00` | `79e7738630fff5699217ef58ecc421bc8fcbcd89` | `$91:D000` (`0x11D000`)<br>3,002 keys | `$9F:FDE7` (`0x1FFDE7`)<br>127 rooms | `$92:801B` (`0x12801B`)<br>127 entries | `$92:8294` (`0x128294`)<br>1,917 entries |
| **Europe** | `$02` | `$00` | `ae17166919fdfdf26cc5771f83cfd19eaf71806c` | `$92:8000` (`0x128000`)<br>3,085 keys | `$A0:FDE5` (`0x20FDE5`)<br>127 rooms | `$93:801B` (`0x13801B`)<br>127 entries | `$93:8294` (`0x138294`)<br>2,344 entries |
| **Germany** | `$09` | `$00` | `5e5c2082526690d05f962c3ffbd7e080c681bfa4` | `$92:8000` (`0x128000`)<br>3,087 keys | `$A0:FDE5` (`0x20FDE5`)<br>127 rooms | `$93:801B` (`0x13801B`)<br>127 entries | `$93:8294` (`0x138294`)<br>2,344 entries |
| **France** | `$06` | `$00` | `8a430c9d6a3dcef974252fe8d946a0d619bb1a61` | `$92:8000` (`0x128000`)<br>3,083 keys | `$A0:FDE5` (`0x20FDE5`)<br>127 rooms | `$93:801B` (`0x13801B`)<br>127 entries | `$93:8294` (`0x138294`)<br>2,344 entries |
| **Spain (Rev 1)** | `$08` | `$00` | `4363ce4b19e76261f9325ac9a0cce27d97490df2` | `$92:8000` (`0x128000`)<br>3,082 keys | `$A0:FDE5` (`0x20FDE5`)<br>127 rooms | `$93:801B` (`0x13801B`)<br>127 entries | `$93:8294` (`0x138294`)<br>2,344 entries |
| **Spain (Rev 2)** | `$08` | `$02` | `c29fe997740bd9b54a07fba7b2b5442a49245aac` | `$92:8000` (`0x128000`)<br>3,082 keys | `$A0:FDE5` (`0x20FDE5`)<br>127 rooms | `$93:801B` (`0x13801B`)<br>127 entries | `$93:8294` (`0x138294`)<br>2,344 entries |

### Key Discovery: The Unified PAL Layout

Across **all five European releases** (both Layout Family A: Europe/Germany and Layout Family B: France/Spain), the four core content tables sit at **identical addresses**:
1. **`string_keys`** moved from `$91:D000` to **`$92:8000`** (file `0x128000`), accommodating ~3,080 keys.
2. Because `$92:8000` was taken by strings, **`room_enter_scripts`** moved from `$92:801B` to **`$93:801B`** (file `0x13801B`).
3. **`script_pointers`** moved from `$92:8294` to **`$93:8294`** (file `0x138294`), with script bank base header at `$93:8000` (word offset `0x0294`).
4. **`map_table`** moved from `$9F:FDE7` to **`$A0:FDE5`** (file `0x20FDE5`), displaced by 2 bytes and pushed into bank `$A0`.

---

## 2. Table-by-Table Details

### 2.1 String Keys (`string_keys`)

- **Format**: 3 bytes per key `(bank << 15) | (addr & $7FFF)` from `$C0:0000`, bit 23 = compressed.
- **US Base**: `$91:D000` (file `0x11D000`), 3,002 keys (144 plain keys).
  - Readers: `$8C:CCF7` and `$8C:CD35` (`lda #$0091 : sta $28 : ldy #$D000`).
- **All PAL Releases**: `$92:8000` (file `0x128000`), 3,082–3,087 keys (49–75 plain keys).
  - Readers: `$CC:D0BA` and `$CC:D0F8` (`lda #$0092 : sta $28 : ldy #$8000`).
- **Language plain samples**:
  - English (Europe): `"rice"`, `"bead"`
  - German: `"Reis"`, `"Gewürz"`, `"Huhn"`, `"EIN GEHEIMES LABOR"`
  - French: `"riz"`, `"Parfum"`
  - Spanish: `"Tapiz"`, `"Podunk, U.S.A."`

### 2.2 Room Pointer Table (`map_table`)

- **Format**: 4 bytes per room (`dl blob_pointer : db pad`). 127 rooms (0x00..0x7E).
- **US Base**: `$9F:FDE7` (file `0x1FFDE7`).
  - Readers: `$90:8F69` and `$90:8F6F` (`lda.l $9FFDE7/8,x`).
- **All PAL Releases**: `$A0:FDE5` (file `0x20FDE5`).
  - Reader: `$D0:8F6E` (`lda.l $A0FDE5,x`).
  - Room `0x61` (Podunk intro title): Points to blob at `0x29B3AA` (US is `0x28B3A9`). Decodes identically to US: `48×47` tiles, 762 metatiles, 2 objects, tile families `[285..291]`.

### 2.3 Room Enter Scripts (`room_enter_scripts`)

- **Format**: 5 bytes per room (3-byte packed script pointer + 2 bytes).
- **US Base**: `$92:801B` (file `0x12801B`).
  - Readers: `$8C:CECC` and `$8C:CED2` (`lda.l $92801B/C,x`).
- **All PAL Releases**: `$93:801B` (file `0x13801B`).
  - Reader: `$CC:D2B1` (`lda.l $93801B,x`).

### 2.4 Script Pointer Table (`script_pointers`)

- **Format**: 3-byte packed script bytecode pointer (`bank $92+n, offset | $8000` in US; `bank $93+n, offset | $8000` in PAL).
- **US Base**: Header at `$92:8000` (file `0x128000`), global table at `$92:8294` (file `0x128294`), 1,917 entries.
  - Readers: `$8C:CE63`, `$8C:CE69`, `$8C:D3B5`, `$8C:D3BB`.
- **All PAL Releases**: Header at `$93:8000` (file `0x138000`), global table at `$93:8294` (file `0x138294`), 2,344 entries.
  - Readers: `$CC:D248`, `$CC:D24E`, `$CC:D79E`, `$CC:D7A4`.

---

## 3. Emulation Verification

Headless execution across each retail ROM in `snes9x2005-wasm` confirms:
1. All retail ROMs transition from room `0x00` to intro title room `0x61` at frame 384 (PAL 50 Hz).
2. The room decoder successfully parses Room `0x61` using `$A0:FDE5`.
