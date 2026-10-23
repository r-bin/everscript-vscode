# Room Environmental Effect: Heat Shimmer & Mirage HDMA Wave Generator ($90:9D45 – $90:9DE7 / $80:AD28)

> **Subsystem**: Environmental Weather & Map Effects / PPU HDMA Line-Scroll Engine  
> **ROM Addresses**: `$90:9D45` (`room_effect_heat_shimmer_hdma_wave_generator`), `$90:9DC5` (Scanline Split Band Table), `$90:9DCF` (Wave Amplitude Table Layer 1), `$90:9DD9` (Wave Amplitude Table Layer 2), `$90:9DE3` (`enable_nmi_auto_joypad_stub`), `$80:AD28` (`trig_sine_fixed_point_scale`)  
> **Clean C Module**: `maps/heat-shimmer.c`  
> **Recomp Symbols**: `bank_90_9D45_M0X0`, `bank_80_AD28_M0X0`  
> **Confidence**: Confirmed (Exact 65816 assembly, cycle analysis & mathematical behavioral equivalence)  

---

## 1. Architectural Role & Overview

In Secret of Evermore, rooms can specify an **environmental effect index** via byte 8 of the room header (stored at `$7E:241F`). When `$7E:241F == 0x0005`, the camera and render dispatcher (`$90:9876` and `$90:9531`) dispatches entry 5 from the effect jump table at `$90:8E68`.

This effect is the **Heat Shimmer / Mirage Distortion Effect**, used in desert environments (such as the Skeleton Coast / Desert of Doom) and volcanic volcanic zones to produce a rippling, atmospheric optical illusion across background layers.

Rather than burning CPU cycles redrawing tiles, the engine uses **SNES PPU HDMA Line-by-Line Scroll Table Injection**:
1. **Camera Scroll Shadow Synchronization**: Synchronizes PPU BG1 and BG2 scroll shadows (`$7E:010E`..`$7E:0114`) with camera coordinates `($59, $5B - 1)`.
2. **Double-Buffered HDMA Table Staging**: Toggles between two ping-pong WRAM HDMA line buffers located at `$7E:151A` and `$7E:153E` using active pointer `$7E:1518` to prevent raster tearing during active VBLANK transfers.
3. **Harmonic Angular Phase Generation**: Reads the global environmental wave oscillation counter `$7E:0B19`, sums it with camera horizontal position `$7E:0059`, and constrains the result to a 1024-step angular period (`& 0x03FF`).
4. **Trigonometric Harmonic Projection Loop**: Calls fixed-point sine utility `$80:AD28` across ROM amplitude and frequency tables (`$90:9DCF` and `$90:9DD9`), writing sinusoidal horizontal displacement values for each scanline band into the HDMA table.
5. **Scanline Band Clamping & Clipping**: Evaluates band split thresholds from `$90:9DC5` relative to camera vertical position `$7E:005B`, clamping against the 224 visible SNES scanlines (`0xDF`). Writes terminator `0xFFFF` at the end of the table.

```mermaid
flowchart TD
    Start["Tick Frame: Dispatch Effect 5 ($90:9D45)"] --> SyncScroll["Synchronize Scroll Shadows:<br/>$010E / $0112 = Camera X ($59)<br/>$0110 / $0114 = Camera Y - 1 ($5B - 1)"]
    SyncScroll --> PingPong{"Active HDMA Table<br/>at $7E:1518 == $151A?"}
    
    PingPong -- "Yes" --> SetBufB["Target Buffer = $7E:153E (DP $0C)"]
    PingPong -- "No" --> SetBufA["Target Buffer = $7E:151A (DP $0C)"]
    
    SetBufB --> CalcPhase["Compute Angular Wave Phase:<br/>phase = ($7E:0B19 + Camera X) & 0x03FF"]
    SetBufA --> CalcPhase
    
    CalcPhase --> WaveLoopInit["Init Wave Offset Loop:<br/>X = 2 (ROM Table Index), Y = Target Buffer + 2"]
    
    WaveLoopInit --> CheckWaveTerm{"Table Entry<br/>$90:9DCF,X < 0?"}
    CheckWaveTerm -- "No (Valid Amplitude)" --> Sine1["Call $80:AD28 (Sine Scale Layer 1)<br/>Store offset at Y + 0x0C"]
    Sine1 --> Sine2["Call $80:AD28 (Sine Scale Layer 2)<br/>Store offset at Y + 0x18"]
    Sine2 --> NextWave["X += 2, Y += 2"] --> CheckWaveTerm
    
    CheckWaveTerm -- "Yes ($FFFF Terminator)" --> BandLoopInit["Init Scanline Band Loop:<br/>X = 2, Restore Y = Target Buffer + 2"]
    
    BandLoopInit --> CheckBandTerm{"Band Threshold<br/>$90:9DC5,X < 0?"}
    CheckBandTerm -- "No" --> SubCamera["rel_y = Band Y - Camera Y ($5B)"]
    SubCamera --> CheckTop{"rel_y < 0?"}
    CheckTop -- "Yes (Above Screen)" --> Terminate["Write $FFFF Terminator"]
    CheckTop -- "No" --> CheckBottom{"rel_y >= 223 (0xDF)?"}
    CheckBottom -- "Yes (Below Screen)" --> Terminate
    CheckBottom -- "No" --> WriteBand["Write rel_y to HDMA Table (Y+0x00)<br/>X += 2, Y += 2"] --> CheckBandTerm
    
    CheckBandTerm -- "Yes" --> Terminate
    Terminate --> WriteTerm["Store 0xFFFF at Y+0x00"] --> Exit["Return (RTS)"]
```

