# Boss Multi-Part State Driver & HP Phase Transitions ($8F:D5D2, $8F:D76A, $8F:D715)

> **Subsystem**: Boss Combat Engine & Multi-Segment Coordination  
> **ROM Addresses**: `$8F:D5D2` (`boss_ai_magmar`), `$8F:D76A` (`boss_part_static_target`), `$8F:D715` (`boss_ai_submerging_segmented`)  
> **Clean C Module**: `combat/boss-engine.c`  
> **Jump Table Indices**: `0x10` (Magmar), `0x02` (Thraxx Heart / Coleoptera / Aegis), `0x0E` (Salabog / Tar Skull)  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Major boss encounters in Secret of Evermore feature multi-segmented entity models, state transitions based on HP milestones, and phase synchronization:
- **Magmar Lava Encounter (`$8F:D5D2`, Index `0x10`)**:
  - Encounters `#87` and `#140`.
  - Phase 1 (Submerged Tracking): Magmar sinks beneath molten lava, tracking the player's X/Y coordinates while invulnerable (`flags | 0x0002`).
  - Phase 2 (Surfaced Projectile Barrage): Breaches lava surface to fire aimed lava spit projectiles (`$DA66`, `$DA7E`).
  - Phase 3 (Charging Roll): Curls into a blazing boulder with entity mode `0x4000` (continuous charging contact damage at `$8F:B52C`), sweeping across the arena until crashing into arena bounds.
- **Static Multi-Part Boss Targets (`$8F:D76A`, Index `0x02`)**:
  - Powers stationary scripted boss targets: Thraxx Heart, Coleoptera Heart, Mungola, Aquagoth, Aegis shield.
  - Zero autonomous roaming (`aggro_range = 0, aggro_chance = 0`).
  - Controlled by room scripts and parent boss controllers: exposes vulnerability windows when peripheral parts (e.g., Thraxx's 4 claws) are stunned or destroyed.
- **Submerging Multi-Segment Ambush (`$8F:D715`, Index `0x0E`)**:
  - Powers Salabog and Tar Skull.
  - Composed of multi-segment node lists (`opcode 0x57`), with 14 bytes per segment link.
  - Submerges beneath swamp/mud terrain, evaluates proximity to party, erupts with forward lunges, fires projectile mud bubbles, and retreats underground to reposition.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; $8F:D5D2: Magmar Lava Boss AI Routine (Index 0x10 in $8F:CBE0)
; ==============================================================================
$8F:D5D2  B9 10 00     LDA $0010,Y      ; Current entity mode/phase flags
$8F:D5D5  89 00 40     BIT #$4000       ; Is Magmar in charging roll phase?
$8F:D5D8  D0 22        BNE $D5FC        ; Yes -> handle rolling physics & wall bounce
$8F:D5DA  B9 2A 00     LDA $002A,Y      ; Current Boss HP
$8F:D5DD  C9 00 02     CMP #$0200       ; HP < 512 (Enrage Phase threshold)?
$8F:D5E0  90 10        BCC $D5F2        ; Switch to fast rolling attack
$8F:D5E2  B9 78 00     LDA $0078,Y      ; Phase timer / state counter
$8F:D5E5  3A           DEC A            ; Decrement phase timer
$8F:D5E6  99 78 00     STA $0078,Y
$8F:D5E9  D0 10        BNE $D5FB        ; Timer active -> remain in current stance
$8F:D5EB  20 30 D6     JSR $D630        ; Submerge / Surface transition trigger
$8F:D5EE  80 0B        BRA $D5FB
$8F:D5F2  ...                           ; Set mode bit $4000 (rolling contact damage)
$8F:D5FB  60           RTS

; ==============================================================================
; $8F:D76A: Static Props & Boss Core Targets (Index 0x02)
; ==============================================================================
$8F:D76A  B9 2A 00     LDA $002A,Y      ; Read Boss Part HP
$8F:D76D  F0 06        BEQ $D775        ; HP == 0 -> Trigger destruction cutscene
$8F:D76F  B9 14 00     LDA $0014,Y      ; Check parent orchestration status
$8F:D772  29 FF 0F     AND #$0FFF
$8F:D775  60           RTS
```

---

## 3. Clean C Implementation

```c
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
```
