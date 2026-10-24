/*
 * Routine: $80AE5C (face_diagonal)
 * Bank: $80 (ROM Offset: $00AE5C)
 * Source: docs/entities/ai-behaviours.md
 */

#include <stdint.h>

/**
 * Returns the diagonal facing code selected by the signs of dx and dy.
 */
uint16_t face_diagonal(int16_t dx, int16_t dy) {
    if (dx >= 0) {
        return dy >= 0 ? 0x0006 : 0x000A;
    }

    return dy >= 0 ? 0x000E : 0x0002;
}