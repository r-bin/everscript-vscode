/*
 * Routine: $909E93 (camera_viewport_scroll)
 * Bank: $90 (ROM Offset: $109E93)
 * Source: docs/disassembly/engine-core/camera-viewport-scroll.md
 */

#include <stdint.h>
#include <stdbool.h>

#define SCREEN_WIDTH                    256
#define SCREEN_HEIGHT                   224
#define MODE7_HORIZON_BIAS_OFFSET       96
#define ROOM_FLAG_FLIGHT_HORIZON_BIAS   0x4000

/** Entity record in WRAM ($7E:0000 / $7E:50A7). */
typedef struct {
    uint8_t  padding_00[0x1A];
    uint16_t world_x;                   /* +0x1A: World pixel X coordinate */
    uint16_t world_y;                   /* +0x1C: World pixel Y coordinate */
} CameraTrackedEntity;

/** Room limits structure. */
typedef struct {
    uint16_t min_x;                     /* $7E:23E9 */
    uint16_t min_y;                     /* $7E:23EB */
    uint16_t max_x;                     /* $7E:23ED */
    uint16_t max_y;                     /* $7E:23EF */
} RoomLimits;

/** Deadzone bounding margins ($7E:240F..$7E:2415). */
typedef struct {
    uint16_t left;                      /* $7E:240F */
    uint16_t right;                     /* $7E:2411 */
    uint16_t top;                       /* $7E:2413 */
    uint16_t bottom;                    /* $7E:2415 */
} CameraDeadzone;

/** Complete context for overworld camera tracking. */
typedef struct {
    /* Live viewport origin */
    int16_t camera_x;                   /* DP $BF */
    int16_t camera_y;                   /* DP $C1 */
    int16_t prev_camera_x;              /* DP $12 */
    int16_t prev_camera_y;              /* DP $14 */

    /* Cutscene anchors */
    int16_t fixed_target_x;             /* $7E:242B (-1 = tracking active) */
    int16_t fixed_target_y;             /* $7E:242D (-1 = tracking active) */

    /* Active tracked entity pointers */
    const CameraTrackedEntity *primary_entity;   /* $7E:0F42 */
    const CameraTrackedEntity *secondary_entity; /* $7E:143A */

    /* Overworld flight & configuration */
    uint16_t room_header_flags;         /* $7E:0F84 */
    uint16_t flight_altitude;           /* $7E:0617 */

    /* Limits and deadzone */
    RoomLimits limits;
    CameraDeadzone deadzone;
} OverworldCameraContext;

/**
 * @brief Subroutine $90:9FC9: Filters candidate actor coordinates through the deadzone box.
 *
 * @param ctx Pointer to the overworld camera context.
 * @param entity_x World pixel X coordinate of the tracked actor.
 * @param entity_y World pixel Y coordinate of the tracked actor.
 */
void camera_deadzone_window_filter(OverworldCameraContext *ctx, uint16_t entity_x, uint16_t entity_y)
{
    /* 1. Horizontal Deadzone Evaluation */
    int32_t left_bound = (int32_t)entity_x - ctx->deadzone.left;
    if (left_bound < ctx->camera_x) {
        ctx->camera_x = (int16_t)left_bound;
    } else {
        int32_t right_bound = (int32_t)entity_x + ctx->deadzone.right - SCREEN_WIDTH;
        if (right_bound > ctx->camera_x) {
            ctx->camera_x = (int16_t)right_bound;
        }
    }

    /* 2. Vertical Deadzone Evaluation */
    int32_t top_bound = (int32_t)entity_y - ctx->deadzone.top;
    if (top_bound < ctx->camera_y) {
        ctx->camera_y = (int16_t)top_bound;
    } else {
        int32_t bottom_bound = (int32_t)entity_y + ctx->deadzone.bottom - SCREEN_HEIGHT;
        if (bottom_bound > ctx->camera_y) {
            ctx->camera_y = (int16_t)bottom_bound;
        }
    }
}

/**
 * @brief Routine $90:9E93: Coordinates overworld camera updates, dual-player lead, and clamping.
 *
 * @param ctx Pointer to the overworld camera context.
 */
void camera_viewport_overworld_scroll_and_clamp(OverworldCameraContext *ctx)
{
    /* Preserve previous origin */
    ctx->prev_camera_x = ctx->camera_x;
    ctx->prev_camera_y = ctx->camera_y;

    /* 1. Stationary cutscene anchor mode */
    if (ctx->fixed_target_x >= 0) {
        ctx->camera_x = ctx->fixed_target_x;
        ctx->camera_y = ctx->fixed_target_y;
    } else {
        /* 2. Track primary player entity */
        if (ctx->primary_entity != NULL) {
            camera_deadzone_window_filter(ctx,
                                          ctx->primary_entity->world_x,
                                          ctx->primary_entity->world_y);
        }

        /* 3. Track secondary companion / 2-player entity (midpoint lead) */
        if (ctx->secondary_entity != NULL) {
            camera_deadzone_window_filter(ctx,
                                          ctx->secondary_entity->world_x,
                                          ctx->secondary_entity->world_y);
        }

        /* 4. Apply Mode 7 flight altitude horizon bias */
        if (ctx->room_header_flags & ROOM_FLAG_FLIGHT_HORIZON_BIAS) {
            int32_t biased_y = (int32_t)ctx->flight_altitude - MODE7_HORIZON_BIAS_OFFSET;
            if (biased_y < ctx->camera_y) {
                ctx->camera_y = (int16_t)biased_y;
            }
        }
    }

    /* 5. Clamp horizontal origin against room bounds */
    if (ctx->camera_x < (int16_t)ctx->limits.min_x) {
        ctx->camera_x = (int16_t)ctx->limits.min_x;
    } else if (ctx->camera_x + SCREEN_WIDTH > (int16_t)ctx->limits.max_x) {
        ctx->camera_x = (int16_t)(ctx->limits.max_x - SCREEN_WIDTH);
    }

    /* 6. Clamp vertical origin against room bounds */
    if (ctx->camera_y < (int16_t)ctx->limits.min_y) {
        ctx->camera_y = (int16_t)ctx->limits.min_y;
    } else if (ctx->camera_y + SCREEN_HEIGHT > (int16_t)ctx->limits.max_y) {
        ctx->camera_y = (int16_t)(ctx->limits.max_y - SCREEN_HEIGHT);
    }
}
