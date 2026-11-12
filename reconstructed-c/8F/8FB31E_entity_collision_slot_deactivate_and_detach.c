/*
 * $8F:B31E — entity_collision_slot_deactivate_and_detach (RTL)
 * $8F:DF41 — entity_wake_up_and_resume_ai (RTL)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_wake_up_and_resume_ai ($8FDF41) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  51 instructions (126 bytes)
 * - Compiled C ASM:   78 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   1.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      61bc9c9f04b804bf
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

static void deactivate_and_detach_impl(soe_regs r)
{
    uint8_t old_db = r->db;
    r->db = 0x7Eu;

    r->y = DP16(r, 0x4C);
    r->x = RAM16((uint16_t)(r->y + 0x006Cu));
    if ((r->x & 0x8000u) == 0) {
        soe_call_rtl(0x8F9916u, r);
        RAM16((uint16_t)(r->y + 0x006Cu)) = r->a;
    }

    if ((RAM16((uint16_t)(r->y + 0x0010u)) & 0x0100u) != 0) {
        soe_call_rts(0x8FC514u, r);
    }

    RAM16(0x1072u) = (uint16_t)(RAM16(0x1072u) - 1u);
    RAM16(0x1074u) = (uint16_t)(RAM16(0x1074u) - 1u);

    RAM16((uint16_t)(r->y + 0x0010u)) = 0;
    RAM16((uint16_t)(r->y + 0x0012u)) = 0;
    RAM16((uint16_t)(r->y + 0x0014u)) = 0;
    RAM16((uint16_t)(r->y + 0x0016u)) = 0;
    RAM16((uint16_t)(r->y + 0x0024u)) = 0;
    RAM16((uint16_t)(r->y + 0x0080u)) = 0;
    RAM16((uint16_t)(r->y + 0x0036u)) = 0;
    RAM16((uint16_t)(r->y + 0x0038u)) = 0;
    RAM16((uint16_t)(r->y + 0x002Au)) = 0;

    uint16_t target = DP16(r, 0x4C);
    r->x = 0x3D83u;
    r->y = RAM16(0x3DE1u);
    while (r->y != target) {
        r->x = r->y;
        r->y = RAM16((uint16_t)(r->x + 0x005Eu));
    }
    r->p |= SOE_C;
    RAM16((uint16_t)(r->x + 0x005Eu)) = RAM16((uint16_t)(r->y + 0x005Eu));

    r->x = 0x3D85u;
    r->y = RAM16(0x3DE3u);
    while (r->y != 0) {
        r->x = r->y;
        r->y = RAM16((uint16_t)(r->x + 0x005Eu));
    }
    RAM16((uint16_t)(r->x + 0x005Eu)) = target;
    r->x = target;
    RAM16((uint16_t)(r->x + 0x005Eu)) = 0;
    r->a = target;
    soe_nz16(r, target);
    r->db = old_db;
}

SOE_BIND(entity_collision_slot_deactivate_and_detach, 0x8FB31E, RTL);
void entity_collision_slot_deactivate_and_detach_bind(soe_regs r)
{
    deactivate_and_detach_impl(r);
}

SOE_BIND(entity_wake_up_and_resume_ai, 0x8FDF41, RTL);
void entity_wake_up_and_resume_ai_bind(soe_regs r)
{
    r->y = DP16(r, 0x4C);
    r->x = RAM16((uint16_t)(r->y + 0x008Cu));
    RAM16((uint16_t)(r->x + 0x0008u)) = 0;
    RAM16((uint16_t)(r->x + 0x000Cu)) = (uint16_t)(RAM16((uint16_t)(r->x + 0x000Cu)) + 1u);
    deactivate_and_detach_impl(r);
}

