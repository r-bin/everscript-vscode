/*
 * $80:B21F format_32bit_integer_to_decimal_ascii (knowledge/routines/format_32bit_integer_to_decimal_ascii.md), RTL.
 *
 * Formats an unsigned 32-bit integer in DP $02 (low) and DP $04 (high) into an ASCII decimal
 * string written to destination far pointer [$22], with comma thousands separators:
 * - If value is zero: writes '0', returns X = $22 + 1, Y = 1, A = $0030.
 * - Otherwise: calls $80:B283 to convert to BCD in DP $06..$0A, formats digits into [$22],
 *   writes commas at appropriate thousands positions, null terminates, and returns
 *   X = $22 + length, Y = length, A = X.
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(format_32bit_integer_to_decimal_ascii, 0x80B21F, RTL)
{
    uint8_t entry_db = r->db;
    uint16_t low = DP16(r, 0x02);
    uint16_t high = DP16(r, 0x04);
    uint32_t dest = SOE_DPPTR(r, 0x22);

    if ((low | high) == 0) {
        soe_bus_write16(dest, 0x0030u);
        r->a = 0x0030u;
        r->y = 1;
        r->x = (uint16_t)(DP16(r, 0x22) + 1u);
        soe_nz16(r, r->a);
        return;
    }

    r->db = 0x80;
    soe_call_rtl(0x80B283, r);

    // SEP #$30
    uint8_t y = 0;
    int8_t x = 5;
    while (x >= 0 && DP8(r, 0x06 + x) == 0) {
        x--;
    }

    if (x >= 0) {
        uint8_t val = DP8(r, 0x06 + x);
        if (val & 0xF0u) {
            goto emit_high;
        } else {
            goto emit_low;
        }

        while (x >= 0) {
            val = DP8(r, 0x06 + x);
emit_high:
            soe_bus_write8(dest + y, (uint8_t)((val >> 4) + 0x30u));
            y++;
            if (x == 1 || x == 4) {
                soe_bus_write8(dest + y, 0x2Cu); // ','
                y++;
            }
            val = DP8(r, 0x06 + x);
emit_low:
            soe_bus_write8(dest + y, (uint8_t)((val & 0x0Fu) + 0x30u));
            y++;
            if (x == 3) {
                soe_bus_write8(dest + y, 0x2Cu); // ','
                y++;
            }
            x--;
        }
    }

    // null-terminate: TDC; STA [$22],y
    soe_bus_write8(dest + y, 0);

    // REP #$31; TYA; ADC $22; TAX; PLB; RTL
    r->db = entry_db;
    r->x = (uint16_t)(DP16(r, 0x22) + y);
    r->y = y;
    r->a = r->x;
    soe_nz16(r, r->x);
    soe_carry(r, (uint32_t)DP16(r, 0x22) + y > 0xFFFFu);
}

