/*
 * Routine: $808020 (debugging)
 * Bank: $80 (ROM Offset: $008020)
 * Source: SecrefOfEvermoreRecomp docs/debugging.md
 */

if (g_evs_debug_server_active) {
    uint32_t script_pc = snes_read24(0x82);
    uint16_t slot_ptr = snes_read16(0x7E);
    if (debug_check_breakpoint(script_pc, slot_ptr)) {
        debug_pause_and_await_dap_command();
    }
}
