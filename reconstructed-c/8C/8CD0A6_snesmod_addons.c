/*
 * Routine: $8CD0A6 (snesmod_addons)
 * Bank: $8C (ROM Offset: $0CD0A6)
 * Source: docs/recomp/snesmod-addons.md
 */

#include "mod_runtime.h"

static void enable_two_player(void) {
    // Hook Evermore input dispatcher in WRAM / Game RTL
    g_two_player_enabled = true;
}

static void reset_two_player(void) {
    g_two_player_enabled = false;
}

SNES_MOD_CONSTRUCTOR(register_two_player_plugin) {
    snes_mod_register_reset_callback(reset_two_player);
    snes_mod_register_activation_plugin("soe.twoplayer.native", enable_two_player);
}
