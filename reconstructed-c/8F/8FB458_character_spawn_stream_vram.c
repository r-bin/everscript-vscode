/**
 * Routine: $8F:B458 (character_spawn_stream_vram)
 * Bank: $8F (ROM Offset: $0FB458)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   character_spawn_stream_vram ($8FB458) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  8 instructions (21 bytes)
 * - Compiled C ASM:   97 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3bcd3b9154d8e270
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(character_spawn_stream_vram, 0x8FB458, RTS);

void character_spawn_stream_vram_bind(soe_regs r) {
    DP16(r, 0x4Cu) = r->y;
    soe_call_rtl(0x8FC2E4u, r);
    r->y = DP16(r, 0x4Cu);
    r->x = ABSI16(r, 0x0060u, r->y);
    r->a = ROM16(0x8E0032u + r->x);
    r->x = r->a;
    soe_nz16(r, r->x);
    soe_call_rtl(0x9080CEu, r);
}
