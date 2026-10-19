# HUD Stamina Gauge Recharge & Entity Collision Perimeter Mesh

**Addresses**:
- `hud_stamina_meter_recharge_step`: `$8F:8AE4` – `$8F:8B90`
- `entity_collision_mesh_init`: `$8F:8C00` – `$8F:8C79`
- `entity_hitbox_bounds_array_init`: `$8F:8CCB` – `$8F:8D5C`
- `enemy_facing_compass_resolve`: `$8F:8D5D` – `$8F:8D75`

**ROM Source**: Bank `$8F` (US 1.0)
**Subsystem**: Combat Engine / HUD & Collision Subsystems

---

## 1. Overview & Architectural Role

This subsystem bridges two foundational elements of real-time combat in Secret of Evermore:
1. **The Weapon Charge & Stamina Percentage Gauge (`hud_stamina_meter_recharge_step`)**:
   Tracks attack stamina for both Boy and Dog ($0$ to $1024 = \text{0x0400}$). When recharging, it employs the SNES hardware math unit (`$4202` / `$4216`) to scale stamina by 100 into a percentage value, selecting tile patterns `$2BE9`, `$2BF6`, `$2BF7`, and `$2BFF` to fill the visual gauge on screen. Upon reaching 100% full charge, it decrements flash timers (`$7E:0B4D` for Boy, `$7E:0B4F` for Dog) and triggers audio/visual readiness cues via `$80:870C`.
2. **64-Byte Entity Collision Perimeter Mesh (`entity_collision_mesh_init`)**:
   Prepares an entity's 64-byte collision bounding box before evaluating movement against terrain or other actors. It clears internal coordinates while populating boundary extents with `#$FF00` (min limits) and `#$FFFF` (max limits).
3. **8-Directional Compass Heading (`enemy_facing_compass_resolve`)**:
   Maps angular displacement vectors into an 8-way directional enum (`North`, `Northeast`, `East`, etc.) via `AND #$0007; ASL`.

---

## 2. Data Structures & Memory Layout

```c
// HUD Stamina Bar Tiles:
#define TILE_STAMINA_EMPTY   0x2BE9 // Empty bar segment tile
#define TILE_STAMINA_PARTIAL 0x2BF6 // Partial fill segment tile
#define TILE_STAMINA_GRADIENT 0x2BF7 // Mid-charge gradient tile
#define TILE_STAMINA_FULL    0x2BFF // 100% solid charged segment tile

// Stamina Recharge Timers in WRAM:
// $7E:0B4D - Boy full charge flash countdown timer
// $7E:0B4F - Dog full charge flash countdown timer
// $7E:4E89 - Boy character entity struct base
// +$2E,Y   - Current stamina / charge points (0..1024)
// +$8E,Y   - Pointer to associated HUD UI tracking descriptor
```

---

## 3. Clean C Decompilation

```c
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
```

---

## 4. Verification & Behavioral Equivalence

1. **Stamina Scaling**: Verified against assembly `$8F:8B16` (`LSR; LSR; ORA #$6400; STA $4202`), multiplying by 100 via hardware multiplier to produce exact HUD percentage fill.
2. **Flash Threshold**: Matches `CMP #$000E` (`$8F:8B38`), triggering the visual charge ready state at tick 14.
3. **Bounding Mesh**: Matches 64-byte initialization pattern `$8F:8C11`–`$8F:8C74`.
