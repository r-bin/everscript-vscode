// The names explode gives the 21 projectile records (docs/open-evermore/resources.md §projectiles), by what throws
// them: the animation that throws it (opcode 0x4C, animations/) or the scripts that launch it (opcode 0xB5).
// No imports, so every codec that names a projectile (projectiles, animation-analysis, sprite-palettes) can use it.
//
// Evidence (a fresh explode of the US ROM, v0.470.0):
//   0  tiny/juggle                  8  magmar/attack_2 (same animation as 7, faster)
//   1  boy/stick_throwing           9-12 Vigor in the colosseum: scripts/rooms/antiqua_nobilia_colosseum_arena_vigor_fight
//   2  boy/spear_attack_2                enter_sub_6 picks 2·id = 18, 20, 22 or 24 at random (temp[21])
//   3  boy/<ammo>_attack_1 (all three ammo)  13 cutscene scripts (Podunk, the professor's lab, Thraxx, Aegis, the final
//   4  salabog/attack_2                       boss): no animation of its own setup, a trail behaviour
//   5  vigor/attack_0 (aimed)        14 the final boss's scripts: no animation, strikes its target (damage_without_roll)
//   6  vigor/attack_1 (the boomerang: setup 6, behaviour orbit, docs/entities/animation_script.md §Projectiles)
//   7  magmar/attack_1               15 the final boss's scripts: the Bazooka shell's animation dropped from z 320
// The five records no id reaches, in address order ($D9EE, $DB0E, $DB26, $DB56, $DB6E):
//   boy/spear_attack_3 (piercing), dog/act4_attack_0, dog/act4_attack_2 and _3, gate_bot/attack_0, guard_bot_intro/attack_0.

/** By id, the 16 the script table `$90:D986` lists. */
export const PROJECTILE_NAMES: readonly string[] = [
    'tiny_juggle', 'boy_thrown_stick', 'spear_streak', 'bazooka_shell', 'salabog_shot', 'vigor_aimed_shot', 'vigor_boomerang',
    'magmar_lob', 'magmar_fast_lob', 'vigor_arena_throw_1', 'vigor_arena_throw_2', 'vigor_arena_throw_3', 'vigor_arena_throw_4',
    'cutscene_trail', 'script_strike', 'falling_shell',
];
/** The records only animations throw, in address order. */
export const ANIM_PROJECTILE_NAMES: readonly string[] = [
    'spear_piercing_streak', 'dog_act4_attack_0_shot', 'dog_act4_attack_2_shot', 'gate_bot_shot', 'guard_bot_shot',
];

export const projectileDefaultName = (id: number): string => PROJECTILE_NAMES[id] ?? `projectile_${String(id).padStart(2, '0')}`;
export const animProjectileName = (k: number): string => ANIM_PROJECTILE_NAMES[k] ?? `anim_projectile_${String(k).padStart(2, '0')}`;
