/*
 * Routine: $8CDB2A (opcode_freeze)
 * Bank: $8C (ROM Offset: $0CDB2A)
 * Source: docs/disassembly/script-vm/opcode-freeze.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint8_t  padding0[0x10];
    uint16_t status_flags;     // +0x10: Entity status and condition flags
    uint16_t anim_state;       // +0x12: Animation mode and direction bits
    uint8_t  padding1[0x64];
    uint16_t latch_timer;      // +0x78: Immobilization / latch duration timer
    uint8_t  padding2[0x1E];
    int16_t  anim_descriptor;  // +0x98: Default animation track / child entity slot
} Entity;

#define DP_TARGET_ENTITY (*(volatile Entity**)0x4C)
#define ENTITY_BOY_BASE  ((Entity*)0x4E89)
#define ENTITY_DOG_BASE  ((Entity*)0x4F37)

// External Subroutines
extern void* script_eval_entity(void);               // $8C:EC8E
extern void  entity_physics_halt_motion(void);        // $8F:98FE
extern void  entity_physics_resume_motion(void);      // $8F:A8E2
extern void  entity_anim_restore_neutral(int16_t id); // $8F:9937

/**
 * $8F:CD78 - Halts active momentum and asserts the immobilized bit.
 */
void entity_freeze_immobilize(Entity *entity) {
    if (!entity) return;

    // Reset current velocity and pending displacement vectors
    entity_physics_halt_motion();

    // Assert Bit 5: Immobilized
    entity->status_flags |= 0x0020;
}

/**
 * $8F:CD4D - Re-enables physics and clears immobilization and latch timers.
 */
void entity_unfreeze_mobilize(Entity *entity) {
    if (!entity) return;

    // Resume physics integration
    entity_physics_resume_motion();

    // Clear Bit 0 (0x0001), Bit 5 (0x0020: Frozen), and Bit 13 (0x2000: Script Lock)
    entity->status_flags &= (uint16_t)~0x2021; // Mask 0xDFDE

    // Clear animation transit bits 8 and 9
    entity->anim_state &= (uint16_t)~0x0300;   // Mask 0xFCFF

    // Clear latch duration timer
    entity->latch_timer = 0;

    // If the entity is a player or companion (address >= $4E89), restore neutral animation track
    if (entity >= ENTITY_BOY_BASE) {
        int16_t anim_id = entity->anim_descriptor;
        if (anim_id >= 0) {
            entity_anim_restore_neutral(anim_id);
        }
    }
}

/**
 * $8C:DB67 - Script VM Opcode 0x2A: freeze_entity(entity)
 * Reads entity expression from script bytecode and immobilizes it.
 */
bool script_op_freeze_entity(void) {
    Entity *entity = (Entity*)script_eval_entity();
    DP_TARGET_ENTITY = entity;

    entity_freeze_immobilize(entity);

    // SEC: Continue execution in the current turn
    return true;
}

/**
 * $8C:DB11 - Script VM Opcode 0x2B: unfreeze_entity(entity)
 * Reads entity expression from script bytecode and restores autonomous motion.
 */
bool script_op_unfreeze_entity(void) {
    Entity *entity = (Entity*)script_eval_entity();
    DP_TARGET_ENTITY = entity;

    entity_unfreeze_mobilize(entity);

    // SEC: Continue execution in the current turn
    return true;
}

/**
 * $8C:DB1B - Script VM Opcode 0xBC: freeze_boy()
 * Selects only the Boy bit in the shared freeze dispatcher.
 */
bool script_op_freeze_boy(void) {
    DP_TARGET_ENTITY = ENTITY_BOY_BASE;
    entity_freeze_immobilize(ENTITY_BOY_BASE);
    return true;
}

/**
 * $8C:DAC5 - Script VM Opcode 0xBD: unfreeze_boy()
 * Selects only the Boy bit in the shared unfreeze dispatcher.
 */
