# Positional 2D Audio Spatialization & Soundbank Package Resolver

> **ROM Bank**: `$8C` (Audio IPC & Driver Interface), `$80` (Math Tables), `$81` (Master Soundbank Catalog)  
> **Source Routines**:
> - `audio_resolve_soundbank_package`: `$8C:8328` – `$8C:8361`
> - `sfx_script_translation_table`: `$8C:8362` – `$8C:8441`
> - `sfx_volume_attenuation_curve`: `$8C:84D4` – `$8C:8588`
> - `audio_play_positional_sfx`: `$8C:8589` – `$8C:8618`
> - `audio_music_fade_step`: `$8C:8619` – `$8C:8657`  
> **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$8C`  
> **Hardware Registers**: `$2140`–`$2143` (APU Communication Ports 0–3)  
> **Related Documents**: [`spc-handshake.md`](spc-handshake.md), [`sfx-queue.md`](sfx-queue.md)

---

## 1. Architectural Overview

The audio engine of *Secret of Evermore* features an advanced real-time 2D positional spatialization pipeline that dynamically alters the volume and stereo balance of in-game sound effects based on the relative on-screen distance between the player/camera and the sound emitter (such as exploding bazooka projectiles, roaring boss entities, waterfalls, and spell bursts).

### Core Components:

1. **Soundbank Package Resolution (`$8C:8328` – `$8C:8361`)**:
   - The game swaps sample packages (BRR audio data) in SPC700 Audio RAM based on the active room and current events.
   - Master index tables at `$81:9900` and `$81:9901` define package layouts:
     $$\text{TableBase} = \$9903 + ((\text{Byte}[\$81:9900] + 1) \times 3)$$
   - When given track ID `$0E44` (if $X = 0$) or effect ID `$0E4F` (if $X \ne 0$), computes the exact catalog pointer and extracts the required 8-bit soundbank package ID.

2. **2D Distance Attenuation & Euclidean Falloff (`$8C:8589` – `$8C:85DC`)**:
   - Computes screen-centered offsets:
     $$\Delta x = |(\text{CameraX} + 128) - \text{EmitterX}|$$
     $$\Delta y = |(\text{CameraY} + 112) - \text{EmitterY}|$$
   - Quantizes delta coordinates ($\gg 4$) and queries quadratic distance penalty table `$80:AA27`.
   - Sums horizontal and vertical distance penalties: $\text{Dist} = \text{Penalty}_x + \text{Penalty}_y$.
   - If $\text{Dist} \ge \text{0x3F01}$, the sound is out of audible range ($\text{Volume} = 0$).
   - Otherwise, indexes logarithmic attenuation curve `$8C:84D4` to obtain volume scalar ($0 \dots 255$).
   - Transmits APU IPC Command `0x0036` (Set Attenuated Sound Effect Volume).

3. **Stereo Panning (`$8C:85E3` – `$8C:8618`)**:
   - Computes signed horizontal displacement:
     $$\text{PanDelta} = \frac{(\text{CameraX} + 128) - \text{EmitterX}}{8}$$
   - Clamps the result to signed 8-bit stereo limits $[-100, +100]$ (`$FF9C` to `$0064`):
     - $\text{PanDelta} > +100 \implies +100$ (panned fully to the left).
     - $\text{PanDelta} < -100 \implies -100$ (panned fully to the right).
   - Packs pan coordinate into register `Y` and transmits APU IPC Command `0x003E` (Set SFX Stereo Pan).

4. **Master BGM Fade Stepper (`$8C:8619` – `$8C:8657`)**:
   - Direct Page `$9B` tracks active fade targets.
   - Stepped each frame tick by rate `$9A`. Upon completion (`$9B = 0`), issues command `0x0028` or `0x00A9` to latch target volume.

```mermaid
flowchart TD
    Emitter["Positional Sound Trigger ($8C:8589)\nA = SFX ID, X = WorldX, Y = WorldY"] --> DistCalc["Calculate Delta from Screen Center:\ndx = abs((CamX + 128) - WorldX)\ndy = abs((CamY + 112) - WorldY)"]
    DistCalc --> QuadTable["Lookup Quadratic Penalty from $80:AA27:\nDist = PenaltyX + PenaltyY"]
    QuadTable --> RangeCheck{"Dist >= 0x3F01?"}
    RangeCheck -->|Yes (Out of Range)| Mute["Volume = 0"]
    RangeCheck -->|No| AttenCurve["Sample Logarithmic Curve $8C:84D4:\nVolume = AttenuationTable[Dist]"]
    Mute --> APUVol["APU Cmd $36: Set Volume Handshake ($8C:81FD)"]
    AttenCurve --> APUVol
    APUVol --> PanCalc["Calculate Stereo Pan:\nPan = ((CamX + 128) - WorldX) >> 3\nClamp [-100, +100]"]
    PanCalc --> APUPan["APU Cmd $3E: Set Stereo Pan Handshake ($8C:81FD)"]
    APUPan --> Ret["Return via RTL ($8C:8618)"]
