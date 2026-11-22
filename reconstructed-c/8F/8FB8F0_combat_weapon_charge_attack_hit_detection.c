/*
 * $8F:B8F0 combat_weapon_charge_attack_hit_detection
 * (knowledge/routines/combat_weapon_charge_attack_hit_detection.md), RTL.
 *
 * Performs spatial collision and terrain obstruction checks for weapon attacks (shape 6):
 * - Reads current entity slot from DP $4C.
 * - Inspects active animation record descriptor pointer in +$06,X and +$07,X.
 * - If shape type is not 6, returns SEC (unobstructed).
 * - Probes four bounding corners against the Bank $7F map metatile collision grid.
 * - If any corner collides with an obstacle, plays weapon rebound SFX (index $2C from
 *   table $8C:8362 via $8C:82DC) and returns CLC (blocked).
 * - Otherwise returns SEC (unobstructed).
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(combat_weapon_charge_attack_hit_detection, 0x8FB8F0, RTL)
{
    uint16_t entity_slot = DP16(r, 0x4C);
    uint16_t anim_bank = RAM16(entity_slot + 0x0007);

    if (anim_bank == 0) {
        soe_carry(r, true);
        return;
    }

    DP8(r, 0x27) = (uint8_t)(anim_bank & 0xFFu);
    DP8(r, 0x28) = (uint8_t)(anim_bank >> 8);
    DP16(r, 0x26) = (uint16_t)(RAM16(entity_slot + 0x0006) + 1u);

    uint32_t desc_ptr = SOE_DPPTR(r, 0x26);
    uint8_t shape = soe_bus_read8(desc_ptr);

    if (shape != 0x06u) {
        soe_carry(r, true);
        return;
    }

    // Y-offset probe
    int8_t dy = (int8_t)soe_bus_read8(desc_ptr + 2u);
    DP16(r, 0x14) = (uint16_t)(RAM16(entity_slot + 0x001C) + (int16_t)dy);

    uint16_t row1 = (uint16_t)((((DP16(r, 0x14) & 0x07F0u) >> 3) + 2u) & 0xFFu);
    IO16(0x4202) = (uint16_t)((row1 << 8) | (RAM16(0x08EE) & 0xFFu));

    // X-offset probe
    int8_t dx = (int8_t)soe_bus_read8(desc_ptr + 1u);
    DP16(r, 0x12) = (uint16_t)(RAM16(entity_slot + 0x001A) + (int16_t)dx);

    uint16_t col1 = (uint16_t)(((DP16(r, 0x12) & 0x07F0u) >> 3) + 2u);
    DP16(r, 0x16) = col1;

    uint16_t prod1 = IO16(0x4216);

    // Corner 1 probe
    uint16_t tile_idx1 = RAM16(0x10000u + (uint16_t)(col1 + prod1));
    uint16_t prop1 = RAM16(0x10004u + tile_idx1);
    if (((prop1 ^ 0x0100u) & 0x0F00u) == 0) {
        goto hit_wall;
    }

    // Corner 2 probe (width delta)
    uint8_t w_delta = soe_bus_read8(desc_ptr + 3u);
    uint16_t col2 = (uint16_t)((((DP16(r, 0x12) + w_delta) & 0x07F0u) >> 3) - 2u);
    DP16(r, 0x18) = col2;

    uint16_t tile_idx2 = RAM16(0x10000u + (uint16_t)(col2 + prod1));
    uint16_t prop2 = RAM16(0x10004u + tile_idx2);
    if (((prop2 ^ 0x0100u) & 0x0F00u) == 0) {
        goto hit_wall;
    }

    // Corner 3 probe (height delta)
    uint8_t h_delta = soe_bus_read8(desc_ptr + 4u);
    uint16_t row2 = (uint16_t)((((DP16(r, 0x14) + h_delta) & 0x07F0u) >> 3) - 2u);
    IO16(0x4202) = (uint16_t)((row2 << 8) | (RAM16(0x08EE) & 0xFFu));

    uint16_t prod2 = IO16(0x4216);
    uint16_t tile_idx3 = RAM16(0x10000u + (uint16_t)(col1 + prod2));
    uint16_t prop3 = RAM16(0x10004u + tile_idx3);
    if (((prop3 ^ 0x0100u) & 0x0F00u) == 0) {
        goto hit_wall;
    }

    // Corner 4 probe
    uint16_t tile_idx4 = RAM16(0x10000u + (uint16_t)(col2 + prod2));
    uint16_t prop4 = RAM16(0x10004u + tile_idx4);
    if (((prop4 ^ 0x0100u) & 0x0F00u) == 0) {
        goto hit_wall;
    }

    soe_carry(r, true);
    return;

hit_wall:
    r->x = 0x002Cu;
    uint8_t sfx = ROM8(0x8C8362u + r->x);
    if ((sfx & 0x80u) == 0) {
        r->a = sfx;
        soe_call_rtl(0x8C82DC, r);
    }
    soe_carry(r, false);
}

