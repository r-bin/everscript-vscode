/*
 * $8C:DCC3 — script_op_c2_spawn_spawner (RTS)
 * $8C:DCD9 — script_op_ba_spawn (RTS)
 * $8C:DCEC — script_op_3c_spawn (RTS)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_3c_spawn ($8CDCEC) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  35 instructions (71 bytes)
 * - Compiled C ASM:   141 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4325cbefe6a563fb
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static void spawn_tail(soe_regs r)
{
    uint16_t tx = (uint16_t)((LONG8(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82)) & 0x00FFu) << 3);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1u);
    DP16(r, 0x46) = tx;

    uint16_t ty = (uint16_t)((LONG8(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82)) & 0x00FFu) << 3);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1u);
    DP16(r, 0x48) = ty;

    soe_call_rtl(0x8FA933u, r);

    uint16_t flags = DP16(r, 0x08);
    r->a = flags;
    if ((flags & 0x8000u) == 0) {
        soe_call_rtl(0x8FB094u, r);
        RAM16(0x0341u) = r->x;
        soe_nz16(r, r->x);
    } else {
        soe_call_rtl(0x8FDE98u, r);
    }
    r->p |= SOE_C;
}

SOE_BIND(script_op_c2_spawn_spawner, 0x8CDCC3, RTS);
void script_op_c2_spawn_spawner_bind(soe_regs r)
{
    uint16_t id = (uint16_t)(LONG8(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82)) & 0x00FFu);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1u);
    r->x = (uint16_t)(id << 1);
    DP16(r, 0x02) = ROM16(0x8EB55Au + r->x);
    DP16(r, 0x08) = 0x8000u;
    spawn_tail(r);
}

SOE_BIND(script_op_ba_spawn, 0x8CDCD9, RTS);
void script_op_ba_spawn_bind(soe_regs r)
{
    uint16_t id = (uint16_t)(LONG8(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82)) & 0x00FFu);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1u);
    r->x = (uint16_t)(id << 1);
    DP16(r, 0x02) = ROM16(0x8EB55Au + r->x);
    DP16(r, 0x08) = 0;
    spawn_tail(r);
}

SOE_BIND(script_op_3c_spawn, 0x8CDCEC, RTS);
void script_op_3c_spawn_bind(soe_regs r)
{
    uint16_t x = LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2u);
    r->x = x;
    DP16(r, 0x02) = ROM16(0x8EB55Au + r->x);
    uint16_t flags = LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2u);
    DP16(r, 0x08) = flags;
    spawn_tail(r);
}
