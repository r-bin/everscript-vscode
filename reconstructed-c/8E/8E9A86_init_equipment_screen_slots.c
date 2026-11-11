/*
 * Routine: $8E9A86 (init_equipment_screen_slots)
 * Bank: $8E
 *
 * Populates the Boy and Dog equipment/status screen menu slot arrays at
 * $0814..$0842 based on unlocked alchemy/bazooka/collar inventory flags in
 * $7E:2258..$7E:2343.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   init_equipment_screen_slots ($8E9A86) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  70 instructions (180 bytes)
 * - Compiled C ASM:   542 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3357a37ecd06e5d4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(init_equipment_screen_slots, 0x8E9A86, RTL) {
    uint16_t y, x, a_val, diff;

    bus_write16(r, 0x0814, 0x0016);
    bus_write16(r, 0x0816, 0x001A);
    bus_write16(r, 0x0818, 0x001C);
    bus_write16(r, 0x081A, 0x001E);
    bus_write16(r, 0x081C, 0x0022);

    y = 0x000A;
    a_val = (wram_u16(0x225C) & 0x00FFu) | wram_u16(0x225A) | wram_u16(0x2258);
    if (a_val != 0) {
        bus_write16(r, (uint16_t)(0x0814u + y), 0x0024);
        y = (uint16_t)(y + 2u);
    }

    for (x = 0x231D; ; x++) {
        if (wram_u16(x) != 0) {
            bus_write16(r, (uint16_t)(0x0814u + y), 0x0020);
            y = (uint16_t)(y + 2u);
            break;
        }
        if (x == 0x233Fu) {
            break;
        }
    }

    bus_write16(r, (uint16_t)(0x0814u + y), 0x0026);
    y = (uint16_t)(y + 2u);

    a_val = y >> 1;
    bus_write16(r, 0x0810, a_val);
    a_val = (uint16_t)(a_val - 1u);
    diff = (uint16_t)(a_val - bus_read16(r, 0x0812));
    if ((diff & 0x8000u) != 0) {
        bus_write16(r, 0x0812, 0x0000);
    }

    bus_write16(r, 0x0834, 0x0005);
    bus_write16(r, 0x0838, 0x0018);
    bus_write16(r, 0x083A, 0x001A);
    bus_write16(r, 0x083C, 0x001C);
    bus_write16(r, 0x083E, 0x001E);
    bus_write16(r, 0x0840, 0x0022);

    for (x = 0x2341; ; x++) {
        if (wram_u16(x) != 0) {
            bus_write16(r, 0x0842, 0x0020);
            bus_write16(r, 0x0834, (uint16_t)(bus_read16(r, 0x0834) + 1u));
            break;
        }
        if (x == 0x2343u) {
            break;
        }
    }

    a_val = (uint16_t)(bus_read16(r, 0x0834) - 1u);
    if (a_val >= bus_read16(r, 0x0836)) r->p |= SOE_C; else r->p &= ~SOE_C;
    diff = (uint16_t)(a_val - bus_read16(r, 0x0836));
    soe_nz16(r, diff);
    if ((diff & 0x8000u) != 0) {
        bus_write16(r, 0x0836, 0x0000);
    }

    r->a = a_val;
    r->x = x;
    r->y = y;
}
