/*
 * Routine: $80ADF0 (face_8)
 * Bank: $80 (ROM Offset: $00ADF0)
 * Source: docs/entities/ai-behaviours.md
 */

#include <stdint.h>

static uint8_t subtraction_sets_negative(uint16_t left, uint16_t right) {
    return (uint8_t)(((uint16_t)(left - right) & 0x8000) != 0);
}

static uint16_t arithmetic_half(uint16_t value) {
    return (uint16_t)((value >> 1) | 0x8000);
}

/**
 * Reproduces the raw direction code from signed deltas in DP $02/$04.
 * direct_page_register supplies the value returned by the assembly's TDC paths.
 */
uint16_t face_8(int16_t dx, int16_t dy, uint16_t direct_page_register) {
    uint16_t x_delta = (uint16_t)dx;
    uint16_t y_delta = (uint16_t)dy;
    uint8_t x_negative = (uint8_t)((x_delta & 0x8000) != 0);
    uint8_t y_negative = (uint8_t)((y_delta & 0x8000) != 0);

    if (!y_negative) {
        if (!x_negative) {
            if (subtraction_sets_negative(x_delta, y_delta)) {
                uint16_t doubled_x = (uint16_t)(x_delta << 1);
                return subtraction_sets_negative(doubled_x, y_delta) ? 0x0008 : 0x0006;
            }

            return subtraction_sets_negative((uint16_t)(x_delta >> 1), y_delta)
                ? 0x0006
                : 0x0004;
        }

        uint16_t absolute_x = (uint16_t)(0 - x_delta);
        if (subtraction_sets_negative(absolute_x, y_delta)) {
            uint16_t doubled_x = (uint16_t)(absolute_x << 1);
            return subtraction_sets_negative(doubled_x, y_delta) ? 0x0008 : 0x000A;
        }

        return subtraction_sets_negative((uint16_t)(absolute_x >> 1), y_delta)
            ? 0x000A
            : 0x000C;
    }

    if (!x_negative) {
        uint16_t negated_x = (uint16_t)(0 - x_delta);
        if (subtraction_sets_negative(negated_x, y_delta)) {
            return subtraction_sets_negative(arithmetic_half(negated_x), y_delta)
                ? 0x0002
                : direct_page_register;
        }

        uint16_t doubled_x = (uint16_t)(negated_x << 1);
        return subtraction_sets_negative(doubled_x, y_delta) ? 0x0002 : direct_page_register;
    }

    if (subtraction_sets_negative(x_delta, y_delta)) {
        return subtraction_sets_negative(arithmetic_half(x_delta), y_delta)
            ? 0x000C
            : 0x000E;
    }

    uint16_t doubled_x = (uint16_t)(x_delta << 1);
    return subtraction_sets_negative(doubled_x, y_delta) ? 0x000E : direct_page_register;
}