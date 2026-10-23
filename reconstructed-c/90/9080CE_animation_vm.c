/*
 * Routine: $9080CE (animation_vm)
 * Bank: $90 (ROM Offset: $1080CE)
 * Source: docs/disassembly/animation/animation-vm.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint16_t pc_offset;     // +0x00: Animation bytecode offset
    uint8_t  pc_bank;       // +0x02: Animation bytecode ROM bank
    uint8_t  flags;         // +0x03: Loop / status flags
    uint16_t hold_timer;    // +0x05: Countdown timer for current keyframe
    uint16_t sprite_frame;  // +0x07: Current graphics frame index
    uint16_t elapsed_ticks; // +0x0E: Lifetime tick counter in current animation
} AnimationSlot;

extern const uint8_t g_rom[0x400000];

typedef void (*AnimOpcodeHandler)(AnimationSlot *slot, uint32_t *pc);
extern const AnimOpcodeHandler g_anim_opcode_table[128]; // Jump table at $90:8000

extern void update_anim_physics_offset(AnimationSlot *slot);

/**
 * Executes one tick of an animated sprite's bytecode script.
 * Corresponds to $90:80CE.
 */
void anim_vm_tick(AnimationSlot *slot) {
    update_anim_physics_offset(slot);
    slot->elapsed_ticks++;

    uint32_t pc = ((uint32_t)slot->pc_bank << 16) | slot->pc_offset;

    // Decode commands until end-of-frame marker (Bit 7)
    bool end_of_frame = false;
    while (!end_of_frame) {
        uint8_t cmd_byte = g_rom[pc++];
        end_of_frame = (cmd_byte & 0x80) != 0;
        uint8_t opcode = cmd_byte & 0x7F;

        AnimOpcodeHandler handler = g_anim_opcode_table[opcode];
        if (handler != NULL) {
            handler(slot, &pc);
        }
    }

    // Decrement hold duration timer
    if (slot->hold_timer > 0) {
        slot->hold_timer--;
    }

    // When keyframe hold expires, advance instruction pointer to next frame
    if (slot->hold_timer == 0) {
        slot->pc_offset = (uint16_t)(pc & 0xFFFF);
    }
}