bool script_op_unfreeze_boy(void) {
    DP_TARGET_ENTITY = ENTITY_BOY_BASE;
    entity_unfreeze_mobilize(ENTITY_BOY_BASE);
    return true;
}

/**
 * $8C:DB20 - Script VM Opcode 0xBE: freeze_dog()
 * Selects only the Dog bit in the shared freeze-mask dispatcher.
 */
bool script_op_freeze_dog(void) {
    DP_TARGET_ENTITY = ENTITY_DOG_BASE;
    entity_freeze_immobilize(ENTITY_DOG_BASE);
    return true;
}

/**
 * $8C:DACA - Script VM Opcode 0xBF: unfreeze_dog()
 * Selects only the Dog bit in the shared unfreeze-mask dispatcher.
 */
bool script_op_unfreeze_dog(void) {
    DP_TARGET_ENTITY = ENTITY_DOG_BASE;
    entity_unfreeze_mobilize(ENTITY_DOG_BASE);
    return true;
}

/**
 * $8C:DB25 - Script VM Opcode 0xC0: freeze_boy_and_dog()
 * Applies the shared mask-3 order: Boy, then Dog.
 */
bool script_op_freeze_boy_and_dog(void) {
    script_op_freeze_boy();
    script_op_freeze_dog();
    return true;
}

/**
 * $8C:DACF - Script VM Opcode 0xC1: unfreeze_boy_and_dog()
 * Applies the shared mask-3 order: Boy, then Dog.
 */
bool script_op_unfreeze_boy_and_dog(void) {
    script_op_unfreeze_boy();
    script_op_unfreeze_dog();
    return true;
}

extern uint8_t script_fetch_u8(void);
extern uint16_t bus_read_word(uint32_t address);

/**
 * $8C:DB2A - Script VM Opcode 0x2C: freeze entities selected by mask.
 */
bool script_op_2c_freeze_mask(void) {
    uint8_t mask = script_fetch_u8();

    if ((mask & 0x08) != 0) {
        uint16_t thread_slot = bus_read_word(0x007E);
        uint16_t bound_entity_address =
            bus_read_word(0x7E000D + (uint32_t)thread_slot);
        if (bound_entity_address != 0) {
            Entity *entity = (Entity *)(uintptr_t)bound_entity_address;
            DP_TARGET_ENTITY = entity;
            entity_freeze_immobilize(entity);
        }
    }

    if ((mask & 0x01) != 0) {
        DP_TARGET_ENTITY = ENTITY_BOY_BASE;
        entity_freeze_immobilize(ENTITY_BOY_BASE);
    }

    if ((mask & 0x02) != 0) {
        DP_TARGET_ENTITY = ENTITY_DOG_BASE;
        entity_freeze_immobilize(ENTITY_DOG_BASE);
    }

    return true;
}

/**
 * $8C:DAD4 - Script VM Opcode 0x2D: unfreeze entities selected by mask.
 */
bool script_op_2d_unfreeze_mask(void) {
    uint8_t mask = script_fetch_u8();

    if ((mask & 0x08) != 0) {
        uint16_t thread_slot = bus_read_word(0x007E);
        uint16_t bound_entity_address =
            bus_read_word(0x7E000D + (uint32_t)thread_slot);
        if (bound_entity_address != 0) {
            Entity *entity = (Entity *)(uintptr_t)bound_entity_address;
            DP_TARGET_ENTITY = entity;
            entity_unfreeze_mobilize(entity);
        }
    }

    if ((mask & 0x01) != 0) {
        DP_TARGET_ENTITY = ENTITY_BOY_BASE;
        entity_unfreeze_mobilize(ENTITY_BOY_BASE);
    }

    if ((mask & 0x02) != 0) {
        DP_TARGET_ENTITY = ENTITY_DOG_BASE;
        entity_unfreeze_mobilize(ENTITY_DOG_BASE);
    }

    return true;
}
