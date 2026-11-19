/*
 * $8C:8619 audio_music_fade_step (knowledge/routines/audio_music_fade_step.md), RTL.
 *
 * Master music volume fade stepper and APU volume latch.
 * Ticks the master music volume fade progression:
 * - Checks DP $9B (signed fade target/step).
 * - If $9B == 0: returns immediately with REP #$20; RTL.
 * - If $9B > 0 (fade in): steps volume DP $9A towards $FF ceiling using ADC $9A.
 *   On carry (max reached): clears $9B, clamps $9A to $FF, sends APU cmd 0x0028 with volume.
 * - If $9B < 0 (fade out): steps volume DP $9A towards 0 floor using ADC $9A.
 *   On underflow (no carry): clears $9B, sends mute APU cmds 0x1A/0x1C, then cmd 0x0028.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   audio_music_fade_step ($8C8619) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  30 instructions (63 bytes)
 * - Compiled C ASM:   276 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f4a69db8023514c0
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(audio_music_fade_step, 0x8C8619, RTL)
{
    // TDC: in 16-bit A mode, A = D. Register B gets D >> 8.
    uint8_t b = (uint8_t)(r->d >> 8);
    r->p |= SOE_M;
    uint8_t step = DP8(r, 0x9B);
    soe_nz8(r, step);
    if (step == 0) {
        r->a = (uint16_t)(((uint16_t)b << 8) | 0u);
        r->p &= (uint8_t)~SOE_M;
        return;
    }

    uint8_t vol = DP8(r, 0x9A);
    if ((int8_t)step >= 0) {
        r->p &= (uint8_t)~SOE_C;
        uint8_t sum = soe_adc8(r, step, vol);
        if ((r->p & SOE_C) != 0) {
            DP8(r, 0x9B) = 0;
            vol = 0xFFu;
            soe_nz8(r, 0xFFu);
        } else {
            vol = sum;
        }
        r->a = (uint16_t)(((uint16_t)b << 8) | vol);
    } else {
        r->p &= (uint8_t)~SOE_C;
        uint8_t sum = soe_adc8(r, step, vol);
        if ((r->p & SOE_C) != 0) {
            vol = sum;
            r->a = (uint16_t)(((uint16_t)b << 8) | vol);
        } else {
            DP8(r, 0x9B) = 0;
            r->a = (uint16_t)(((uint16_t)b << 8) | 0x1Au);
            soe_nz8(r, 0x1Au);
            r->y = 0x0000u;
            soe_call_rtl(0x8C81FDu, r);

            r->y = 0x8000u;
            r->a = (uint16_t)((r->a & 0xFF00u) | 0x1Cu);
            soe_nz8(r, 0x1Cu);
            soe_call_rtl(0x8C81FDu, r);

            vol = (uint8_t)r->a;
        }
    }

    DP8(r, 0x9A) = vol;
    r->p &= (uint8_t)~SOE_M;
    r->y = r->a;
    soe_nz16(r, r->y);
    r->a = 0x0028u;
    soe_nz16(r, 0x0028u);
    soe_call_rtl(0x8C81FDu, r);
}
