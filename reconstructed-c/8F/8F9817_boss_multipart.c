/*
 * Routine: $8F9817 (boss_multipart)
 * Bank: $8F (ROM Offset: $0F9817)
 * Source: docs/disassembly/combat/boss-multipart.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/** Maximum number of child entity slots in the multipart pool. */
#define MULTIPART_POOL_CAPACITY         6
/** Stride of a child entity record in WRAM (in bytes). */
#define MULTIPART_RECORD_STRIDE         89
/** Total byte size of the child entity pool (6 * 89 = 534 bytes). */
#define MULTIPART_POOL_SIZE             (MULTIPART_POOL_CAPACITY * MULTIPART_RECORD_STRIDE)

/** Sentinel value for an unattached or empty entity slot. */
#define ENTITY_SLOT_NONE                ((int16_t)-1)

/** Child entity state flags ($7E:3C12). */
#define CHILD_FLAG_SUSPENDED            0x0200
#define CHILD_FLAG_STICKY_LEASH         0x1000

/** Forward declaration of the anchor initializer from Session 38. */
void companion_waypoint_anchor_init(uint16_t child_slot_offset);

/** Structure representing a single entity slot in WRAM ($7E:50A7 / $7E:0000). */
typedef struct EntityRecord {
    uint8_t  padding_00[0x6A];
    int16_t  primary_child;             /* +0x6A: Primary attached child slot index */
    int16_t  secondary_child;           /* +0x6C: Secondary attached child slot index */
    uint8_t  padding_6E[0x92];
} EntityRecord;

/** Context structure for the multi-part tracking subsystem ($7E:3BC0). */
typedef struct {
    uint16_t slot_cursor;               /* $7E:3BC3: Current slot byte offset (0..533) */
    uint16_t task_index;                /* $7E:3BC5: Round-robin task selector (0..14) */
    int16_t  free_list_head;            /* $7E:3BC7: Head index of free child slots */
    int16_t  next_free_slot[MULTIPART_POOL_CAPACITY];   /* $7E:3BC9,X */
    uint16_t child_flags[MULTIPART_POOL_CAPACITY];      /* $7E:3C12,X */
    EntityRecord *child_parent[MULTIPART_POOL_CAPACITY];/* $7E:3C14,X */
} MultiPartSubsystem;

typedef uint16_t (*ReadFrameCounter)(void);
typedef uint16_t (*ReadWramWord)(uint16_t address);
typedef void (*RunChildTask)(uint16_t task_index, uint16_t parent_pointer,
                             uint16_t child_slot_offset);
typedef void (*FinishFieldFrame)(void);

/** Reconstructs the spare-time worker loop at $8F:9817-$8F:9866. */
void field_spare_time_loop(MultiPartSubsystem *ctx,
                           ReadFrameCounter read_frame_counter,
                           ReadWramWord read_wram_word,
                           RunChildTask run_child_task,
                           FinishFieldFrame finish_field_frame)
{
    uint16_t frame_at_entry = read_frame_counter();

    for (;;) {
        if (read_frame_counter() != frame_at_entry) {
            finish_field_frame();
            return;
        }

        uint16_t next_cursor =
            (uint16_t)(ctx->slot_cursor + MULTIPART_RECORD_STRIDE);
        if (next_cursor >= MULTIPART_POOL_SIZE) {
            ctx->task_index = (uint16_t)((ctx->task_index + 2u) & 0x000Eu);
            ctx->slot_cursor = 0;
        } else {
            ctx->slot_cursor = next_cursor;
        }

        uint16_t slot_offset = ctx->slot_cursor;
        uint16_t child_flags = read_wram_word((uint16_t)(0x3C12u + slot_offset));
        if ((child_flags & CHILD_FLAG_SUSPENDED) != 0) {
            continue;
        }

        uint16_t parent_pointer =
            read_wram_word((uint16_t)(0x3C14u + slot_offset));
        if (parent_pointer == 0) {
            continue;
        }

        run_child_task(ctx->task_index, parent_pointer, slot_offset);
    }
}

/**
 * @brief Subroutine $8F:9877: Retrieves or allocates a primary child attachment entity.
 *
 * @param ctx Pointer to the multi-part subsystem context.
 * @param parent Pointer to the parent entity.
 * @return int16_t Child slot index, or ENTITY_SLOT_NONE (-1) on pool exhaustion.
 */
