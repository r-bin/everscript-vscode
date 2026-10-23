/*
 * Routine: $8FD5D2 (boss_engine)
 * Bank: $8F (ROM Offset: $0FD5D2)
 * Source: docs/disassembly/combat/boss-engine.md
 */

#include <stdint.h>
#include <stdbool.h>

#define ENT_MODE_CHARGING_DAMAGE    0x4000  /* Deals contact damage on collision */
#define ENT_MODE_INVINCIBLE         0x0002  /* Untargetable / invulnerable */

#define MAGMAR_HP_ENRAGE_THRESHOLD  512     /* Transitions to aggressive rolling */
#define MAGMAR_SUBMERGE_TICKS       180     /* 3 seconds under molten lava */
#define MAGMAR_SURFACE_TICKS        240     /* 4 seconds exposed spitting fire */

typedef enum {
    MAGMAR_PHASE_SUBMERGED = 0,
    MAGMAR_PHASE_SURFACED_SPIT,
    MAGMAR_PHASE_CHARGING_ROLL,
} MagmarPhase;

typedef struct {
    uint16_t hp;
    uint16_t max_hp;
    uint16_t x, y;
    MagmarPhase phase;
    uint16_t phase_timer;
    bool is_invulnerable;
    bool deals_contact_damage;
} MagmarBossState;

/**
 * Executes one frame tick of Magmar lava boss AI ($8F:D5D2).
 *
 * @param boss Pointer to Magmar boss state structure.
 * @param player_x Target player X coordinate.
 * @param player_y Target player Y coordinate.
 */
void boss_ai_magmar_tick(MagmarBossState *boss, int16_t player_x, int16_t player_y) {
    if (boss->hp == 0) {
        // Boss defeated: trigger death explosion and set progression flag ($2260 bit 4)
        return;
    }

    switch (boss->phase) {
        case MAGMAR_PHASE_SUBMERGED:
            // Submerged: invulnerable, moves unseen beneath lava tracking player
            boss->is_invulnerable = true;
            boss->deals_contact_damage = false;

            // Move towards player coordinates at subterranean speed
            if (boss->x < player_x) boss->x += 2;
            else if (boss->x > player_x) boss->x -= 2;

            if (boss->y < player_y) boss->y += 2;
            else if (boss->y > player_y) boss->y -= 2;

            if (--boss->phase_timer == 0) {
                // Erupt from lava: breach surface
                boss->phase = (boss->hp < MAGMAR_HP_ENRAGE_THRESHOLD) ?
                              MAGMAR_PHASE_CHARGING_ROLL : MAGMAR_PHASE_SURFACED_SPIT;
                boss->phase_timer = (boss->phase == MAGMAR_PHASE_CHARGING_ROLL) ? 300 : MAGMAR_SURFACE_TICKS;
                boss->is_invulnerable = false;
            }
            break;

        case MAGMAR_PHASE_SURFACED_SPIT:
            // Surfaced: vulnerable to weapon/alchemy strikes, spits lava projectiles ($DA66)
            boss->is_invulnerable = false;
            boss->deals_contact_damage = false;

            if ((boss->phase_timer % 60) == 0) {
                // Fire lava projectile towards player
                spawn_boss_projectile(boss->x, boss->y - 20, player_x, player_y);
            }

            if (--boss->phase_timer == 0) {
                // Dive back into lava
                boss->phase = MAGMAR_PHASE_SUBMERGED;
                boss->phase_timer = MAGMAR_SUBMERGE_TICKS;
            }
            break;

        case MAGMAR_PHASE_CHARGING_ROLL:
            // Enraged Rolling Boulder: fast movement with mode 0x4000 contact damage
            boss->is_invulnerable = false;
            boss->deals_contact_damage = true;

            // Charge in current heading until colliding with room walls
            step_charging_ram(boss);

            if (--boss->phase_timer == 0) {
                boss->phase = MAGMAR_PHASE_SUBMERGED;
                boss->phase_timer = MAGMAR_SUBMERGE_TICKS;
            }
            break;
    }
}

/**
 * Static Props & Boss Core Target update loop ($8F:D76A).
 * Used for Thraxx Heart, Coleoptera Heart, Mungola, Aegis.
 *
 * @param core_entity_ptr WRAM address of the core boss target.
 * @param subpart_count   Number of dependent sub-parts (e.g. 4 claws).
 * @return True if boss core is currently exposed to damage.
 */
bool boss_part_evaluate_exposure(uint16_t core_entity_ptr, int subpart_count) {
    uint16_t hp = read_wram16(core_entity_ptr + 0x002A);
    if (hp == 0) {
        return false;
    }

    // Check peripheral parts (e.g. claws): if any claw is alive and shielding, core is invulnerable
    for (int i = 0; i < subpart_count; i++) {
        uint16_t claw_ptr = read_wram16(0x0EAC + (i * 4));
        if (claw_ptr != 0 && read_wram16(claw_ptr + 0x002A) > 0) {
            // Heart is shielded by peripheral parts: apply invulnerability bit
            uint16_t flags = read_wram16(core_entity_ptr + 0x0010);
            write_wram16(core_entity_ptr + 0x0010, flags | ENT_MODE_INVINCIBLE);
            return false;
        }
    }

    // All shielding parts down: expose heart to attack
    uint16_t flags = read_wram16(core_entity_ptr + 0x0010);
    write_wram16(core_entity_ptr + 0x0010, flags & ~ENT_MODE_INVINCIBLE);
    return true;
}
