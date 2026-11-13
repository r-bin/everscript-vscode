/*
 * Routine: restore_color_math_snapshot ($8C:E20F, script opcode 0x82)
 * Restore PPU layer enable and color-math registers ($212C/$212D/$2131/$2130)
 * from WRAM snapshots ($7E235B-$7E235E) and sync HUD update bit 0 ($0B29)
 * with gameplay flag bit 7 ($7E22EA).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   restore_color_math_snapshot ($8CE20F) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  19 instructions (56 bytes)
 * - Compiled C ASM:   137 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5c3db77aa18ed6e5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(restore_color_math_snapshot, 0x8CE20F, RTS) {
    uint8_t hud_flags;
    uint8_t flags_22ea;
    uint8_t a8;

    /* SEP #$20: copy 4 saved PPU display/color-math bytes to hardware regs */
    LONG8(0x00212Cu) = RAM8(0x235Bu);
    LONG8(0x00212Du) = RAM8(0x235Cu);
    LONG8(0x002131u) = RAM8(0x235Du);
    LONG8(0x002130u) = RAM8(0x235Eu);

    /* TRB $0B29 clears bit 0 of HUD dirty flags */
    hud_flags = ABS8(r, HUD_DIRTY_UPDATE_FLAGS_ADDR);
    ABS8(r, HUD_DIRTY_UPDATE_FLAGS_ADDR) = (uint8_t)(hud_flags & (uint8_t)~0x01u);

    flags_22ea = RAM8(GAMEPLAY_FLAGS_22EA_ADDR);
    a8 = (uint8_t)(flags_22ea & 0x80u);
    if (a8 != 0u) {
        a8 = 0x01u;
        ABS8(r, HUD_DIRTY_UPDATE_FLAGS_ADDR) = a8;
    }

    soe_set_a8(r, a8);
    soe_nz8(r, a8);
    /* REP #$20; SEC */
    r->p = (uint8_t)((r->p & (uint8_t)~SOE_M) | SOE_C);
}
