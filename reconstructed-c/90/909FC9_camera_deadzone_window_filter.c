/*
 * $90:9FC9 camera_deadzone_window_filter (knowledge/rom/909fc9.md), RTS, 16-bit A.
 *
 * In: A = the target x, Y = the target y; DP $BF / $C1 = the camera x / y. Each axis keeps the
 * camera within a window: left/top edge $7E:240F / $7E:2413, width/height $7E:2411 / $7E:2415,
 * minus the screen ($100 wide, $E0 high). Below the window's start the camera follows down
 * (camera = target - edge); past its end it follows up (camera = target + width - screen).
 * The comparisons are CMP's N flag (sign of the 16-bit difference). Leaves A = the y candidate,
 * flags from the last CMP or ADC.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   camera_deadzone_window_filter ($909FC9) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (56 bytes)
 * - Compiled C ASM:   90 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   3.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      d9af236d78c09973
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

/* one axis: the new camera value, or the old one when inside the window */
static uint16_t axis(soe_regs r, uint16_t target, uint16_t cam, uint32_t edge, uint32_t size, uint16_t screen, uint16_t *out)
{
    uint16_t a;

    soe_carry(r, true);
    a = soe_sbc16(r, target, LONG16(edge));
    soe_cmp16(r, a, cam);
    if (r->p & SOE_N) { *out = a; return a; }
    soe_carry(r, false);
    a = soe_adc16(r, a, LONG16(edge));
    a = soe_adc16(r, a, LONG16(size));
    a = soe_adc16(r, a, screen);
    soe_cmp16(r, a, cam);
    *out = (r->p & SOE_N) ? cam : a;
    return a;
}

SOE_BIND(camera_deadzone_window_filter, 0x909FC9, RTS)
{
    uint16_t cam;

    axis(r, r->a, DP16(r, 0xBF), 0x7E240FUL, 0x7E2411UL, 0xFF00, &cam);
    DP16(r, 0xBF) = cam;
    r->a = axis(r, r->y, DP16(r, 0xC1), 0x7E2413UL, 0x7E2415UL, 0xFF20, &cam);
    DP16(r, 0xC1) = cam;
}