```

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8C:8328 - Resolve Soundbank Package for Track or SFX
; Input: X = 0 (BGM track in $0E44), X != 0 (SFX in $0E4F)
; Output: A = Package ID
; ==============================================================================
audio_resolve_soundbank_package:
    REP #$30
    LDA $819900                 ; Table dimension header
    AND #$00FF
    INC A
    STA $A3
    ASL A
    CLC
    ADC $A3
    CLC
    ADC #$9903                  ; Table base offset
    TXY
    BNE .resolve_sfx_package

    ; Resolve Music Track Package (X == 0)
    CLC
    ADC $0E44                   ; Add track ID
    BRA .read_package_byte

.resolve_sfx_package:
    STA $A3
    LDA $819901                 ; SFX section offset
    AND #$00FF
    CLC
    ADC $A3
    CLC
    ADC $0E4F                   ; Add sound effect ID

.read_package_byte:
    STA $A3
    LDA #$0081
    STA $A5                     ; Bank $81
    LDA [$A3]                   ; Read package byte from catalog
    AND #$00FF
    RTL

; ==============================================================================
; $8C:8589 - Positional 2D Sound Effect Player
; Input: A = SFX ID, X = Emitter World X, Y = Emitter World Y
; ==============================================================================
audio_play_positional_sfx:
    STX $02                     ; $02 = Emitter X
    STY $04                     ; $04 = Emitter Y
    STA $06                     ; $06 = SFX ID

    ; --- 1. Vertical Distance Falloff ---
    LDA $5B                     ; Camera Y top edge
    CLC
    ADC #$0070                  ; Screen center Y (+112 px)
    SEC
    SBC $04                     ; dy = ScreenCenterY - EmitterY
    BPL .dy_positive
    DEC A
    EOR #$FFFF                  ; abs(dy)
.dy_positive:
    LSR A
    LSR A
    LSR A
    LSR A                       ; dy >> 4
    ASL A                       ; (dy >> 4) * 2 (table word stride)
    TAY                         ; Y = scaled vertical distance index

    ; --- 2. Horizontal Distance Falloff ---
    LDA $59                     ; Camera X left edge
    CLC
    ADC #$0080                  ; Screen center X (+128 px)
    SEC
    SBC $02                     ; dx = ScreenCenterX - EmitterX
    BPL .dx_positive
    DEC A
    EOR #$FFFF                  ; abs(dx)
.dx_positive:
    LSR A
    LSR A
    LSR A
    LSR A                       ; dx >> 4
    ASL A                       ; (dx >> 4) * 2
    TAX                         ; X = scaled horizontal distance index

    ; --- 3. Attenuation Penalty Lookup ---
    LDA $80AA27,X               ; Horizontal quadratic penalty
    CLC
    ADC $80AA27,Y               ; + Vertical quadratic penalty
    CMP #$3F01                  ; Out-of-range audible threshold?
    BCC .in_audible_range
    TDC                         ; Volume = 0
    BRA .send_volume_cmd

.in_audible_range:
    JSL $80AC27                 ; Quadratic distance to attenuation index
    TAX
    LDA $8C84D4,X               ; Read logarithmic attenuation curve
.send_volume_cmd:
    SEP #$20                    ; 8-bit A
    XBA                         ; Swap volume byte into high byte
    LDA $06                     ; Low byte = SFX ID
    REP #$20                    ; 16-bit A
    TAY                         ; Parameter: [Volume, SFX ID]
    LDA #$0036                  ; APU Command $36: Play Attenuated SFX
    JSL $8C81FD                 ; Dispatch IPC handshake across $2140-$2143

    ; --- 4. Stereo Panning Calculation ---
    LDA $59
    CLC
    ADC #$0080
    SEC
    SBC $02                     ; Signed pan delta: CenterX - EmitterX
    BMI .pan_right
    LSR A
    LSR A
    LSR A                       ; Positive: pan left (delta / 8)
    CMP #$0064                  ; Max pan +100
    BMI .clamp_pan_left
    LDA #$0064
.clamp_pan_left:
    BRA .send_pan_cmd

.pan_right:
    SEC
    ROR A
    SEC
    ROR A
    SEC
    ROR A                       ; Arithmetic shift right / 8 (negative)
    CMP #$FF9C                  ; Min pan -100
    BPL .clamp_pan_right
    LDA #$FF9C
.clamp_pan_right:
.send_pan_cmd:
    SEP #$20
    XBA                         ; Swap pan byte into high byte
    LDA $06                     ; Low byte = SFX ID
    REP #$20
    TAY                         ; Parameter: [Pan, SFX ID]
    LDA #$003E                  ; APU Command $3E: Set SFX Stereo Pan
    JSL $8C81FD                 ; Dispatch IPC handshake
    RTL

; ==============================================================================
; $8C:8619 - Master Music Volume Fade Stepper
; ==============================================================================
audio_music_fade_step:
    TDC
    SEP #$20
    LDA $9B                     ; Fade active indicator
    BNE .fade_in_progress
    REP #$20
    RTL

.fade_in_progress:
    BMI .fade_down
    CLC
    ADC $9A                     ; Advance fade up
    BCC .fade_commit
    STZ $9B                     ; Reached max target
    LDA #$85FF
    TXS
    REP #$20
    TAY
    LDA #$0028                  ; APU Command $28: Set Master Volume
    JSL $8C81FD
    RTL

.fade_down:
    CLC
    ADC $9A                     ; Advance fade down
    BCS .fade_commit
    STZ $9B                     ; Reached zero target
    LDA #$A900
    INC A
    LDY #$0000
    JSL $8C81FD
    LDY #$8000
    LDA #$221C
    SBC $8C81,X
    BRA .fade_commit

.fade_commit:
    REP #$20
    RTL
```

