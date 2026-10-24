/*
 * Routine: $8C:DF75 (opcode 0x63)
 * Source: docs/disassembly/script-vm/opcode-63-select-alchemy.md
 */

#include <stdbool.h>
#include <stdint.h>

extern volatile uint16_t wram_0106;
extern volatile uint16_t wram_0b83;
extern volatile uint16_t wram_0f3e;

extern void routine_8ee56a(void);
extern void routine_808fee(void);
extern void wait_for_nmi_frame(void);
extern void routine_8caf23(void);
extern void routine_8cb743(void);
extern void routine_8db7d6(void);
extern void routine_8db98f(void);
extern void routine_8ee08b(void);
extern void routine_9092c7(void);
extern void routine_8cab10(void);
extern void camera_follow_entity(uint16_t entity_id);

bool script_op_63_select_alchemy(void) {
    routine_8ee56a();
    routine_808fee();
    wait_for_nmi_frame();
    routine_8caf23();
    routine_8cb743();
    routine_8db7d6();
    wram_0106 = 0;
    wram_0b83 = 0x800F;
    routine_8db98f();

    routine_8ee56a();
    routine_808fee();
    routine_8caf23();
    routine_8ee08b();
    routine_9092c7();
    wait_for_nmi_frame();
    routine_8cab10();
    camera_follow_entity(wram_0f3e);
    wram_0106 = 0;
    wram_0b83 = 0x800F;
    return true;
}