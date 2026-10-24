/*
 * Routine: $8C:E4B1 (script_op_97_palette_transfer)
 * Bank: $8C (ROM Offset: $0CE4B1)
 * Source: docs/disassembly/script-vm/opcode-97-palette-transfer.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void palette_data_operation_90d34c(void); /* $90:D34C */
extern void cgram_palette_dma_enqueue_or_immediate(void); /* $80:85FA */
extern uint16_t read_wram_word(uint32_t address);
extern void write_wram_word(uint32_t address, uint16_t value);

extern volatile uint16_t g_palette_upload_lock; /* $7E:0F3C */
extern volatile uint16_t g_dp_02;
extern volatile uint16_t g_dp_04;
extern volatile uint16_t g_dp_10;
extern volatile uint16_t g_dp_12;
extern volatile uint16_t g_dp_14;
extern volatile uint16_t g_dp_18;
extern volatile uint16_t g_dp_1c;
extern volatile uint16_t g_dp_26;
extern volatile uint16_t g_dp_28;
extern volatile uint16_t g_dp_2a;
extern volatile uint16_t g_dp_2c;
extern volatile uint16_t g_dp_2e;
extern volatile uint16_t g_dp_30;
extern volatile uint16_t g_register_x;

static uint16_t adjust_bgr555_component(uint16_t component,
                                        uint16_t delta,
                                        uint16_t upper_bound,
                                        uint16_t maximum) {
    uint16_t result = (uint16_t)(component + delta);

    if ((result & 0x8000) != 0) {
        return 0;
    }
    if (result >= upper_bound) {
        return maximum;
    }
    return result;
}

bool script_op_97_palette_transfer(void) {
    uint16_t operands[7];

    ++g_palette_upload_lock;
    for (uint8_t index = 0; index < 7; ++index) {
        operands[index] = script_eval_expression();
    }

    g_dp_1c = operands[6];
    g_dp_10 = operands[6];
    g_dp_14 = 1;
    g_dp_02 = (uint16_t)(operands[5] << 1);
    g_dp_04 = operands[4];
    g_dp_12 = operands[3];

    uint16_t red_delta = operands[0];
    uint16_t green_delta = (uint16_t)(operands[1] << 5);
    uint16_t blue_delta = (uint16_t)((((operands[2] & 0x00ff) << 8) |
                                       (operands[2] >> 8)) << 2);

    g_dp_2c = 0;
    g_dp_2a = 4;
    g_dp_28 = 0x7e;
    g_dp_26 = (uint16_t)(0x6187 + g_dp_02);
    g_dp_30 = 0x7e;
    g_dp_2e = (uint16_t)(0x61f1 + g_dp_18 + g_dp_02);

    for (;;) {
        g_dp_10 = (uint16_t)(g_dp_10 - 1);
        if ((g_dp_10 & 0x8000) != 0) {
            break;
        }

        palette_data_operation_90d34c();

        uint32_t staging_address = 0x7e0000u | g_dp_2e;
        uint16_t color = read_wram_word(staging_address);
        uint16_t red = adjust_bgr555_component(
            color & 0x001f, red_delta, 0x0020, 0x001f);
        uint16_t green = adjust_bgr555_component(
            color & 0x03e0, green_delta, 0x0400, 0x03e0);
        uint16_t blue = adjust_bgr555_component(
            color & 0x7c00, blue_delta, 0x8000, 0x7c00);

        write_wram_word(staging_address, (uint16_t)(red | green | blue));
        g_dp_26 = (uint16_t)(g_dp_26 + 2);
        g_dp_2e = (uint16_t)(g_dp_2e + 2);
    }

    g_dp_28 = 0x7e;
    g_dp_26 = (uint16_t)(0x65f1 + g_dp_18 + g_dp_02);
    g_dp_2e = (uint16_t)(g_dp_02 >> 1);
    g_register_x = (uint16_t)(g_dp_1c << 1);
    cgram_palette_dma_enqueue_or_immediate();

    --g_palette_upload_lock;
    return true;
}