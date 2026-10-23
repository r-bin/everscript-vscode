/*
 * Routine: $8CDD19 (opcode_spawning)
 * Bank: $8C (ROM Offset: $0CDD19)
 * Source: docs/disassembly/script-vm/opcode-spawning.md
 */

#include <stdint.h>
#include <stdbool.h>

// Direct Page Register Bindings
#define DP_CHAR_RECORD_PTR   (*(volatile uint16_t*)0x02)
#define DP_SPAWN_FLAGS       (*(volatile uint16_t*)0x08)
#define DP_ELEVATION_PLANE   (*(volatile uint16_t*)0x44)
#define DP_WORLD_X           (*(volatile uint16_t*)0x46)
#define DP_WORLD_Y           (*(volatile uint16_t*)0x48)
#define DP_SCRIPT_PC         (*(volatile uint8_t**)0x82)

// WRAM Global Variables
#define WRAM_LAST_SPAWNED_ENTITY   (*(volatile uint16_t*)0x7E0341)
#define WRAM_SPAWN_STAGING_PTR     (*(volatile uint16_t*)0x7E0EC0)
#define WRAM_ANIM_DESCRIPTOR_OVR   (*(volatile uint16_t*)0x7E23DD)
#define WRAM_ROOM_STATE_1          (*(volatile uint16_t*)0x7E2431)
#define WRAM_ROOM_STATE_2          (*(volatile uint16_t*)0x7E2433)

#define SPAWN_STAGING_MAX_LIMIT    0x6183

// Deferred Spawn Staging Table Entry (16 bytes)
typedef struct {
    uint16_t char_record_ptr;    // +0x00: Pointer to character record in Bank $8E
    uint16_t world_x;            // +0x02: Target world X in pixels
    uint16_t world_y;            // +0x04: Target world Y in pixels
    uint16_t spawn_flags;        // +0x06: Spawn flags (with 0x8000 cleared)
    uint16_t direct_page_base;   // +0x08: Direct Page base (TDC)
    uint16_t room_state_1;       // +0x0A: Shadow of $7E:2431
    uint16_t room_state_2;       // +0x0C: Shadow of $7E:2433
    uint16_t anim_track_ptr;     // +0x0E: Animation descriptor pointer
} DeferredSpawnEntry;

// External Subroutines & Tables
extern const uint16_t g_enemy_record_table[143];       // $8E:B55A
extern const uint16_t g_character_anim_table[];        // $8E:0017
extern uint16_t script_eval_expression(void);          // $8C:EA43
extern uint16_t tile_get_collision_flags(uint16_t x, uint16_t y); // $90:9815
extern uint16_t projectile_spawn_master(void);         // $8F:B094

/**
 * Evaluates tile collision flags at (X, Y) to calculate initial plane elevation.
 * ROM Address: $8F:A933 (and alternate entry $8F:A924)
 */
void spawn_eval_tile_plane_elevation(uint16_t x, uint16_t y) {
    uint16_t tile_flags = tile_get_collision_flags(x, y);

    if (tile_flags & 0x2000) {
        // Elevated bridge / upper plane slope
        DP_ELEVATION_PLANE = (tile_flags & 0x0030) | 0x0040;
    } else {
        // Standard terrain plane
        DP_ELEVATION_PLANE = (tile_flags & 0x0030);
    }
}

/**
 * Writes an entity descriptor to the deferred spawn table buffer.
 * ROM Address: $8F:DE98
 */
void spawn_stage_deferred_entity(void) {
    uint16_t staging_offset = WRAM_SPAWN_STAGING_PTR;

    // Buffer capacity safety check
    if (staging_offset >= SPAWN_STAGING_MAX_LIMIT) {
        return;
    }

    DeferredSpawnEntry* entry = (DeferredSpawnEntry*)(uintptr_t)(0x7E0000 + staging_offset);

    // Clear spawner indicator bit 15
    DP_SPAWN_FLAGS &= ~0x8000;

    entry->char_record_ptr = DP_CHAR_RECORD_PTR;

    // Resolve sprite animation descriptor
    uint16_t anim_desc = WRAM_ANIM_DESCRIPTOR_OVR;
    if ((int16_t)anim_desc < 0) {
        // Negative override flag indicates fallback to table lookup
        uint16_t rec_offset = DP_CHAR_RECORD_PTR;
        anim_desc = g_character_anim_table[rec_offset >> 1];
    }
    entry->anim_track_ptr = anim_desc;

    entry->world_x = DP_WORLD_X;
    entry->world_y = DP_WORLD_Y;
    entry->spawn_flags = DP_SPAWN_FLAGS;
    entry->direct_page_base = 0x0000; // TDC snapshot
    entry->room_state_1 = WRAM_ROOM_STATE_1;
    entry->room_state_2 = WRAM_ROOM_STATE_2;

    // Advance staging pointer by sizeof(DeferredSpawnEntry)
    WRAM_SPAWN_STAGING_PTR = staging_offset + sizeof(DeferredSpawnEntry);
}

