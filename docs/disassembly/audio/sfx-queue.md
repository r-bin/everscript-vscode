# Sound Effect Dispatcher & APU Command Queue

> **ROM Bank**: `$8C` (Audio IPC & Driver Interface), `$81` (Soundbank Table `$81:9900`)  
> **Source Routines**: `$8C:82DC` (`play_sound_effect_direct`), `$8C:82E3` (`play_sound_effect_with_package`), `$8C:831D` (`apu_send_sfx_command`)  
> **Related Routines**: `$8C:81FD` (APU handshake & spinlock), `$8C:8236` (Song soundbank loader), `$8C:D6A7` (Script opcode 0x30/0x31/0x32 sound triggers), `$8C:8362` (SFX index table)  
> **Hardware Registers**: `$2140`–`$2143` (APU Communication Ports 0–3)  
> **Memory Map**: `$0E4F` (Active SFX parameter register), `$00A0`–`$00A2` (Direct page pointer to soundbank table)

---

## 1. Architectural Overview

The audio engine of *Secret of Evermore* runs on the dedicated Sony SPC700 audio coprocessor and 64 KB of audio RAM (ARAM). Communication between the 65816 main CPU and the SPC700 occurs exclusively across four 8-bit bidirectional I/O ports (`$2140`–`$2143`).

### Key Subsystems:
1. **Direct Sound Effect Trigger (`$8C:82DC`)**:
   - Used when a sound effect's BRR samples and ADSR envelopes are already resident in ARAM (common shared effects like sword slashes, menu bleeps, footsteps, and dog barks).
   - The sound effect ID is loaded into accumulator `A`, stored into WRAM register `$0E4F`, and immediately forwarded to `$8C:831D`.
2. **Soundbank Package Validation & Loading (`$8C:82E3`)**:
   - When triggering a specialized environment or monster effect whose sample package might not be loaded, the CPU inspects the master soundbank catalog at `$81:9900`.
   - The engine computes the soundbank table offset, reads the bank package ID, and calls `$8C:8236` to upload the missing BRR sample chunk to the SPC700 before firing the sound command.
3. **APU IPC Handshake Protocol (`$8C:831D` & `$8C:81FD`)**:
   - The engine sets register `Y` to the sound effect descriptor in `$0E4F`.
   - Accumulator `A` is loaded with command byte `0x0004` (SPC700 SFX trigger command).
   - Jumps to the APU spinlock handshake `$8C:81FD`:
     - Writes the command to port `$2140` and parameter to `$2141`–`$2142`.
     - Polls port `$2140` until the SPC700 driver acknowledges receipt by echoing back the sequence counter.
4. **Voice Channel Allocation (SPC700 Driver)**:
   - The SPC700 sound driver allocates voices dynamically across its 8 hardware channels:
     - **Channels 0–3**: Dedicated to music background tracks (melody, harmony, bass, rhythm).
     - **Channels 4–7**: Dedicated to dynamic sound effects. If all 4 SFX channels are occupied, higher-priority combat and UI sounds preempt lower-priority ambient effects.

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8C:82DC - Direct Sound Effect Trigger (Does not reload soundbank package)
; Input: A = Sound effect ID
; ==============================================================================
play_sound_effect_direct:
    REP #$30                    ; 16-bit A/X/Y
    STA $0E4F                   ; Save SFX ID in parameter register
    BRA apu_send_sfx_command

; ==============================================================================
; $8C:82E3 - Play Sound Effect (Loads sample package from $81:9900 if necessary)
; Input: A = Sound effect ID
; ==============================================================================
play_sound_effect_with_package:
    REP #$30
    STA $0E4F

    ; Calculate sound package table offset
    LDA $819900
    AND #$00FF
    INC A
    STA $A0
    ASL A
    CLC
    ADC $A0
    CLC
    ADC #$9903
    STA $A0

    LDA $819901
    AND #$00FF
    CLC
    ADC $A0
    CLC
    ADC $0E4F
    STA $A0

    SEP #$20                    ; 8-bit A
    LDA #$81
    STA $A2                     ; Bank $81
    REP #$20                    ; 16-bit A

    LDA [$A0]                   ; Fetch required package ID
    AND #$00FF
    JSL $8C8236                 ; Validate / stream soundbank into SPC700

; ==============================================================================
; $8C:831D - APU Handshake & SFX Command Dispatcher
; ==============================================================================
apu_send_sfx_command:
    LDY $0E4F                   ; Parameter = SFX ID
    LDA #$0004                  ; Command $04 = Play SFX
    JSL $8C81FD                 ; Dispatch IPC command across $2140-$2143
    RTL
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

