/*
 * Routine: $8FC824 (spell_collision)
 * Bank: $8F (ROM Offset: $0FC824)
 * Source: docs/disassembly/combat/spell-collision.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_camera_x; // DP $59
extern uint16_t g_camera_y; // DP $5B
extern uint16_t g_particle_buffer_ptr; // $1276

extern void oam_composite_particle_slice(uint16_t x, uint16_t y, uint16_t slice, uint16_t flags); // $80:960A

/**
 * $8F:C824 - spell_screen_projection_with_elevation
 * Projects 3D world coordinates (X, Y, Z) and child offsets to 2D screen coordinates.
 */
void spell_screen_projection_with_elevation(Entity* entity, int16_t* out_screen_x, int16_t* out_screen_y) {
    // 1. Horizontal screen projection: World X + Projectile Offset X - Camera X
    *out_screen_x = (int16_t)(entity->world_x + entity->child_offset_x) - (int16_t)g_camera_x;

    // 2. Isometric elevation calculation: inverted Z shifted right by 4
    int16_t z_inverted = (int16_t)(entity->elevation_z ^ 0x7FFF);
    int16_t z_screen_offset = (z_inverted >> 4) - 0x0800;

    // 3. Vertical screen projection: World Y + Projectile Offset Y + Z offset - Camera Y
    *out_screen_y = (int16_t)(entity->world_y + entity->child_offset_y + z_screen_offset) - (int16_t)g_camera_y;
}

/**
 * $8F:C86C - spell_multi_target_aoe_dispatcher
 * Iterates through active spell hit segments and composites hit particles.
 */
void spell_multi_target_aoe_dispatcher(SpellHitSegment* segments, uint16_t segment_count,
                                      int16_t screen_x, int16_t screen_y, int16_t depth_base) {
    for (uint16_t i = 0; i < segment_count; i++) {
        SpellHitSegment* seg = &segments[i];

        // Depth elevation test
        int16_t combined_depth = depth_base + seg->depth_offset;
        if (combined_depth <= 0) {
            continue; // Clipped beneath ground or elevation plane
        }

        // Relative screen space offsets with sign extension
        int16_t part_x = screen_x + seg->offset_x;
        int16_t part_y = screen_y + seg->offset_y;

        // Composite particle slice into OAM display list
        oam_composite_particle_slice(part_x, part_y, seg->sprite_slice, seg->render_flags);
    }
}

/**
 * $8F:C8DE - spell_script_payload_unpack
 * Unpacks dynamic bytecode payload into active projectile hit definition slots.
 */
void spell_script_payload_unpack(const uint8_t** script_ptr, SpellHitSegment* dest_slot) {
    const uint8_t* p = *script_ptr;
    uint8_t count = *p++;

    dest_slot->depth_offset = (int16_t)(*p++);
    dest_slot->target_mask  = (uint16_t)p[0] | ((uint16_t)p[1] << 8);
    p += 2;
    dest_slot->sprite_slice = (uint16_t)p[0] | ((uint16_t)p[1] << 8);
    p += 2;

    *script_ptr = p;
}
