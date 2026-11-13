/*
 * $90:CBB3 reload_families_when_a_script_changes_map_palett (knowledge/routines/reload_families_when_a_script_changes_map_palett.md), RTL, 16-bit A, X, Y.
 *
 * Compares $7E:2437 against loaded palette tag $0F8A, reloading tile families via $90:D020 on change,
 * then processes the palette reload queue ($90:D55F) and ticks animated palette channels ($90:D481).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   reload_families_when_a_script_changes_map_palett ($90CBB3) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (21 bytes)
 * - Compiled C ASM:   102 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      c12bdf4b249be409
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

void palette_family_reload_queue_process_bind(soe_regs r);

SOE_BIND(reload_families_when_a_script_changes_map_palett, 0x90CBB3, RTL)
{
    SOE_AT(0xCBB3);
    r->a = RAM16(0x2437);
    soe_cmp16(r, r->a, ABS16(r, LOADED_PALETTE_TAG_ADDR));
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xCBBC);
        soe_call_rtl(0x90D020, r);
    }
    SOE_AT(0xCBC0);
    palette_family_reload_queue_process_bind(r);
    soe_call_rts(0x90D481, r);
}
