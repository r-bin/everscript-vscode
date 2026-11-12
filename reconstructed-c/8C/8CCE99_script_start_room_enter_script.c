/**
 * Routine: $8C:CE99 (script_start_room_enter_script)
 * Bank: $8C (ROM Offset: $0CCE99)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_start_room_enter_script ($8CCE99) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  29 instructions (80 bytes)
 * - Compiled C ASM:   186 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5e7b29de3d5374ac
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_start_room_enter_script, 0x8CCE99, RTL);

void script_start_room_enter_script_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x8Cu;
    soe_call_rtl(0x808D82u, r);
    RAM16(0x23D3u) = r->d;
    RAM16(0x2461u) = r->d;
    RAM16(0x2393u) = 0x0001u;
    RAM16(0x23A7u) = 0x0001u;
    RAM16(0x23A9u) = 0x0001u;
    RAM16(0x23ABu) = 0x0001u;
    uint16_t mul_arg = (uint16_t)(ABS16(r, 0x0ADBu) | 0x0500u);
    IO16(0x8C4202u) = mul_arg;
    uint16_t prod = IO16(0x4216u);
    r->x = prod;
    DP16(r, 0x26u) = ROM16(0x92801Bu + prod);
    DP16(r, 0x27u) = ROM16(0x92801Cu + prod);
    soe_call_rtl(0x8CCF18u, r);
    uint16_t ctx = ABS16(r, 0x0F42u);
    RAM16(0x000Du + r->x) = ctx;
    soe_nz16(r, ctx);
    soe_call_rtl(0x8CCE86u, r);
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
