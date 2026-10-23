/*
 * Routine: $8FB52C (contact_damage)
 * Bank: $8F (ROM Offset: $0FB52C)
 * Source: docs/disassembly/combat/contact-damage.md
 */

#include <stdint.h>
#include <stdbool.h>

#define CHARGE_DAMAGE_THRESHOLD 0x0400

typedef struct {
    uint8_t  _pad0[16];
    uint16_t status_flags_10;   // +0x10: Status & suppression flags
    uint8_t  _pad1[2];
    uint16_t state_flags_14;    // +0x14: Invulnerability frame bits
    uint16_t collision_mode_16; // +0x16: Charging bits (0xC000) & exemption (0x0021)
    uint8_t  _pad2[18];
    uint16_t current_hp;        // +0x2A
    uint8_t  _pad3[2];
    uint16_t charge_stamina;    // +0x2E: Current momentum / charge value
    uint8_t  _pad4[6];
    uint16_t last_damage_source;// +0x36: Entity pointer of last attacker
    uint8_t  _pad5[40];
    uint16_t contact_weapon_id; // +0x60: Weapon / contact type index
    uint8_t  _pad6[20];
    uint16_t last_damage;       // +0x76: Damage flash / flinch timer
} EntityCombatRecord;

typedef void (*ContactAttackHandler)(EntityCombatRecord *attacker, EntityCombatRecord *victim);

// ROM lookup tables
extern const uint16_t g_contact_action_table[];      // $8E:0030
extern const ContactAttackHandler g_contact_handlers[]; // $8F:B6AE

/**
 * Checks whether an attacker can deal contact charge damage to a victim,
 * and executes the attack if all criteria are satisfied.
 */
static void try_contact_damage(EntityCombatRecord *attacker, EntityCombatRecord *victim) {
    // 1. Attacker must be in charging mode
    if ((attacker->collision_mode_16 & 0xC000) == 0) {
        return;
    }

    // 2. Attacker must meet the charge stamina threshold (1,024 units)
    if (attacker->charge_stamina < CHARGE_DAMAGE_THRESHOLD) {
        return;
    }

    // 3. Victim must not be exempt from collision damage
    if (victim->collision_mode_16 & 0x0021) {
        return;
    }

    // 4. Victim must not have disabling status conditions (petrify, dead, sleep)
    if (victim->status_flags_10 & 0x5022) {
        return;
    }

    // 5. Victim must not have intangible/invulnerable animation bits
    if (victim->state_flags_14 & 0x070D) {
        return;
    }

    // 6. Victim must not currently be flinching or invulnerable
    if (victim->last_damage != 0) {
        return;
    }

    // 7. Victim must be alive
    if (victim->current_hp == 0) {
        return;
    }

    // 8. Prevent duplicate hits from the same attacker in the same engagement frame
    if (victim->last_damage_source == (uint16_t)(uintptr_t)attacker) {
        return;
    }

    // 9. Attacker must not be in a passive state
    if (attacker->status_flags_10 & 0x0002) {
        return;
    }

    // Dispatch contact attack action
    uint16_t weapon_type = attacker->contact_weapon_id;
    uint16_t action_id = g_contact_action_table[weapon_type];
    ContactAttackHandler handler = g_contact_handlers[action_id];

    if (handler) {
        handler(attacker, victim);
    }

    // Reset attacker charge momentum to zero
    attacker->charge_stamina = 0;
}

/**
 * contact_damage_charging_body ($8F:B52C)
 * Performs mutual symmetric collision evaluation between two overlapping entities.
 * 
 * @param entity_a First entity involved in collision.
 * @param entity_b Second entity involved in collision.
 */
void contact_damage_charging_body(EntityCombatRecord *entity_a, EntityCombatRecord *entity_b) {
    // Pass 1: Entity A charges into Entity B
    try_contact_damage(entity_a, entity_b);

    // Pass 2: Entity B charges into Entity A (symmetric mutual collision)
    try_contact_damage(entity_b, entity_a);
}
