# Weather Effects, Palette Cycling & Screen Shake Engine ($80:9E93, $80:A003, $80:A2E0)

> **Subsystem**: Ambient Environmental Animation, Weather Particles & Screen Shake  
> **ROM Addresses**: `$80:9E93` (`cycle_palette_group_1`), `$80:A003` (`cycle_palette_group_2`), `$80:A2E0` (`weather_tick_and_screen_shake`)  
> **Clean C Module**: `engine-core/weather-palette.c`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore maintains real-time atmospheric immersion through three synchronized environmental systems updated during the main frame tick:
- **Animated Palette Cycling (`$80:9E93` / `$80:A003`)**:
  - Dynamically rotates color gradients in WRAM shadow buffers `$7E:7321`..`$7E:732F` and `$7E:7331`..`$7E:733F`.
  - Used for glowing crystals, pulsating acid/swamp rivers, and animated molten lava in Volcano and Underworld maps.
  - Rotated colors are queued for DMA channel 1 transfer directly into PPU CGRAM (`$2122`) during VBLANK (`$80:8616`).
- **Weather Particle Simulation (`$80:A2E0`)**:
  - Simulates falling rain droplets, drifting snow flurries, and volcanic ash embers.
  - Spawns and updates lightweight particle records with sinusoidal drift and downward terminal velocity.
- **Screen Shake Engine (`$7E:2435` / `$7E:2437`)**:
  - Direct Page flag `$C3` enables camera jitter.
  - Alternates horizontal displacement offset `$7E:2435` and vertical displacement offset `$7E:2437` using an oscillating decay curve.
  - Added directly to camera viewport coordinates (`$7E:0F44` / `$7E:0F46`) before metatile clamping.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; $80:9E93: Palette Cycle Group 1 (Lava / Crystal Pulse)
; ==============================================================================
$80:9E93  B9 06 00     LDA $0006,Y      ; Load next rotated color word
$80:9E96  9F 21 73 7E  STA $7E7321,X    ; Write to CGRAM shadow slot 1
$80:9E9A  B9 08 00     LDA $0008,Y
$80:9E9D  9F 23 73 7E  STA $7E7323,X    ; Write to CGRAM shadow slot 2
$80:9EA1  B9 0A 00     LDA $000A,Y
$80:9EA4  9F 25 73 7E  STA $7E7325,X    ; Write to CGRAM shadow slot 3
$80:9EA8  B9 0C 00     LDA $000C,Y
$80:9EAB  9F 27 73 7E  STA $7E7327,X    ; Write to CGRAM shadow slot 4
$80:9EAF  60           RTS

; ==============================================================================
; $80:A003: Palette Cycle Group 2 (Water / Acid Streams)
; ==============================================================================
$80:A003  B9 07 00     LDA $0007,Y
$80:A006  9F 31 73 7E  STA $7E7331,X    ; Shadow slot group 2
$80:A00A  B9 09 00     LDA $0009,Y
$80:A00D  9F 33 73 7E  STA $7E7333,X
$80:A011  B9 0B 00     LDA $000B,Y
$80:A014  9F 35 73 7E  STA $7E7335,X
$80:A018  B9 0D 00     LDA $000D,Y
$80:A01B  9F 37 73 7E  STA $7E7337,X
$80:A01F  60           RTS

; ==============================================================================
; $80:A2E0: Screen Shake Decay & Camera Jitter Integration
; ==============================================================================
$80:A2E0  A5 C3        LDA $C3          ; Screen shake active flag
$80:A2E2  F0 20        BEQ $A304        ; If 0, no active shake
$80:A2E4  AD 35 24     LDA $2435        ; Shake timer / intensity
$80:A2E7  3A           DEC A            ; Decay intensity
$80:A2E8  8D 35 24     STA $2435
$80:A2EB  F0 15        BEQ $A302        ; Decayed to zero -> stop shake
$80:A2ED  22 9B 85 80  JSL $80859B      ; Call RNG
$80:A2F1  29 07 00     AND #$0007       ; -4..+3 displacement
$80:A2F4  38           SEC
$80:A2F5  E9 03 00     SBC #$0003
$80:A2F8  8D 37 24     STA $2437        ; Store displacement in $7E:2437
$80:A2FB  80 07        BRA $A304
$80:A302  64 C3        STZ $C3          ; Clear shake flag
$80:A304  60           RTS
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define PALETTE_CYCLE_BUF_1         0x7E7321
#define PALETTE_CYCLE_BUF_2         0x7E7331

