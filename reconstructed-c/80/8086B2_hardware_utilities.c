/*
 * Routine: $8086B2 (hardware_utilities)
 * Bank: $80 (ROM Offset: $0086B2)
 * Source: docs/disassembly/engine-core/hardware-utilities.md
 */

#include "engine-core/hardware-utilities.h"
#include "engine-core/vram-dma.h"

// ----------------------------------------------------------------------------
// WRAM Global State & Hardware Registers
// ----------------------------------------------------------------------------
extern uint8_t  g_vram_lock_counter;            // $7E:0F3A (VRAM DMA in progress)
extern uint8_t  g_input_filter_flags;           // $7E:0106 (Gating & input enable)

// Typematic auto-repeat state
extern uint16_t g_joypad_repeat_timer;          // $7E:0343 (Remaining frames)
extern uint16_t g_joypad_held_mask;             // $7E:0345 (Currently held buttons)
extern uint16_t g_joypad_initial_repeat_delay;  // $7E:0347 (Default initial hold, e.g. 24)
extern uint16_t g_joypad_sustained_repeat_rate; // $7E:0349 (Sustained repeat rate, e.g. 6)

// ----------------------------------------------------------------------------
// vram_dma_upload_tile_block_with_vmain ($80:86B2)
// Streams a data block to VRAM with custom VMAIN increment mode
// ----------------------------------------------------------------------------
void vram_dma_upload_tile_block_with_vmain(const uint8_t *source_data, 
                                           uint16_t vram_word_addr, 
                                           uint16_t byte_count, 
                                           uint8_t vmain_mode) {
    // If input / video updating is gated ($7E:0106 bit 7), perform full stack backup
    // Otherwise configure VMAIN and fire DMA Channel 1
    g_vram_lock_counter++;

    // Set VMAIN address increment mode ($2115)
    snes_write_reg(0x2115, vmain_mode);

    // Set destination VRAM word address ($2116)
    snes_write_reg16(0x2116, vram_word_addr);

    // Configure DMA Channel 1 ($4310)
    // 0x1801 = 2-register write (PPU $2118 / $2119 VRAM Data)
    snes_write_reg16(0x4310, 0x1801);
    snes_write_reg24(0x4312, (uint32_t)source_data);
    snes_write_reg16(0x4315, byte_count);

    // Trigger DMA Channel 1 ($420B bit 1)
    snes_write_reg(0x420B, 0x02);

    g_vram_lock_counter--;
}

// ----------------------------------------------------------------------------
// format_16bit_integer_to_decimal_digits ($80:870C)
// Decomposes a 16-bit integer into individual BCD digits using SNES divider
// Output written to out_digits array, terminated with 0xFF
// ----------------------------------------------------------------------------
uint8_t format_16bit_integer_to_decimal_digits(uint16_t value, uint8_t *out_digits) {
    uint8_t digit_count;

    // Determine magnitude
    if (value < 10) {
        digit_count = 1;
    } else if (value < 100) {
        digit_count = 2;
    } else if (value < 1000) {
        digit_count = 3;
    } else if (value < 10000) {
        digit_count = 4;
    } else {
        digit_count = 5;
    }

    // Write end-of-string sentinel (0xFF)
    out_digits[digit_count] = 0xFF;

    // Extract digits in reverse order using hardware divider ($4204 / $4206)
    int8_t idx = digit_count - 1;
    uint16_t quotient = value;

    while (idx >= 0) {
        // SNES hardware divider: 16-bit dividend / 8-bit divisor
        uint8_t remainder = quotient % 10;
        quotient = quotient / 10;

        out_digits[idx] = remainder;
        idx--;
    }

    return digit_count;
}

// ----------------------------------------------------------------------------
// joypad_button_typematic_repeat ($80:8838)
// Processes joypad buttons with typematic initial delay and repeat frequency
// Returns button mask to execute on this frame, or 0 if suppressed
// ----------------------------------------------------------------------------
uint16_t joypad_button_typematic_repeat(uint16_t current_buttons) {
    // If no buttons held, reset repeat state
    if (current_buttons == 0) {
        g_joypad_held_mask = 0;
        g_joypad_repeat_timer = g_joypad_initial_repeat_delay;
        return 0;
    }

    // Check if exactly the same buttons are held as previous frame
    if ((current_buttons & g_joypad_held_mask) != 0) {
        // Same buttons held: decrement repeat countdown
        g_joypad_repeat_timer--;
        if (g_joypad_repeat_timer == 0) {
            // Repeat timer triggered: reload sustained repeat rate
            g_joypad_repeat_timer = g_joypad_sustained_repeat_rate;
            return current_buttons; // Fire repeat event!
        }

        // Timer still running: suppress action
        return 0;
    }

    // New button press: latch held mask and set initial repeat delay
    g_joypad_held_mask = current_buttons;
    g_joypad_repeat_timer = g_joypad_initial_repeat_delay;

    return current_buttons; // Fire immediate press event!
}
