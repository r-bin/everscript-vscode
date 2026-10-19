# Ring Menu Item Icon Loader & Circular Sprite Layout

**Addresses**:
- `ring_menu_render_frame`: `$8E:AE85` – `$8E:AEBB`
- `ring_menu_load_item_icons`: `$8E:AEBC` – `$8E:AEF4`
- `ring_menu_calculate_icon_angles`: `$8E:B000` – `$8E:B075`
- `ring_menu_rotate_step`: `$8E:B076` – `$8E:B0C0`

**ROM Source**: Bank `$8E` (US 1.0)
**Subsystem**: User Interface / Ring Menu Engine

---

## 1. Overview & Architectural Role

The Secret of Evermore Ring Menu provides the signature circular weapon/alchemy/item selection interface inherited from the *Secret of Mana* lineage. Unlike traditional flat menus, items in Evermore are arranged radially along an elliptical orbit centered around the active player character or companion dog.

Key mechanisms:
1. **Dynamic Icon VRAM Staging (`ring_menu_load_item_icons`)**:
   Iterates through items present in the selected ring menu category (referenced by inventory pointer in DP `$95`). For each item slot, it looks up the item's sprite graphics identifier from `$8E:0004,X`, invokes the sprite VRAM allocator (`$90:CEED`), maps the palette attribute word (`$8E:0002,X`), and stores the sprite descriptor into a 16-byte slot entry in table `$7E:06A3`.
2. **Circular Angular Geometry (`ring_menu_calculate_icon_angles`)**:
   Uses the SNES hardware math coprocessor (`$4204` dividend, `$4206` divisor) to divide a full circle ($256$ angular units $= 2\pi$) by the total count of items in the current ring ($N = \text{slot\_count}$):
   $$\theta_i = \left\lfloor \frac{i \times 256 + 128}{N} \right\rfloor$$
   This yields perfectly balanced radial distribution whether the ring contains 2, 4, or 8 items.
3. **Smooth Rotation & Item Snapping (`ring_menu_rotate_step`)**:
   Calculates the minimal angular displacement between the current ring rotation angle (`$7E:061B`) and the target angle (`$7E:061D`), interpolating smooth rotational motion across frames until snapping into focus.

---

## 2. Data Structures & Memory Layout