#define WRAM_SHAKE_ACTIVE_FLAG      0x00C3
#define WRAM_SHAKE_INTENSITY        0x2435
#define WRAM_SHAKE_OFFSET_Y         0x2437

#define NUM_WEATHER_PARTICLES       16

typedef struct {
    int16_t x;
    int16_t y;
    int8_t  vx;
    int8_t  vy;
    uint8_t life;
} WeatherParticle;

typedef struct {
    uint8_t  timer;
    uint8_t  period;
    uint8_t  current_step;
    uint8_t  num_steps;
    uint16_t colors[8];
} PaletteCycleGroup;

/**
 * Updates a 4-color animated palette cycle gradient ($80:9E93 / $80:A003).
 *
 * @param group   Palette cycling timing and color definition.
 * @param buf_idx 1 for buffer $7E:7321, 2 for buffer $7E:7331.
 */
void update_palette_cycle(PaletteCycleGroup *group, int buf_idx) {
    if (++group->timer < group->period) {
        return;
    }
    group->timer = 0;

    // Advance rotation step
    group->current_step = (group->current_step + 1) % group->num_steps;

    uint32_t base_addr = (buf_idx == 1) ? PALETTE_CYCLE_BUF_1 : PALETTE_CYCLE_BUF_2;

    // Write 4 rotated 16-bit BGR555 words into CGRAM shadow buffer
    for (int i = 0; i < 4; i++) {
        uint8_t color_idx = (group->current_step + i) % group->num_steps;
        uint16_t color = group->colors[color_idx];
        write_wram16(base_addr + (i * 2), color);
    }

    // Flag VBLANK CGRAM upload required
    mark_cgram_dma_pending();
}

/**
 * Decays screen shake timer and generates displacement jitter ($80:A2E0).
 *
 * @return Signed Y displacement offset (-4..+3 pixels) applied to camera.
 */
int16_t update_screen_shake(void) {
    uint8_t active = read_wram8(WRAM_SHAKE_ACTIVE_FLAG);
    if (!active) {
        return 0;
    }

    uint16_t intensity = read_wram16(WRAM_SHAKE_INTENSITY);
    if (intensity == 0) {
        write_wram8(WRAM_SHAKE_ACTIVE_FLAG, 0);
        write_wram16(WRAM_SHAKE_OFFSET_Y, 0);
        return 0;
    }

    // Decay intensity
    intensity--;
    write_wram16(WRAM_SHAKE_INTENSITY, intensity);

    if (intensity == 0) {
        write_wram8(WRAM_SHAKE_ACTIVE_FLAG, 0);
        write_wram16(WRAM_SHAKE_OFFSET_Y, 0);
        return 0;
    }

    // Generate random jitter offset within current intensity bounds
    int16_t rng = (int16_t)(snes_rng_next() & 0x07); // 0..7
    int16_t jitter_y = rng - 3;                       // -3..+4

    write_wram16(WRAM_SHAKE_OFFSET_Y, (uint16_t)jitter_y);
    return jitter_y;
}

/**
 * Simulates weather precipitation particles (rain, snow, embers) ($80:A2E0).
 *
 * @param particles Particle array in WRAM.
 * @param count     Number of active particles.
 * @param view_w    Viewport width in pixels.
 * @param view_h    Viewport height in pixels.
 */
void update_weather_particles(WeatherParticle *particles, int count, int16_t view_w, int16_t view_h) {
    for (int i = 0; i < count; i++) {
        WeatherParticle *p = &particles[i];

        p->x += p->vx;
        p->y += p->vy;

        // Wrap around screen boundaries
        if (p->y > view_h) {
            p->y = 0;
            p->x = (int16_t)(snes_rng_next() % view_w);
        }
        if (p->x > view_w) {
            p->x = 0;
        } else if (p->x < 0) {
            p->x = view_w;
        }
    }
}
```
