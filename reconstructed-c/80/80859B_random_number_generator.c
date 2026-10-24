/*
 * $80:859B random_number_generator (knowledge/rom/80859b.md), RTL. Gate: see the knowledge entry.
 *
 * Four words of state at DB:$0133..$013A (RNG_STATE). Four times: rotate one word left through
 * carry, carry out bumps the next word, then add another word with carry and store. The carry the
 * caller enters with goes into the first rotate. Leaves A = the new first word, N V Z C from the
 * last ADC; X, Y, DB, D untouched. Entered with a 16-bit accumulator.
 */
#include "soe.h"
#include "soe_ram.h"

#define W0 (RNG_STATE_ADDR + 0)
#define W1 (RNG_STATE_ADDR + 2)
#define W2 (RNG_STATE_ADDR + 4)
#define W3 (RNG_STATE_ADDR + 6)

/* rotate ABS16(rot) through carry; carry out increments ABS16(bump); A + ABS16(add) + carry -> ABS16(store) */
static uint16_t step(soe_regs r, uint16_t rot, uint16_t bump, uint16_t add, uint16_t store)
{
    uint16_t a = soe_rol16(r, ABS16(r, rot));
    if (r->p & SOE_C)
        ABS16(r, bump) = (uint16_t)(ABS16(r, bump) + 1);
    a = soe_adc16(r, a, ABS16(r, add));
    ABS16(r, store) = a;
    return a;
}

SOE_BIND(random_number_generator, 0x80859B, RTL)
{
    step(r, W3, W2, W1, W3);
    step(r, W2, W1, W0, W2);
    step(r, W1, W0, W2, W1);
    r->a = step(r, W0, W3, W3, W0);
}
