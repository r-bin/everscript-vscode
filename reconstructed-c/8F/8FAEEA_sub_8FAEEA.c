/**
 * Routine: $8F:AEEA (sub_8FAEEA)
 * Bank: $8F (ROM Offset: $0FAEEA)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8FAEEA ($8FAEEA) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  93 instructions (205 bytes)
 * - Compiled C ASM:   257 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   2.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      014a2eed14314146
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"

#define MOVEMENT_OK_OR_STOPPED_BIT 0x0001u
#define MOVEMENT_APPLIED_BIT       0x0002u

SOE_BIND(sub_8FAEEA, 0x8FAEEA, RTL);

static inline uint16_t decode_step_offset(uint16_t raw, uint16_t dp_base) {
    uint16_t swapped_or = (uint16_t)(((raw >> 8) | (raw << 8)) | raw);
    uint16_t dec = (uint16_t)(swapped_or - 1u);
    return (dec & 0x8000u) ? dec : dp_base;
}

/**
 * Advances candidate entity coordinates in DP $46/$48 from $1A/$1C and checks
 * terrain passability via $8F:AF48. On success, sets flag bit $0002 and commits
 * position via $8F:C2E4; on collision, sets bit $0001.
 */
void sub_8FAEEA_bind(soe_regs r) {
    uint16_t entity = r->y;
    uint16_t x_off = decode_step_offset(DP16(r, 0x1Au), r->d);
    uint16_t cur_x = ABS16(r, (uint16_t)(entity + 0x001Au));
    uint16_t cand_x = (uint16_t)(x_off + cur_x + 1u);
    DP16(r, 0x46u) = cand_x;

    uint16_t y_off = decode_step_offset(DP16(r, 0x1Cu), r->d);
    uint16_t cur_y = ABS16(r, (uint16_t)(entity + 0x001Cu));
    soe_carry(r, true);
    uint16_t cand_y = soe_adc16(r, y_off, cur_y);
    DP16(r, 0x48u) = cand_y;
    r->a = cand_y;

    soe_call_rtl(0x8FAF48u, r);

    if (r->p & SOE_C) {
        uint16_t f = (uint16_t)(ABS16(r, (uint16_t)(r->y + 0x0012u)) | MOVEMENT_APPLIED_BIT);
        ABS16(r, (uint16_t)(r->y + 0x0012u)) = f;
        r->a = f;
        soe_nz16(r, f);
        soe_call_rtl(0x8FC2E4u, r);
        return;
    }

    uint16_t f = (uint16_t)(ABS16(r, (uint16_t)(r->y + 0x0012u)) | MOVEMENT_OK_OR_STOPPED_BIT);
    ABS16(r, (uint16_t)(r->y + 0x0012u)) = f;
    r->a = f;
    soe_nz16(r, f);
}
