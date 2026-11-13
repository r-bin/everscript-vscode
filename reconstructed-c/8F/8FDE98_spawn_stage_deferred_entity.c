/**
 * Routine: $8F:DE98 (spawn_stage_deferred_entity)
 * Bank: $8F (ROM Offset: $0FDE98)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   spawn_stage_deferred_entity ($8FDE98) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  35 instructions (88 bytes)
 * - Compiled C ASM:   370 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7cd5190437f4bc00
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define DEFERRED_SPAWN_RECORD_SIZE 16u
#define DEFERRED_SPAWN_LIMIT_ADDR  0x6183u
#define ENTITY_TYPE_DEFAULTS_ROM   0x8E0017u
#define FATAL_OVERFLOW_MSG_ADDR    0xDEF0u
#define FATAL_OVERFLOW_MSG_BANK    0x008Fu

SOE_BIND(spawn_stage_deferred_entity, 0x8FDE98, RTL);

/**
 * Appends a 16-byte deferred entity spawn record at $0EC0 (DP $02=type, $46=X,
 * $48=Y, $08=flags). Invokes fatal error handler $8C:C521 if the staging
 * buffer reaches $6183.
 */
void spawn_stage_deferred_entity_bind(soe_regs r) {
    uint16_t cursor = ABS16(r, DEFERRED_SPAWN_BUF_ADDR);
    if (cursor >= DEFERRED_SPAWN_LIMIT_ADDR) {
        DP16(r, 0x22u) = FATAL_OVERFLOW_MSG_ADDR;
        DP16(r, 0x24u) = FATAL_OVERFLOW_MSG_BANK;
        r->a = FATAL_OVERFLOW_MSG_BANK;
        r->y = cursor;
        soe_nz16(r, FATAL_OVERFLOW_MSG_BANK);
        soe_carry(r, true);
        soe_call_rtl(0x8CC521u, r);
        return;
    }

    DP16(r, 0x08u) &= (uint16_t)~0x8000u;

    uint16_t type = DP16(r, 0x02u);
    ABS16(r, cursor) = type;

    uint16_t default_stat = LONG16(ENTITY_TYPE_DEFAULTS_ROM + type);
    uint16_t override_stat = ABS16(r, QUEUED_ROOM_EXIT_TRIGGER_1_ADDR);
    uint16_t stat = (override_stat & 0x8000u) ? default_stat : override_stat;
    ABS16(r, (uint16_t)(cursor + 0x0Eu)) = stat;

    ABS16(r, (uint16_t)(cursor + 0x02u)) = DP16(r, 0x46u);
    ABS16(r, (uint16_t)(cursor + 0x04u)) = DP16(r, 0x48u);
    ABS16(r, (uint16_t)(cursor + 0x06u)) = DP16(r, 0x08u);
    ABS16(r, (uint16_t)(cursor + 0x08u)) = r->d;
    ABS16(r, (uint16_t)(cursor + 0x0Au)) = RAM16(SPAWN_RESPAWN_RATE_DEFAULT_ADDR);
    ABS16(r, (uint16_t)(cursor + 0x0Cu)) = RAM16(SPAWN_SYSTEM_ENABLE_ADDR);

    soe_carry(r, false);
    uint16_t next_cursor = soe_adc16(r, cursor, DEFERRED_SPAWN_RECORD_SIZE);
    ABS16(r, DEFERRED_SPAWN_BUF_ADDR) = next_cursor;

    r->a = next_cursor;
    r->x = override_stat;
    r->y = cursor;
}
