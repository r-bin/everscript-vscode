/*
 * Routine: $8CDAC5 (dog_ai)
 * Bank: $8C (ROM Offset: $0CDAC5)
 * Source: docs/disassembly/entities/dog-ai.md
 */

/**
 * Executes one companion and active player control update pass.
 * Called once per frame during active gameplay.
 *
 * @param active_player_mask Bitmask of active player characters (1 = Boy, 2 = Dog).
 * @param cutscene_freeze    True if cutscenes or dialog lock party movement.
 */
void companion_ai_tick(uint16_t active_player_mask, bool cutscene_freeze) {
    if (cutscene_freeze) {
        return;
    }

    /* Process Boy entity slot ($7E:4E89) */
    if (active_player_mask & 0x0001) {
        // Boy is player-controlled: read controller input directly
        update_player_entity(ENTITY_BOY_PTR);
    } else {
        // Boy is companion: execute follower AI towards the Dog
        companion_entity_update(ENTITY_BOY_PTR, ENTITY_DOG_PTR);
    }

    /* Process Dog entity slot ($7E:4F37) */
    if (active_player_mask & 0x0002) {
        // Dog is player-controlled: read controller input directly
        update_player_entity(ENTITY_DOG_PTR);
    } else {
        // Dog is companion: execute sniffing, follow, and combat target AI
        companion_entity_update(ENTITY_DOG_PTR, ENTITY_BOY_PTR);
    }
}

/**
 * Updates a companion entity's navigation, following distance, and sniffing state.
 *
 * @param companion_ptr WRAM address of the companion entity ($4E89 or $4F37).
 * @param leader_ptr    WRAM address of the player-controlled leader entity.
 */
void companion_entity_update(uint16_t companion_ptr, uint16_t leader_ptr) {
    /* 1. Clear transient obstacle/movement flags */
    uint16_t flags10 = read_wram16(companion_ptr + ENT_OFF_FLAGS_10);
    flags10 &= ~0x2021; // Clear colliding and stuck bits
    write_wram16(companion_ptr + ENT_OFF_FLAGS_10, flags10);

    /* 2. Compute distance vector to leader */
    int16_t comp_x = (int16_t)read_wram16(companion_ptr + ENT_OFF_POS_X);
    int16_t comp_y = (int16_t)read_wram16(companion_ptr + ENT_OFF_POS_Y);
    int16_t lead_x = (int16_t)read_wram16(leader_ptr + ENT_OFF_POS_X);
    int16_t lead_y = (int16_t)read_wram16(leader_ptr + ENT_OFF_POS_Y);

    int16_t dx = lead_x - comp_x;
    int16_t dy = lead_y - comp_y;
    uint32_t dist_sq = (uint32_t)(dx * dx + dy * dy);

    /* 3. If entity is the Dog, check for nearby hidden ingredient sniffing spots */
    if (companion_ptr == ENTITY_DOG_PTR) {
        uint16_t sniff_spot_obj = check_sniff_spot_proximity(comp_x, comp_y, 48 /* radius px */);
        if (sniff_spot_obj != 0) {
            // Dog detected hidden ingredient: turn towards spot and start sniffing anim
            write_wram16(companion_ptr + ENT_OFF_TARGET_PTR, sniff_spot_obj);
            trigger_dog_sniff_animation(companion_ptr);
            return;
        }
    }

    /* 4. Follow distance leash:
     *    - Within 32 pixels: companion is comfortable in idle/stand stance.
     *    - 32 to 128 pixels: companion walks towards leader.
     *    - > 128 pixels: companion runs / sprints to catch up.
     *    - > 384 pixels: companion is teleported to leader coordinates to prevent desync.
     */
    if (dist_sq > (384 * 384)) {
        // Desync recovery teleport
        write_wram16(companion_ptr + ENT_OFF_POS_X, lead_x);
        write_wram16(companion_ptr + ENT_OFF_POS_Y, lead_y);
    } else if (dist_sq > (32 * 32)) {
        // Navigate companion towards leader waypoint
        navigate_towards(companion_ptr, lead_x, lead_y, dist_sq > (128 * 128) /* run */);
    }
}

/**
 * Handles B-button interaction on a detected sniff spot (Global Script 0x39).
 *
 * @param spot_id The sniff spot trigger ID.
 */
void trigger_sniff_spot_loot(uint16_t spot_id) {
    uint16_t active_player = read_wram16(WRAM_ACTIVE_PLAYER);

    // If player is controlling the Dog, loot cannot be picked up directly
    if (!(active_player & 0x0001)) {
        // Clear loot success flag ($22EA bit 0)
        uint16_t flags = read_wram16(WRAM_LOOT_SUCCESS_FLAG);
        write_wram16(WRAM_LOOT_SUCCESS_FLAG, flags & ~0x0001);
        return;
    }

    // Boy triggers excavation: play dog digging animation, award ingredient
    uint16_t item_id = read_wram16(WRAM_LOOT_MAILBOX_ITEM);
    bool added = inventory_add_item(item_id, 1);

    uint16_t flags = read_wram16(WRAM_LOOT_SUCCESS_FLAG);
    if (added) {
        write_wram16(WRAM_LOOT_SUCCESS_FLAG, flags | 0x0001);
    } else {
        write_wram16(WRAM_LOOT_SUCCESS_FLAG, flags & ~0x0001);
    }
}
