/*
 * Routine: $8FB5E6 (strike_hittest)
 * Bank: $8F (ROM Offset: $0FB5E6)
 * Source: docs/disassembly/combat/strike-hittest.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

#define MAX_ALTITUDE_DIFF 0x0460

typedef struct EntityNode {
    uint8_t  _pad0[16];
    uint16_t status_flags_10;   // +0x10: Party and suppression bits
    uint8_t  _pad1[2];
    uint16_t state_flags_14;    // +0x14: Invulnerability / dying state
    uint16_t collision_mode_16; // +0x16: Bit 0x0020 = invulnerability flash
    uint16_t plane_18;          // +0x18: Layer plane & transparency flag (0x0040)
    uint16_t pos_x;             // +0x1A: World coordinate X
    uint16_t pos_y;             // +0x1C: World coordinate Y
    uint16_t pos_z;             // +0x1E: World coordinate Z (altitude)
    uint8_t  _pad2[10];
    uint16_t hp;                // +0x2A: Current HP
    uint8_t  _pad3[10];
    uint16_t last_damage_source;// +0x36: Entity pointer of last attacker
    uint8_t  _pad4[10];
    int16_t  offset_x;          // +0x42: Animated hurtbox offset X
    int16_t  offset_y;          // +0x44: Animated hurtbox offset Y
    uint8_t  _pad5[24];
    struct EntityNode *next;    // +0x5E: Next entity in active linked list
    uint16_t archetype_id;      // +0x60: Character type / hurtbox index
} EntityNode;

typedef bool (*AttackProcHandler)(EntityNode *target, uint16_t action_id);

// Master ROM tables
extern const uint16_t g_entity_radii[];             // $8E:000D
extern const uint16_t g_contact_actions[];          // $8E:0030
extern const AttackProcHandler g_attack_procs[];    // $8F:B6AE

// WRAM references
extern EntityNode *g_active_entity_head;            // $7E:3DDF
extern uint16_t    g_current_action_id;             // $7E:0E9A

/**
 * strike_hit_test_entity_loop ($8F:B5E6)
 * Sweeps candidate entity hurtboxes against a weapon or projectile strike box.
 * 
 * @param attacker Pointer to the entity delivering the strike.
 * @param strike_w Strike bounding box width.
 * @param strike_h Strike bounding box height.
 * @param strike_x Strike center world X coordinate.
 * @param strike_y Strike center world Y coordinate.
 * @param strike_z Attacker elevation altitude.
 * @param strike_plane Attacker layer plane and flags.
 */
void strike_hit_test_entity_loop(
    EntityNode *attacker,
    uint16_t strike_w,
    uint16_t strike_h,
    uint16_t strike_x,
    uint16_t strike_y,
    uint16_t strike_z,
    uint16_t strike_plane
) {
    // 1. Resolve attack action ID from attacker archetype
    uint16_t action_id = g_contact_actions[attacker->archetype_id];
    g_current_action_id = action_id;

    // 2. Setup party and status filter masks
    uint16_t attacker_party = attacker->status_flags_10 & 0x0004;
    uint16_t status_filter = 0x5006;
    if ((uintptr_t)attacker < 0x4E89) {
        status_filter |= 0x0020;
    }

    uint16_t altitude_base = 0x0280 - strike_z;

    // 3. Walk active entities linked list
    for (EntityNode *target = g_active_entity_head; target != NULL; target = target->next) {
        // Faction filter: skip allies and immune targets
        if (((target->status_flags_10 ^ attacker_party) & status_filter) != 0) {
            continue;
        }

        // Living check: target must have HP > 0
        if (target->hp == 0) {
            continue;
        }

        // Invulnerability flash check (bit 0x0020)
        if (target->collision_mode_16 & 0x0020) {
            continue;
        }

        // Prevent repeat hits from same attacker in current swing
        if (target->last_damage_source == (uint16_t)(uintptr_t)attacker) {
            continue;
        }

        // Closed or dying animation state check
        if (target->state_flags_14 & 0x070D) {
            continue;
        }

        // 4. Geometry overlap tests
        uint16_t radius = g_entity_radii[target->archetype_id];

        // Vertical torso hurtbox test (anchored +16 px above feet origin)
        int32_t torso_y = (int32_t)target->pos_y + 16 + target->offset_y;
        int32_t dy = abs(torso_y - (int32_t)strike_y);
        int32_t vert_dist = (dy - (int32_t)radius) * 2;
        if (vert_dist >= (int32_t)strike_h) {
            continue;
        }

        // Horizontal torso hurtbox test
        int32_t torso_x = (int32_t)target->pos_x + target->offset_x;
        int32_t dx = abs(torso_x - (int32_t)strike_x);
        int32_t horiz_dist = (dx - (int32_t)radius) * 2;
        if (horiz_dist >= (int32_t)strike_w) {
            continue;
        }

        // Altitude tolerance test
        if ((target->pos_z + altitude_base) >= MAX_ALTITUDE_DIFF) {
            continue;
        }

        // Layer plane alignment test (unless either entity is plane-transparent)
        if (!(strike_plane & 0x0040) && !(target->plane_18 & 0x0040)) {
            if (target->plane_18 != strike_plane) {
                continue;
            }
        }

        // 5. Successful hit: Dispatch weapon attack proc handler
        AttackProcHandler handler = g_attack_procs[action_id];
        if (handler) {
            bool pierce = handler(target, action_id);
            if (!pierce) {
                // Non-piercing weapon terminates swing upon connecting with first target
                break;
            }
        }
    }
}
