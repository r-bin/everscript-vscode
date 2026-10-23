/*
 * Routine: $8CD315 (expression_eval)
 * Bank: $8C (ROM Offset: $0CD315)
 * Source: docs/disassembly/script-vm/expression-eval.md
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint32_t stack[16];
    uint8_t  sp;
} EvalStack;

extern const uint8_t g_rom[0x400000];
extern uint16_t g_script_args[16]; // $7E:0E80

// Sub-Op Function Handlers
static void subop_push(EvalStack *stack, uint32_t val) {
    if (stack->sp < 16) {
        stack->stack[stack->sp++] = val;
    }
}

static uint32_t subop_pop(EvalStack *stack) {
    return (stack->sp > 0) ? stack->stack[--stack->sp] : 0;
}

/**
 * Evaluates a single dynamic expression from bytecode.
 * Corresponds to $8C:EA43.
 */
uint32_t script_vm_eval_expression(uint32_t *pc) {
    EvalStack stack = { .sp = 0 };
    uint32_t acc = 0;
    bool is_last = false;

    while (!is_last) {
        uint8_t raw_byte = g_rom[(*pc)++];
        is_last = (raw_byte & 0x80) != 0;
        uint8_t subop = raw_byte & 0x7F;

        switch (subop) {
            case 0x00: // End / Return
                return acc;

            case 0x01: { // Signed byte constant
                int8_t b = (int8_t)g_rom[(*pc)++];
                acc = (uint32_t)(int32_t)b;
                break;
            }

            case 0x02: { // Unsigned byte constant
                uint8_t b = g_rom[(*pc)++];
                acc = (uint32_t)b;
                break;
            }

            case 0x03: { // Signed word constant
                int16_t w = (int16_t)(g_rom[*pc] | (g_rom[*pc + 1] << 8));
                *pc += 2;
                acc = (uint32_t)(int32_t)w;
                break;
            }

            case 0x04: { // Unsigned word constant
                uint16_t w = (uint16_t)(g_rom[*pc] | (g_rom[*pc + 1] << 8));
                *pc += 2;
                acc = (uint32_t)w;
                break;
            }

            case 0x1A: { // Addition (+)
                uint32_t left = subop_pop(&stack);
                acc = left + acc;
                break;
            }

            case 0x1B: { // Subtraction (-)
                uint32_t left = subop_pop(&stack);
                acc = left - acc;
                break;
            }

            case 0x17: { // Multiplication (*)
                uint32_t left = subop_pop(&stack);
                acc = left * acc;
                break;
            }

            case 0x18: { // Division (/)
                uint32_t left = subop_pop(&stack);
                acc = (acc != 0) ? (left / acc) : 0;
                break;
            }

            case 0x22: { // Equality (==)
                uint32_t left = subop_pop(&stack);
                acc = (left == acc) ? 1 : 0;
                break;
            }

            case 0x23: { // Inequality (!=)
                uint32_t left = subop_pop(&stack);
                acc = (left != acc) ? 1 : 0;
                break;
            }

            case 0x29: // Push accumulator to stack
                subop_push(&stack, acc);
                break;

            default:
                // Handle remaining memory, flag, and entity sub-ops
                break;
        }
    }

    return acc;
}

/**
 * Reads a counted list of expressions and stores them in $0E80.
 * Corresponds to $8C:D315.
 */
void script_vm_read_args(uint32_t *pc) {
    uint8_t count = g_rom[(*pc)++]; // Argument count n
    for (uint8_t i = 0; i < count; i++) {
        uint32_t val = script_vm_eval_expression(pc);
        g_script_args[i] = (uint16_t)(val & 0xFFFF);
    }
}
