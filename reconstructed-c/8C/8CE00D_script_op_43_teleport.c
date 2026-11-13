/*
 * $8C:E00D script_op_43_teleport (knowledge/routines/script_op_43_teleport.md), RTS, 16-bit A, X, Y.
 *
 * Evaluates entity operand and pixel (X, Y) coordinates into DP $4C, $46, $48, and repositions
 * the entity via $8F:C2D1 or $8F:C2E4 (with Z-override $23DB) unless blocked by flag $0008.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_43_teleport ($8CE00D) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  20 instructions (51 bytes)
 * - Compiled C ASM:   202 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8b8c3d52c1d5d9a2
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

void script_entity_operand_bind(soe_regs r);

SOE_BIND(script_op_43_teleport, 0x8CE00D, RTS)
{
    SOE_AT(0xE00D);
    script_entity_operand_bind(r);
    soe_call_rtl(0x8CEA43, r);
    DP16(r, 0x46) = r->a;
    soe_call_rtl(0x8CEA43, r);
    DP16(r, 0x48) = r->a;
    r->y = DP16(r, 0x4C);
    r->a = ABSI16(r, 0x0010, r->y);
    soe_nz16(r, r->a);
    soe_bit_imm(r, r->a, 0x0008);
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xE030);
        r->p |= SOE_C;
        return;
    }
    SOE_AT(0xE027);
    r->a = ABS16(r, QUEUED_ROOM_EXIT_TRIGGER_0_ADDR);
    soe_nz16(r, r->a);
    if (r->p & SOE_N) {
        SOE_AT(0xE02C);
        soe_call_rtl(0x8FC2D1, r);
        SOE_AT(0xE030);
        r->p |= SOE_C;
        return;
    }
    SOE_AT(0xE032);
    DP16(r, 0x44) = r->a;
    r->a = 0xFFFF;
    soe_nz16(r, 0xFFFF);
    ABS16(r, QUEUED_ROOM_EXIT_TRIGGER_0_ADDR) = 0xFFFF;
    soe_call_rtl(0x8FC2E4, r);
    r->p |= SOE_C;
}
