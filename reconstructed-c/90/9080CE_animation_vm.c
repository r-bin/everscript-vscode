/**
 * Routine: $90:80CE (anim_vm_tick)
 * Bank: $90 (ROM Offset: $1080CE)
 * Calling convention: RTL (Y = animation slot pointer)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_vm_tick ($9080CE) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  36 instructions (71 bytes)
 * - Compiled C ASM:   383 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b277646aa3bf3931
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

#define ANIM_OPCODE_TABLE_ROM  0x908000u
#define ANIM_HOLD_DEFAULT      1u
#define ANIM_SCRIPT_END_FLAG   0x80u
#define ANIM_PC_DP             0x5Du
#define ANIM_BANK_DP           0x5Fu

SOE_BIND(anim_vm_tick, 0x9080CE, RTL);

/**
 * Advances one tick of an entity/sprite animation bytecode slot at DB:Y:
 * ensures the script record is synced ($90:817B), increments elapsed ticks,
 * executes command opcodes until the end-of-frame bit ($80), then decrements
 * the frame hold countdown or commits the next frame PC.
 */
void anim_vm_tick_bind(soe_regs r) {
    soe_call_rtl(0x90817Bu, r);

    uint16_t slot = r->y;
    r->x = slot;
    ABS16(r, (uint16_t)(slot + 0x000Eu))++;

    uint16_t pc = ABS16(r, slot);
    r->x = pc;
    DP16(r, ANIM_PC_DP) = pc;
    DP8(r, ANIM_BANK_DP) = ABS8(r, (uint16_t)(slot + 0x0002u));

    bool frame_done = false;
    do {
        uint32_t bus_pc = SOE_DPPTR(r, ANIM_PC_DP);
        uint8_t cmd = LONG8(bus_pc);
        DP16(r, ANIM_PC_DP) = (uint16_t)(DP16(r, ANIM_PC_DP) + 1u);

        uint8_t shifted = (uint8_t)(cmd << 1);
        frame_done = (cmd & ANIM_SCRIPT_END_FLAG) != 0u;

        uint16_t table_off = (uint16_t)((r->d & 0xFF00u) | shifted);
        r->a = table_off;
        r->x = table_off;
        r->p |= SOE_M;
        soe_carry(r, frame_done);
        soe_nz8(r, shifted);

        uint16_t handler = ROM16(ANIM_OPCODE_TABLE_ROM + table_off);
        soe_call_rts(0x900000u | handler, r);
    } while (!frame_done);

    slot = r->y;
    r->x = slot;
    uint8_t hold = (uint8_t)(ABS8(r, (uint16_t)(slot + 0x0005u)) - 1u);
    ABS8(r, (uint16_t)(slot + 0x0005u)) = hold;

    if (hold != 0u) {
        r->p &= (uint8_t)~(SOE_M | SOE_X);
        soe_nz8(r, hold);
        return;
    }

    ABS8(r, (uint16_t)(slot + 0x0005u)) = ANIM_HOLD_DEFAULT;
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    uint16_t next_pc = DP16(r, ANIM_PC_DP);
    ABS16(r, slot) = next_pc;
    r->a = next_pc;
    soe_nz16(r, next_pc);
}
