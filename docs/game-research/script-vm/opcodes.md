# Script opcodes

All 256 opcode bytes, read from the handlers (`$8C:D0A6` doubles the byte and calls `JSR ($E8BD,x)`).
This page is the overview; the facts live in one place each:

| What | Where |
|---|---|
| one entry per opcode byte (all 256): what it does, why it exists, groups, Everscript names, evidence | `src/games/evermore/localizations/knowledge/opcodes/<xx>.md` |
| what each handler does, with its addresses | `src/games/evermore/localizations/knowledge/rom/<handler>.md` |
| operands, flow and the script viewer's name | `src/games/evermore/script-vm/spec.ts` |
| the table of all 256, usage counts, examples, shared handlers | `soe://rom/assets/scripts/opcodes/index.md` (and `<xx>.md`, `index.json`) |
| the groups | `soe://tags/opcode.<group>` (generated from the entries' `tags:`) |

Usage counts are computed from the user's ROM (static walk from the script tables), never stored.
Operand tokens and flow words: [README.md](README.md).

## The 256 bytes

| Kind | Count | Bytes |
|---|---:|---|
| handled and used by the original scripts | 136 | the rest of `0x00`-`0xC2` |
| handled, never used | 32 | `12 15 16 21 23 31 32 38 39 45 46 48-4B 4C 4D 5E-61 64-66 68-6A 7B 8A 90 B1 B7` |
| no handler: `STP` (the CPU stops) | 27 | `01-03 06 0F 13 1F 24 25 28 2F 34-37 3E 40 41 4F 53 56 57 67 6B 72 8B B8` |
| past the table: the "handler" is a code byte pair of `$8C:EA43` | 61 | `C3`-`FF` |

`0x06`, `0x24`, `0x25`, `0x28`, `0x41`, `0x40`, `0x3E` each point at their own `STP` byte
(`$8C:E8B5`-`$E8BB`), the other 20 share `$E8BC`: removed handlers whose labels were kept (guess).
The 16 zero bytes after `0x4D` (`$8C:D880`-`$D88F`) and the unreachable copy of the `0x5C` handler at
`$8C:DE67` are more traces of removed opcodes.

## Groups

`soe://tags/opcode.<group>`; an opcode can be in more than one.

| Group | Opcodes |
|---|---|
| `flow` | end, jumps, branches, reset: `00 04 05 08 09 0A 0B 8E 8F AB` |
| `wait` | `2E 38 39 3A 3B A7 A8 5B 64-6A 79` |
| `call` | `07 29 A3-A6 AF-B4` |
| `variable` | save / temp / argument writes: `0C-0E 10-12 14-1E AD AE 7A 7B 23` |
| `spawn` | `3C A2 BA C2 9B 9C` |
| `actor_control` | freeze, event scripts, character switch: `2A-2D BC-C1 98 4E 3D 3F` |
| `movement` | teleports and walks: `20 42 43 96 B9 6C-6F 73 9D` |
| `facing` | `70 71 74-77` |
| `animation` | `78 79 A9` |
| `combat` | `92-95 BB AA 9E AC B5 A9` |
| `map` | `21 22 5C-62` |
| `text` | `44-4B 50-55 5A 5B 64-6A 80 81 9A` (`64-6A`: speaker figures) |
| `screen` | `26 27 90 91 82 83 97 8D 99 B6 B7` (`B6 B7`: palette cycles) |
| `audio` | `30-33 58 59 86 87` |
| `money` | `0A 0B 8E 8F 7C-7E 84 85 88-8A 9F-A1` |
| `menu` | `63 7F 8C 8A` |
| `filler`, `duplicate`, `unused`, `invalid` | as named |

## Duplicates

Several bytes reach the same handler. `0x10/0x14`, `0x11/0x15`, `0x12/0x16`, `0x18/0x1C`, `0x19/0x1D`
and `0x1A/0x1E` differ only in bit 2, like the signed/unsigned pairs of the expression reads (sub-ops
`$06/$07`, `$08/$09`): when storing, the sign makes no difference, so both got one handler. `0x30`-`0x32`,
`0x38/0x3A`, `0x39/0x3B`, `0x44`-`0x47` and `0x48`-`0x4B` look like variants whose difference was dropped.
The reasons are a guess; that the bytes are interchangeable is not — except `0x47`: the `0x44` handler
compares its own opcode and gives `0x47` the fixed, transparent, centred style (Everscript
`MESSAGE_BOX_TYPE.TRANSPARENT_CENTERED`). Short forms are not duplicates: `0xBC`-`0xC1` enter the
`0x2C`/`0x2D` handlers with a preset mask, `0x3D` is `0x3F` with the talk mask, `0xBA`/`0xC2`/`0xA2`
are forms of `0x3C`.

## Operands that break a valid opcode

| Opcode | Garbage when |
|---|---|
| `0x78`, `0x79` | the mode is odd or above 10: `JMP ($E100,x)` runs past the 6-entry table |
| `0xA9` | the selector is odd or `$38`+: past the table at `$8C:E6F8` |
| `0x9A` | the font index is above 2 |
| `0x7F` | the index is not 0 or 3 |
| `0x9E`, `0xAC` | no free spell slot: the rest of the operands is read from the wrong place |
| `0x7A`, `0x7B` | no bounds check: any `$7E` address |
| `0x23` | always useless: nothing reads `$0E6E` |

## Names

The script viewer prints the names in `spec.ts`. Rule: the Everscript name when it says what the
handler does, ours when it does not, or when one Everscript wrapper covers several opcodes. Where they
differ, the entry's `everscript:` lists the Everscript spelling.

| Opcode | Viewer | Everscript | Why ours |
|---|---|---|---|
| `0x3C`, `0xBA`, `0xA2` | `spawn`, `spawn_at` | `add_enemy` | also places NPCs |
| `0x20` | `teleport_party` | `teleport` | moves Boy and Dog; `teleport` is `0x43` |
| `0x21` | `restart_room_at` | — | it re-runs the enter script |
| `0x6C`-`0x6F`, `0x73`, `0x9D` | `walk_*` | `walk` | `_direct` = through `$8F:AAD3` (no terrain); `0x9D` was `teleport` |
| `0x3D` | `attach_talk_script` | `attach_script` | fixed mask `$0040` |
| `0x58`, `0x59` | `music_fade_in/out` | `music_fade` | was `fade_in_screen` / `fade_out_screen` |
| `0x0A`, `0x0B`, `0x8E`, `0x8F` | `jump_if_currency_*` | `if_currency` | printed `if (currency[n] >= x) goto` |
| `0x9E` / `0xAC` | `cast_all` / `cast` | `cast` (= `0xAC`) | `0xAC` leaves out a dead Dog |
| `0x92`, `0x93`, `0xBB` | `damage`, `damage_no_reaction`, `damage_no_knockback` | `damage` | three handlers |
| `0x99` | `mode7_scene` | — | runs `$80:BC00` (BGMODE 7) |
| `0x64`-`0x6A` | `show/reshow/hide_left/right_speaker` | — | speaker figures at the bottom left/right (`$0B73`/`$0B75`) |
| `0x87` | `music_tempo` | — | driver command `$2A` = SPC timer 1 |
| `0xB6`, `0xB7` | `palette_cycle`, `palette_cycle_stop` | `tile_flashing` | rotates a palette's colours (`$90:D50F`) |
| `0x7F` | `name_entry` | — | |
| `0x8C` | `save_menu` | `save` | |
| `0x0E`, `0x12`, `0x1A`, `0xAE` | `*_arg_*` | `arg[n]` | was `*_local_*`; the printer already says `arg` |

## Corrections in v0.320.0

Read again from the handlers: `0x7E` exchanges money (was "palette transfer"); `0x58`/`0x59` fade the
music volume (was "screen fade"); `0x6E`, `0x6F`, `0x73` walk through `$8F:AAD3` (was "only stage
coordinates"); `0x8D` with 0 stops the shake (was "does nothing"); `0x92` with `$23D5` set runs as `0xBB`
(was "skips"). Newly described: `0x2C`/`0x2D` masks, `0x3D`/`0x3F` event scripts (`+$66`/`+$68`), `0x42`/`0x43`
(`$23DB`), `0x47`, `0x63`, `0x78`/`0x79`, `0x7F`, `0x8C`, `0x8E`/`0x8F`, `0x99`, `0x9A`, `0x9E`/`0xAC`,
`0xA9`, `0xAA`, the 27 `STP` bytes and `0xC3`-`0xFF`. v0.320.1: `0x64`-`0x6A` show and hide the speaker figures (were "wait for dialogue"), `0x87` is the music tempo (checked in the SPC700 interpreter), `0xB6`/`0xB7` cycle palette colours (`$90:D50F` was "reserve extra graphics").
