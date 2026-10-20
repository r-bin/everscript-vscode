# Kaizo: what the opcode pass (v0.320) offers the hack

What the documentation of all 256 script opcodes ([../scripts/opcodes.md](../scripts/opcodes.md),
`soe://rom/assets/scripts/opcodes/<xx>.md`) means for Kaizo Evermore (`everscript/in/kaizo/`). Kaizo is
built on the core wrappers; its own files emit only raw `0x00`, `0xB5` and `0xA3`. Everything here is
read from the handlers' code, not yet tested in the emulator unless it says so.

Legend: 🟡 open · 💡 idea · 🔴 risk to check

## 1. Opcodes Kaizo does not use yet

| Opcode | What it gives | Everscript today | Task |
|---|---|---|---|
| `0x21` restart_room_at(x, y) | Stops every thread, places Boy and Dog, re-runs the room's enter script, no map load: an instant room reset for a "retry this challenge" mechanic. Unused in vanilla. | no wrapper | 🟡 wrapper + emulator test |
| `0x3F` event mask `$0400` | Starts the entity's event script at once (`$8C:CE4D`); the new thread finds the reason in its slot `+$09` (`$0100` hit, `$0200` death, `$0400` direct). One boss script can handle all three. | `SCRIPT_TRIGGER` lacks `$0400` | 🟡 enum value + a way to read `+$09` |
| `0x3F` with index 1–5 | Room-level hooks `$0EA2`/`$0EAC` instead of an entity (vanilla: `attach_script(4, 0x0001, …)`). Who reads them is not traced. | `UNKNOWN_1/2` | 🟡 trace the readers of `$0EA2`/`$0EAC` |
| `0xA9` selectors `$00`-`$0E` | Facing set directly, **diagonals included** (2, 6, 10, 14); `face()` has four directions. | missing in `ATTRIBUTE_BITS` | 🟡 enum values / `face_diagonal` |
| `0xA9` `$1C/$1E`, `$24/$26`, `$2C`-`$36` | Further entity flag bits (`+$12` `$4000`, `+$10` `$80`, `+$14` `$20`/`$40`/`$800`); meanings untested. | `UNKNOWN_*` | 💡 test each on an enemy: new boss behaviours? |
| `0x6E` / `0x6F` / `0x73` | Walk ignoring terrain (`$8F:AAD3`): bosses crossing pits, walls, levels. About 1,400 vanilla uses. | no wrapper | 🟡 `walk_direct` wrappers |
| `0xB9` teleport_relative | Moves only if the spot is free; `$23E3` = 1 moved / nothing to do, 0 blocked. | wrapper, result unused | 💡 knockback and push puzzles that test `$23E3` |
| One-shot `$23DB` | Next `teleport` (`0x43`) lands on that layer. | — | 💡 multi-level arenas |
| One-shot `$23D9` | Next `animate` (`0x78`) plays on a dead enemy. | — | 💡 custom death animations |
| One-shot `$23D7` | Next `damage` (`0x92`) goes through `$8F:C06D` first (not traced; defence?). | — | 🟡 trace `$8F:C06D` |
| `0x87` music_tempo | SPC timer 1 divider: default `$A0`, larger = slower (confirmed in the SPC700 interpreter). | **no wrapper** | 🟡 wrapper; 💡 faster music at low boss HP / timed rooms |
| `0x64`-`0x6A` speaker figures | Show/hide an entity's figure at the bottom left/right during subtitles. Unused in vanilla: may be unpolished. | no wrapper | 🟡 emulator test, then wrappers |
| `0xB7` | Stops a palette cycle (`tile_flashing`, `0xB6`). | no wrapper | 🟡 `tile_flashing_stop` |
| `0x5F`-`0x61` | Add to / step a map object's state. | no wrapper | 💡 multi-step objects without branches |

## 2. Free opcode numbers for custom opcodes (ASM patch)

The table at `$8C:E8BD` holds one 2-byte handler pointer per opcode. Pointing one at a routine in
free space gives Kaizo a native opcode (a damage formula, "all enemies dead?", a loop that lags as a
script).

- **27 STP opcodes** nothing can use: `01-03 06 0F 13 1F 24 25 28 2F 34-37 3E 40 41 4F 53 56 57 67 6B 72 8B B8`.
- **About 14 unused by vanilla**: the second forms `15 16 31 32 38 39 45 46 49-4B`, plus `23` (dead write)
  and `4C`. 🔴 Check that no Everscript wrapper emits them before taking one.
- `0xC3`-`0xFF` are **not** usable without moving the table first (their entries are the code of `$8C:EA43`).

Tasks: 🟡 an `opcode_table.asm` patch helper (repoint entry `n`); 🟡 teach the plugin's decoder
(`script-vm/spec.ts`) about custom opcodes so the viewer and `soe://` decode patched ROMs.

## 3. Traps for a hard hack

- 🔴 `cast` (`0xAC`/`0x9E`) without a free spell slot reads its operands from the wrong place and the script
  derails. Check boss rooms that cast heavily.
- 🔴 Computed operands that jump into random code: `animate` mode odd or > 10, `attribute_bit` selector
  odd or ≥ `$38`, `font` > 2, `0x7F` index not 0 or 3. Keep them even and in range.
- 🔴 `sleep(0)` does not yield: a `while` loop whose computed sleep reaches 0 freezes the game.
- 🔴 `currency_take` (`0x7D`/`0x85`) has no underflow check: money wraps unless the script checks first.
- 🔴 `0x7A`/`0x7B` write anywhere in `$7E` with no bounds check.

## Suggested order

1. Wrappers in `everscript/in/core`: `restart_room_at`, `music_tempo`, `walk_direct`, diagonal facing,
   `tile_flashing_stop`.
2. Emulator tests: `0x21`, `0x64`-`0x6A`, the unknown `0xA9` bits.
3. Audit Kaizo's boss scripts for the traps in §3.
4. The custom-opcode patch helper (§2).
