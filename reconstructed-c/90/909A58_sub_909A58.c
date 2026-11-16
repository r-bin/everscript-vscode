/*
 * Routine: sub_909A58 ($90:9A58) and VRAM DMA streaming helpers ($90:999C, $90:99CE, $90:99FB).
 * Graphics/VRAM DMA queue: enqueues tilemap row / column updates into deferred DMA queue at $013D.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   room_collision_word_fetch_at_pixel_coords ($9099FB) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  66 instructions (135 bytes)
 * - Compiled C ASM:   476 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      92ec9f7d1ca910dd
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_909A58, 0x909A58, RTS) {
    uint16_t x = RAM16(0x013Du);
    RAM16(0x0143u + x) = (uint16_t)(r->a | DP16(r, 0x04u));
    RAM16(0x013Fu + x) = r->y;
    RAM16(0x0141u + x) = 0x0009u;
    RAM16(0x0140u + x) = DP16(r, 0x2Eu);
    RAM16(0x0145u + x) = 0x0040u;
    soe_carry(r, false);
    uint16_t sum = soe_adc16(r, x, 0x0008u);
    uint16_t res = (uint16_t)(sum & 0x01FFu);
    RAM16(0x013Du) = res;
    r->x = x;
    r->a = res;
    soe_nz16(r, res);
}

SOE_BIND(sub_9099CE, 0x9099CE, RTS) {
    uint32_t ptr_26 = SOE_DPPTR(r, 0x26u);
    while (1) {
        uint16_t tile_idx = LONG16(0x7F0000u | r->x);
        uint16_t word = LONG16(ptr_26 + tile_idx);
        ABS16(r, r->y) = word;
        uint16_t d12 = (uint16_t)(DP16(r, 0x12u) - 1u);
        DP16(r, 0x12u) = d12;
        soe_nz16(r, d12);
        if (d12 == 0u) break;
        r->x = (uint16_t)(r->x + 2u);
        r->y = (uint16_t)(r->y + 2u);
        soe_cmp16(r, r->y, DP16(r, 0x30u));
        if (r->y == DP16(r, 0x30u)) {
            r->y = DP16(r, 0x2Eu);
            soe_nz16(r, r->y);
        }
    }
    uint16_t a = (uint16_t)((DP16(r, 0x02u) & 0x001Fu) << 5);
    r->a = a;
    r->y = 0x0080u;
    sub_909A58_bind(r);
}

SOE_BIND(room_tilemap_layer2_parallax_offset_calc, 0x90999C, RTS) {
    uint16_t a = DP16(r, 0x48u);
    int16_t x_0c = (int16_t)DP16(r, 0x0Cu);
    r->a = a;
    r->x = (uint16_t)x_0c;
    soe_nz16(r, r->x);
    if (x_0c == 0) {
        return;
    }
    if (x_0c >= 0) {
        a = (uint16_t)(a + 0x000Eu);
    }
    DP16(r, 0x02u) = a;
    uint16_t mul = (uint16_t)((a << 8) | ABS16(r, 0x08EEu));
    ABS16(r, 0x4202) = mul;

    soe_carry(r, false);
    a = soe_adc16(r, DP16(r, 0x46u), ABS16(r, 0x4216));
    soe_carry(r, (a & 0x8000u) != 0);
    a = (uint16_t)(a << 1);
    r->x = a;

    DP16(r, 0x30u) = soe_adc16(r, DP16(r, 0x2Eu), 0x0040u);

    a = (uint16_t)((DP16(r, 0x46u) & 0x001Fu) << 1);
    soe_carry(r, (a & 0x8000u) != 0);
    r->y = soe_adc16(r, a, DP16(r, 0x2Eu));

    DP16(r, 0x12u) = ABS16(r, 0x0FACu);

    sub_9099CE_bind(r);
}

SOE_BIND(room_collision_word_fetch_at_pixel_coords, 0x9099FB, RTS) {
    uint16_t a = DP16(r, 0x46u);
    int16_t x_0a = (int16_t)DP16(r, 0x0Au);
    r->a = a;
    r->x = (uint16_t)x_0a;
    soe_nz16(r, r->x);
    if (x_0a == 0) {
        return;
    }
    if (x_0a >= 0) {
        soe_carry(r, false);
        a = soe_adc16(r, a, ABS16(r, 0x0FACu));
        a = (uint16_t)(a - 1u);
    }
    DP16(r, 0x02u) = a;
    uint16_t mul = (uint16_t)((DP16(r, 0x48u) << 8) | ABS16(r, 0x08EEu));
    ABS16(r, 0x4202) = mul;

    soe_carry(r, false);
    a = soe_adc16(r, a, ABS16(r, 0x4216));
    soe_carry(r, (a & 0x8000u) != 0);
    a = (uint16_t)(a << 1);
    r->x = a;

    DP16(r, 0x30u) = soe_adc16(r, DP16(r, 0x2Eu), 0x0040u);

    a = (uint16_t)((DP16(r, 0x48u) & 0x001Fu) << 1);
    soe_carry(r, (a & 0x8000u) != 0);
    r->y = soe_adc16(r, a, DP16(r, 0x2Eu));

    DP16(r, 0x12u) = 0x000Fu;

    uint32_t ptr_26 = SOE_DPPTR(r, 0x26u);
    while (1) {
        uint16_t tile_idx = LONG16(0x7F0000u | r->x);
        uint16_t word = LONG16(ptr_26 + tile_idx);
        ABS16(r, r->y) = word;
        uint16_t d12 = (uint16_t)(DP16(r, 0x12u) - 1u);
        DP16(r, 0x12u) = d12;
        soe_nz16(r, d12);
        if (d12 == 0u) break;
        soe_carry(r, false);
        r->x = soe_adc16(r, r->x, ABS16(r, 0x0F46u));
        r->y = (uint16_t)(r->y + 2u);
        soe_cmp16(r, r->y, DP16(r, 0x30u));
        if (r->y == DP16(r, 0x30u)) {
            r->y = DP16(r, 0x2Eu);
            soe_nz16(r, r->y);
        }
    }

    r->a = (uint16_t)(DP16(r, 0x02u) & 0x001Fu);
    r->y = 0x0081u;
    sub_909A58_bind(r);
}