/**
 * Common commit dispatcher for all entity/character spawn opcodes.
 * ROM Address: $8C:DD19
 */
void script_spawn_commit(void) {
    // 1. Determine tile elevation and collision plane
    spawn_eval_tile_plane_elevation(DP_WORLD_X, DP_WORLD_Y);

    // 2. Route between deferred spawner staging or active entity creation
    if (DP_SPAWN_FLAGS & 0x8000) {
        // Bit 15 set: Stage into deferred spawn table
        spawn_stage_deferred_entity();
    } else {
        // Bit 15 clear: Immediate entity / projectile spawn
        uint16_t entity_ptr = projectile_spawn_master();
        WRAM_LAST_SPAWNED_ENTITY = entity_ptr;
    }
}

/**
 * Opcode 0xA2: Spawn Character at Evaluated Pixel Expressions
 * Bytecode: [0xA2] [enemy_index: word] [flags: word] [expr_x: E] [expr_y: E]
 * ROM Address: $8C:DC9A
 */
void script_op_spawn_character_at_expr(void) {
    uint16_t enemy_index = *(const uint16_t*)DP_SCRIPT_PC;
    DP_SCRIPT_PC += 2;

    DP_CHAR_RECORD_PTR = g_enemy_record_table[enemy_index >> 1];

    uint16_t flags = *(const uint16_t*)DP_SCRIPT_PC;
    DP_SCRIPT_PC += 2;
    DP_SPAWN_FLAGS = flags;

    // Evaluate dynamic expressions
    DP_WORLD_X = script_eval_expression();
    DP_WORLD_Y = script_eval_expression();

    script_spawn_commit();
}

/**
 * Opcode 0xC2: Spawn Deferred Spawner at Tile Coordinates
 * Bytecode: [0xC2] [enemy_id: byte] [tile_x: byte] [tile_y: byte]
 * ROM Address: $8C:DCC3
 */
void script_op_spawn_spawner(void) {
    uint8_t enemy_id = *DP_SCRIPT_PC++;
    DP_CHAR_RECORD_PTR = g_enemy_record_table[enemy_id];

    DP_SPAWN_FLAGS = 0x8000; // Enforce spawner flag

    uint8_t tile_x = *DP_SCRIPT_PC++;
    DP_WORLD_X = (uint16_t)tile_x << 3;

    uint8_t tile_y = *DP_SCRIPT_PC++;
    DP_WORLD_Y = (uint16_t)tile_y << 3;

    script_spawn_commit();
}

/**
 * Opcode 0xBA: Spawn Active Entity at Tile Coordinates
 * Bytecode: [0xBA] [enemy_id: byte] [tile_x: byte] [tile_y: byte]
 * ROM Address: $8C:DCD9
 */
void script_op_spawn_default(void) {
    uint8_t enemy_id = *DP_SCRIPT_PC++;
    DP_CHAR_RECORD_PTR = g_enemy_record_table[enemy_id];

    DP_SPAWN_FLAGS = 0x0000; // Clear flags to 0

    uint8_t tile_x = *DP_SCRIPT_PC++;
    DP_WORLD_X = (uint16_t)tile_x << 3;

    uint8_t tile_y = *DP_SCRIPT_PC++;
    DP_WORLD_Y = (uint16_t)tile_y << 3;

    script_spawn_commit();
}

/**
 * Opcode 0x3C: Spawn Entity at Tile Coordinates with Explicit Arguments
 * Bytecode: [0x3C] [enemy_index: word] [flags: word] [tile_x: byte] [tile_y: byte]
 * ROM Address: $8C:DCEC
 */
void script_op_spawn_with_args(void) {
    uint16_t enemy_index = *(const uint16_t*)DP_SCRIPT_PC;
    DP_SCRIPT_PC += 2;

    DP_CHAR_RECORD_PTR = g_enemy_record_table[enemy_index >> 1];

    uint16_t flags = *(const uint16_t*)DP_SCRIPT_PC;
    DP_SCRIPT_PC += 2;
    DP_SPAWN_FLAGS = flags;

    uint8_t tile_x = *DP_SCRIPT_PC++;
    DP_WORLD_X = (uint16_t)tile_x << 3;

    uint8_t tile_y = *DP_SCRIPT_PC++;
    DP_WORLD_Y = (uint16_t)tile_y << 3;

    script_spawn_commit();
}
