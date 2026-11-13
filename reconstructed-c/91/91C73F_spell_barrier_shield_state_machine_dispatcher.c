/* Reconstructed from Secret of Evermore (USA) [$91C73F..$91C7F4].
 * Note: Reference states in power-on 8414-frame replay have $7E23B5 == 0
 * (Barrier inactive), so SOE_BIND is deferred until a Barrier replay is added.
 */
#include "soe.h"

static inline void set_nz8(soe_regs r, uint8_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x80u) ? SOE_FLAG_N : 0));
}

static inline void set_nz16(soe_regs r, uint16_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z)) |
                     (v == 0 ? SOE_FLAG_Z : 0) |
                     ((v & 0x8000u) ? SOE_FLAG_N : 0));
}

static inline void cmp16(soe_regs r, uint16_t a, uint16_t b) {
    uint16_t d = (uint16_t)(a - b);
    r->p = (uint8_t)((r->p & ~(SOE_FLAG_N | SOE_FLAG_Z | SOE_FLAG_C)) |
                     (a >= b ? SOE_FLAG_C : 0) |
                     (d == 0 ? SOE_FLAG_Z : 0) |
                     ((d & 0x8000u) ? SOE_FLAG_N : 0));
}

void spell_barrier_shield_state_machine_dispatcher_c(soe_regs r)
{
    uint8_t saved_dbr = r->db;
    r->db = 0x7E;
    r->p &= (uint8_t)~(SOE_FLAG_M | SOE_FLAG_X);

    uint16_t state = soe_wram16(0x23B5);
    r->a = state;
    set_nz16(r, state);
    if (state == 0) {
        r->db = saved_dbr;
        set_nz8(r, saved_dbr);
        return;
    }

    cmp16(r, state, 0x0001u);
    if (state == 0x0001u) {
        soe_wram16(0x156A) = soe_wram16(0x23AD);
        soe_wram16(0x156C) = soe_wram16(0x23AF);
        soe_wram16(0x23B5) = 0x0002u;
        uint16_t b3 = soe_wram16(0x23B3);
        if (!(b3 & 0x8000u)) {
            soe_wram16(0x157E) = b3;
            r->a = b3;
            set_nz16(r, b3);
            r->p |= SOE_FLAG_C;
            soe_call_rom(0x91C7F5, r);
        } else {
            uint16_t neg = (uint16_t)((b3 ^ 0xFFFFu) + 1u);
            soe_wram16(0x1580) = neg;
            r->a = neg;
            set_nz16(r, neg);
            r->p &= (uint8_t)~SOE_FLAG_C;
            soe_call_rom(0x91C7F5, r);
        }
        r->db = saved_dbr;
        set_nz8(r, saved_dbr);
        return;
    }

    cmp16(r, state, 0x0002u);
    if (state == 0x0002u) {
        soe_call_rom(0x91C899, r);
        r->db = saved_dbr;
        set_nz8(r, saved_dbr);
        return;
    }

    cmp16(r, state, 0x0003u);
    if (state == 0x0003u) {
        soe_wram16(0x23B5) = 0x0002u;
        soe_wram16(0x156A) = soe_wram16(0x23AD);
        uint16_t af = soe_wram16(0x23AF);
        if (af & 0x8000u) {
            r->p |= SOE_FLAG_C;
        } else {
            r->p &= (uint8_t)~SOE_FLAG_C;
        }
        soe_wram16(0x156C) = (uint16_t)(af << 1);
        uint16_t b3 = soe_wram16(0x23B3);
        if (!(b3 & 0x8000u)) {
            soe_wram16(0x157E) = b3;
            soe_wram16(0x157C) = 0x0001u;
            r->a = 0x0001u;
        } else {
            soe_wram16(0x1580) = (uint16_t)((b3 ^ 0xFFFFu) + 1u);
            soe_wram16(0x157C) = r->d;
            r->a = r->d;
        }
        r->db = saved_dbr;
        set_nz8(r, saved_dbr);
        return;
    }

    cmp16(r, state, 0x0004u);
    if (state == 0x0004u) {
        uint16_t z = r->d;
        soe_wram16(0x0122) = z;
        soe_wram16(0x23B5) = z;
        soe_wram8(0x0124) = (uint8_t)z;
        uint8_t v72 = (uint8_t)(DP8(r, 0x72) & 0xDFu);
        DP8(r, 0x72) = v72;
        r->a = (uint16_t)((z & 0xFF00u) | v72);
        soe_wram16(0x158A) = 0x0000u;
        r->db = saved_dbr;
        set_nz8(r, saved_dbr);
        return;
    }

    r->a = (uint16_t)(state - 1u);
    soe_wram16(0x23B5) = r->a;
    r->db = saved_dbr;
    set_nz8(r, saved_dbr);
}
