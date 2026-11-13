/**
 * Routine: $90:811B (entity_set_flag_0040)
 * Bank: $90 (ROM Offset: $10811B)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_set_flag_0040 ($90811B) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  39 instructions (95 bytes)
 * - Compiled C ASM:   75 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      2d8748540cf45463
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

#define ENTITY_ANIM_FLAG_0040 0x0040u

SOE_BIND(entity_set_flag_0040, 0x90811B, RTL);

/**
 * Sets flag bit $0040 on the entity/slot at DB:Y (+0x10) and tail-jumps into
 * anim_start_record ($90:8124) with script record X.
 */
void entity_set_flag_0040_bind(soe_regs r) {
    uint16_t flags = (uint16_t)(ABS16(r, (uint16_t)(r->y + 0x0010u)) | ENTITY_ANIM_FLAG_0040);
    ABS16(r, (uint16_t)(r->y + 0x0010u)) = flags;
    r->a = flags;
    soe_nz16(r, flags);
    soe_call_rtl(0x908124u, r);
}
