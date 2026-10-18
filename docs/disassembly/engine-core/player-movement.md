# Player Dash, Sprinting & Movement Control Subsystem

> **ROM Bank**: `$8F` (Code), `$80` (Physics/OAM integration), `$C3` (Slope Vector Dispatch)  
> **Source Routine**: `$8F:CD88` (`player_human_control_boy`), `$8F:CECC` (`player_human_control_dog`)  
> **Related Routines**: `$8F:B28D` (Entity physics integration), `$8C:ABED` (Weapon attack trigger), `$8F:CD78` / `$8F:CD4D` (Entity mode switches), `$C3:A3` (Slope metatile vector table)  
> **Memory Map**: `$0104` (Joypad 1 raw buttons), `$0105` (Filtered direction / D-pad), `$0EB8` (Held buttons), `$0EC6` (Trigger edge), `$05A7` (Active ring menu entity), `$05A9` (Ring menu mode bits), `$4EB7` (Boy stamina), `$4F65` (Dog stamina)

---

## 1. Architectural Overview

In *Secret of Evermore*, the active player character's movement is managed by dedicated per-frame dispatchers for the Boy (`$8F:CD88`) and the companion Dog (`$8F:CECC`). When an entity is selected as the primary camera focus (`$7E:0F42`), the engine diverts execution away from the autonomous follower AI routines (`$8F:D066` / `$8F:D0B0`) directly into these human control routines.

### Key Subsystems:
1. **B-Button Sprinting / Dash**:
   - The engine checks whether the **B button** (`$0800`) is held in register `$0EB8`.
   - Sprinting is **gated by a 100% full stamina gauge**: stamina must be at or above `0x0400` (`1024` raw units) in `$4EB7` (Boy) or `$4F65` (Dog) to initiate a sprint.
   - While dashing, the engine drains stamina at **3 units per tick** (`adc #$FFFD`). If stamina drops below the minimum threshold, dash speed is forfeited and the character drops to normal walk speed.
2. **D-Pad Direction Filtering & Mapping**:
   - The directional nibble is extracted from `$0105 & $000F` (representing SNES D-pad Right, Left, Down, Up).
   - This nibble directly indexes direction table `$8F:CC0E,X` to establish the 16-way heading in character record field `+0x22` (`$4EAB` for Boy).
3. **Attack and Subsystem Arbitration**:
   - **Attack (A Button)**: Evaluates trigger edge `$0EC6 & $0080` to initiate weapon charge or swing via `$8C:ABED`.
   - **Ring Menus (Y / X Buttons)**: Tests `$0104 & $4000` (Y button - Boy ring menu) or `$0104 & $0040` (X button - Dog ring menu). Writing the entity pointer into `$05A7` and asserting bits `0x0002` or `0x0004` in `$05A9` suspends gameplay and opens the radial menu.
4. **45-Degree Collision Slopes**:
   - When a character walks into an angled metatile surface (diagonal stone paths, stairs, hillsides), metatile classification invokes jump table `$C3A3,x`.
   - The engine applies a normalized slope guide vector that resolves diagonal movement into proportional X/Y sub-pixel velocity components, preventing jerky snagging against terrain contours.

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8F:CD88 - Human Control & Movement Dispatcher (Boy)
; ==============================================================================
player_human_control_boy:
    LDA $1464
    STA $10
    JSL $8FB28D                 ; Integrate friction and base entity physics

    ; Check Sprint / Dash Condition (B Button held: $0800)
    LDA $0EB8
    BIT #$0800
    BEQ .no_dash
    LDA $0B25
    BIT $0EC6
    BEQ .no_dash

    ; Check Stamina >= 100% (0x0400)
    LDA $4EB7                   ; Boy current stamina
    CMP #$0400
    BMI .no_dash                ; Must be at full stamina to maintain dash

    ; Deduct 3 stamina per frame
    CLC
    ADC $0A54
    CLC
    ADC #$FFFD                  ; -3 stamina units
    CMP $0A52
    BCC .stamina_clamped
    LDA $0A52
.stamina_clamped:
    STA $4EB7                   ; Store updated stamina

.no_dash:
    ; Directional movement check
    LDA $0105
    AND #$000F                  ; Mask D-pad bits (Up/Down/Left/Right)
    BEQ .no_movement
    TAX
    LDA $4E9D
    BIT #$C000
    BEQ .apply_heading
    LDA $8FCC0E,X               ; Fetch 16-way directional heading from table
    BRA .store_heading
.apply_heading:
    ; Additional slope & angle handling
.store_heading:
    AND #$00FF
    STA $4EAB                   ; Set character facing direction

.no_movement:
    ; Ring menu triggers (Y Button = $4000)
    LDA #$4000
    TRB $0104
    BEQ .check_dog_ring
    LDA #$4E89                  ; Boy entity pointer
    STA $05A7
    LDA #$0002
    TSB $05A9                   ; Trigger Boy ring menu

.check_dog_ring:
    ; Dog ring menu trigger (X Button = $0040)
    LDA $4F47
    BIT #$1021
    BNE .check_attack
    LDA #$0040
    TRB $0104
    BEQ .check_attack
    LDA #$4F37                  ; Dog entity pointer
    STA $05A7
    LDA #$0004
    TSB $05A9                   ; Trigger Dog ring menu

.check_attack:
    ; A-Button Attack Trigger
    LDA $0B25
    TRB $0104
    BEQ .done
    JSR $ABED                   ; Launch weapon attack animation / swing
.done:
    RTS
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

