/*
 * $8C:AF2B window_tilemap_buffer_init
 * (src/games/evermore/localizations/knowledge/routines/window_tilemap_buffer_init.md), RTL.
 *
 * Window tilemap buffer initializer and font DMA staging:
 * - Computes total rows product +$1C,y * +$1E,y via hardware multiplication $4202/$4216.
 * - Streams font glyph tiles via DMA channel 1 to WRAM $7F:C800 shadow buffer.
 * - Enqueues VRAM DMA uploads in chunks of $0800 bytes via $80:8650 and $80:858C.
 * - Copies +$0A,y to +$00,y and +$0C,y to +$02,y.
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(window_tilemap_buffer_init, 0x8CAF2B, RTL)
{
    uint16_t y = r->y;

    uint16_t mul_in = (uint16_t)(((ABS16(r, 0x001C + y) & 0xFFu) << 8) | (ABS16(r, 0x001E + y) & 0xFFu));
    IO16(0x4202) = mul_in;
    uint16_t count = IO16(0x4216);
    DP16(r, 0x32) = count;
    DP16(r, 0x06) = (uint16_t)(count << 4);
    DP16(r, 0x02) = 0;

    while (count != 0) {
        uint16_t dest_off = (uint16_t)(ABS16(r, 0x0018 + y) + DP16(r, 0x02));
        IO16(0x2181) = dest_off;
        IO8(0x2183) = 0x7Fu;
        DP8(r, 0x28) = 0x7Fu;

        IO8(0x4311) = 0x80u;
        IO16(0x4312) = ABS16(r, 0x0026 + y);
        IO8(0x4314) = 0xC4u;
        IO16(0x4315) = 0x0010u;
        IO8(0x4310) = 0x00u;
        IO8(0x420B) = 0x02u;

        DP16(r, 0x02) = (uint16_t)(DP16(r, 0x02) + 0x0010u);
        DP16(r, 0x04) = (uint16_t)(DP16(r, 0x04) + 0x0008u);

        count--;
        DP16(r, 0x32) = count;
    }

    DP16(r, 0x26) = ABS16(r, 0x0018 + y);
    DP16(r, 0x2E) = ABS16(r, 0x001A + y);

    while ((int16_t)(DP16(r, 0x06) - 0x0800u) >= 0) {
        DP16(r, 0x06) = (uint16_t)(DP16(r, 0x06) - 0x0800u);
        r->x = 0x0800u;
        soe_call_rtl(0x808650, r);
        soe_call_rtl(0x80858C, r);

        DP16(r, 0x26) = (uint16_t)(DP16(r, 0x26) + 0x0800u);
        DP16(r, 0x2E) = (uint16_t)(DP16(r, 0x2E) + 0x0400u);
    }

    r->x = DP16(r, 0x06);
    soe_call_rtl(0x808650, r);

    ABS16(r, 0x0000 + y) = ABS16(r, 0x000A + y);
    ABS16(r, 0x0002 + y) = ABS16(r, 0x000C + y);
}

