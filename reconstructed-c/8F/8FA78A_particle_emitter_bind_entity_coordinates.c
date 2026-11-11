/**
 * Routine: $8F:A78A (particle_emitter_bind_entity_coordinates)
 * Bank: $8F (ROM Offset: $0FA78A)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   particle_emitter_bind_entity_coordinates ($8FA78A) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  47 instructions (113 bytes)
 * - Compiled C ASM:   242 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      233e9b15bc1286c6
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"
#include "soe_ram.h"

SOE_BIND(particle_emitter_bind_entity_coordinates, 0x8FA78A, RTL);

/**
 * Copies the target entity's pixel and coarse tile coordinates into the
 * companion waypoint / emitter record at $4E, clears its active timer, and
 * tail-jumps into the proximity evaluation helper ($8F:A723).
 */
void particle_emitter_bind_entity_coordinates_bind(soe_regs r) {
    uint16_t slot = DP16(r, DP_CHILD_RECORD);
    uint16_t entity = r->y;

    r->x = slot;
    ABS16(r, (uint16_t)(slot + 0x3C1Cu)) = ABS16(r, (uint16_t)(entity + 0x001Au));
    ABS16(r, (uint16_t)(slot + 0x3C1Eu)) = ABS16(r, (uint16_t)(entity + 0x001Cu));
    ABS16(r, (uint16_t)(slot + 0x3BFAu)) = ABS16(r, (uint16_t)(entity + 0x0017u));

    uint16_t tile_xy = ABS16(r, (uint16_t)(entity + 0x0062u));
    r->a = tile_xy;
    ABS16(r, (uint16_t)(slot + COMPANION_WAYPOINT_16_COORDS_ADDR)) = tile_xy;
    ABS16(r, (uint16_t)(slot + 0x3C16u)) = 0u;
    soe_nz16(r, tile_xy);

    soe_call_rtl(0x8FA723u, r);
}
