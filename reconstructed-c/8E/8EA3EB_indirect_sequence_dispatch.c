/*
 * Routine: $8E:A3EB (walk_indirect_sequence_with_dispatch)
 * Bank: $8E (ROM offset: $0EA3EB)
 * Source: docs/disassembly/engine-core/record-iteration-dispatch.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint16_t accumulator;
    bool carry;
} RoutineResult;

extern volatile uint16_t g_dp_0022;
extern volatile uint16_t g_dp_0024;
extern volatile uint16_t g_dp_0095;

extern uint16_t read_word_from_data_bank(uint16_t address);
extern uint16_t read_word_via_dp95(uint16_t y_offset);
extern uint16_t read_word_from_bank_8e(uint16_t offset);
extern RoutineResult routine_8eadbc(void);
extern RoutineResult call_indirect_subroutine_a444(uint16_t x_index);
extern void routine_8eae85(void);
extern void routine_8caf2b(uint16_t y);
extern void routine_8c9e03(uint16_t y);

static void prepare_sequence_iteration(void) {
    uint16_t y = 0x034Du;

    routine_8eae85();
    routine_8caf2b(y);

    y = g_dp_0095;
    uint16_t index = read_word_from_data_bank((uint16_t)(y + 2u));
    y = (uint16_t)((index << 1) + 4u);

    uint16_t x = read_word_via_dp95(y);
    x = read_word_from_bank_8e((uint16_t)(0x8000u + x));
    x = read_word_from_bank_8e(x);
    g_dp_0022 = x;
    g_dp_0024 = 0x00C4u;

    routine_8c9e03(0x034Du);
}

static uint16_t current_dispatch_index(void) {
    uint16_t y = g_dp_0095;
    uint16_t offset = read_word_from_data_bank((uint16_t)(y + 2u));
    uint32_t first_sum = (uint32_t)y + offset;

    y = (uint16_t)(first_sum + offset + (first_sum >> 16));
    return read_word_from_data_bank((uint16_t)(y + 4u));
}

void walk_indirect_sequence_with_dispatch(void) {
    for (;;) {
        prepare_sequence_iteration();

        RoutineResult result = routine_8eadbc();
        if (!result.carry) {
            continue;
        }

        if ((result.accumulator & 0x0040u) == 0) {
            return;
        }

        uint16_t x_index = current_dispatch_index();
        x_index = read_word_from_bank_8e((uint16_t)(0x8000u + x_index));
        x_index = read_word_from_bank_8e((uint16_t)(0x0006u + x_index));

        result = call_indirect_subroutine_a444(x_index);
        if (result.carry) {
            return;
        }
    }
}