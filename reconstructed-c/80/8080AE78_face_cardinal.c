/*
 * Routine: $80AE78 (face_cardinal)
 * Bank: $80 (ROM Offset: $00AE78)
 * Source: docs/entities/ai-behaviours.md
 */

#include <stdint.h>

static uint8_t subtraction_sets_negative(uint16_t left, uint16_t right) {
    return (uint8_t)(((uint16_t)(left - right) & 0x8000) != 0);
}

/**
 * Returns the cardinal facing code for signed x/y deltas in DP $02/$04.
 */
uint16_t face_cardinal(int16_t dx, int16_t dy) {
    uint16_t x_delta = (uint16_t)dx;
    uint16_t y_delta = (uint16_t)dy;
    uint8_t x_negative = (uint8_t)((x_delta & 0x8000) != 0);
    uint8_t y_negative = (uint8_t)((y_delta & 0x8000) != 0);

    if (!y_negative) {
        if (!x_negative) {
            return subtraction_sets_negative(x_delta, y_delta) ? 0x0008 : 0x0004;
        }

        uint16_t negated_x = (uint16_t)(0 - x_delta);
        return subtraction_sets_negative(negated_x, y_delta) ? 0x0008 : 0x000C;
    }

    if (!x_negative) {
        uint16_t negated_x = (uint16_t)(0 - x_delta);
        return subtraction_sets_negative(negated_x, y_delta) ? 0x0004 : 0x0000;
    }

    return subtraction_sets_negative(x_delta, y_delta) ? 0x000C : 0x0000;
}