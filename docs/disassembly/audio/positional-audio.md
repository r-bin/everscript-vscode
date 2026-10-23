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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8C8328](soe://rom/code/8C8328?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C8328_positional_audio.c`](../../../reconstructed-c/8C/8C8328_positional_audio.c).
> [View in VFS: soe://rom/code/8C8328](soe://rom/code/8C8328?c=1&asm=0)


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
