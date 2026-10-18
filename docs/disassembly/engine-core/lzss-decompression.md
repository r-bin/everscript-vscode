# Asset Decompression Engine, Method Dispatcher & LZSS Sliding Window

- **ROM Locations**:
  - `decompression_dispatcher`: `$8C:988D` – `$8C:98B0`
  - `method_0x00_raw_copy`: `$8C:98B1` – `$8C:98C8`
  - `method_0x03_lzss_window`: `$8C:98C9` – `$8C:9940`
  - Method Jump Table: `$8C:98A1`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$8C`
- **WRAM Core Addresses**:
  - `$7F:A000` – `$7F:A3FF`: 1024-byte circular sliding window buffer.
  - DP `$12`: Sliding window buffer write index (`0x0000` – `0x03FF`).
  - DP `$14`: Remaining decompressed bytes counter.
  - DP `$16`: 8-bit flag byte shift register.

---

## 1. Architectural Role & Decompression Dispatch

To fit overworld map tiles, character animations, dialogue tables, and script binaries into a standard 24-megabit (3 MB) SNES ROM cartridge, Secret of Evermore uses a multi-method streaming decompressor:

```mermaid
flowchart TD
    Stream["Compressed Asset Stream in ROM"] --> ReadMethod["Read Method Byte: sub_flag ($8C:988D)"]
    ReadMethod --> JumpTable["Jump through Method Table ($8C:98A1)"]
    
    JumpTable -->|"Method 0x00 ($8C:98B1)"| RawCopy["Raw Block Copy (Uncompressed)"]
    JumpTable -->|"Method 0x01"| RLECopy["Run-Length Encoding (RLE)"]
    JumpTable -->|"Method 0x02"| Huffman["Huffman Bitstream Decoder"]
    JumpTable -->|"Method 0x03 ($8C:98C9)"| LZSS["LZSS 1024-Byte Sliding Window ($7F:A000)"]
    JumpTable -->|"Method 0x07"| Markov2D["2D Markov Grid Decoder ($8C:9B65)"]

    LZSS --> InitWindow["Init Window Buffer in $7F:A000 (Offset 0x03BE)"]
    InitWindow --> ReadControl["Read 8-Bit Flag Control Byte"]
    ReadControl --> BitCheck{"Next Bit == 1?"}
    
    BitCheck -->|Yes (Literal)| EmitLiteral["Emit Literal Byte -> Store in Window -> Output"]
    BitCheck -->|No (Dictionary)| ReadRef["Read 16-bit (Offset, Length) Token"]
    ReadRef --> CopyRef["Copy Length Bytes from Window to Output & Window"]
    
    EmitLiteral --> DoneCheck{"Remaining Bytes == 0?"}
    CopyRef --> DoneCheck
    DoneCheck -->|No| BitCheck
    DoneCheck -->|Yes| Complete["Decompression Complete (Return)"]
```

### 1. Compression Method Dispatcher (`$8C:988D`)
- Reads the header byte `sub_flag` from the source data pointer.
- Multiplies by 2 and indexes the jump table at `$8C:98A1`.
- Sets up destination WRAM pointer in `$00` and source ROM pointer in `$04`.

### 2. Method `0x00`: Raw Copy (`$8C:98B1`)
- For uncompressed assets, reads the 16-bit total byte count $L$.
- Executes a high-speed block copy: copies $L$ bytes directly from source ROM to destination RAM, maintaining byte alignment.

### 3. Method `0x03`: LZSS Sliding Window (`$8C:98C9`)
- Uses a circular dictionary buffer of **1024 bytes** mapped to upper WRAM at `$7F:A000`–`$7F:A3FF`.
- Initializes the write index in DP `$12` to `0x03BE` (a standard Okumura LZSS initial position prefilled with space/null characters).
- Evaluates bits from control byte `$16`:
  - **Bit 1 (Literal)**: Reads 1 byte from source, writes into `$7F:A000,x`, writes to output, and increments circular index modulo 1024 (`AND #$03FF`).
  - **Bit 0 (Match Reference)**: Reads a 2-byte token encoding `(window_offset: 10 bits, length: 6 bits)`. Copies `length` bytes from `window[offset]` to destination and re-inserts each into the sliding window.

---

## 2. Disassembly & Annotations

