/*
 * Routines: sub_8FA468, sub_8FA471, sub_8FA476, sub_8FA47F ($8F:A468-$8F:A47F)
 * Map metatile terrain collision and layer attribute probe.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8FA47F ($8FA47F) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  26 instructions (58 bytes)
 * - Compiled C ASM:   3 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   0.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c97f7ce7055c19fa
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static void probe_metatile_at(soe_regs r, uint8_t a) {
    IO8(0x4202u) = a;
    uint8_t factor = RAM8(0x08EEu);
    IO8(0x4203u) = factor;
    uint16_t product = (uint16_t)((uint16_t)a * factor);

    uint8_t d66 = DP8(r, 0x66u);
    uint16_t a16 = (uint16_t)((r->a & 0xFF00u) | d66);
    r->p &= (uint8_t)~(SOE_M | SOE_C);
    uint16_t sum = soe_adc16(r, a16, product);
    soe_carry(r, (sum & 0x8000u) != 0u);
    uint16_t x_off = (uint16_t)(sum << 1);
    r->x = x_off;

    uint16_t meta_ptr = (*(uint16_t SOE_FAR *)(0x7F0000UL + x_off));
    r->x = meta_ptr;

    uint16_t attr = (*(uint16_t SOE_FAR *)(0x7F0004UL + meta_ptr));
    r->p |= SOE_M;
    uint8_t a_hi = (uint8_t)(attr >> 8);

    if ((attr & 0x2040u) == 0u) {
        uint8_t a_lo = (uint8_t)(attr & 0x30u);
        DP8(r, 0x68u) = a_lo;
        soe_set_a8(r, a_lo);
        r->a = (uint16_t)(((uint16_t)a_hi << 8) | a_lo);
        soe_nz8(r, a_lo);
    } else {
        if ((attr & 0x0040u) == 0u) {
            uint8_t a_lo = (uint8_t)((attr & 0x30u) | 0x40u);
            DP8(r, 0x68u) = a_lo;
            soe_set_a8(r, a_lo);
            r->a = (uint16_t)(((uint16_t)a_hi << 8) | a_lo);
            soe_nz8(r, a_lo);
        } else {
            uint8_t old_68 = DP8(r, 0x68u);
            DP8(r, 0x68u) = (uint8_t)(old_68 & (uint8_t)~0x40u);
            soe_set_a8(r, 0x40u);
            r->a = (uint16_t)(((uint16_t)a_hi << 8) | 0x40u);
            r->p &= (uint8_t)~SOE_N;
            if ((old_68 & 0x40u) == 0u) {
                r->p |= SOE_Z;
            } else {
                r->p &= (uint8_t)~SOE_Z;
            }
        }
    }
}

SOE_BIND(sub_8FA468, 0x8FA468, RTL) {
    uint8_t d66 = (uint8_t)(DP8(r, 0x66u) - 1u);
    DP8(r, 0x66u) = d66;
    uint8_t a = (uint8_t)(SOE_A8(r) - 1u);
    DP8(r, 0x67u) = a;
    probe_metatile_at(r, a);
}

SOE_BIND(sub_8FA471, 0x8FA471, RTL) {
    uint8_t a = (uint8_t)(SOE_A8(r) + 1u);
    DP8(r, 0x67u) = a;
    probe_metatile_at(r, a);
}

SOE_BIND(sub_8FA476, 0x8FA476, RTL) {
    uint8_t d66 = (uint8_t)(DP8(r, 0x66u) + 1u);
    DP8(r, 0x66u) = d66;
    probe_metatile_at(r, SOE_A8(r));
}

SOE_BIND(sub_8FA47F, 0x8FA47F, RTL) {
    probe_metatile_at(r, SOE_A8(r));
}

