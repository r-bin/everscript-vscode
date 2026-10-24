/*
 * Routine: $8C:D0D0 (script opcode 0x9E)
 * Source: docs/disassembly/script-vm/opcode-9e-cast-all.md
 */

#include <stdbool.h>
#include <stdint.h>

extern uint16_t script_eval_entity_expression(void); /* $8C:EC8E, result DP $4C */
extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t wram_read_word(uint16_t address);
extern void wram_write_word(uint16_t address, uint16_t value);
extern uint16_t allocate_spell_slot_per_target(uint16_t spell); /* $91:9777 */
extern uint16_t allocate_spell_slot_shared(uint16_t spell); /* $91:9759 */
extern void store_spell_target(uint16_t slot, uint16_t target); /* slot field +$2E */
extern void initialize_and_enqueue_spell_cast(
    uint16_t caster,
    uint16_t spell,
    uint16_t level,
    uint16_t slot
); /* opaque remainder, including $91:AD17, $91:973E, and $8C:C521 */

static void consume_unallocated_cast_operands(void) {
    (void)script_eval_entity_expression();
    (void)script_eval_expression();
    (void)script_eval_expression();

    while (script_eval_expression() != 0) {
    }
}

bool script_cast_all_with_target_marker(uint16_t target_marker) {
    wram_write_word(0x3BC1, target_marker);
    uint16_t caster = script_eval_entity_expression();
    uint16_t spell = script_eval_expression();
    uint16_t level = script_eval_expression();
    uint16_t slot = spell == 0x0002 || spell == 0x0016
        ? allocate_spell_slot_per_target(spell)
        : allocate_spell_slot_shared(spell);

    if (slot == 0) {
        consume_unallocated_cast_operands();
        return true;
    }

    uint16_t current_target_marker = wram_read_word(0x3BC1);
    for (;;) {
        uint16_t target = script_eval_expression();
        if (target == 0) {
            break;
        }
        if (target != current_target_marker) {
            store_spell_target(slot, target);
        }
    }

    initialize_and_enqueue_spell_cast(caster, spell, level, slot);
    return true;
}

bool script_op_9e_cast_all(void) {
    return script_cast_all_with_target_marker(0);
}