# Room Entrance Character Orientation, Spawn Scripting, and Audio Fade Engine ($8E:E508 – $8E:E630)

## 1. Subsystem Architecture Overview

When transitioning into a new room, Secret of Evermore synchronizes entity script initialization, geometry validation, and smooth audio fading through a dedicated coordination loop in Bank `$8E`:

1. **Pre-Roll Frame Loop & Character Script Spawn (`$8E:E508` – `$8E:E567`)**:
   - Evaluates spawn dispatch trigger bits in `$7E:05A9`:
     - Bit 1 (`0x0002`): Resets bit and spawns Boy initialization script (`0x4E89`) using script engine thread spawner `$8E:A091`.
     - Bit 2 (`0x0004`): Resets bit and spawns Dog initialization script (`0x4F37`) using thread spawner `$8E:A091`.
   - Advances room physics and script VMs by calling `per_frame_field_tick` (`$8E:E41E`).
   - Polls room readiness tri-state flags in `$7E:22EA`:
     - Bit 3 (`0x0008`): Map metatile and collision planes decompressed and active.
     - Bit 4 (`0x0010`): Character entity records allocated and initial coordinates aligned.
     - Bit 5 (`0x0020`): Palette DMA gradient initialized.
   - Loops until all 3 bits are simultaneously asserted.

2. **Room Transition Audio Fade-Out & DSP Reset (`$8E:E592` – `$8E:E5C1`)**:
   - Reads current master volume attenuation level from `$7E:0106` bits 3..0.
   - Sequentially steps down volume frame-by-frame:
     - Waits for V-Blank interrupt via `$80:858C`.
     - Multiplies attenuation level by 16 (`ASL` $\times 4$) into register `Y`.
     - Dispatches APU master attenuation command `0x0028` via handshake spinlock.
     - Decrements volume counter `$7E:0B7F` until zero.
   - Issues APU command `0x001A` (sound effect fade/silence) with `Y = 0`.
   - Issues APU command `0x001C` (DSP stereo echo reset) with `Y = 0x8000`.
   - Resets per-room sound latch via `$80:85D8`.

3. **Per-Frame Dynamic Master Volume Fader (`$8E:E5FC` – `$8E:E630`)**:
   - Runs every frame during `per_frame_field_tick` (`$8E:E470`).
   - Checks mute / master override bit 7 in `$7E:0106`; if set, bypasses fade.
   - Evaluates target volume latch `$7E:0B83`:
     - If negative (`0xFF`), fading is inactive.
     - If active:
       - Compares target volume `$7E:0B83` against current volume `$7E:0106`.
       - If current $>$ target: decrements `$7E:0106` (smooth fade-out).
       - If current $<$ target: increments `$7E:0106` (smooth fade-in).
       - Upon reaching target: zeroes out latch `$7E:0B83` to finalize fade.

---

## 2. 65816 Disassembly Analysis