int16_t multipart_child_get_or_create_primary(MultiPartSubsystem *ctx, EntityRecord *parent)
{
    /* 1. If child entity is already attached, return its slot index */
    if (parent->primary_child >= 0) {
        return parent->primary_child;
    }

    /* 2. Pop a free slot from the free list */
    int16_t child_idx = ctx->free_list_head;
    if (child_idx < 0 || child_idx >= MULTIPART_POOL_CAPACITY) {
        return ENTITY_SLOT_NONE; /* Pool exhausted */
    }

    /* Advance free list head */
    ctx->free_list_head = ctx->next_free_slot[child_idx];

    /* 3. Cross-link parent and child entities */
    ctx->child_parent[child_idx] = parent;
    parent->primary_child = child_idx;

    /* 4. Clear state flags and initialize waypoint navigation anchor */
    ctx->child_flags[child_idx] = 0;
    companion_waypoint_anchor_init((uint16_t)(child_idx * MULTIPART_RECORD_STRIDE));

    return child_idx;
}

/**
 * @brief Subroutine $8F:98A4: Configures an attached child entity with a sticky leash tether.
 *
 * @param ctx Pointer to the multi-part subsystem context.
 * @param parent Pointer to the parent entity.
 * @return int16_t Child slot index, or ENTITY_SLOT_NONE (-1) if allocation failed.
 */
int16_t multipart_child_set_sticky_leash(MultiPartSubsystem *ctx, EntityRecord *parent)
{
    int16_t child_idx = multipart_child_get_or_create_primary(ctx, parent);
    if (child_idx >= 0) {
        ctx->child_flags[child_idx] |= CHILD_FLAG_STICKY_LEASH;
    }
    return child_idx;
}

/**
 * @brief Subroutine $8F:98B5: Retrieves or allocates a secondary child attachment entity.
 *
 * @param ctx Pointer to the multi-part subsystem context.
 * @param parent Pointer to the parent entity.
 * @param out_child_idx Output pointer for the allocated child slot index.
 * @return bool True if allocated or existing; False on failure.
 */
bool multipart_child_get_or_create_secondary(MultiPartSubsystem *ctx, EntityRecord *parent, int16_t *out_child_idx)
{
    /* 1. Return existing secondary child if attached */
    if (parent->secondary_child >= 0) {
        *out_child_idx = parent->secondary_child;
        return true;
    }

    /* 2. Attempt to pop from free list */
    int16_t child_idx = ctx->free_list_head;

    if (child_idx < 0) {
        /* Pool exhausted: scan for active primary child to detach and transfer */
        for (int i = 0; i < MULTIPART_POOL_CAPACITY; ++i) {
            EntityRecord *slot_parent = ctx->child_parent[i];
            if (slot_parent != NULL && slot_parent->primary_child == i) {
                slot_parent->primary_child = ENTITY_SLOT_NONE;
                child_idx = i;
                break;
            }
        }

        if (child_idx < 0) {
            return false; /* Transfer failed */
        }
    } else {
        ctx->free_list_head = ctx->next_free_slot[child_idx];
    }

    /* 3. Link into secondary attachment slot */
    ctx->child_parent[child_idx] = parent;
    parent->secondary_child = child_idx;
    ctx->child_flags[child_idx] = 0;

    companion_waypoint_anchor_init((uint16_t)(child_idx * MULTIPART_RECORD_STRIDE));
    *out_child_idx = child_idx;
    return true;
}

/**
 * @brief Subroutine $8F:98FE: Frees the primary child entity attached to a parent.
 *
 * @param ctx Pointer to the multi-part subsystem context.
 * @param parent Pointer to the parent entity.
 */
void multipart_child_free_primary(MultiPartSubsystem *ctx, EntityRecord *parent)
{
    int16_t child_idx = parent->primary_child;
    if (child_idx < 0 || child_idx >= MULTIPART_POOL_CAPACITY) {
        return;
    }

    /* Clear child's parent reference */
    ctx->child_parent[child_idx] = NULL;

    /* Push slot back onto free list */
    ctx->next_free_slot[child_idx] = ctx->free_list_head;
    ctx->free_list_head = child_idx;

    /* Detach from parent */
    parent->primary_child = ENTITY_SLOT_NONE;
}

/**
 * @brief Subroutine $8F:9916: Frees a specified child slot and returns it to the free list.
 *
 * @param ctx Pointer to the multi-part subsystem context.
 * @param child_idx The child slot index to release.
 * @return int16_t Sentinel ENTITY_SLOT_NONE (-1).
 */
int16_t multipart_child_free_secondary(MultiPartSubsystem *ctx, int16_t child_idx)
{
    if (child_idx >= 0 && child_idx < MULTIPART_POOL_CAPACITY) {
        ctx->child_parent[child_idx] = NULL;
        ctx->next_free_slot[child_idx] = ctx->free_list_head;
        ctx->free_list_head = child_idx;
    }
    return ENTITY_SLOT_NONE;
}
