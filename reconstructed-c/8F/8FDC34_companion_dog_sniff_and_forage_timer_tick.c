/*
 * $8F:DC34 companion_dog_sniff_and_forage_timer_tick (knowledge/routines/companion_dog_sniff_and_forage_timer_tick.md), RTS, 16-bit A and X.
 *
 * Entity scheduler and companion dog foraging timer tick:
 * 1. Decrements secondary interval target $0E98; on underflow (< 0) resets it to RNG & $00FF + $003C (60..315 frames)
 *    and resets $0E96 to RNG & $01F0 + $0100 (256..752 frames).
 * 2. Monitors frame counter $0100 vs $1078:
 *    - If missed frame (lag): increments $107A; at 3 misses resets $107C and drops awake limit $1076 to current count $1070 (min 5).
 *    - If consecutive frame: resets $107A, increments $107C; after 1800 good frames increases budget $1076 up to 6.
 *    - Updates $1078 = $0100.
 * 3. Calls companion_dog_ingredient_dig_find_trigger ($8F:DCD0).
 * 4. Round-robin visits 6 entity slots starting at $0EBC, calling entity_sleep_wake ($8F:C40F) for any active slot
 *    (+$10 & $0300 != 0). Advance pointer by stride $008E, wrapping at $4E89 back to $3DE5.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   companion_dog_sniff_and_forage_timer_tick ($8FDC34) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  62 instructions (156 bytes)
 * - Compiled C ASM:   437 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      383b63352393de61
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(companion_dog_sniff_and_forage_timer_tick, 0x8FDC34, RTS)
{
    uint16_t a;
    int16_t val;
    int count;

    SOE_AT(0xDC34);
    val = (int16_t)(RAM16(0x0E98) - 1);
    RAM16(0x0E98) = (uint16_t)val;
    soe_nz16(r, (uint16_t)val);

    SOE_AT(0xDC37);
    if (val < 0) {
        SOE_AT(0xDC39);
        soe_call_rtl(0x80859BUL, r);
        a = (uint16_t)(r->a & 0x00FF);
        a = soe_adc16(r, a, 0x003C);
        RAM16(0x0E98) = a;
        r->a = a;
        soe_nz16(r, a);

        SOE_AT(0xDC46);
        soe_call_rtl(0x80859BUL, r);
        a = (uint16_t)(r->a & 0x01F0);
        a = soe_adc16(r, a, 0x0100);
        RAM16(0x0E96) = a;
        r->a = a;
        soe_nz16(r, a);
    }

    SOE_AT(0xDC53);
    a = (uint16_t)(RAM16(0x0100) - 1);
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, RAM16(0x1078));
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xDC79);
        a = (uint16_t)(RAM16(0x107A) + 1);
        RAM16(0x107A) = a;
        r->a = a;
        soe_nz16(r, a);
        soe_cmp16(r, a, 0x0003);
        if (!(r->p & SOE_C)) {
            goto frame_update;
        }

        SOE_AT(0xDC85);
        RAM16(0x107C) = 0;
        RAM16(0x107A) = 0;

        SOE_AT(0xDC8B);
        a = RAM16(0x1070);
        r->a = a;
        soe_nz16(r, a);
        soe_cmp16(r, a, RAM16(0x1076));
        if (r->p & SOE_C) {
            goto frame_update;
        }
        soe_cmp16(r, a, 0x0005);
        if (!(r->p & SOE_C)) {
            goto frame_update;
        }
        RAM16(0x1076) = a;
        goto frame_update;
    }

    SOE_AT(0xDC5C);
    RAM16(0x107A) = 0;

    SOE_AT(0xDC5F);
    a = (uint16_t)(RAM16(0x107C) + 1);
    RAM16(0x107C) = a;
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, 0x0708);
    if (!(r->p & SOE_C)) {
        goto frame_update;
    }

    SOE_AT(0xDC6B);
    a = RAM16(0x1076);
    r->a = a;
    soe_nz16(r, a);
    soe_cmp16(r, a, 0x0006);
    if (r->p & SOE_C) {
        goto frame_update;
    }
    a++;
    RAM16(0x1076) = a;
    r->a = a;
    soe_nz16(r, a);

frame_update:
    SOE_AT(0xDC9B);
    a = RAM16(0x0100);
    RAM16(0x1078) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xDCA1);
    soe_call_rtl(0x8FDCD0UL, r);

    SOE_AT(0xDCA5);
    r->x = RAM16(0x0EBC);
    soe_nz16(r, r->x);

    for (count = 6; count > 0; count--) {
        SOE_AT(0xDCAC);
        DP16(r, 0x4C) = r->x;
        a = ABSI16(r, 0x0010, r->x);
        r->a = a;
        soe_nz16(r, a);
        soe_bit_imm(r, a, 0x0300);
        if (!(r->p & SOE_Z)) {
            SOE_AT(0xDCB6);
            soe_call_rts(0x8FC40FUL, r);
        }

        SOE_AT(0xDCB9);
        soe_carry(r, false);
        a = soe_adc16(r, DP16(r, 0x4C), 0x008E);
        r->a = a;
        soe_cmp16(r, a, 0x4E89);
        if (r->p & SOE_C) {
            a = 0x3DE5;
            r->a = a;
            soe_nz16(r, a);
        }
        r->x = a;
    }

    SOE_AT(0xDCC8);
    r->a = 0;
    soe_nz16(r, 0);

    SOE_AT(0xDCCC);
    RAM16(0x0EBC) = r->x;
}
