# Everscript & entity formats

What the decoder in [`src/script/`](../../src/script/README.md) and the
sprite/character code in [`src/maps/`](../../src/maps/README.md) know about
the ROM, and how each fact was established.

Every page here follows the same rule: **a claim is either measured against a
reference, read out of the encoder, or traced — and if it is none of those it
says so.** Where something is unknown, the page records the readings already
ruled out, so the next attempt starts further along.

| Page | Topic | Status |
|---|---|---|
| **[entities-reference.md](entities-reference.md)** | **Start here** for anything on a map that moves: the character record, placement, sprites, palettes and depth, bodies, attacks, damage, animation, entity WRAM fields | Index |
| [operand_grammar.md](operand_grammar.md) | The postfix expression grammar operands are written in | Solved |
| [instruction_set.md](instruction_set.md) | Opcodes, sizes, summaries, and what stops a walk | Solved |
| [loot.md](loot.md) | What a pickup gives, and writing it back as Everscript | Solved |
| [map_transitions.md](map_transitions.md) | Doors: where a trigger sends the player | Solved |
| [enemy_spawns.md](enemy_spawns.md) | Which NPCs a script places, and where | Solved |
| [character_table.md](character_table.md) | Stats, palette and animation pointers per character | Solved |
| [animation_format.md](animation_format.md) | Character → idle sprite and its frames | Solved |
| [sprite_format.md](sprite_format.md) | Sprite blocks, chunks and their compression | Solved |
| [sprite_priority.md](sprite_priority.md) | Which characters the scenery is drawn over | Solved |
| [hitboxes.md](hitboxes.md) | How big a character's body is, and what blocks a move | Solved |
| [attack_boxes.md](attack_boxes.md) | What a swing sweeps, and what it can land on | Solved |
| [palettes.md](palettes.md) | How many enemies fit in a room before their colours glitch | Solved |
| [arrivals.md](arrivals.md) | The doors that lead *into* a room | Solved |
| [../room-simulation.md](../room-simulation.md) | Deciding which branch an enter script takes | **Not built** — see [/simulation](../../simulation/README.md) |
| [../ingredient-icons.md](../ingredient-icons.md) | Where the menu's item icons live | **Unsolved** |

## Two lessons that keep repaying

**Read the encoder before tracing.** This repo sits between an encoder
(`everscript`) and a decoder (`SoEScriptDumper`). Twice a question that
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