```assembly
; ==============================================================================
; room_enter_pre_roll_wait_and_entity_spawn ($8E:E508 - $8E:E567)
; ==============================================================================
$8E:E508  A9 02 00     LDA #$0002
$8E:E50B  1C A9 05     TRB $05A9           ; Test and reset Bit 1 (Spawn Boy script)
$8E:E50E  F0 17        BEQ $8EE527         ; If not set, check Dog
$8E:E510  A9 99 8E     LDA #$8E99          ; Script bank pointer high
$8E:E513  85 98        STA $98
$8E:E515  A9 8C 99     LDA #$998C          ; Script bank pointer low
$8E:E518  85 97        STA $97
$8E:E51A  A9 89 4E     LDA #$4E89          ; Script entry offset: Boy Room Spawn
$8E:E51D  8D A7 05     STA $05A7
$8E:E520  22 91 A0 8E  JSL $8EA091         ; Launch script thread for Boy
$8E:E524  4C 43 E5     JMP $8EE543

$8E:E527  A9 04 00     LDA #$0004
$8E:E52A  1C A9 05     TRB $05A9           ; Test and reset Bit 2 (Spawn Dog script)
$8E:E52D  F0 14        BEQ $8EE543
$8E:E52F  A9 99 8E     LDA #$8E99
$8E:E532  85 98        STA $98
$8E:E534  A9 98 99     LDA #$9998
$8E:E537  85 97        STA $97
$8E:E539  A9 37 4F     LDA #$4F37          ; Script entry offset: Dog Room Spawn
$8E:E53C  8D A7 05     STA $05A7
$8E:E53F  22 91 A0 8E  JSL $8EA091         ; Launch script thread for Dog

; Poll readiness flags:
$8E:E543  22 1E E4 8E  JSL $8EE41E         ; Advance 1 field frame tick
$8E:E547  AF EA 22 7E  LDA $7E22EA         ; System readiness flags
$8E:E54B  89 08 00     BIT #$0008          ; Bit 3: Map metatiles & collision loaded?
$8E:E54E  F0 17        BEQ $8EE567         ; If not, repeat frame pre-roll
$8E:E550  AF EA 22 7E  LDA $7E22EA
$8E:E554  89 10 00     BIT #$0010          ; Bit 4: Entities placed and facing set?
$8E:E557  F0 0E        BEQ $8EE567
$8E:E559  AF EA 22 7E  LDA $7E22EA
$8E:E55D  89 20 00     BIT #$0020          ; Bit 5: Palette fade ready?
$8E:E560  F0 05        BEQ $8EE567
$8E:E562  22 92 E5 8E  JSL $8EE592         ; Execute audio fadeout & DSP reset
$8E:E566  6B           RTL                 ; Return to main game loop!

$8E:E567  4C 08 E5     JMP $8EE508         ; Repeat until fully ready

; ==============================================================================
; room_transition_audio_fadeout_and_dsp_reset ($8E:E592 - $8E:E5C1)
; ==============================================================================
$8E:E592  AD 06 01     LDA $0106           ; Current master volume ($7E:0106)
$8E:E595  29 0F 00     AND #$000F          ; Mask low 4 bits (volume level 0..15)
$8E:E598  8D 7F 0B     STA $0B7F           ; Volume loop counter

$8E:E59B  22 8C 85 80  JSL $80858C         ; Wait for V-Blank interrupt
$8E:E59F  AD 7F 0B     LDA $0B7F
$8E:E5A2  0A 0A 0A 0A  ASL : ASL : ASL : ASL ; Shift left 4 -> 0x00..0xF0
$8E:E5A6  A8           TAY                 ; Volume attenuation in Y
$8E:E5A7  A9 28 00     LDA #$0028          ; APU Command 0x0028: Set Master Volume
$8E:E5AA  22 19 86 8C  JSL $8C8619         ; Handshake with APU register $2140
$8E:E5AE  AD 06 01     LDA $0106
$8E:E5B1  29 80 00     AND #$0080          ; Preserve mute bit 7
$8E:E5B4  0D 7F 0B     ORA $0B7F
$8E:E5B7  8D 06 01     STA $0106           ; Update current volume mirror
$8E:E5BA  CE 7F 0B     DEC $0B7F           ; Decrement volume level
$8E:E5BD  30 02        BMI $8EE5C1
$8E:E5BF  D0 DA        BNE $8EE59B         ; Repeat until 0

$8E:E5C1  9C 7F 0B     STZ $0B7F           ; Volume zeroed
$8E:E5C4  A9 1A 00     LDA #$001A          ; APU Command 0x001A: Silence SFX
$8E:E5C7  A0 00 00     LDY #$0000
$8E:E5CA  22 19 86 8C  JSL $8C8619
$8E:E5CE  A0 00 80     LDY #$8000
$8E:E5D1  A9 1C 00     LDA #$001C          ; APU Command 0x001C: Reset DSP Echo
$8E:E5D4  22 19 86 8C  JSL $8C8619
$8E:E5D8  22 D8 85 80  JSL $8085D8         ; Reset sound state latch
$8E:E5DC  6B           RTL

; ==============================================================================
; audio_master_volume_fade_tick ($8E:E5FC - $8E:E630)
; ==============================================================================
$8E:E5FC  AD 06 01     LDA $0106
$8E:E5FF  89 80 00     BIT #$0080          ; Is mute bit active?
$8E:E602  D0 2A        BNE $8EE62E         ; If so, bypass fade
$8E:E604  AD 83 0B     LDA $0B83           ; Target volume latch ($7E:0B83)
$8E:E607  30 25        BMI $8EE62E         ; If negative (0xFF), no fade active
$8E:E609  E2 20        SEP #$20            ; 8-bit mode
$8E:E60B  AD 83 0B     LDA $0B83
$8E:E60E  CD 06 01     CMP $0106           ; Compare target with current volume
$8E:E611  F0 19        BEQ $8EE62C         ; Target reached!
$8E:E613  10 0C        BPL $8EE621         ; If target > current, fade up

; Fade down:
$8E:E615  CE 06 01     DEC $0106           ; Current volume -= 1
$8E:E618  CD 06 01     CMP $0106
$8E:E61B  F0 0F        BEQ $8EE62C
$8E:E61D  C2 20        REP #$20
$8E:E61F  6B           RTL

; Fade up:
$8E:E621  EE 06 01     INC $0106           ; Current volume += 1
$8E:E624  CD 06 01     CMP $0106
$8E:E627  F0 03        BEQ $8EE62C
$8E:E629  C2 20        REP #$20
$8E:E62B  6B           RTL

; Target reached:
$8E:E62C  C2 20        REP #$20
$8E:E62E  9C 83 0B     STZ $0B83           ; Clear target volume latch
$8E:E631  6B           RTL
```

