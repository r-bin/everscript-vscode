# Spell Impact Collision & Multi-Target Hitbox Projection

**Addresses**:
- `spell_screen_projection_with_elevation`: `$8F:C824` – `$8F:C84B`
- `spell_hit_target_bounding_box_test`: `$8F:C84C` – `$8F:C86B`
- `spell_multi_target_aoe_dispatcher`: `$8F:C86C` – `$8F:C8DD`
- `spell_script_payload_unpack`: `$8F:C8DE` – `$8F:C904`

**ROM Source**: Bank `$8F` (US 1.0)
**Subsystem**: Combat Engine / Alchemy Spell Subsystem

---

## 1. Overview & Architectural Role

When an alchemy formula is cast (e.g., Flash, Fireball, Acid Rain, Nitro), the spell creates one or more projectile or particle clusters that travel across the room and trigger damage calculations upon impact. Unlike simple 2D collision tests, Secret of Evermore uses a 2.5D elevation projection system where vertical Z-height offsets the visual particle position without altering ground tile collision.

Key mechanisms:
1. **Screen Projection with Elevation (`spell_screen_projection_with_elevation`)**:
   Transforms entity world coordinates $(X_w, Y_w, Z_w)$ into screen space:
   $$X_s = X_w + \text{offset}_x - \text{CameraX}$$
   $$Y_s = Y_w + \text{offset}_y - \frac{\sim Z_w}{16} - \text{CameraY}$$
   The Z height is bitwise inverted (`EOR #$7FFF`), shifted right by 4, and offset by `$0800` to correctly account for isometric elevation perspective.
2. **Multi-Target AOE Hitbox Iteration (`spell_multi_target_aoe_dispatcher`)**:
   Walks an array of 14-byte hit definitions. For each segment, it calculates relative X/Y offsets, evaluates height thresholds, and submits valid particle slices to the OAM compositor (`$80:960A`).
3. **Dynamic Script Payload Unpacking (`spell_script_payload_unpack`)**:
   Unpacks byte streams from spell bytecode scripts (`[$5D],Y`) directly into active projectile parameters, configuring particle depth, target flags, and animation frames.

---

## 2. Data Structures & Memory Layout

```c
// 14-Byte Spell Hit Segment Descriptor
typedef struct SpellHitSegment {
    uint8_t  anim_frame_low;   // +$00: Particle animation frame byte 0
    uint8_t  anim_frame_high;  // +$01: Particle animation frame byte 1
    uint16_t active_flag;      // +$02: Segment valid flag
    int16_t  depth_offset;     // +$03: Relative Z elevation test
    uint16_t target_mask;      // +$04: Target entity mask / ID
    int8_t   offset_x;         // +$07: Signed 8-bit screen offset X
    int8_t   offset_y;         // +$09: Signed 8-bit screen offset Y
    uint16_t render_flags;     // +$0A: Palette, priority, and flip flags
    uint16_t sprite_slice;     // +$0C: OAM tile identifier
} SpellHitSegment;

// Entity Combat & Projectile Slots in WRAM:
// +$1A,Y: Entity World X coordinate
// +$1C,Y: Entity World Y coordinate
// +$1E,Y: Entity Elevation / Z coordinate
// +$42,Y: Child / Projectile offset X
// +$44,Y: Child / Projectile offset Y
// DP $59: Camera X coordinate
// DP $5B: Camera Y coordinate
// $7E:1276: Active particle buffer cursor
```

---

## 3. Clean C Decompilation

```c
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
```

---

## 4. Verification & Behavioral Equivalence

1. **Elevation Formula**: Matches assembly `$8F:C833` (`EOR #$7FFF; LSR x4; SBC #$0800`): accounts for isometric elevation in screen space.
2. **14-Byte Stride**: Iteration loop `$8F:C8D3` uses `ADC #$000E` to step through multi-target segment descriptors.
3. **Depth Culling**: Emulates `BMI / BEQ $C8D3` culling particles when calculated depth falls below ground plane.