#define STAMINA_FULL_THRESHOLD  0x0400  /* 1024 raw stamina points = 100% */
#define STAMINA_DASH_DRAIN_RATE 3       /* 3 raw units consumed per frame while sprinting */

#define BUTTON_B                0x0800  /* Dash / Run hold button */
#define BUTTON_A                0x0080  /* Attack / Action trigger */
#define BUTTON_Y                0x4000  /* Open Boy Ring Menu */
#define BUTTON_X                0x0040  /* Open Dog Ring Menu */

#define DPAD_MASK               0x000F  /* D-pad direction bits */

#define RING_MENU_BOY_BIT       0x0002
#define RING_MENU_DOG_BIT       0x0004

/* Direction lookup table ($8F:CC0E): maps 4-bit D-pad state to 16-way heading */
static const uint8_t g_dpad_to_heading[16] = {
    0x00, /* 0000: None */
    0x04, /* 0001: Right */
    0x0C, /* 0010: Left */
    0x00, /* 0011: Invalid (Right + Left) */
    0x08, /* 0100: Down */
    0x06, /* 0101: Down-Right */
    0x0A, /* 0110: Down-Left */
    0x08, /* 0111: Invalid */
    0x00, /* 1000: Up */
    0x02, /* 1001: Up-Right */
    0x0E, /* 1010: Up-Left */
    0x00, /* 1011: Invalid */
    0x00, /* 1100: Invalid (Up + Down) */
    0x04, /* 1101: Invalid */
    0x0C, /* 1110: Invalid */
    0x00  /* 1111: Invalid */
};

typedef struct {
    uint16_t entity_id;
    int16_t  pos_x;
    int16_t  pos_y;
    int16_t  vel_x;
    int16_t  vel_y;
    uint16_t stamina;           /* Offset +0x2E / +0x65 */
    uint16_t max_stamina;
    uint8_t  facing_direction;  /* Offset +0x22 */
    uint16_t state_flags;
    bool     is_sprinting;
} PlayerEntity;

typedef struct {
    uint16_t raw_held;          /* $0EB8 */
    uint16_t edge_trigger;      /* $0EC6 */
    uint16_t dpad_filtered;     /* $0105 */
    uint16_t active_buttons;    /* $0104 */
} ControllerState;

extern void entity_physics_integrate(PlayerEntity *player);
extern void weapon_initiate_attack(PlayerEntity *player);
extern void slope_resolve_collision(PlayerEntity *player, int16_t *dx, int16_t *dy);

/**
 * Executes one frame of player movement and input arbitration for the active character.
 * Corresponds to native routines $8F:CD88 (Boy) and $8F:CECC (Dog).
 */
void player_human_control_tick(PlayerEntity *player, ControllerState *ctrl, uint16_t *ring_owner, uint16_t *ring_flags) {
    /* Step 1: Base friction and inertia integration */
    entity_physics_integrate(player);

    /* Step 2: B-Button Dash / Sprint Evaluation */
    player->is_sprinting = false;
    if ((ctrl->raw_held & BUTTON_B) != 0) {
        /* Dashing requires full stamina (100% = 0x0400) */
        if (player->stamina >= STAMINA_FULL_THRESHOLD) {
            player->is_sprinting = true;
            
            /* Deduct stamina drain per tick */
            if (player->stamina >= STAMINA_DASH_DRAIN_RATE) {
                player->stamina -= STAMINA_DASH_DRAIN_RATE;
            } else {
                player->stamina = 0;
            }
        }
    }

    /* Step 3: Directional Input & Velocity Determination */
    uint8_t dpad = (uint8_t)(ctrl->dpad_filtered & DPAD_MASK);
    if (dpad != 0) {
        uint8_t target_heading = g_dpad_to_heading[dpad];
        player->facing_direction = target_heading;

        int16_t base_speed = player->is_sprinting ? 0x0300 : 0x0180; /* Dashing provides 2x speed */
        int16_t move_x = 0;
        int16_t move_y = 0;

        if (dpad & 0x01) move_x += base_speed; /* Right */
        if (dpad & 0x02) move_x -= base_speed; /* Left */
        if (dpad & 0x04) move_y += base_speed; /* Down */
        if (dpad & 0x08) move_y -= base_speed; /* Up */

        /* Normalize diagonal movement components (1 / sqrt(2) approx = 0.707) */
        if (move_x != 0 && move_y != 0) {
            move_x = (move_x * 181) >> 8;
            move_y = (move_y * 181) >> 8;
        }

        /* Step 4: Resolve angled 45-degree terrain slope guides */
        slope_resolve_collision(player, &move_x, &move_y);

        player->vel_x = move_x;
        player->vel_y = move_y;
    } else {
        /* No input: come to a smooth halt */
        player->vel_x = 0;
        player->vel_y = 0;
    }

    /* Step 5: Ring Menu Invocation */
    if (ctrl->active_buttons & BUTTON_Y) {
        ctrl->active_buttons &= ~BUTTON_Y; /* Consume trigger */
        *ring_owner = player->entity_id;
        *ring_flags |= RING_MENU_BOY_BIT;
        return;
    }

    if (ctrl->active_buttons & BUTTON_X) {
        ctrl->active_buttons &= ~BUTTON_X; /* Consume trigger */
        *ring_owner = player->entity_id;
        *ring_flags |= RING_MENU_DOG_BIT;
        return;
    }

    /* Step 6: Attack / Action Execution */
    if (ctrl->edge_trigger & BUTTON_A) {
        ctrl->edge_trigger &= ~BUTTON_A; /* Consume trigger */
        weapon_initiate_attack(player);
    }
}
```
