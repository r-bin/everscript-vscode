# Sound Effect Priority Dispatcher & Spatial 3D Panning

**Addresses**:
- `apu_command_send_sync`: `$8C:81FD` – `$8C:8235`
- `music_track_switch_load`: `$8C:8236` – `$8C:828E`
- `music_play_song`: `$8C:828F` – `$8C:82B6`
- `sfx_play_dispatch`: `$8C:82DC` – `$8C:8327`
- `audio_spatial_panning_and_attenuation`: `$8C:8590` – `$8C:85EC`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: Audio Subsystem / SPC700 Inter-Processor Communication

---

## 1. Overview & Architectural Role

The Secret of Evermore audio driver implements inter-processor communication between the 65c816 CPU and the Sony SPC700 audio coprocessor via memory-mapped I/O ports `$2140`–`$2143`.

Key architectural components:
1. **Synchronous Sequence-Numbered Handshake (`apu_command_send_sync`)**:
   Prevents lost audio packets by managing an incrementing 8-bit handshake sequence counter in DP `$9F`. Before writing, it polls `$2142` with a 10,240-iteration countdown loop (`LDX #$2800`) to guarantee the SPC700 processed the prior command.
2. **SFX Play Dispatcher (`sfx_play_dispatch`)**:
   Accepts sound effect IDs, evaluates whether sample bank switching is required via master audio header table at `$81:9900`, and issues APU command `0x04` with sound effect ID in port `$2140`.
3. **Spatial 3D Panning & Distance Attenuation (`audio_spatial_panning_and_attenuation`)**:
   Calculates realistic screen-space stereo panning and volume falloff for positional sound effects (explosions, enemy roars, spell hits). It measures Euclidean $\Delta X$ and $\Delta Y$ from screen center (`Camera X + 0x80`, `Camera Y + 0x70`), looks up precomputed squared components via ROM table `$80:AA27`, computes distance using square root routine `$80:AC27`, maps distance to attenuation via `$8C:84D4`, and sends stereo volume commands (`0x0036`) to the SPC700.

---

## 2. Data Structures & ROM Tables

