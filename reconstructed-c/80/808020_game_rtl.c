/*
 * Routine: $808020 (game_rtl)
 * Bank: $80 (ROM Offset: $008020)
 * Source: SecrefOfEvermoreRecomp docs/game-rtl.md
 */

static const SnesDesktopHostGame kGameHost = {
    .game                = &kGameInfo,
    .after_config        = SoeAfterConfig,   /* everscript glue */
    // ...
};
