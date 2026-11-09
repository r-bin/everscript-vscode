/*
 * $90:877D anim_op_loop (knowledge/routines/anim_op_loop.md), RTS, 8-bit A on entry and exit.
 *
 * Animation command 2D: jump to the animation loop restart point.
 * Copies restart PC from entity record +$03 (+$03,Y) into current PC +$00 (+$00,Y)
 * and direct page script pointer offset DP $5D.
 * Leaves A = 16-bit restart address (high byte in B), N Z from the load, M=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_op_loop ($90877D) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (13 bytes)
 * - Compiled C ASM:   83 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8e028337a6eeb0dc
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(anim_op_loop, 0x90877D, RTS)
{
    uint16_t restart_pc;

    SOE_AT(0x877D);
    restart_pc = ABSI16(r, ENTITY_RECORD_ANIM_RESTART_OFF, r->y);
    ABSI16(r, ENTITY_RECORD_ANIM_PTR_OFF, r->y) = restart_pc;
    DP16(r, 0x5D) = restart_pc;
    r->a = restart_pc;
    soe_nz16(r, restart_pc);
    r->p |= SOE_M;
}