#define APU_CMD_SFX_TRIGGER     0x04
#define APU_PORT_COMMAND        0x2140
#define APU_PORT_PARAM_LOW      0x2141
#define APU_PORT_PARAM_HIGH     0x2142
#define APU_PORT_STATUS         0x2143

#define NUM_SFX_CHANNELS        4    /* SPC700 channels 4 through 7 */

typedef enum {
    SFX_PRIORITY_LOW      = 0,  /* Ambient water droplets, rustling bushes */
    SFX_PRIORITY_NORMAL   = 1,  /* Footsteps, enemy movements */
    SFX_PRIORITY_HIGH     = 2,  /* Weapon swings, hit impacts, spell casts */
    SFX_PRIORITY_CRITICAL = 3   /* Menu clicks, dialogue beeps, level-up fanfares */
} SfxPriority;

typedef struct {
    uint8_t  sfx_id;
    uint8_t  package_id;
    uint8_t  priority;
    uint16_t pitch_offset;
} SfxDescriptor;

typedef struct {
    bool     active;
    uint8_t  current_sfx;
    uint8_t  priority;
    uint16_t remaining_ticks;
} SfxChannelState;

typedef struct {
    uint8_t         loaded_soundbank_id;
    uint8_t         ipc_sequence_counter;
    SfxChannelState channels[NUM_SFX_CHANNELS];
} AudioEngineState;

extern uint16_t rom_read16(uint32_t addr);
extern uint8_t  rom_read8(uint32_t addr);
extern void     spc700_upload_soundbank(uint8_t package_id);
extern void     spc700_handshake_send(uint8_t cmd, uint16_t param);

/**
 * Sends a sound effect trigger command to the SPC700 via hardware port handshake.
 * Corresponds to native routine $8C:831D.
 */
void apu_send_sfx_command(uint16_t sfx_id) {
    /* Command 0x04 = Play SFX; parameter Y = sfx_id */
    spc700_handshake_send(APU_CMD_SFX_TRIGGER, sfx_id);
}

/**
 * Fires a sound effect immediately without checking package residency.
 * Assumes the soundbank is already loaded in SPC700 RAM.
 * Corresponds to native routine $8C:82DC.
 */
void play_sound_effect_direct(AudioEngineState *audio, uint16_t sfx_id) {
    apu_send_sfx_command(sfx_id);
}

/**
 * Checks if the required sound package is loaded in SPC700 RAM before triggering.
 * If not loaded, uploads the BRR package first to prevent audio glitches.
 * Corresponds to native routine $8C:82E3.
 */
void play_sound_effect_with_package(AudioEngineState *audio, uint16_t sfx_id) {
    /* 1. Calculate soundbank package table address ($81:9900) */
    uint16_t base_count = rom_read8(0x819900) + 1;
    uint32_t table_addr = 0x819903 + (base_count * 3);
    uint16_t sub_offset = rom_read8(0x819901);
    
    uint32_t entry_addr = table_addr + sub_offset + sfx_id;
    uint8_t required_package = rom_read8(entry_addr);

    /* 2. Upload soundbank if missing */
    if (audio->loaded_soundbank_id != required_package) {
        spc700_upload_soundbank(required_package);
        audio->loaded_soundbank_id = required_package;
    }

    /* 3. Dispatch SFX trigger command */
    apu_send_sfx_command(sfx_id);
}

/**
 * SPC700 Voice Channel Allocator:
 * Selects an available voice channel (4-7) for an incoming sound effect.
 * Preempts active effects if the new effect has higher priority.
 */
int audio_allocate_sfx_channel(AudioEngineState *audio, uint8_t sfx_id, uint8_t priority) {
    /* Pass 1: Find completely free channel */
    for (int i = 0; i < NUM_SFX_CHANNELS; i++) {
        if (!audio->channels[i].active) {
            audio->channels[i].active = true;
            audio->channels[i].current_sfx = sfx_id;
            audio->channels[i].priority = priority;
            return i;
        }
    }

    /* Pass 2: Preempt lowest priority voice */
    int lowest_channel = -1;
    uint8_t lowest_priority = priority;

    for (int i = 0; i < NUM_SFX_CHANNELS; i++) {
        if (audio->channels[i].priority < lowest_priority) {
            lowest_priority = audio->channels[i].priority;
            lowest_channel = i;
        }
    }

    if (lowest_channel >= 0) {
        audio->channels[lowest_channel].current_sfx = sfx_id;
        audio->channels[lowest_channel].priority = priority;
        return lowest_channel;
    }

    /* Rejected: all voices occupied by higher or equal priority */
    return -1;
}
```
