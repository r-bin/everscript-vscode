/*
 * Routines: $8C:E430 (script opcode 0x92), $8C:E467 (script opcode 0xBB)
 * Source: docs/disassembly/script-vm/opcode-92-damage.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E, result DP $4C */
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t transform_script_damage(uint16_t entity, uint16_t amount); /* $8F:C06D */
extern void queue_script_damage_with_knockback(uint16_t entity, uint16_t amount); /* $8F:C121 */
extern void queue_script_damage_without_knockback(uint16_t entity, uint16_t amount); /* $8F:C16E */

static bool entity_accepts_script_damage(uint16_t entity) {
    uint16_t hp = wram_read_word((uint16_t)(entity + 0x002A));
    uint16_t flags = wram_read_word((uint16_t)(entity + 0x0010));

    return hp != 0 && (flags & 0x1000) == 0;
}

static void script_op_bb_damage_no_knockback_body(void) {
    uint16_t entity = script_eval_entity_expression();
    uint16_t amount = script_eval_expression();

    if (entity_accepts_script_damage(entity)) {
        queue_script_damage_without_knockback(entity, amount);
    }
}

bool script_op_92_damage(void) {
    uint16_t redirect = wram_read_word(0x23D5);
    wram_write_word(0x23D5, 0);

    if (redirect != 0) {
        script_op_bb_damage_no_knockback_body();
        return true;
    }

    uint16_t entity = script_eval_entity_expression();
    uint16_t amount = script_eval_expression();

    if (entity_accepts_script_damage(entity)) {
        if (wram_read_word(0x23D7) != 0) {
            wram_write_word(0x23D7, 0);
            amount = transform_script_damage(entity, amount);
        }

        queue_script_damage_with_knockback(entity, amount);
    }

    return true;
}

bool script_op_bb_damage_no_knockback(void) {
    script_op_bb_damage_no_knockback_body();
    return true;
}