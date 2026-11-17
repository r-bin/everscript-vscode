# MSU-1 Hardware Specification & SNES Memory Bus Integration

> Technical Reference for SNES Developers & ROM Hackers  
> Architecture: Media Streaming Unit (Revision 1 & Revision 2)  
> Bus Interface: 8-bit memory-mapped I/O registers at `$00:2000`–`$00:2007`  

---

## 1. SNES Memory Map & Bus Mirroring Rules

On the Super Nintendo 65816 memory bus, addresses `$2000`–`$5FFF` are designated for memory-mapped I/O registers (PPU, CPU, DMA, and Cartridge Coprocessors).

### 1.1 Valid Addressing Banks
The MSU-1 hardware decodes address pins `$2000`–`$2007` when accessed in **Banks `$00`–`$3F`** and **Banks `$80`–`$BF`**:
- In HiROM/FastROM, addresses `$00:2000`–`$00:2007` access the MSU-1 hardware registers.
- **Critical SNES Trap:** In Banks `$40`–`$7D` and Banks `$C0`–`$FF` (HiROM cartridge ROM pages), addresses `$2000`–`$2007` are mapped to **Cartridge ROM data**, NOT I/O registers!
- Therefore, any 65816 code executing from Bank `$8C` or expanded Bank `$FE` **must use 24-bit long addressing** (`LDA $002000`, `STA $002004`) or set the Data Bank register (`DB`) to `$00` or `$80` before performing 16-bit absolute accesses (`LDA $2000`).

---

## 2. Register Specification

### `$00:2000` — Status Register (Read-Only)

Returns bitflags describing the current operating state of the MSU-1 data and audio controllers:

| Bit | Name | Logic | Description |
|---|---|---|---|
| **Bit 7** | `DATA_BUSY` | `1` = Busy | Set while the data seek controller is seeking within the `.msu` file. Clear when data port `$2001` is ready to read. |
| **Bit 6** | `AUDIO_BUSY` | `1` = Busy | Set immediately upon writing the high track byte to `$2005`. Remains `1` while the host/cartridge opens and buffers the audio track file. Clears to `0` when ready. |
| **Bit 5** | `AUDIO_LOOPING` | `1` = Looping | Set if the current track has completed its first play cycle and has seamlessly wrapped back to its designated loop point. |
| **Bit 4** | `AUDIO_PLAYING` | `1` = Playing | Set while audio samples are actively being streamed and played back. Clears upon track completion or when stopped. |
| **Bit 3** | `TRACK_MISSING` | `1` = Missing | Set if the requested `track-<N>.pcm` file does not exist on disk, or if the file contains an invalid header. Used by our patch for seamless vanilla fallback. |
| **Bits 2..0**| `REVISION` | `001` or `010` | Hardware revision identifier (`001` = MSU-1 Rev 1; `010` = MSU-1 Rev 2 with Resume support). |

---

### `$00:2001` — Data Port (Read-Only) / Data Seek Byte 0 (Write-Only)

- **Read:** Returns the next 8-bit sequential data byte from the `.msu` file at the current 32-bit seek pointer, then automatically increments the seek pointer by 1.
- **Write:** Writes Byte 0 (least significant byte) of the 32-bit data seek offset.

---

### `$00:2002`–`$00:2007` — Hardware Identification (Read-Only)

Reading bytes `$00:2002` through `$00:2007` returns the fixed 6-byte ASCII identification string `"S-MSU1"`:

```
$00:2002: 'S'  (0x53)
$00:2003: '-'  (0x2D)
$00:2004: 'M'  (0x4D)
$00:2005: 'S'  (0x53)
$00:2006: 'U'  (0x55)
$00:2007: '1'  (0x31)
```

In 16-bit Accumulator mode (`REP #$20`), these can be verified in 3 double-byte reads:
```assembly
    LDA $002002     ; Reads $002002 and $002003 -> $2D53 ('S' | '-'<<8)
    CMP #$2D53
    BNE .missing
    LDA $002004     ; Reads $002004 and $002005 -> $534D ('M' | 'S'<<8)
    CMP #$534D
    BNE .missing
    LDA $002006     ; Reads $002006 and $002007 -> $3155 ('U' | '1'<<8)
    CMP #$3155
    BNE .missing
```

---

### `$00:2004` & `$00:2005` — Audio Track Number (Write-Only)

- **`$00:2004` (Low Byte):** Writes bits 0..7 of the 16-bit track index (`0`..`65535`).
- **`$00:2005` (High Byte):** Writes bits 8..15 of the 16-bit track index.
- **Trigger:** Writing to `$00:2005` commits the 16-bit track request and immediately begins the hardware seek/load operation. `AUDIO_BUSY` (bit 6 of `$2000`) is raised until the file is ready.

---

### `$00:2006` — Audio Playback Volume (Write-Only)

Linear digital volume multiplier applied to the 44.1 kHz PCM output stream:
- `$00`: Complete silence / Mute (0%)
- `$80`: Half volume (~50%)
- `$FF`: Full volume (100% / $0\text{ dBFS}$)

---

### `$00:2007` — Audio Control Register (Write-Only)

Controls playback state:

| Bit | Flag | Purpose |
|---|---|---|
| **Bit 0** | `PLAY` | `1` = Begin playing the pre-selected track. `0` = Stop/pause playback. |
| **Bit 1** | `REPEAT` | `1` = Enable seamless looping. Upon reaching the end of the audio stream, playback resumes at the loop sample index specified in the `.pcm` header. `0` = Play once and stop. |
| **Bit 2** | `RESUME` | *(MSU-1 v2 only)* `1` = Resume playback from the paused sample offset instead of rewinding to sample 0. |

In the Evermore patch:
- Looping background themes write `$03` (`PLAY | REPEAT`).
- Fanfares, stingers, and Game Over write `$01` (`PLAY`).
- Muting or stopping music writes `$00` (`STOP`).