---

## 3. Clean C Reconstructed Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define ROOM_FLAG_TILES_LOADED     0x0008  /* $7E:22EA bit 3 */
#define ROOM_FLAG_ENTITIES_ALIGNED 0x0010  /* $7E:22EA bit 4 */
#define ROOM_FLAG_PALETTE_READY    0x0020  /* $7E:22EA bit 5 */
#define ROOM_READY_ALL_MASK        (ROOM_FLAG_TILES_LOADED | ROOM_FLAG_ENTITIES_ALIGNED | ROOM_FLAG_PALETTE_READY)

#define SPAWN_BOY_SCRIPT_BIT       0x0002  /* $7E:05A9 bit 1 */
#define SPAWN_DOG_SCRIPT_BIT       0x0004  /* $7E:05A9 bit 2 */

#define APU_CMD_SET_VOLUME         0x0028
#define APU_CMD_SILENCE_SFX        0x001A
#define APU_CMD_RESET_DSP_ECHO     0x001C

/* WRAM State */
typedef struct {
    uint16_t spawn_triggers;      /* $7E:05A9 */
    uint16_t current_volume;      /* $7E:0106: bit 7 = mute, bits 3..0 = level */
    int16_t  target_volume_fade;  /* $7E:0B83: -1 / 0xFF = inactive */
    uint16_t volume_fade_counter; /* $7E:0B7F */
    uint16_t room_state_flags;    /* $7E:22EA */
} RoomEntranceSystemState;

extern RoomEntranceSystemState g_room_state;

/* External Subsystems */
extern void script_spawn_thread(uint32_t script_address);       /* $8E:A091 */
extern void per_frame_field_tick(void);                         /* $8E:E41E */
extern void wait_for_vblank(void);                              /* $80:858C */
extern void apu_send_command(uint16_t cmd, uint16_t arg);       /* $8C:8619 */
extern void sound_reset_latches(void);                          /* $80:85D8 */

/**
 * Executes the room transition audio fade-out, silences SFX, and resets DSP echo.
 * Corresponds to native routine $8E:E592.
 */
