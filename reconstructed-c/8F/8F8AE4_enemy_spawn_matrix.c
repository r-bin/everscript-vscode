/*
 * Routine: $8F8AE4 (enemy_spawn_matrix)
 * Bank: $8F (ROM Offset: $0F8AE4)
 * Source: docs/disassembly/entities/enemy-spawn-matrix.md
 */

#include <stdint.h>
#include <stdbool.h>

#define REG_WRMPYA (*(volatile uint8_t*)0x4202)
#define REG_WRMPYB (*(volatile uint8_t*)0x4203)
#define REG_RDMPYL (*(volatile uint16_t*)0x4216)

extern uint16_t g_boy_stamina_flash_timer; // $0B4D
extern uint16_t g_dog_stamina_flash_timer; // $0B4F

extern void hud_stream_stamina_tiles_to_vram(void); // $80:870C

/**
 * $8F:8AE4 - hud_stamina_meter_recharge_step
 * Computes stamina percentage, formats gauge tiles, and triggers 100% full charge alerts.
 */
void hud_stamina_meter_recharge_step(Entity* entity) {
    uint16_t* hud_tile_dest = entity->hud_component_ptr->tile_buffer_dest;

    // Reset base gauge boundary tiles
    hud_tile_dest[0] = TILE_STAMINA_EMPTY;
    hud_tile_dest[2] = TILE_STAMINA_EMPTY;
    hud_tile_dest[3] = TILE_STAMINA_EMPTY;
    hud_tile_dest[4] = TILE_STAMINA_EMPTY;
    hud_tile_dest[7] = TILE_STAMINA_EMPTY;

    uint16_t cur_stamina = entity->stamina;

    // Check if fully charged (1024 = 0x0400)
    if (cur_stamina >= 0x0400) {
        // Flash timer decrement
        if (entity == g_boy_entity) {
            if (g_boy_stamina_flash_timer > 0) {
                g_boy_stamina_flash_timer--;
            }
            if (g_boy_stamina_flash_timer == 14) {
                hud_tile_dest[1] = TILE_STAMINA_FULL;
            }
        } else {
            if (g_dog_stamina_flash_timer > 0) {
                g_dog_stamina_flash_timer--;
            }
            if (g_dog_stamina_flash_timer == 14) {
                hud_tile_dest[1] = TILE_STAMINA_FULL;
            }
        }
    } else {
        // Scaled stamina recharge calculation: percentage = (stamina / 4) * 100 / 256
        uint8_t scaled_stamina = (uint8_t)(cur_stamina >> 2);
        REG_WRMPYA = scaled_stamina;
        REG_WRMPYB = 100;

        // Retrieve product high byte
        uint8_t percentage = (uint8_t)(REG_RDMPYL >> 8);

        // Select gauge fill tiles based on recharge tier
        if (percentage >= 75) {
            hud_tile_dest[1] = TILE_STAMINA_FULL;
            hud_tile_dest[6] = TILE_STAMINA_GRADIENT;
        } else if (percentage >= 50) {
            hud_tile_dest[1] = TILE_STAMINA_PARTIAL;
            hud_tile_dest[6] = TILE_STAMINA_EMPTY;
        } else {
            hud_tile_dest[1] = TILE_STAMINA_EMPTY;
            hud_tile_dest[6] = TILE_STAMINA_EMPTY;
        }
    }

    // Flush updated stamina gauge tiles to SNES VRAM
    hud_stream_stamina_tiles_to_vram();
}

/**
 * $8F:8C00 - entity_collision_mesh_init
 * Initializes the 64-byte bounding box mesh for entity collision checks.
 */
void entity_collision_mesh_init(uint16_t* mesh_buffer) {
    // Clear primary offsets
    for (int i = 0; i < 32; i++) {
        mesh_buffer[i] = 0;
    }

    // Set minimum extents to 0xFF00
    mesh_buffer[2]  = 0xFF00;
    mesh_buffer[5]  = 0xFF00;
    mesh_buffer[10] = 0xFF00;
    mesh_buffer[13] = 0xFF00;
    mesh_buffer[18] = 0xFF00;
    mesh_buffer[21] = 0xFF00;
    mesh_buffer[26] = 0xFF00;
    mesh_buffer[29] = 0xFF00;

    // Set maximum extents to 0xFFFF
    mesh_buffer[3]  = 0xFFFF;
    mesh_buffer[4]  = 0xFFFF;
    mesh_buffer[11] = 0xFFFF;
    mesh_buffer[12] = 0xFFFF;
    mesh_buffer[19] = 0xFFFF;
    mesh_buffer[20] = 0xFFFF;
    mesh_buffer[27] = 0xFFFF;
    mesh_buffer[28] = 0xFFFF;
}

/**
 * $8F:8D5D - enemy_facing_compass_resolve
 * Converts an angle value into an 8-way directional compass facing heading.
 */
uint16_t enemy_facing_compass_resolve(uint16_t angle) {
    return ((angle >> 3) & 0x0007) * 2;
}
