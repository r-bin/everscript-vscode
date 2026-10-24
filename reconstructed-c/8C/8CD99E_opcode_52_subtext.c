/*
 * Routine: $8C:D99E (opcode 0x52)
 * Source: docs/disassembly/script-vm/opcode-52-subtext.md
 */

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    uint16_t offset;
    uint8_t bank;
} FarPointer;

typedef struct {
    uint16_t text_buf_cursor;
    uint8_t wram_bank7f[65536];
} TextEngineState;

extern uint16_t g_cutscene_flags;
extern uint16_t g_message_state_23d3;
extern TextEngineState g_text_engine_state;

extern uint16_t script_fetch_u16(void);
extern void cutscene_dialogue_queue_reset(void);
extern FarPointer string_resolve_and_decompress(TextEngineState *state, uint16_t string_key);
extern void cutscene_script_enqueue(uint32_t script_address);

bool script_op_52_subtext(void) {
    if (g_message_state_23d3 == 0 && (g_cutscene_flags & 0x8000) == 0) {
        cutscene_dialogue_queue_reset();
    }

    uint16_t string_key = script_fetch_u16();
    FarPointer text = string_resolve_and_decompress(&g_text_engine_state, string_key);
    uint32_t text_address = ((uint32_t)text.bank << 16) | text.offset;
    cutscene_script_enqueue(text_address);
    return true;
}