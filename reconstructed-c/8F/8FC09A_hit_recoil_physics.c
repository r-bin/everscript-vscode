/*
 * Routine: $8FC09A (hit_recoil_physics)
 * Bank: $8F (ROM Offset: $0FC09A)
 * Source: docs/disassembly/combat/hit-recoil-physics.md
 */

#include <stdint.h>
#include <stdbool.h>

#define DAMAGE_CAP 999

extern uint16_t g_last_damage_dealt;      // $7E:0EA0
extern uint16_t g_active_attacker_ptr;    // DP $4C
extern uint16_t g_boy_last_attacker;      // $7E:4EAD
extern uint16_t g_dog_last_attacker;      // $7E:4F5B

typedef struct CombatEntity {
    uint16_t pad0[8];
    uint16_t status_flags_10;   // +$10
    uint16_t reaction_flags_12; // +$12
    uint16_t immunity_flags_14; // +$14
    uint16_t pad1[2];
    int16_t  world_x;           // +$1A
    int16_t  world_y;           // +$1C
    uint16_t pad2[3];
    uint16_t last_attacker_ptr; // +$24
    uint16_t pad3[2];
    int16_t  current_hp;        // +$2A
    uint16_t pad4[37];
    int16_t  pending_damage;    // +$76
    uint16_t pad5[4];
    uint16_t secondary_attacker;// +$80
} CombatEntity;

extern void particle_spawn_floating_number(int16_t x, int16_t y, uint16_t value); // $8F:C09A

/**
 * Spawns an on-screen floating damage number particle above the victim's head.
 */
void combat_floating_damage_number_spawn(CombatEntity* victim, uint16_t damage) {
    if (!victim || damage == 0) return;

    // Center floating text 16 pixels above entity origin
    int16_t spawn_x = victim->world_x;
    int16_t spawn_y = victim->world_y - 16;

    particle_spawn_floating_number(spawn_x, spawn_y, damage);
}

/**
 * Delivers damage to a target actor, evaluates invulnerability, and sets flinch reactions.
 *
 * @param victim Pointer to target entity receiving damage
 * @param raw_damage Initial gross damage amount
 */
void combat_damage_delivery_and_flinch(CombatEntity* victim, uint16_t raw_damage) {
    if (!victim) return;

    g_last_damage_dealt = raw_damage;

    // 1. Invulnerability check: Bit 14 in status flags or Bits 0, 2, 3, 8 in immunity flags
    if (victim->status_flags_10 & 0x4000) return;
    if (victim->immunity_flags_14 & 0x010D) return;

    // 2. Arm flinch, HUD flash, and invulnerability reaction flags
    victim->reaction_flags_12 |= 0x0438;

    // 3. Clamp damage strictly to the hard cap (999 HP)
    uint16_t clamped_damage = raw_damage;
    if (clamped_damage > DAMAGE_CAP) {
        clamped_damage = DAMAGE_CAP;
    }
    g_last_damage_dealt = clamped_damage;

    // 4. Accumulate into pending damage buffer
    victim->pending_damage += clamped_damage;
}

/**
 * Binds the attacking entity's address to the victim for AI aggro and XP crediting.
 */
void combat_attacker_attribution_bind(CombatEntity* victim, uint16_t attacker_ptr) {
    if (!victim) return;

    victim->last_attacker_ptr = attacker_ptr;
    victim->secondary_attacker = attacker_ptr;

    // Check if target is Boy ($4E89) or Dog ($4F37)
    uint16_t victim_addr = (uint16_t)(uintptr_t)victim;
    if (victim_addr == 0x4E89) {
        g_boy_last_attacker = attacker_ptr;
    } else if (victim_addr == 0x4F37) {
        g_dog_last_attacker = attacker_ptr;
    }
}