---

## 3. Clean C Decompilation

```c
/**
 * @file positional-audio.c
 * @brief Secret of Evermore 2D Positional Audio Spatialization & Attenuation
 *
 * Source: Bank $8C ($8C:8328 - $8C:8657)
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

#define MAX_STEREO_PAN_LEFT        100   /* +100 units */
#define MAX_STEREO_PAN_RIGHT     (-100)  /* -100 units ($FF9C) */
#define AUDIBLE_DISTANCE_LIMIT    0x3F01

#define APU_CMD_PLAY_ATTENUATED_SFX   0x0036
#define APU_CMD_SET_SFX_STEREO_PAN    0x003E
#define APU_CMD_SET_MASTER_VOLUME     0x0028

/**
 * @brief Global Audio & Camera State
 */
typedef struct {
    uint16_t camera_x;              /* DP $59: Camera viewport left edge */
    uint16_t camera_y;              /* DP $5B: Camera viewport top edge */
    uint16_t active_bgm_track;      /* $7E:0E44: Current music track ID */
    uint16_t active_sfx_id;         /* $7E:0E4F: Active SFX parameter */
    uint8_t  fade_step_rate;        /* DP $9A: Volume fade step increment */
    int8_t   fade_target_vol;       /* DP $9B: Volume fade target (signed) */
} AudioEngineState;

/* External Hardware & Table Interfaces */
extern void apu_ipc_handshake(uint16_t command, uint16_t parameter); /* $8C:81FD */
extern uint16_t lookup_distance_penalty(uint16_t delta_index);       /* $80:AA27 */
extern uint8_t lookup_attenuation_curve(uint16_t penalty_sum);       /* $8C:84D4 */

/**
 * @brief Resolves the required soundbank sample package for a track or SFX ($8C:8328).
 *
 * @param state Active audio state
 * @param is_sfx true if resolving for sound effect, false if BGM track
 * @param rom_bank81 Pointer to Bank $81 master soundbank catalog
 * @return uint8_t 8-bit sample package ID to upload into SPC700 ARAM
 */
uint8_t audio_resolve_soundbank_package(const AudioEngineState *state, bool is_sfx, const uint8_t *rom_bank81)
{
    uint8_t header_dim = rom_bank81[0x9900];
    uint16_t table_base = 0x9903 + ((header_dim + 1) * 3);

    uint16_t catalog_offset;
    if (!is_sfx) {
        catalog_offset = table_base + state->active_bgm_track;
    } else {
        uint8_t sfx_section = rom_bank81[0x9901];
        catalog_offset = table_base + sfx_section + state->active_sfx_id;
    }

    return rom_bank81[catalog_offset];
}

/**
 * @brief Plays a 2D sound effect with dynamic distance attenuation and stereo panning ($8C:8589).
 *
 * @param state Active camera and audio state
 * @param sfx_id Sound effect ID
 * @param emitter_x Emitter world X coordinate
 * @param emitter_y Emitter world Y coordinate
 */
void audio_play_positional_sfx(const AudioEngineState *state, uint8_t sfx_id, uint16_t emitter_x, uint16_t emitter_y)
{
    /* 1. Calculate Screen-Centered Delta Coordinates */
    int16_t center_x = (int16_t)(state->camera_x + 128);
    int16_t center_y = (int16_t)(state->camera_y + 112);

    int16_t raw_dx = center_x - (int16_t)emitter_x;
    int16_t raw_dy = center_y - (int16_t)emitter_y;

    uint16_t abs_dx = (uint16_t)abs(raw_dx);
    uint16_t abs_dy = (uint16_t)abs(raw_dy);

    /* 2. Quantize Deltas for Table Stride: (delta >> 4) * 2 */
    uint16_t idx_x = (abs_dx >> 4) << 1;
    uint16_t idx_y = (abs_dy >> 4) << 1;

    /* 3. Distance Attenuation & Audible Threshold Check */
    uint16_t penalty_x = lookup_distance_penalty(idx_x);
    uint16_t penalty_y = lookup_distance_penalty(idx_y);
    uint16_t total_distance = penalty_x + penalty_y;

    uint8_t volume = 0;
    if (total_distance < AUDIBLE_DISTANCE_LIMIT) {
        volume = lookup_attenuation_curve(total_distance);
    }

    /* 4. Transmit Volume Command to SPC700 */
    uint16_t vol_param = ((uint16_t)volume << 8) | sfx_id;
    apu_ipc_handshake(APU_CMD_PLAY_ATTENUATED_SFX, vol_param);

    /* 5. Compute Signed Stereo Panning: raw_dx / 8 clamped to [-100, +100] */
    int16_t pan = raw_dx >> 3;
    if (pan > MAX_STEREO_PAN_LEFT) {
        pan = MAX_STEREO_PAN_LEFT;
    } else if (pan < MAX_STEREO_PAN_RIGHT) {
        pan = MAX_STEREO_PAN_RIGHT;
    }

    /* 6. Transmit Stereo Panning Command to SPC700 */
    uint16_t pan_param = ((uint16_t)(uint8_t)(int8_t)pan << 8) | sfx_id;
    apu_ipc_handshake(APU_CMD_SET_SFX_STEREO_PAN, pan_param);
}

/**
 * @brief Advances the master music volume fade step ($8C:8619).
 *
 * @param state Active audio state
 */
void audio_music_fade_step(AudioEngineState *state)
{
    if (state->fade_target_vol == 0) {
        return;
    }

    if (state->fade_target_vol > 0) {
        /* Fade In */
        int16_t new_vol = state->fade_target_vol + state->fade_step_rate;
        if (new_vol >= 255) {
            state->fade_target_vol = 0;
            apu_ipc_handshake(APU_CMD_SET_MASTER_VOLUME, 0x85FF);
        } else {
            state->fade_target_vol = (int8_t)new_vol;
        }
    } else {
        /* Fade Out */
        int16_t new_vol = state->fade_target_vol - state->fade_step_rate;
        if (new_vol <= -128) {
            state->fade_target_vol = 0;
            apu_ipc_handshake(APU_CMD_SET_MASTER_VOLUME, 0x0000);
        } else {
            state->fade_target_vol = (int8_t)new_vol;
        }
    }
}
```

