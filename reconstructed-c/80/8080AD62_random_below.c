/*
 * Routine: $80AD62 (random_below)
 * Bank: $80 (ROM Offset: $00AD62)
 * Source: docs/disassembly/combat/random-below.md
 */

#include <stdint.h>

extern uint16_t random_number_generator(void);

/**
 * Returns a bounded value using the high word of a 16-by-16-bit product.
 * The PRNG advances even when upper_bound is zero, matching the ROM routine.
 */
uint16_t random_below(uint16_t upper_bound) {
    uint16_t random_value = random_number_generator();
    uint32_t product = (uint32_t)random_value * upper_bound;

    return (uint16_t)(product >> 16);
}