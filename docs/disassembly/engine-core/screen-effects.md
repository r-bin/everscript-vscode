# Screen Shake, Palette Flash & Visual FX Pipeline

> **ROM Bank**: `$80` (Screen & PPU Driver)  
> **Source Routines**: `$80:A100` (`palette_transfer_stream_block`), `$80:A16E` (`palette_cgram_buffer_commit`)  
> **Related Routines**: `$80:A2E0` (`weather_tick_and_screen_shake`), `$80:823A` (`nmi_vblank_handler`)  
> **Hardware Registers**: SNES PPU `$2121` (CGADD - CGRAM Address), `$2122` (CGDATA - Color Data Write), `$2106` (MOSAIC)  
> **Memory Map**: `$7E:2435` (Screen shake intensity timer), `$7E:2437` (Screen shake vertical pixel offset), `$7E:7321`–`$7E:734F` (CGRAM shadow buffer)

---

## 1. Architectural Overview

Special visual effects in *Secret of Evermore*—earthquake screen tremors, damage flashes (red screen flash when struck), recovery auras, and color rotation—are driven by a synchronized PPU shadow pipeline in Bank `$80`. Because the SNES main CPU cannot write directly to CGRAM (Color RAM) during active display scanlines, color transformations are staged in WRAM shadow buffers (`$7E:7321`–`$7E:734F`) and transferred via DMA or loop streaming during Vertical Blanking (VBLANK).

### Key Subsystems:
1. **Palette Transfer Streaming (`$80:A100`)**:
   - Updates animated sub-palettes (e.g. glowing lava in Volcano, crystalline glows in Antiqua, and damage hit flashes).
   - Reads color sequences from ROM table pointers `$0007,y` and copies 16-color chunks into WRAM CGRAM shadow buffer `$7E:7339`–`$7E:734F`.
2. **CGRAM Commit Pipeline (`$80:A16E`)**:
   - Streamlines 16-color palette records into continuous arrays ready for VBLANK transfer.
   - Preserves transparency color 0 while shifting foreground and background shades.
3. **Screen Shake Oscillation & Decay Curve (`$80:A2E0`)**:
   - Screen tremors are governed by intensity counter `$7E:2435`.
   - Each frame, if `$7E:2435 > 0`:
     - The intensity counter decrements toward 0.
     - The engine computes an oscillating vertical offset: $\Delta y = \pm (\text{intensity} \pmod 4)$.
     - Stores the offset into `$7E:2437`, which the camera centering routine (`$90:94AB`) adds directly to the PPU BG Scroll register `$210E` (BG2VOFS).

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $80:A100 - Palette Color Block Transfer
; ==============================================================================
palette_transfer_stream_block:
    AND $7B,S
    STA $7E7339,X               ; Store in CGRAM shadow buffer
    LDA $0007,Y                 ; Fetch next color word from source
    STA $7E733B,X
    INY
    INY
    BRA $80A124

$80A124:
    LSR $12
    BCC $80A137
    LSR $12
    BCC $80A14B
    TDC
    STA $7E733D,X
    STA $7E733F,X
    BRA palette_cgram_buffer_commit

; ==============================================================================
; $80:A16E - CGRAM Buffer 16-Color Commit Loop
; ==============================================================================
palette_cgram_buffer_commit:
    LDA $0007,Y
    BNE .copy_palette_chunk
    LDA $0008,Y
    STA $7E7341,X
    LDA $000A,Y
    STA $7E7343,X
    LDA $000C,Y
    STA $7E7345,X
    LDA $000E,Y
    STA $7E7347,X
    LDA $0010,Y
    STA $7E7349,X
    LDA $0012,Y
    STA $7E734B,X
    LDA $0014,Y
    STA $7E734D,X
    LDA $0016,Y
    STA $7E734F,X
    TYA
    CLC
    ADC #$0010                  ; Advance to next 16-color block
    TAY
.copy_palette_chunk:
    RTS
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

#define CGRAM_NUM_COLORS        256
#define PALETTE_CHUNK_SIZE      16

typedef struct {
    uint16_t cgram_shadow[CGRAM_NUM_COLORS]; /* $7E:7300..$7E:74FF */
    uint16_t shake_intensity;                /* $7E:2435 */
    int16_t  shake_offset_y;                 /* $7E:2437 */
    uint8_t  flash_timer;
    uint16_t flash_color;
} VisualEffectsState;

/**
 * Commits a 16-color palette block into the WRAM CGRAM shadow buffer.
 * Corresponds to native routines $80:A100 and $80:A16E.
 */
void palette_commit_16color_chunk(VisualEffectsState *vfx, uint8_t palette_index, const uint16_t *source_colors) {
    if (palette_index >= 16) {
        return;
    }

    uint16_t base_offset = palette_index * PALETTE_CHUNK_SIZE;
    for (int i = 0; i < PALETTE_CHUNK_SIZE; i++) {
        vfx->cgram_shadow[base_offset + i] = source_colors[i];
    }
}

/**
 * Updates the screen shake oscillation and decays tremor intensity.
 * Corresponds to native routine $80:A2E0.
 */
void screen_shake_tick(VisualEffectsState *vfx) {
    if (vfx->shake_intensity == 0) {
        vfx->shake_offset_y = 0;
        return;
    }

    /* Decrement tremor countdown */
    vfx->shake_intensity--;

    /* Compute oscillating vertical offset (+/- amplitude based on frame parity) */
    int16_t amplitude = (int16_t)(vfx->shake_intensity & 0x03);
    if ((vfx->shake_intensity & 0x01) != 0) {
        vfx->shake_offset_y = amplitude;
    } else {
        vfx->shake_offset_y = -amplitude;
    }
}

/**
 * Triggers a damage screen flash (e.g. red tint when player takes severe damage).
 */
void screen_flash_trigger(VisualEffectsState *vfx, uint16_t bgr555_color, uint8_t duration_frames) {
    vfx->flash_color = bgr555_color;
    vfx->flash_timer = duration_frames;
}
```