void room_transition_audio_fadeout_and_dsp_reset(void) {
    uint16_t vol_level = g_room_state.current_volume & 0x000F;
    g_room_state.volume_fade_counter = vol_level;

    // Step-down volume loop
    while (g_room_state.volume_fade_counter > 0) {
        wait_for_vblank();

        uint16_t attenuation = (g_room_state.volume_fade_counter << 4) & 0x00F0;
        apu_send_command(APU_CMD_SET_VOLUME, attenuation);

        // Update current volume mirror preserving mute bit
        g_room_state.current_volume = (g_room_state.current_volume & 0x0080) |
                                      (g_room_state.volume_fade_counter & 0x000F);

        g_room_state.volume_fade_counter--;
    }

    g_room_state.volume_fade_counter = 0;

    // Silence SFX and reset DSP echo buffers
    apu_send_command(APU_CMD_SILENCE_SFX, 0x0000);
    apu_send_command(APU_CMD_RESET_DSP_ECHO, 0x8000);
    sound_reset_latches();
}

/**
 * Pre-roll coordination loop: spawns character initialization scripts and executes
 * field ticks until collision, entities, and palettes are fully prepared.
 * Corresponds to native routine $8E:E508.
 */
void room_enter_pre_roll_wait_and_entity_spawn(void) {
    while (true) {
        // Test and spawn Boy script
        if (g_room_state.spawn_triggers & SPAWN_BOY_SCRIPT_BIT) {
            g_room_state.spawn_triggers &= ~SPAWN_BOY_SCRIPT_BIT;
            script_spawn_thread(0x8E4E89); // Script: Boy Spawn
        }
        // Test and spawn Dog script
        else if (g_room_state.spawn_triggers & SPAWN_DOG_SCRIPT_BIT) {
            g_room_state.spawn_triggers &= ~SPAWN_DOG_SCRIPT_BIT;
            script_spawn_thread(0x8E4F37); // Script: Dog Spawn
        }

        // Advance 1 field frame
        per_frame_field_tick();

        // Check if map collision, entity positions, and palettes are all ready
        if ((g_room_state.room_state_flags & ROOM_READY_ALL_MASK) == ROOM_READY_ALL_MASK) {
            room_transition_audio_fadeout_and_dsp_reset();
            return; // Room transition complete, ready for interactive gameplay!
        }
    }
}

/**
 * Per-frame master volume interpolation helper ($8E:E5FC).
 * Smoothly ramps master volume toward target level every frame.
 */
void audio_master_volume_fade_tick(void) {
    // If master mute flag is set, do not alter volume
    if (g_room_state.current_volume & 0x0080) {
        return;
    }

    // Inactive if target volume latch is negative
    if (g_room_state.target_volume_fade < 0) {
        return;
    }

    uint8_t target = (uint8_t)g_room_state.target_volume_fade;
    uint8_t current = (uint8_t)(g_room_state.current_volume & 0x000F);

    if (current > target) {
        current--;
        g_room_state.current_volume = (g_room_state.current_volume & ~0x000F) | current;
    } else if (current < target) {
        current++;
        g_room_state.current_volume = (g_room_state.current_volume & ~0x000F) | current;
    }

    // If target has been reached, finalize fade
    if (current == target) {
        g_room_state.target_volume_fade = -1; // Clear fade latch
    }
}
```

---

## 4. Architectural Invariants & Memory Anchors

- **Readiness Bitfield `$7E:22EA`**:
  - Acts as the primary inter-subsystem barrier. The room loader sets bit 3 when decompression of tile layer data completes, bit 4 when player and companion coordinates are snapped to entrance vectors, and bit 5 when color palette buffers are primed for display.
- **Spawn Trigger Register `$7E:05A9`**:
  - Bit 1 (`0x0002`): Triggers creation of the Boy entity's entering animation and state script thread (`$8E:4E89`).
  - Bit 2 (`0x0004`): Triggers creation of the Dog entity's entering script thread (`$8E:4F37`).
  - Both bits are atomically cleared via `TRB` before launching to prevent thread duplicity.
- **APU Communication Protocol**:
  - Command `0x0028` sends volume attenuation in increments of 16 ($0 \dots 240$), producing a smooth perceptual decibel drop over $\approx 15$ frames without audio popping.
  - Commands `0x001A` and `0x001C` ensure no lingering sound effect channels or reverberating DSP delay echoes corrupt the incoming room's musical identity.
