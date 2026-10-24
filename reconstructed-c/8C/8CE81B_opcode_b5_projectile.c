/*
 * Routine: $8C:E81B (script opcode 0xB5)
 * Projectile initializer: $90:DCC0
 * Source: docs/disassembly/script-vm/opcode-b5-projectile.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint16_t target_x;       /* DP $02 */
    uint16_t target_y;       /* DP $04 */
    uint16_t movement_entry; /* DP $06 */
    uint16_t last_parameter; /* DP $08 */
    uint16_t source_entity;  /* DP $4C */
    uint16_t source_x;       /* DP $46 */
    uint16_t source_y;       /* DP $48 */
    uint16_t source_z;       /* DP $4A */
} ProjectileVmParameters;

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern uint16_t rom_read_word_long(uint32_t address);
extern void initialize_projectile_from_vm_parameters(
    const ProjectileVmParameters *parameters
); /* opaque model of $90:DCC0 */

bool script_op_b5_projectile(void) {
    uint16_t movement_selector = script_eval_expression();
    uint16_t source_entity = script_eval_expression();
    uint16_t source_x = script_eval_expression();
    uint16_t source_y = script_eval_expression();
    uint16_t source_z = script_eval_expression();
    uint16_t target_x = script_eval_expression();
    uint16_t target_y = script_eval_expression();
    uint16_t last_parameter = script_eval_expression();

    ProjectileVmParameters parameters = {
        .target_x = target_x,
        .target_y = target_y,
        .movement_entry = rom_read_word_long(0x90D986UL + movement_selector),
        .last_parameter = last_parameter,
        .source_entity = source_entity,
        .source_x = source_x,
        .source_y = source_y,
        .source_z = source_z,
    };

    initialize_projectile_from_vm_parameters(&parameters);
    return true;
}
