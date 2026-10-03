---
name: animation-script
description: The animation bytecode language in Secret of Evermore — the per-entity interpreter at $9080D0, the frame-end bit, holds as checkpoints, every opcode and its width, the record table at $C43E3A (783 animations) and the global animate() id table at $C43C92. Read before changing src/maps/animation-opcodes.ts, animation-vm.ts, character-animation.ts, src/sprites/animation-*.js, or anything that walks, runs, lists, names or renders an animation script.
applyTo: "src/maps/animation-*.ts,src/maps/character-animation.ts,src/sprites/**,docs/script-format/animation_*.md"
---

# Animation scripts: rules

The language, with every handler address and the evidence for each width, is
`docs/script-format/animation_script.md`. How idle frames feed the room view is
`docs/script-format/animation_format.md`. This skill is what a change must not get
wrong.

## 1. Where things are

| What | Where | Code |
|---|---|---|
| Opcode widths, mnemonics, disassembler | the one table | `src/maps/animation-opcodes.ts` (`opcode()`) |
| Tick-accurate interpreter, record table, id table | | `src/maps/animation-vm.ts` |
| Linear idle walk (room view) | | `src/maps/character-animation.ts` |
| Catalogue of every animation + owners | | `src/sprites/animation-catalog.js` |
| Render + script listing for the Sprites tab | | `src/sprites/animation-decoder.js` |
| Projectile records, straight-line velocity | `$900000 + id` | `src/maps/projectiles.ts` |
| Projectile spawns + their animations for the tab | | `src/sprites/projectile-render.js` |

**Widths live only in `animation-opcodes.ts`.** Never add a width table anywhere
else; the linear walker reads `opcode()` too.

## 2. The ROM's own lists — use these, never name-matching

- **Records**: `$C40000 + record`, 4 bytes `[low:u16][bank:u8][flags:u8]`, from
  `$C43E3A` to `$C45999`. Flags bit 7 → a group of 8 facing records, bit 6 → 4,
  else 1. That gives **783 animations / 1752 records**, and every character field,
  weapon field and id lands on a group head.
- **Global ids** (`animate(entity, mode, id)`, `id < 0x8000`): record =
  `$C43C92 + id` (`$8CE13C`). 212 entries. `id >= 0x8000` means the character's own
  field `+0x32 + (id & 0x7FFF)`.
- **Projectiles**: `0x4C` throws record `$900000 + id` (24 bytes, `$90D9A6`..`$90DB86`):
  `+0x00` animation record, `+0x02` palette (`0` = thrower's), `+0x08` routine, `+0x0E`
  speed (1/16 px/tick), `+0x16` power (`0` = thrower's). Only routines 2 and 4 fly
  straight (`$90DD88` direction table); never animate the others as if they did.
- **Boy palette = equipped weapon's `+0x04`**, from the data, not a traced reader. His
  own `+0x09` palette leaves slots 12–13 placeholder green; don't render weapons or
  their projectiles in it.
- **`$910000` is font graphics, not an animation table.** Anything resolved through
  it is a coincidence (it once "found" a 22-frame `MAGMAR_ENTER` that belonged to
  another record). Do not reintroduce it.

## 3. The machine — what a decoder must model

- Bit 7 of a command byte = **end of frame**, not part of the opcode
  (`(cmd & 0x7F)` dispatch).
- A **hold** loads the frame timer *and saves the resume pointer after itself*.
  Later ticks of that frame re-run only the commands between the hold and the frame
  end. So `step` after a hold moves every tick, and a `strike` *before* the hold is
  live for **one tick only**. A linear walk gets both wrong; the interpreter gets
  them right.
- With no hold in a frame, the frame lasts one tick.
- `loop` (`0x2D`) ends a cycle. A one-shot ends on `end_check!` and the entity is
  retired. Bytes after it are not commands.
- Variables are byte offsets into the entity's own slot (`$7E` and `$09` are the usual
  scratch). `dec_jnz` (`0x39`) / `jump_pos` (`0x3A`) / `jump` (`0x3B`) /
  `jump_if_linked` (`0x54`) all jump to a u16 in the script's own bank.

- **Motion** (`runAnimation(rom, script, facing)`): `step n` moves `(n + f) >> 2` px
  with `f` dithering 0, 3, 1, 2 (`$0F36`), so n/4 px per tick on average, along
  `$8FAF18`. Height `+0x1E` is in **1/16 px**; gravity at `$8FAFF5` is
  `h += v - 1; v -= 1`, landing at ≤ 0. `wait_landed` holds a frame while airborne.
  Height and z-speed belong in loop detection, position does not. Don't wrap-merge a
  run that moves.

## 4. Never guess

- A width comes from a trace or from reading the handler's `$5D` advances on every
  path. If neither exists, the opcode stays out of the table and walks stop there
  with `stoppedAt`. `0x57` is genuinely variable-length and stays unknown.
- The real opcode range ends before `0x66`. Table entries past it point into data.
- Names marked unverified in the doc (`sound`, `op_3f`, `op_40`, weapon
  `op_48`–`op_4a`, `op_58`/`op_59`) describe the handler, not a confirmed on-screen
  effect. Don't promote them without a trace.
- Static runs assume the idle case: on screen, not in state `$0100`, no linked
  entity, unset variables read 0, `hold_random` takes the middle of its range.
  Say so wherever a result depends on it.

## 5. Check after any change

`node tests/memory/sprites.test.js` covers the group counts (783/1752/274/21), id
resolution (Magmar `$4DD2`, Dog `ACT3_FALL_2` `$449E`), interpreter vs. linear-walk
parity on idles (≥137/142), the Flowering Death counted loop, the Mosquito
checkpoint step, the disassembly notation, the `$D9D6` spear projectile (tick 16,
29 px ahead, 5 px/tick), and the weapon palette slots.