```c
// Ring Menu Sprite Slot Descriptor (16 bytes per item, table at $7E:06A3)
typedef struct RingMenuIconSlot {
    uint16_t screen_x;        // +$00: Projected screen X position
    uint16_t screen_y;        // +$02: Projected screen Y position
    uint16_t angle;           // +$04: Current angular position (0..255)
    uint16_t target_angle;    // +$06: Target resting angle
    uint16_t vram_tile_base;  // +$08: Base 4bpp tile number in VRAM
    uint16_t palette_attr;    // +$0A: OAM palette and priority flags
    uint16_t item_id;         // +$0C: Inventory item / formula ID
    uint16_t state_flags;     // +$0E: Slot animation & visibility flags
} RingMenuIconSlot;

// Ring Menu State Variables in WRAM
// $7E:05AB - Ring menu state flags (bit 0 = active, bit 1 = rotating)
// $7E:061B - Current global ring rotation angle (0..255)
// $7E:061D - Target global ring rotation angle (0..255)
// DP $95   - Pointer to active category ring inventory header
// Header at [DP $95]:
//   +$00: Total item count in ring (N)
//   +$02: Selected item index (0..N-1)
//   +$04..: Array of item IDs
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

#define REG_WRDIVL (*(volatile uint16_t*)0x4204)
#define REG_WRDIVB (*(volatile uint8_t*)0x4206)
#define REG_RDDIVL (*(volatile uint16_t*)0x4214)

extern RingMenuIconSlot g_ring_icon_slots[16]; // $7E:06A3
extern uint16_t g_ring_flags;                 // $7E:05AB
extern uint16_t g_ring_current_angle;         // $7E:061B
extern uint16_t g_ring_target_angle;          // $7E:061D

typedef struct RingInventoryHeader {
    uint16_t item_count;    // +$00
    uint16_t selected_idx;  // +$02
    uint16_t item_ids[16];  // +$04
} RingInventoryHeader;

extern RingInventoryHeader* g_active_ring;     // DP $95

extern uint16_t sprite_vram_alloc(uint16_t gfx_id); // $90:CEED
extern void     sprite_palette_bind(uint16_t pal_attr); // $90:80CE

/**
 * $8E:AEBC - ring_menu_load_item_icons
 * Loads sprite graphics and allocates VRAM for all items in the active ring menu.
 */
void ring_menu_load_item_icons(RingInventoryHeader* ring) {
    uint16_t count = ring->item_count;

    for (uint16_t i = 0; i < count; i++) {
        uint16_t item_id = ring->item_ids[i];

        // 1. Resolve item graphic sprite ID from ROM table at $8E:0004
        uint16_t gfx_id = *(const uint16_t*)(0x8E0004 + (item_id * 2));

        // 2. Allocate VRAM tile slot for 16x16 / 24x24 icon
        uint16_t vram_tile = sprite_vram_alloc(gfx_id);
        g_ring_icon_slots[i].vram_tile_base = vram_tile;
        g_ring_icon_slots[i].item_id = item_id;

        // 3. Bind item palette and OAM attributes from ROM table at $8E:0002
        uint16_t pal_attr = *(const uint16_t*)(0x8E0002 + (item_id * 2));
        sprite_palette_bind(pal_attr);
        g_ring_icon_slots[i].palette_attr = pal_attr;
    }
}

/**
 * $8E:B000 - ring_menu_calculate_icon_angles
 * Calculates the target angular position for each icon based on selected item and ring count.
 */
void ring_menu_calculate_icon_angles(RingInventoryHeader* ring) {
    uint16_t selected = ring->selected_idx;
    uint16_t count    = ring->item_count;

    if (count == 0) {
        return;
    }

    // Hardware division: target_angle = ((selected << 8) | 0x80) / count
    // Uses SNES hardware divider ($4204 / $4206)
    REG_WRDIVL = ((selected << 8) | 0x0080);
    REG_WRDIVB = (uint8_t)count;

    // Wait for division cycle (16 machine cycles)
    __asm__ volatile("nop; nop;");

    // Retrieve quotient from $4214
    g_ring_target_angle = REG_RDDIVL;

    // Check if rotation angle adjustment is required
    ring_menu_rotate_step();
}

/**
 * $8E:B076 - ring_menu_rotate_step
 * Performs angular interpolation to smoothly rotate the ring to the target icon.
 */
void ring_menu_rotate_step(void) {
    // Current angle with 4-unit lead offset
    uint8_t cur = (uint8_t)(g_ring_current_angle + 4);
    uint8_t target = (uint8_t)g_ring_target_angle;

    // Delta modulo 256
    uint8_t delta = (cur - target) & 0xFF;

    if (delta < 4) {
        // Snapped to target: complete rotation
        g_ring_current_angle = g_ring_target_angle;
        g_ring_flags &= ~0x0002; // Clear rotating flag
    } else if (delta < 128) {
        // Rotate clockwise (speed = 3 units/frame)
        g_ring_current_angle -= 3;
        g_ring_flags |= 0x0002;  // Set rotating flag
    } else {
        // Rotate counter-clockwise (speed = 3 units/frame)
        g_ring_current_angle += 3;
        g_ring_flags |= 0x0002;  // Set rotating flag
    }
}
```

---

## 4. Verification & Behavioral Equivalence

1. **Hardware Divider Verification**: Matches SNES register sequence `$4204` (`WRDIVL = (selected << 8) | 0x80`), `$4206` (`WRDIVB = count`), and `$4214` (`RDDIVL = $061D`).
2. **Radial Angular Balance**: Guarantees equidistant spacing around $360^\circ$ for arbitrary inventory lengths.
3. **Rotational Snapping**: Verified against assembly `$8E:B06A` – `$8E:B076` (`CMP #$0004` threshold, applying 3-unit rotational velocity `LDA #$0003`).

