/*
 * $8C:805B spc700_ipl_stream_uploader (knowledge/routines/spc700_ipl_bootloader_handshake_block_upload.md), RTS.
 *
 * Uploads a music soundbank package to the SPC700 via the IPL bootloader handshake:
 * - Reads transfer count $0E47 from descriptor [$A0],y.
 * - Spin-waits on $2140 for initial ready signature $BBAA.
 * - Streams each memory block via byte-by-byte handshake on $2140.
 * - Sets final execution entry point $0700 in $2142, clears $2141, signals execution,
 *   waits for echo, sets $9F = 1, restores $0E65.
 */
#include "soe.h"
#include "soe_ram.h"

void spc700_stream_advance_bank_pointer_short_bind(soe_regs r);
void spc700_stream_advance_bank_pointer_bind(soe_regs r);

SOE_BIND(spc700_ipl_stream_uploader, 0x8C805B, RTS)
{
    uint8_t saved_p = r->p;
    uint16_t saved_0e65 = RAM16(0x0E65);
    RAM16(0x0E65) = 0;

    DP8(r, 0xA2) = (uint8_t)((r->a & 0xFFu) | 0x80u);
    DP8(r, 0xA1) = 0;
    DP8(r, 0xA0) = 0;
    RAM16(0x0E49) = r->x;
    r->y = r->x;

    uint32_t desc_ptr = ((uint32_t)DP8(r, 0xA2) << 16);
    RAM16(0x0E47) = soe_bus_read16(desc_ptr | r->y);

    spc700_stream_advance_bank_pointer_short_bind(r);
    RAM16(0x0E49) = r->y;
    DP16(r, 0x9C) = 0;

    // Wait for SPC700 IPL handshake $BBAA on $2140
    while (IO16(0x2140) != 0xBBAAu) {
    }

    uint8_t token = 0xCCu;

    while (1) {
        int16_t blocks_remaining = (int16_t)(RAM16(0x0E47) - 1u);
        RAM16(0x0E47) = (uint16_t)blocks_remaining;
        if (blocks_remaining < 0) {
            break;
        }

        r->y = RAM16(0x0E49);
        desc_ptr = ((uint32_t)DP8(r, 0xA2) << 16);
        uint16_t block_len = soe_bus_read16(desc_ptr | r->y);

        if (block_len == 0) {
            uint32_t next_y = r->y + 7u;
            if (next_y > 0xFFFFu) {
                DP8(r, 0xA2) = (uint8_t)(DP8(r, 0xA2) + 1u);
                r->y = (uint16_t)(next_y | 0x8000u);
            } else {
                r->y = (uint16_t)next_y;
            }
            RAM16(0x0E49) = r->y;
            continue;
        }

        r->x = block_len;
        spc700_stream_advance_bank_pointer_short_bind(r);
        desc_ptr = ((uint32_t)DP8(r, 0xA2) << 16);
        uint16_t src_offset = soe_bus_read16(desc_ptr | r->y);

        spc700_stream_advance_bank_pointer_short_bind(r);
        desc_ptr = ((uint32_t)DP8(r, 0xA2) << 16);
        DP8(r, 0x9E) = soe_bus_read8(desc_ptr | r->y);

        spc700_stream_advance_bank_pointer_bind(r);
        desc_ptr = ((uint32_t)DP8(r, 0xA2) << 16);
        IO8(0x2142) = soe_bus_read8(desc_ptr | r->y);

        spc700_stream_advance_bank_pointer_bind(r);
        desc_ptr = ((uint32_t)DP8(r, 0xA2) << 16);
        IO8(0x2143) = soe_bus_read8(desc_ptr | r->y);

        spc700_stream_advance_bank_pointer_bind(r);
        RAM16(0x0E49) = r->y;

        r->y = src_offset;
        IO8(0x2141) = 0x01u;
        IO8(0x2140) = token;

        while (IO8(0x2140) != token) {
        }

        // Stream X bytes from [$9C],y to APU port $2140
        while (r->x != 0) {
            uint32_t src_ptr = ((uint32_t)DP8(r, 0x9E) << 16) | r->y;
            uint8_t byte_val = soe_bus_read8(src_ptr);
            r->y++;
            if (r->y == 0) {
                DP8(r, 0x9E) = (uint8_t)(DP8(r, 0x9E) + 1u);
                r->y = 0x8000u;
            }
            IO8(0x2141) = byte_val;
            IO8(0x2140) = token;
            while (IO8(0x2140) != token) {
            }
            token++;
            r->x--;
        }

        token += 4u;
        if (token == 0) {
            token += 4u;
        }
    }

    IO16(0x2142) = 0x0700u;
    IO8(0x2141) = 0;
    IO8(0x2140) = token;

    while (IO8(0x2140) != token) {
    }

    DP8(r, 0x9F) = 0x01u;
    RAM16(0x0E65) = saved_0e65;
    r->p = saved_p;
}

