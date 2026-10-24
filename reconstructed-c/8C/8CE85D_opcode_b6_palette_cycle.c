/*
 * Routine: $8C:E85D (script opcode 0xB6)
 * Palette loader: $8C:E899
 * Cycle initializer: $90:D50F
 * Source: docs/disassembly/script-vm/opcode-b6-palette-cycle.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint16_t palette_index_times_two; /* DP $02 */
    uint16_t first_colour;            /* DP $04 */
    uint16_t inclusive_colour_count;  /* DP $06 */
    uint16_t speed;                   /* DP $08 */
} PaletteCycleParameters;

extern uint16_t script_eval_expression(void); /* $8C:EA43 */
extern void load_palette_cycle_source(uint16_t palette); /* $8C:E899 */
extern void initialize_palette_cycle(const PaletteCycleParameters *parameters); /* $90:D50F */

bool script_op_b6_palette_cycle(void) {
    uint16_t palette = script_eval_expression();
    load_palette_cycle_source(palette);

    uint16_t first_colour = script_eval_expression();
    uint16_t last_colour = script_eval_expression();
    uint16_t speed = script_eval_expression();

    PaletteCycleParameters parameters = {
        .palette_index_times_two = (uint16_t)(palette << 1),
        .first_colour = first_colour,
        .inclusive_colour_count = (uint16_t)(last_colour - first_colour + 1),
        .speed = speed,
    };

    initialize_palette_cycle(&parameters);
    return true;
}
