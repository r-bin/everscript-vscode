/*
 * Routine: $8C:E6EA (script opcode 0xA9)
 * Source: docs/disassembly/script-vm/opcode-a9-attribute-bit.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef uint16_t EntityAddress;

typedef enum {
    SCRIPT_HANDLER_CONTINUES,
    SCRIPT_HANDLER_UNMODELED_DISPATCH
} ScriptHandlerResult;

typedef struct {
    uint16_t field_offset;
    uint16_t mask;
    bool set_bits;
    bool clear_pending_damage;
    bool clear_status_bits;
} AttributeOperation;

extern EntityAddress script_eval_entity_expression(void); /* $8C:EC8E, result at DP $4C */
extern uint16_t script_eval_expression(void);             /* $8C:EA43 */
extern uint16_t entity_read_word(EntityAddress entity, uint16_t offset);
extern void entity_write_word(EntityAddress entity, uint16_t offset, uint16_t value);

static bool attribute_operation(uint16_t selector, AttributeOperation *operation) {
    switch (selector) {
    case 0x10: *operation = (AttributeOperation){0x10, 0x4000, false, false, false}; return true;
    case 0x12: *operation = (AttributeOperation){0x10, 0x4000, true, true, true}; return true;
    case 0x14: *operation = (AttributeOperation){0x10, 0x0002, true, true, false}; return true;
    case 0x16: *operation = (AttributeOperation){0x10, 0x0002, false, false, false}; return true;
    case 0x18: *operation = (AttributeOperation){0x12, 0x1000, false, false, false}; return true;
    case 0x1A: *operation = (AttributeOperation){0x12, 0x1000, true, false, false}; return true;
    case 0x1C: *operation = (AttributeOperation){0x12, 0x4000, true, false, false}; return true;
    case 0x1E: *operation = (AttributeOperation){0x12, 0x4000, false, false, false}; return true;
    case 0x20: *operation = (AttributeOperation){0x10, 0x0400, true, false, false}; return true;
    case 0x22: *operation = (AttributeOperation){0x10, 0x0400, false, false, false}; return true;
    case 0x24: *operation = (AttributeOperation){0x10, 0x0080, true, false, false}; return true;
    case 0x26: *operation = (AttributeOperation){0x10, 0x0080, false, false, false}; return true;
    case 0x28: *operation = (AttributeOperation){0x12, 0xC000, true, false, false}; return true;
    case 0x2A: *operation = (AttributeOperation){0x12, 0xC000, false, false, false}; return true;
    case 0x2C: *operation = (AttributeOperation){0x14, 0x0020, true, false, false}; return true;
    case 0x2E: *operation = (AttributeOperation){0x14, 0x0020, false, false, false}; return true;
    case 0x30: *operation = (AttributeOperation){0x14, 0x0040, true, false, false}; return true;
    case 0x32: *operation = (AttributeOperation){0x14, 0x0040, false, false, false}; return true;
    case 0x34: *operation = (AttributeOperation){0x14, 0x0800, true, false, false}; return true;
    case 0x36: *operation = (AttributeOperation){0x14, 0x0800, false, false, false}; return true;
    default: return false;
    }
}

ScriptHandlerResult script_op_a9_attribute_bit(void) {
    EntityAddress entity = script_eval_entity_expression();
    uint16_t selector = script_eval_expression();

    if (selector <= 0x000E && (selector & 1) == 0) {
        entity_write_word(entity, 0x0022, selector);
        return SCRIPT_HANDLER_CONTINUES;
    }

    AttributeOperation operation;
    if (!attribute_operation(selector, &operation)) {
        return SCRIPT_HANDLER_UNMODELED_DISPATCH;
    }

    uint16_t field_value = entity_read_word(entity, operation.field_offset);
    field_value = operation.set_bits
        ? (uint16_t)(field_value | operation.mask)
        : (uint16_t)(field_value & (uint16_t)~operation.mask);
    entity_write_word(entity, operation.field_offset, field_value);

    if (operation.clear_pending_damage) {
        entity_write_word(entity, 0x0076, 0);
    }
    if (operation.clear_status_bits) {
        uint16_t status = entity_read_word(entity, 0x0012);
        entity_write_word(entity, 0x0012, (uint16_t)(status & (uint16_t)~0x0478));
    }

    return SCRIPT_HANDLER_CONTINUES;
}
