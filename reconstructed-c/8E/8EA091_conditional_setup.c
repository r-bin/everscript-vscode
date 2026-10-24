/*
 * Routine: $8E:A091 (conditional_setup_hook)
 * Bank: $8E (ROM offset: $0EA091)
 * Source: docs/disassembly/ui/ring-menu-subitems.md
 */

#include <stdint.h>

extern volatile uint16_t g_word_0106; /* $0106 */
extern volatile uint16_t g_word_05A9; /* $05A9 */

extern void routine_8cc543(void);
extern void routine_8ea0b3(void);
extern void routine_8cc55d(void);

void conditional_setup_hook(void) {
    uint16_t state = g_word_0106;

    if ((state & 0x0080u) != 0) {
        return;
    }

    if (((uint16_t)(state - 0x0008u) & 0x8000u) != 0) {
        return;
    }

    if ((g_word_05A9 & 0x0001u) != 0) {
        return;
    }

    routine_8cc543();
    routine_8ea0b3();
    routine_8cc55d();
}