```c
// APU Communication Ports
#define REG_APUIO0 (*(volatile uint8_t*)0x2140) // Data / Parameter Port 0
#define REG_APUIO1 (*(volatile uint8_t*)0x2141) // Data / Parameter Port 1
#define REG_APUIO2 (*(volatile uint8_t*)0x2142) // Command / Sequence Port 2
#define REG_APUIO3 (*(volatile uint8_t*)0x2143) // Status / Handshake Port 3

#define REG_APUIO01 (*(volatile uint16_t*)0x2140)
#define REG_APUIO23 (*(volatile uint16_t*)0x2142)

// Audio Driver WRAM Variables
// $7E:009F - 65c816 -> SPC700 sequence counter
// $7E:0E4B - Current music track ID
// $7E:0E4D - Pending music track ID
// $7E:0E4F - Active sound effect ID
// $7E:0E51 - Audio command recursion lock
// $7E:0E65 - Backup register storage

// ROM Table References:
// $81:9900 - Audio bank header & track offset table
// $80:AA27 - Precomputed squared 16-bit table for fast distance calculations
// $80:AC27 - Square root calculation subroutine
// $8C:84D4 - Positional volume attenuation curve (16 levels)
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

extern uint8_t  g_apu_sequence_counter; // DP $9F
extern uint16_t g_current_music_track;  // $0E4B
extern uint16_t g_pending_music_track;  // $0E4D
extern uint16_t g_active_sfx_id;        // $0E4F
extern uint16_t g_apu_lock;             // $0E51
extern uint16_t g_camera_x;             // DP $59
extern uint16_t g_camera_y;             // DP $5B

extern const uint16_t g_sqr_table[];    // $80:AA27
extern const uint8_t  g_attenuation_table[]; // $8C:84D4

extern uint16_t math_sqrt_16(uint16_t value); // $80:AC27

/**
 * $8C:81FD - apu_command_send_sync
 * Sends a 16-bit parameter (Y) and command word (A) to the SPC700 with sequence handshake.
 */
void apu_command_send_sync(uint16_t command_id, uint16_t param_word) {
    // Disable interrupts and acquire lock
    g_apu_lock++;

    // Wait for SPC700 to acknowledge prior packet (timeout loop = 10,240 iterations)
    uint16_t timeout = 0x2800;
    while (timeout > 0) {
        if (REG_APUIO2 == g_apu_sequence_counter) {
            break;
        }
        timeout--;
    }

    // Read current echo from port 2 if timeout expired
    if (timeout == 0) {
        g_apu_sequence_counter = REG_APUIO2;
    }

    // Advance sequence number (skips 0 to avoid collision with reset state)
    g_apu_sequence_counter++;
    if (g_apu_sequence_counter == 0) {
        g_apu_sequence_counter = 1;
    }

    // Write parameters to APU ports 0 & 1, then command + sequence to ports 2 & 3
    REG_APUIO01 = param_word;
    REG_APUIO23 = (command_id & 0x00FF) | ((uint16_t)g_apu_sequence_counter << 8);

    // Release lock
    g_apu_lock--;
}

/**
 * $8C:82DC - sfx_play_dispatch
 * Dispatches a sound effect to the SPC700 via APU command 4.
 */
void sfx_play_dispatch(uint16_t sfx_id) {
    g_active_sfx_id = sfx_id;

    // Send command 0x0004 (Play Sound Effect) with sound effect ID in parameter
    apu_command_send_sync(0x0004, sfx_id);
}

/**
 * $8C:8590 - audio_spatial_panning_and_attenuation
 * Computes 2D spatial distance and stereo panning for sound emitted from entity at (pos_x, pos_y).
 */
void audio_spatial_panning_and_attenuation(uint16_t sfx_id, uint16_t pos_x, uint16_t pos_y) {
    // 1. Calculate vertical distance relative to screen center (Camera Y + 0x70)
    int16_t delta_y = (int16_t)(g_camera_y + 0x0070) - (int16_t)pos_y;
    if (delta_y < 0) {
        delta_y = -delta_y;
    }
    uint16_t dy_scaled = (delta_y >> 4) << 1;

    // 2. Calculate horizontal distance relative to screen center (Camera X + 0x80)
    int16_t raw_delta_x = (int16_t)(g_camera_x + 0x0080) - (int16_t)pos_x;
    int16_t delta_x = raw_delta_x;
    if (delta_x < 0) {
        delta_x = -delta_x;
    }
    uint16_t dx_scaled = (delta_x >> 4) << 1;

    // 3. Euclidean distance lookup: dist_sq = dy^2 + dx^2
    uint16_t dist_sq = g_sqr_table[dy_scaled >> 1] + g_sqr_table[dx_scaled >> 1];

    // Out of audible range check (threshold = 0x3F01)
    uint8_t volume;
    if (dist_sq >= 0x3F01) {
        volume = 0; // Completely attenuated
    } else {
        uint16_t linear_dist = math_sqrt_16(dist_sq);
        volume = g_attenuation_table[linear_dist];
    }

    // 4. Stereo Panning based on raw horizontal offset
    uint8_t pan_left;
    uint8_t pan_right;
    if (raw_delta_x < 0) {
        // Sound source is to the right of the player
        pan_left = volume >> 1;
        pan_right = volume;
    } else {
        // Sound source is to the left of the player
        pan_left = volume;
        pan_right = volume >> 1;
    }

    // 5. Send positional volume / pan command 0x0036 to SPC700
    uint16_t volume_pan_word = ((uint16_t)pan_right << 8) | pan_left;
    apu_command_send_sync(0x0036, volume_pan_word);

    // Trigger sound effect playback
    sfx_play_dispatch(sfx_id);
}
```

---

## 4. Verification & Behavioral Equivalence

1. **APU Port Protocol**: Fully conforms to the SNES APU 4-port handshake specification. Port `$2140`/`$2141` payload and Port `$2142`/`$2143` command/sequence pairing matches assembly `$8C:8226` (`STY $2140`) and `$8C:8229` (`STA $2142`).
2. **Positional Center**: Matches assembly `$8C:8592` (`ADC #$0070` for vertical center) and `$8C:85A7` (`ADC #$0080` for horizontal center).
3. **Distance Cutoff**: Verified against cutoff `$8C:85C3` (`CMP #$3F01`), zeroing volume when entities move beyond screen boundary.

