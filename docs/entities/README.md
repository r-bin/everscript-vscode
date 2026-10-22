# Entity formats

What the sprite/character code in [`src/games/evermore/maps/`](../../src/games/evermore/maps/README.md)
knows about everything on a map that moves, and how each fact was established. Event scripts (the
interpreter, opcodes, loot, doors, spawns, triggers) are in [../scripts/](../scripts/README.md).

Every page here follows the same rule: **a claim is either measured against a
reference, read out of the encoder, or traced — and if it is none of those it
says so.** Where something is unknown, the page records the readings already
ruled out, so the next attempt starts further along.

| Page | Topic | Status |
|---|---|---|
| **[entities-reference.md](entities-reference.md)** | **Start here** for anything on a map that moves: the character record, placement, sprites, palettes and depth, bodies, attacks, damage, animation, entity WRAM fields | Index |
| [character_table.md](character_table.md) | Stats, palette and animation pointers per character | Solved |
| [enemy_ai.md](enemy_ai.md) | How enemy AI identifies targets, state transitions, attack selection, behaviour table | Solved |
| [runtime_stats.md](runtime_stats.md) | Which record stats a script can change at runtime, and how | Mostly derived |
| [animation_format.md](animation_format.md) | Character → idle sprite and its frames | Solved |
| [animation_script.md](animation_script.md) | The animation bytecode language: machine, every opcode, a notation, decoded scripts | Mostly decoded |
| [sprite_format.md](sprite_format.md) | Sprite blocks, chunks and their compression | Solved |
| [sprite_priority.md](sprite_priority.md) | Which characters the scenery is drawn over | Solved |
| [hitboxes.md](hitboxes.md) | How big a character's body is, and what blocks a move | Solved |
| [attack_boxes.md](attack_boxes.md) | What a swing sweeps, and what it can land on | Solved |
| [combat.md](combat.md) | A fight in time: ticks, charge, when enemies attack, one roll per swing, damage and knockback rolls; checked in the game | Traced, one fight checked |
| [palettes.md](palettes.md) | How many enemies fit in a room before their colours glitch | Solved |
| [../item-icons.md](../item-icons.md) | Where the menu's item icons live | Solved |

## Two lessons that keep repaying

**Read the encoder before tracing.** This repo sits between an encoder
(`everscript`) and the game's own interpreter. Twice a question that
looked like it needed a Mesen trace was answered outright by the side that
*writes* the bytes: `add_enemy` defined the spawn opcodes' operand layout and
the `ENEMY` enum, and `loot()` defined what `$2461` means before and after a
call. Check there first.

**A trace answers what the encoder cannot.** The animation format is engine
behaviour with no encoder counterpart, and only a trace could give it.
[animation_format.md](animation_format.md) shows the three instructions that
settled it after five wrong guesses.

**When a trace runs out, read the handler.** A trace only covers what
happened to run. The last animation opcodes appear in none of them, and
disassembling their handlers gave the same kind of answer — each one advances
the script pointer in plain sight, and the one opcode that *was* also traced
agreed with its handler. The rule stays the same: derive it or leave it
unknown, never guess a width.
