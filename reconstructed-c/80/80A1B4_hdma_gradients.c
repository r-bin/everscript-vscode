/*
 * Routine: $80A1B4 (hdma_gradients)
 * Bank: $80 (ROM Offset: $00A1B4)
 * Source: docs/disassembly/engine-core/hdma-gradients.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_hdma_gradient_table[8]; // $7E:7341..$7E:734F

/**
 * Builds the 6-band HDMA sky gradient color table in WRAM.
 * Corresponds to $80:A1B4.
 */
void hdma_color_gradient_band_builder(uint16_t gradient_mask, uint16_t base_color) {
    uint16_t mask = gradient_mask;

    // Process 4 dual-band color segments:
    for (int i = 0; i < 4; i++) {
        bool bit0 = (mask & 0x0001) != 0;
        mask >>= 1;
        bool bit1 = (mask & 0x0001) != 0;
        mask >>= 1;

        uint16_t band_color = 0;
        if (!bit0 && !bit1) {
            band_color = 0x0000; // Black horizon baseline
        } else if (bit0 && !bit1) {
            band_color = base_color >> 1; // 50% shaded gradient
        } else {
            band_color = base_color;      // Full sky illumination
        }

        g_hdma_gradient_table[i * 2]     = band_color;
        g_hdma_gradient_table[i * 2 + 1] = band_color;
    }
}
