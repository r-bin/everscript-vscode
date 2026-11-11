/*
 * Routine: $8F81C9 (boy_load_weapon)
 * Bank: $8F
 *
 * Loads the Boy's equipped weapon descriptor from Bank $C4 ($C4:3874,x or
 * $C4:388E,x for Bazooka ammo when X == $001A), populates combat parameters
 * ($0A39..$0A6E, $1460..$1462), uploads the weapon sprite palette via
 * $90:CF3A, and updates weapon charge rate in $0A52.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   boy_load_weapon ($8F81C9) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  60 instructions (177 bytes)
 * - Compiled C ASM:   713 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      e1795dc5ac1bf0e6
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(boy_load_weapon, 0x8F81C9, RTL) {
    uint16_t x = r->x;
    uint16_t desc, pal, wep_lvl, a_val;

    if (x == 0x001Au) {
        x = bus_read16(r, 0x2349) & 0x00FFu;
        desc = R16(0xC4388Eu + x);
    } else {
        desc = R16(0xC43874u + x);
    }
    x = desc;

    bus_write16(r, 0x0A39, R16(0xC40006u + x));
    bus_write16(r, 0x0A58, R16(0xC40008u + x));
    bus_write16(r, 0x0A5A, R16(0xC4000Au + x));
    bus_write16(r, 0x0A5C, R16(0xC4000Cu + x));
    bus_write16(r, 0x0A5E, R16(0xC4000Eu + x));
    bus_write16(r, 0x0A60, R16(0xC40010u + x));
    bus_write16(r, 0x0A62, R16(0xC40012u + x));
    bus_write16(r, 0x0A64, R16(0xC40014u + x));
    bus_write16(r, 0x0A6E, R16(0xC40016u + x));
    bus_write16(r, 0x0A66, R16(0xC40018u + x));
    bus_write16(r, 0x1460, R16(0xC4001Au + x));
    bus_write16(r, 0x1462, R16(0xC4001Cu + x));

    bus_write16(r, 0x0A6C, 0x414E);
    bus_write16(r, 0x4EFD, 0x0C0C);
    bus_write16(r, 0x4E95, 0x000C);

    pal = bus_read16(r, 0x23CD);
    if (pal != 0) {
        uint32_t sum = (uint32_t)pal + 0xA7CBu;
        uint16_t res = (uint16_t)sum;
        if ((~(pal ^ 0xA7CBu) & (pal ^ res) & 0x8000u) != 0) r->p |= SOE_V; else r->p &= ~SOE_V;
        if (sum > 0xFFFFu) r->p |= SOE_C; else r->p &= ~SOE_C;
        pal = res;
    } else {
        pal = R16(0xC40004u + x);
    }

    bus_write16(r, 0x0A2F, pal);
    bus_write16(r, 0x1278 + 0x000C, pal);
    r->a = pal;
    r->x = 0x000C;
    soe_nz16(r, 0x000C);
    soe_call_rom(0x90CF3A, r);

    x = bus_read16(r, 0x0ABA);
    wep_lvl = (bus_read16(r, (uint16_t)(0x0ADEu + x)) & 0x00FFu) << 1;
    if (wep_lvl >= bus_read16(r, 0x0B0B)) r->p |= SOE_C; else r->p &= ~SOE_C;
    if (((wep_lvl - bus_read16(r, 0x0B0B)) & 0x8000u) != 0) {
        bus_write16(r, 0x0B0B, wep_lvl);
    }

    a_val = ((wep_lvl & 0x00FFu) << 8) | ((wep_lvl >> 8) & 0x00FFu);
    if (a_val & 0x8000u) r->p |= SOE_C; else r->p &= ~SOE_C;
    a_val = (uint16_t)(a_val << 1);
    bus_write16(r, 0x0A52, a_val);

    r->a = a_val;
    r->x = x;
    soe_nz16(r, a_val);
}