---

## 4. Verification & Behavioral Equivalence

| Subsystem Component | 65816 Assembly | C Reconstruction | Equivalence |
|---|---|---|---|
| **Center Reference** | `CameraX + 128`, `CameraY + 112` | `state->camera_x + 128`, `state->camera_y + 112` | Exact screen-center offsets |
| **Quantization** | `LSR A; LSR A; LSR A; LSR A; ASL A` | `(abs_delta >> 4) << 1` | Identical 16px table index stride |
| **Audible Limit** | `CMP #$3F01; BCC .in_audible_range; TDC` | `if (total_distance < 0x3F01) ... else vol = 0;` | Verified threshold cut-off |
| **Volume Command** | `LDA #$0036; JSL $8C81FD` with Y = `[Vol, SFX]` | `apu_ipc_handshake(APU_CMD_PLAY_ATTENUATED_SFX, vol_param)` | Matches SPC700 IPC protocol |
| **Stereo Pan Division** | `LSR A / ROR A` ($\div 8$) | `raw_dx >> 3` | Signed division preserves left/right polarity |
| **Pan Clamping** | Range `[#$FF9C, #$0064]` ($-100$ to $+100$) | Range `[-100, +100]` | Prevents phase distortion beyond max pan |
| **Pan Command** | `LDA #$003E; JSL $8C81FD` with Y = `[Pan, SFX]` | `apu_ipc_handshake(APU_CMD_SET_SFX_STEREO_PAN, pan_param)` | Matches SPC700 IPC protocol |
