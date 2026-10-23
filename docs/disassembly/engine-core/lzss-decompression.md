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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8C988D](soe://rom/code/8C988D?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C988D_lzss_decompression.c`](../../../reconstructed-c/8C/8C988D_lzss_decompression.c).
> [View in VFS: soe://rom/code/8C988D](soe://rom/code/8C988D?c=1&asm=0)

