/*
 * $8C:D340 — script_op_a6_call_back_far (RTS)
 * $8C:D35C — script_op_a5_call_back (RTS)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_a5_call_back ($8CD35C) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  45 instructions (89 bytes)
 * - Compiled C ASM:   74 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1a9c1898f982b035
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static void call_back_tail(soe_regs r, uint16_t off)
{
    DP16(r, 0x02) = off;
    uint16_t base_pc = r->a;
    /* caller pushed A before reading operand; here base_pc is passed via DP $2E */
    (void)base_pc;
}

static void call_back_finish(soe_regs r, uint16_t off, uint16_t base_pc)
{
    DP16(r, 0x02) = off;
    DP16(r, 0x2E) = base_pc;

    uint16_t bank_diff = (uint16_t)(DP16(r, 0x84) - 0x0092u);
    uint16_t bank_bit = (uint16_t)(bank_diff & 1u);
    DP16(r, 0x28) = (uint16_t)(bank_diff >> 1);

    uint16_t addr = (bank_bit != 0) ? (uint16_t)(base_pc | 0x8000u) : (uint16_t)(base_pc & 0x7FFFu);
    uint32_t sum32 = (uint32_t)addr + (uint32_t)off;
    uint16_t lo = (uint16_t)sum32;
    uint16_t c = (sum32 >> 16) ? 1u : 0u;
    DP16(r, 0x26) = lo;
    DP16(r, 0x28) = (uint16_t)(DP16(r, 0x28) + 0xFFFFu + c);

    soe_call_rtl(0x8CCF18u, r);

    r->y = DP16(r, 0x7E);
    RAM16((uint16_t)(r->x + 0x000Bu)) = r->y;
    uint16_t next = RAM16((uint16_t)(r->y + 0x000Du));
    RAM16((uint16_t)(r->x + 0x000Du)) = next;
    uint16_t slot = r->x;
    if (next != 0) {
        RAM16((uint16_t)(next + 0x003Eu)) = (uint16_t)(RAM16((uint16_t)(next + 0x003Eu)) + 1u);
    }
    r->y = DP16(r, 0x80);
    RAM16((uint16_t)(0x2F28u + r->y)) = slot;
    r->y = (uint16_t)(r->y - 2u);
    DP16(r, 0x80) = r->y;
    r->a = slot;
    r->x = next;
    soe_nz16(r, r->y);
    r->p &= (uint8_t)~SOE_C;
}

SOE_BIND(script_op_a6_call_back_far, 0x8CD340, RTS);
void script_op_a6_call_back_far_bind(soe_regs r)
{
    uint16_t base_pc = (uint16_t)(DP16(r, 0x82) - 1u);
    uint16_t off = LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2u);
    call_back_finish(r, off, base_pc);
}

SOE_BIND(script_op_a5_call_back, 0x8CD35C, RTS);
void script_op_a5_call_back_bind(soe_regs r)
{
    uint16_t base_pc = (uint16_t)(DP16(r, 0x82) - 1u);
    uint16_t off = (uint16_t)(LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82)) | 0xFF00u);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1u);
    call_back_finish(r, off, base_pc);
}

