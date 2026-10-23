/*
 * Routine: $8FAD51 (entity_movement)
 * Bank: $8F (ROM Offset: $0FAD51)
 * Source: docs/disassembly/entities/entity-movement.md
 */

#include <stdint.h>
#include <stdbool.h>

#define STAIR_DRIFT_BIT 0x2000 // Collision bit 13: 45° diagonal ramp

typedef struct {
    int16_t dx;
    int16_t dy;
} StepVector;

// 8-directional compass vectors ($8F:AF18)
static const StepVector g_direction_vectors[8] = {
    {  0, -1 }, // 0: North
    {  1, -1 }, // 1: North-East
    {  1,  0 }, // 2: East
    {  1,  1 }, // 3: South-East
    {  0,  1 }, // 4: South
    { -1,  1 }, // 5: South-West
    { -1,  0 }, // 6: West
    { -1, -1 }, // 7: North-West
};

typedef struct {
    uint8_t  padding_1[0x30];
    int16_t  x;                 // +0x30: World X
    int16_t  y;                 // +0x32: World Y
    uint16_t facing_direction;  // +0x34: 0..7
    uint16_t speed;             // +0x36: Pixels per step
    uint16_t tile_collision;    // +0x38: Current tile attributes
} MovingActor;

extern void bit_14_gate_before_step_on_search(uint16_t flags, uint16_t x, uint16_t y); // $8F:B078

/**
 * Applies diagonal stairway drift if walking across a 45° ramp tile (bit 13).
 * Corresponds to $8F:ADB2.
 */
static inline void apply_diagonal_stair_drift(const MovingActor *actor, int16_t dx, int16_t *dy) {
    if ((actor->tile_collision & STAIR_DRIFT_BIT) == 0) {
        return; // Normal flat ground
    }

    if (dx < 0) {
        *dy -= 1; // Moving West up diagonal stairs -> drift upward
    } else if (dx > 0) {
        *dy += 1; // Moving East down diagonal stairs -> drift downward
    }
}

/**
 * Moves an actor forward according to facing direction, speed, and terrain ramps.
 * Corresponds to $8F:AD51.
 */
void entity_mover_step_direction(MovingActor *actor) {
    if (actor->speed == 0) {
        return;
    }

    uint8_t dir = actor->facing_direction & 7;
    int16_t dx = g_direction_vectors[dir].dx * actor->speed;
    int16_t dy = g_direction_vectors[dir].dy * actor->speed;

    // Evaluate diagonal ramp collision bit 13
    apply_diagonal_stair_drift(actor, dx, &dy);

    actor->x += dx;
    actor->y += dy;

    // Check step-on trigger entry
    bit_14_gate_before_step_on_search(0, (uint16_t)actor->x, (uint16_t)actor->y);
}
