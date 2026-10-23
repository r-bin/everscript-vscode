/*
 * Routine: $808B6C (save_system)
 * Bank: $80 (ROM Offset: $008B6C)
 * Source: docs/disassembly/engine-core/save-system.md
 */

#include <stdint.h>
#include <stdbool.h>

#define NUM_SAVE_SLOTS          4
#define SRAM_BASE_OFFSET        0x6002
#define SAVE_SLOT_TOTAL_SIZE    0x0331  /* 817 bytes per slot */
#define SAVE_SLOT_PAYLOAD_SIZE  0x032F  /* 815 bytes payload */
#define CHECKSUM_SEED           0x043F

typedef struct {
    uint16_t checksum;          /* Stored 16-bit header checksum */
    uint8_t  payload[SAVE_SLOT_PAYLOAD_SIZE];
} SramSaveSlot;

typedef struct {
    uint16_t global_init_flag;  /* $30:6000 */
    SramSaveSlot slots[NUM_SAVE_SLOTS];
} SramLayout;

typedef struct {
    uint8_t  valid_slots_mask;  /* $7E:0B39 (bits 0..3) */
    bool     sram_present;      /* $7E:0B3B */
} SaveSystemState;

/**
 * Computes the authentic Secret of Evermore rotational 16-bit checksum.
 * Corresponds to native routine $8D:B478.
 */
uint16_t sram_compute_checksum(const uint8_t *payload, uint16_t length) {
    uint16_t acc = CHECKSUM_SEED;
    uint16_t index = 0;

    while (index < length) {
        /* Add low byte */
        acc = (acc & 0xFF00) | ((acc + payload[index++]) & 0x00FF);
        if (index >= length) {
            break;
        }

        /* 16-bit rotate left by 1 bit */
        acc = (uint16_t)(acc << 1);

        /* Add next byte */
        acc = (acc & 0xFF00) | ((acc + payload[index++]) & 0x00FF);
    }

    return acc;
}

/**
 * Scans all four battery-backed SRAM save slots and builds the valid slot bitmask.
 * Corresponds to native routine $8D:C905.
 */
uint8_t sram_verify_all_save_slots(const SramLayout *sram) {
    uint8_t valid_mask = 0;

    for (int i = 0; i < NUM_SAVE_SLOTS; i++) {
        const SramSaveSlot *slot = &sram->slots[i];

        /* Calculate checksum across 815 bytes of game state data */
        uint16_t computed = sram_compute_checksum(slot->payload, SAVE_SLOT_PAYLOAD_SIZE);

        /* Validate against stored header checksum */
        if (computed == slot->checksum) {
            valid_mask |= (1 << i); /* Assert slot valid bit */
        }
    }

    return valid_mask;
}

/**
 * Serializes active game state into a specified SRAM slot and calculates its checksum.
 */
void sram_save_slot(SramLayout *sram, int slot_index, const uint8_t *wram_state) {
    if (slot_index < 0 || slot_index >= NUM_SAVE_SLOTS) {
        return;
    }

    SramSaveSlot *slot = &sram->slots[slot_index];

    /* Copy 815 bytes of active WRAM state to SRAM payload */
    for (int i = 0; i < SAVE_SLOT_PAYLOAD_SIZE; i++) {
        slot->payload[i] = wram_state[i];
    }

    /* Compute and store header checksum */
    slot->checksum = sram_compute_checksum(slot->payload, SAVE_SLOT_PAYLOAD_SIZE);
}
