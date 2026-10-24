/*
 * $8F:A93B elevation_ramp_plane_project (knowledge/rom/8fa93b.md), RTL, 16-bit A.
 *
 * In: A = a metatile collision word. DP $44 = word & $30, with $40 added when the word has bit 13
 * (shared tail with update_entity_plane at $8F:A924). Leaves A = the value, N Z from it.
 */
#include "soe.h"

SOE_BIND(elevation_ramp_plane_project, 0x8FA93B, RTL)
{
    uint16_t a = (uint16_t)(r->a & 0x0030);

    if (r->a & 0x2000) a |= 0x0040;
    soe_nz16(r, a);
    DP16(r, 0x44) = a;
    r->a = a;
}
