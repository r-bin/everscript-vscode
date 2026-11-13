/*
 * Routine: $8CC6CB (field_transient_effects_and_particles_oam_render)
 * Bank: $8C
 *
 * Updates and renders HUD status portraits / transient overlay sprites via
 * $80:9033 based on state flags in $7E:0B79.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   field_transient_effects_and_particles_oam_render ($8CC6CB) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  176 instructions (449 bytes)
 * - Compiled C ASM:   653 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   3.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      96e3e80ffef38c1d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static void render_hud_slot(soe_regs r, uint16_t x, uint16_t pos_x, uint16_t pos_y) {
    uint16_t pal;
    dp_u16(r, 0x26) = wram_u16((uint16_t)(x + 0x0071));
    dp_u16(r, 0x28) = wram_u16((uint16_t)(x + 0x0073));
    pal = wram_u16((uint16_t)(x + 0x000C)) | 0x0030u;
    dp_u16(r, 0x06) = pal;
    dp_u16(r, 0x02) = pos_x;
    dp_u16(r, 0x04) = pos_y;
    r->a = pos_y;
    r->x = x;
    soe_nz16(r, pos_y);
    soe_call_rom(0x809033, r);
}

SOE_BIND(field_transient_effects_and_particles_oam_render, 0x8CC6CB, RTL) {
    uint8_t saved_db = r->db;
    uint16_t a_val, x, v;
    uint8_t b;

    r->db = 0x7E;
    wram_u16(0x0120) = wram_u16(0x011E);
    a_val = wram_u16(0x0B79);
    soe_nz16(r, a_val);

    /* Bit 0: static left slot */
    if ((a_val & 0x0001u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0001u) != 0) {
        x = wram_u16(0x0B73);
        render_hud_slot(r, x, 0x0018, 0x00B6);
        a_val = wram_u16(0x0B79);
        soe_nz16(r, a_val);
    }

    /* Bit 1: static right slot */
    if ((a_val & 0x0002u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0002u) != 0) {
        x = wram_u16(0x0B75);
        render_hud_slot(r, x, 0x00C6, 0x00B6);
        a_val = wram_u16(0x0B79);
        soe_nz16(r, a_val);
    }

    /* Bit 7: scroll-in $011E down to $E7 */
    if ((a_val & 0x0080u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0080u) != 0) {
        v = wram_u16(0x011E);
        b = (uint8_t)(v - 1u);
        wram_u8(0x011E) = b;
        a_val = (v & 0xFF00u) | b;
        if (b >= 0xE7u) r->p |= SOE_C; else r->p &= ~SOE_C;
        if (((uint8_t)(b - 0xE7u) & 0x80u) != 0) {
            if ((wram_u16(0x0B79) & 0x0080u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
            wram_u16(0x0B79) &= (uint16_t)~0x0080u;
            wram_u16(0x0B77) = 0x0000;
        }
        a_val = wram_u16(0x0B79);
        soe_nz16(r, a_val);
    }

    /* Bit 6: scroll-out $011E up to $FF */
    if ((a_val & 0x0040u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0040u) != 0) {
        b = wram_u8(0x011E);
        if (((uint8_t)(b - 0xE7u) & 0x80u) != 0) {
            wram_u8(0x0B77) = (uint8_t)(wram_u8(0x0B77) + 1u);
        }
        b = (uint8_t)(b + 1u);
        wram_u8(0x011E) = b;
        if (b >= 0xFFu) r->p |= SOE_C; else r->p &= ~SOE_C;
        if (((uint8_t)(b - 0xFFu) & 0x80u) == 0) {
            wram_u16(0x0B79) &= (uint16_t)~0x0040u;
            wram_u16(0x011E) = 0xFFFF;
        }
        a_val = wram_u16(0x0B79);
        soe_nz16(r, a_val);
    }

    /* Bit 2: slide left slot up ($0B7B -= 2 until $00B6) */
    if ((a_val & 0x0004u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0004u) != 0) {
        x = wram_u16(0x0B73);
        render_hud_slot(r, x, 0x0018, wram_u16(0x0B7B));
        v = (uint16_t)(wram_u16(0x0B7B) - 2u);
        wram_u16(0x0B7B) = v;
        if (v >= 0x00B6u) r->p |= SOE_C; else r->p &= ~SOE_C;
        if (v == 0x00B6u) {
            a_val = (wram_u16(0x0B79) & 0xFFFBu) | 0x0001u;
            wram_u16(0x0B79) = a_val;
        } else {
            a_val = wram_u16(0x0B79);
        }
        soe_nz16(r, a_val);
    }

    /* Bit 4: slide right slot up ($0B7D -= 2 until $00B6) */
    if ((a_val & 0x0010u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0010u) != 0) {
        x = wram_u16(0x0B75);
        render_hud_slot(r, x, 0x00C6, wram_u16(0x0B7D));
        v = (uint16_t)(wram_u16(0x0B7D) - 2u);
        wram_u16(0x0B7D) = v;
        if (v >= 0x00B6u) r->p |= SOE_C; else r->p &= ~SOE_C;
        if (v == 0x00B6u) {
            a_val = (wram_u16(0x0B79) & 0xFFEFu) | 0x0002u;
            wram_u16(0x0B79) = a_val;
        } else {
            a_val = wram_u16(0x0B79);
        }
        soe_nz16(r, a_val);
    }

    /* Bit 3: slide left slot down ($0B7B += 2 until $00E2) */
    if ((a_val & 0x0008u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0008u) != 0) {
        x = wram_u16(0x0B73);
        render_hud_slot(r, x, 0x0018, wram_u16(0x0B7B));
        v = (uint16_t)(wram_u16(0x0B7B) + 2u);
        wram_u16(0x0B7B) = v;
        if (v >= 0x00E2u) r->p |= SOE_C; else r->p &= ~SOE_C;
        if (v == 0x00E2u) {
            wram_u16(0x0B79) &= (uint16_t)~0x0008u;
        }
        a_val = wram_u16(0x0B79);
        soe_nz16(r, a_val);
    }

    /* Bit 5: slide right slot down ($0B7D += 2 until $00E2) */
    if ((a_val & 0x0020u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
    if ((a_val & 0x0020u) != 0) {
        wram_u16(0x0B79) &= (uint16_t)~0x0002u;
        x = wram_u16(0x0B75);
        render_hud_slot(r, x, 0x00C6, wram_u16(0x0B7D));
        v = (uint16_t)(wram_u16(0x0B7D) + 2u);
        wram_u16(0x0B7D) = v;
        if (v >= 0x00E2u) r->p |= SOE_C; else r->p &= ~SOE_C;
        if (v == 0x00E2u) {
            if ((wram_u16(0x0B79) & 0x0020u) == 0) r->p |= SOE_Z; else r->p &= ~SOE_Z;
            wram_u16(0x0B79) &= (uint16_t)~0x0020u;
            a_val = 0x0020;
            r->p &= ~SOE_N;
        } else {
            a_val = wram_u16(0x0B79);
            soe_nz16(r, a_val);
        }
    }

    r->a = a_val;
    r->db = saved_db;
    soe_nz8(r, r->db);
}