---

## 2. Full 65816 Disassembly & Annotations

### Part 1: Heat Shimmer HDMA Wave Generator (`$90:9D45` – `$90:9DC4`)

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/909D45](soe://rom/code/909D45?asm=1&c=0)


---

### Part 2: HDMA ROM Coefficient & Split Band Tables (`$90:9DC5` – `$90:9DE2`)

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/909D45](soe://rom/code/909D45?asm=1&c=0)


---

### Part 3: Fixed-Point Trigonometric Scaling Generator (`$80:AD28` – `$80:AD53`)

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/909D45](soe://rom/code/909D45?asm=1&c=0)


---

## 3. Data Structures & Memory Layout

### 3.1 Direct Page Variables

| Address | Size | Name | Purpose |
|---|---|---|---|
| `DP $02` | 2 bytes | `trig_result_lo` | Fractional low word of scaled sine product |
| `DP $03` | 2 bytes | `trig_result_int` | **Integer sine displacement** (written to HDMA table) |
| `DP $04` | 2 bytes | `trig_result_hi` | High word of scaled sine product |
| `DP $06` | 2 bytes | `trig_angle_phase` | Angle input (0..1023) passed to `$80:ACF5` / `$80:AD28` |
| `DP $0A` | 2 bytes | `wave_harmonic_phase` | Computed harmonic phase angle: `(timer + camera_x) & 0x03FF` |
| `DP $0C` | 2 bytes | `target_hdma_buffer` | Active double-buffered HDMA staging buffer address (`0x151A` or `0x153E`) |
| `DP $16` | 2 bytes | `trig_scratch_lo` | Intermediate multiplication partial sum |
| `DP $18` | 2 bytes | `trig_scratch_hi` | Intermediate multiplication partial sum high word |
| `DP $59` | 2 bytes | `camera_world_x` | Primary viewport world coordinate X |
| `DP $5B` | 2 bytes | `camera_world_y` | Primary viewport world coordinate Y |

### 3.2 WRAM System Registers

| Address | Size | Name | Purpose |
|---|---|---|---|
| `$7E:010E` | 2 bytes | `BG1HOFS_SHADOW` | BG1 Horizontal scroll shadow written to `$210D` during NMI |
| `$7E:0110` | 2 bytes | `BG1VOFS_SHADOW` | BG1 Vertical scroll shadow written to `$210E` during NMI |
| `$7E:0112` | 2 bytes | `BG2HOFS_SHADOW` | BG2 Horizontal scroll shadow written to `$210F` during NMI |
| `$7E:0114` | 2 bytes | `BG2VOFS_SHADOW` | BG2 Vertical scroll shadow written to `$2110` during NMI |
| `$7E:0B19` | 2 bytes | `wave_osc_timer` | Global environmental wave oscillation counter |
| `$7E:1518` | 2 bytes | `hdma_active_buf_ptr` | Current active HDMA buffer pointer (`0x151A` or `0x153E`) |
| `$7E:151A` | 36 bytes | `hdma_buffer_a` | HDMA double-buffer bank A |
| `$7E:153E` | 36 bytes | `hdma_buffer_b` | HDMA double-buffer bank B |
| `$7E:241F` | 2 bytes | `environment_effect_id`| Environmental effect selector index (5 = Heat Shimmer) |

---

## 4. Clean C Reconstruction

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/909D45_heat_shimmer.c`](../../../reconstructed-c/90/909D45_heat_shimmer.c).
> [View in VFS: soe://rom/code/909D45](soe://rom/code/909D45?c=1&asm=0)


---

## 5. Verification & Mathematical Behavioral Equivalence

| Requirement | 65816 Assembly Behavior | Clean C Implementation | Status |
|---|---|---|---|
| **Scroll Sync** | `STA $0110`, `STA $0114` = `Y - 1`; `STA $010E`, `STA $0112` = `X` | `bg1_scroll_y = camera_y - 1`, `bg1_scroll_x = camera_x` | **Identical** |
| **Double Buffering** | `CMP #$151A; BNE select_151A; LDA #$153E` | `hdma_active_buf_ptr == 0x151A ? buf_b : buf_a` | **Identical** |
| **Wave Phase Modulo** | `(timer + camera_x) & 0x03FF` | `(wave_timer + camera_x) & 0x03FF` | **Identical** |
| **Trig Multiplier** | Dual-byte fixed point sine scaling via `$80:AD28` | `trig_sine_fixed_point_scale` returns integer sine `(full_acc >> 16)` | **Identical** |
| **Scanline Clipping** | `SBC $5B; BMI term; CMP #$00DF; BCS term` | `rel_y < 0 \|\| rel_y >= 223 -> break` | **Identical** |
| **HDMA Sentinel** | `LDA #$FFFF; STA 0,Y` | `*table_cursor = HDMA_TERMINATOR (0xFFFF)` | **Identical** |
