/*
 * $8E:B520 mode7_flight_sprite_render (knowledge/routines/mode7_flight_sprite_render.md), RTL.
 *
 * Calculates on-screen perspective projection for the Windwalker flight sprite:
 * - Computes camera-relative X: DP $02 = $0615 - $59.
 * - Multiplies $0619 through hardware multiplier $4202 and shifts product right by 2 into DP $12.
 * - Computes perspective Y: DP $04 = $0617 - DP $12 - $5B.
 * - Configures sprite parameters: DP $06 = $003C, DP $26 = $32C9, DP $28 = $00CC.
 * - Renders sprite to OAM via $80:9033.
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(mode7_flight_sprite_render, 0x8EB520, RTL)
{
    DP16(r, 0x02) = (uint16_t)(RAM16(0x0615) - DP16(r, 0x59));

    uint16_t mul_in = (uint16_t)(((RAM16(0x0619) & 0xFFu) << 8) | ((RAM16(0x0619) >> 8) | 0x0003u));
    IO16(0x4202) = mul_in;
    uint16_t prod = IO16(0x4216);
    DP16(r, 0x12) = (uint16_t)(prod >> 2);

    DP16(r, 0x04) = (uint16_t)(RAM16(0x0617) - DP16(r, 0x12) - DP16(r, 0x5B));
    DP16(r, 0x06) = 0x003Cu;
    DP16(r, 0x26) = 0x32C9u;
    DP16(r, 0x28) = 0x00CCu;

    soe_call_rtl(0x809033, r);
}