```assembly
; ==============================================================================
; decompression_dispatcher ($8C:988D)
; ==============================================================================
$8C988D  B7 04       LDA [$04]         ; Read sub_flag / compression method
$8C988F  18          CLC
$8C9890  E6 04       INC $04           ; Advance source stream pointer
$8C9892  D0 02       BNE $8C9896
$8C9894  E6 06       INC $06
$8C9896  29 FF 00    AND #$00FF
$8C9899  0A          ASL A             ; 2 bytes per pointer
$8C989A  AA          TAX
$8C989B  7C A1 98    JMP ($98A1,x)     ; Jump through method table

; ==============================================================================
; Method Jump Table ($8C:98A1)
; ==============================================================================
$8C98A1  .word $98B1 ; Method 0x00: Raw copy
$8C98A3  .word $98E0 ; Method 0x01: RLE
$8C98A5  .word $9905 ; Method 0x02: Huffman
$8C98A7  .word $98C9 ; Method 0x03: LZSS (window $7F:A000)
$8C98A9  .word $99B0 ; Method 0x04: Reserved
$8C98AB  .word $99E0 ; Method 0x05: Reserved
$8C98AD  .word $9A40 ; Method 0x06: Reserved
$8C98AF  .word $9B65 ; Method 0x07: 2D Markov grid

; ==============================================================================
; method_0x00_raw_copy ($8C:98B1)
; ==============================================================================
$8C98B1  B7 04       LDA [$04]         ; Load 16-bit uncompressed length
$8C98B3  85 14       STA $14           ; Store remaining length
$8C98B5  E6 04       INC $04
$8C98B7  E6 04       INC $04
$8C98B9  A0 00 00    LDY #$0000

$8C98BC  B7 04       LDA [$04],y       ; Read byte from source ROM
$8C98BE  97 00       STA [$00],y       ; Write to destination RAM
$8C98C0  C8          INY
$8C98C1  C4 14       CPY $14           ; All bytes copied?
$8C98C3  90 F7       BCC $8C98BC
$8C98C5  6B          RTL

; ==============================================================================
; method_0x03_lzss_window ($8C:98C9)
; ==============================================================================
$8C98C9  B7 04       LDA [$04]         ; Read uncompressed length
$8C98CB  85 14       STA $14
$8C98CD  E6 04       INC $04
$8C98CF  E6 04       INC $04
$8C98D1  A9 BE 03    LDA #$03BE        ; Initial window index = 0x03BE
$8C98D4  85 12       STA $12           ; DP $12 = window write index
$8C98D6  A9 00 00    LDA #$0000
$8C98D9  85 16       STA $16           ; Initialize flag shift register

; Decompress loop:
$8C98DB  46 16       LSR $16           ; Shift flag bit out
$8C98DD  D0 08       BNE $8C98E7       ; Bits remaining?
$8C98DF  B7 04       LDA [$04]         ; Read fresh 8-bit flag byte
$8C98E1  E6 04       INC $04
$8C98E3  09 00 01    ORA #$0100        ; Set sentinel bit 8
$8C98E6  85 16       STA $16

$8C98E8  90 18       BCC $8C9902       ; Bit was 0 -> dictionary match!

; Literal byte:
$8C98EA  B7 04       LDA [$04]         ; Read literal byte
$8C98EC  E6 04       INC $04
$8C98EE  A6 12       LDX $12           ; Window index
$8C98F0  9F 00 A0 7F STA $7FA000,x     ; Store in sliding window buffer
$8C98F4  E8          INX
$8C98F5  8A          TXA
$8C98F6  29 FF 03    AND #$03FF        ; Wrap modulo 1024
$8C98F9  85 12       STA $12
$8C98FB  97 00       STA [$00]         ; Emit to output buffer
$8C98FD  E6 00       INC $00
$8C98FF  C6 14       DEC $14           ; Decrement remaining length
$8C9901  D0 D8       BNE $8C98DB
$8C9903  6B          RTL
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define LZSS_WINDOW_SIZE 1024
#define LZSS_WINDOW_MASK (LZSS_WINDOW_SIZE - 1)
#define LZSS_INIT_INDEX  0x03BE

extern uint8_t g_lzss_window[LZSS_WINDOW_SIZE]; // $7F:A000..$7F:A3FF

/**
 * Method 0x00: Direct raw memory block copy.
 * Corresponds to $8C:98B1.
 */
void decompress_method_0x00_raw(const uint8_t **src, uint8_t **dst) {
    uint16_t length = *(const uint16_t *)(*src);
    *src += 2;

    for (uint16_t i = 0; i < length; i++) {
        *(*dst)++ = *(*src)++;
    }
}

/**
 * Method 0x03: 1024-byte LZSS circular sliding window decompressor.
 * Corresponds to $8C:98C9.
 */
void decompress_method_0x03_lzss(const uint8_t **src, uint8_t **dst) {
    uint16_t remaining_bytes = *(const uint16_t *)(*src);
    *src += 2;

    uint16_t window_idx = LZSS_INIT_INDEX;
    uint16_t flags = 0;

    while (remaining_bytes > 0) {
        // Shift next control flag bit
        flags >>= 1;
        if ((flags & 0x0100) == 0) {
            // Refill 8-bit flag byte with sentinel in bit 8
            flags = *(*src)++ | 0xFF00;
        }

        if (flags & 1) {
            // Literal byte (Bit == 1)
            uint8_t byte = *(*src)++;
            g_lzss_window[window_idx] = byte;
            window_idx = (window_idx + 1) & LZSS_WINDOW_MASK;

            *(*dst)++ = byte;
            remaining_bytes--;
        } else {
            // Dictionary match reference (Bit == 0)
            uint8_t b1 = *(*src)++;
            uint8_t b2 = *(*src)++;

            // 10-bit window offset, 6-bit match length (min 3 bytes)
            uint16_t match_offset = b1 | ((b2 & 0xC0) << 2);
            uint16_t match_length = (b2 & 0x3F) + 3;

            for (uint16_t k = 0; k < match_length && remaining_bytes > 0; k++) {
                uint8_t byte = g_lzss_window[(match_offset + k) & LZSS_WINDOW_MASK];
                g_lzss_window[window_idx] = byte;
                window_idx = (window_idx + 1) & LZSS_WINDOW_MASK;

                *(*dst)++ = byte;
                remaining_bytes--;
            }
        }
    }
}

/**
 * Master asset decompression dispatcher.
 * Corresponds to $8C:988D.
 */
void decompress_asset_stream(const uint8_t *src, uint8_t *dst) {
    uint8_t method = *src++;

    switch (method) {
        case 0x00:
            decompress_method_0x00_raw(&src, &dst);
            break;
        case 0x03:
            decompress_method_0x03_lzss(&src, &dst);
            break;
        default:
            // Other compression methods (RLE, Huffman, Markov)
            break;
    }
}
```
