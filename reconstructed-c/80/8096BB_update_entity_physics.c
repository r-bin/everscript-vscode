/*
 * Routine: $8096BB (update_entity_physics)
 * Bank: $80
 *
 * Traverses the active actor list backwards from tail ($7E:5127), calling
 * $80:9040 for each active node (status bit 15 clear) until reaching the
 * head sentinel ($FFFE), then calls $80:9685.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   update_entity_physics ($8096BB) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  30 instructions (67 bytes)
 * - Compiled C ASM:   296 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0f45ffbe8ca924e8
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(update_entity_physics, 0x8096BB, RTL) {
    uint8_t saved_db = r->db;
    uint16_t x, y = r->y, status, a_val;

    r->db = 0x7E;
    x = wram_u16(0x5127);

    for (;;) {
        status = wram_u16((uint16_t)(x + 0x0004));
        if ((status & 0x8000u) == 0) {
            dp_u16(r, 0x02) = wram_u16((uint16_t)(x + 0x0006));
            dp_u16(r, 0x04) = wram_u16((uint16_t)(x + 0x0008));
            dp_u16(r, 0x06) = wram_u16((uint16_t)(x + 0x000A));
            dp_u16(r, 0x26) = wram_u16((uint16_t)(x + 0x000C));
            a_val = wram_u16((uint16_t)(x + 0x000D));
            dp_u16(r, 0x27) = a_val;

            r->a = a_val;
            r->x = x;
            r->y = y;
            soe_nz16(r, a_val);
            soe_call_rom(0x809040, r);

            y = x;
            x = wram_u16(y);
        } else {
            if (status == 0xFFFEu) {
                break;
            }
            if (status >= 0xFFFEu) r->p |= SOE_C; else r->p &= ~SOE_C;
            y = x;
            x = wram_u16(y);
        }
    }

    r->a = 0xFFFE;
    r->x = x;
    r->y = y;
    r->p = (r->p & ~SOE_N) | SOE_Z | SOE_C;
    soe_call_rom(0x809685, r);

    r->db = saved_db;
    soe_nz8(r, r->db);
}
