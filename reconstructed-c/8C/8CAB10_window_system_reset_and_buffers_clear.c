/*
 * $8C:AB10 window_system_reset_and_buffers_clear
 * (src/games/evermore/localizations/knowledge/routines/window_system_reset_and_buffers_clear.md), RTL.
 *
 * Master reset routine for the game window and dialogue system:
 * - Clears active window flags $0B2F, $0B31, $0B2B.
 * - Initializes window descriptors at $0365..$04B1 and VRAM bases at $0367..$04B3.
 * - Clears window status words at $0377..$04C3.
 * - Performs DMA transfers to VRAM $1FF8 and $1FF0.
 * - Commits base palette from $C4:1EA4 to CGRAM 0 via $80:85FA.
 * - Calls $8C:AC16 and $8C:AFEB.
 * - Queues shadow tilemap DMA via $8C:AFD0 -> $80:8650.
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(window_system_reset_and_buffers_clear, 0x8CAB10, RTL)
{
    RAM16(0x0B2F) = 0;
    RAM16(0x0B31) = 0;
    RAM16(0x0B2B) = 0;

    RAM16(0x0365) = 0xA000u;
    RAM16(0x0391) = 0xA500u;
    RAM16(0x03BD) = 0xAA00u;
    RAM16(0x03F5) = 0xAF00u;
    RAM16(0x0421) = 0xB400u;
    RAM16(0x044D) = 0xB900u;
    RAM16(0x0485) = 0xBE00u;
    RAM16(0x04B1) = 0xC300u;

    RAM16(0x0367) = 0x0C00u;
    RAM16(0x0393) = 0x0E80u;
    RAM16(0x03BF) = 0x1100u;
    RAM16(0x03F7) = 0x1380u;
    RAM16(0x0423) = 0x1600u;
    RAM16(0x044F) = 0x1880u;
    RAM16(0x0487) = 0x1B00u;
    RAM16(0x04B3) = 0x1D80u;

    RAM16(0x0377) = 0;
    RAM16(0x03A3) = 0;
    RAM16(0x03CF) = 0;
    RAM16(0x0407) = 0;
    RAM16(0x0433) = 0;
    RAM16(0x045F) = 0;
    RAM16(0x0497) = 0;
    RAM16(0x04C3) = 0;

    // DMA channel 1 to VRAM 0x1FF8 from $8C:AC12 (16 bytes)
    IO16(0x2116) = 0x1FF8u;
    IO8(0x2115) = 0x80u;
    IO8(0x4311) = 0x18u;
    IO8(0x4310) = 0x09u;
    IO16(0x4315) = 0x0010u;
    IO16(0x4312) = 0xAC12u;
    IO8(0x4314) = 0x8Cu;
    IO8(0x420B) = 0x02u;

    // DMA channel 1 to VRAM 0x1FF0 from $8C:AC14 (16 bytes)
    IO16(0x2116) = 0x1FF0u;
    IO8(0x2115) = 0x80u;
    IO8(0x4311) = 0x18u;
    IO8(0x4310) = 0x09u;
    IO16(0x4315) = 0x0010u;
    IO16(0x4312) = 0xAC14u;
    IO8(0x4314) = 0x8Cu;
    IO8(0x420B) = 0x02u;

    // Commit base palette from $C4:1EA4 to CGRAM 0 (8 colors)
    DP16(r, 0x26) = 0x1EA4u;
    DP16(r, 0x28) = 0x00C4u;
    DP16(r, 0x2E) = 0x0000u;
    r->x = 0x0008u;
    soe_call_rtl(0x8085FA, r);

    // Call $8C:AC16 and $8C:AFEB
    soe_call_rtl(0x8CAC16, r);
    soe_call_rtl(0x8CAFEB, r);

    // JML $8CAFD0 -> $80:8650
    DP16(r, 0x26) = 0xC800u;
    DP16(r, 0x28) = 0x007Fu;
    DP16(r, 0x2E) = 0x0800u;
    r->x = 0x0700u;
    soe_call_rtl(0x808650, r);
}

