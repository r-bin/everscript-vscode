/*
 * Routine: $8FCD88 (player_movement)
 * Bank: $8F (ROM Offset: $0FCD88)
 * Source: docs/disassembly/engine-core/player-movement.md
 */

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
