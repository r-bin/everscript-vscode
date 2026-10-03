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
| Render + script listing for the Characters tab (formerly Sprites) | | `src/sprites/animation-decoder.js` |
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

- **Projectile flight** (`projectileFlight`): setup `+0x08` (2/4 straight, `0x16`/`0x18`
  aimed at the target, 6 the boomerang ellipse), per-tick behaviour `+0x0C` (`0x0E` gravity
  until height < 0, `0x12`/`0x1A` lifetime `+0x10`, `0x10` orbit). Projectile damage is
  a **16×16 hit test every tick alive**, not a `strike` command.
- **Hit test** (`src/maps/hit-test.ts`): hurt region = half-size radius **centred on the
  feet**. Heights must satisfy −40 px ≤ target − attack < 30 px. Don't apply `hurtbox`
  (`0x50`) offsets until the Boy's −132/−144 is explained.
- **Dog forms** (`src/sprites/dog-forms.js`): 6 entries via `$CF945F`, palette at
  header +6, 15 slots, named only where an id or the Dog's record names them. The
  Dog's own fields are the Act 1 wolf: draw them in its own palette, not the form's.
- **`0x4B` = `palette $p`** (`$90CD80`, the projectile palette loader): a script that
  loads one is drawn in it (`VmResult.palette`), ahead of any owner or inference. In the
  game it also writes the slot to `+0x75`, the entity's **home** palette slot, so the
  entity keeps those colours after the animation (`runtime_stats.md` § Three palette fields).
  `ANIMATION_PLACEHOLDER` ids belong to character #25 (`$BDB2`).
- **`0x5D` = `effect_done`**: alchemy effects signal their spell; when the next byte is
  another record's script the VM stops there (otherwise it plays that record, e.g. a rocket).
- **Attack level = stamina**: < 100% → `+0x38`, 100% → `+0x3A`, 200% → `+0x3C`, 300% → `+0x3E` (`$9082D8`).
  Power (`$8FC02B`): < 50% ÷4, < 100% ÷2, ×1, 200% ×2, 300% ×4.
- **Diagonal movement** (`$8FAD51` via `$8FAF18`): the full step on x **and** y, no √2.
  Four-pose walks play E's/W's script on diagonals, so NE climbs at E's speed, faster
  than N. Measure speed per facing (all 8), never assume diagonals are cardinals scaled.
- **Attacks round the facing** (`$908343`): a four-pose attack record writes
  `$90815B[facing]` back to `+0x22`, so steps and projectiles go E/W, never diagonal.
  Other animation starts keep the diagonal.

- **Segments**: `0x57` (`2 + 4·groups` bytes, read with `segmentsAt`) lists a body's
  segment sprites; `0x59` (always 7 bytes) places one. Widths of variable commands come
  from `lengthAt(rom, p)`, never from `opcode().length` alone.
- **Mode bit `$20` = invulnerable**. Procs 2 and 6 consume a projectile on hit; 4 pierces.
- A script with no `sprite` keeps the previous one: pass `initialSprite`. A run still
  airborne at `loop` continues; play from `loopFrom`.
- Entries that came from the Gemini pass (`0x48`–`0x4A`, `0x58`, `0x59`, the weapon
  table's "charging stance", the "upward-anchored" hurt box) were wrong. Re-derive any
  opcode or field claim from its handler before trusting it.

- **Segment easing**: `0x59` sets a target; `0x58` (`$8FC905`) eases current toward it
  each tick it runs; draw at current. Head = segment 0, drawn in front. Hurt offset
  follows the head. Segment state belongs in loop detection.
- **Hurt offsets** (`+0x42/+0x44`, set by `hurtbox` and `segment_step`) are applied, except
  for the Boy and Dog.
- **Hit cooldown**: the same attacker re-hits only after 21 ticks (`+0x36/+0x38`).
  Knock-back is not invulnerable.
- Character record fields and their readers: `docs/script-format/character_table.md`.

- **One-shots** (attack, damage, death, cast — record fields from `+0x38` on) pass
  `oneShot`: still airborne at `loop`, they hold their last frame until they land.
- everscript's `03_sprites.evs` names entity and record fields; it agrees on most and is
  one byte off on `CHARGE_RATE`, and wrong on `+0x46` (casting, not running). Check
  the code before trusting either.

- **Contact damage**: mode `& $C000` + a body blocked by another (`bodiesTouch`:
  `2|dy| < r₁+r₂`, `|dx| < r₁+r₂`, |Δh| < `$230`), full stamina, once per charge.
  Knock-back (`$01`) and casting (`$20`) targets are skipped.

- **Facing**: 0 = N, 4 = E, 8 = S, 12 = W, odd steps the diagonals. Not S = 0.
- **Second palette**: chunk OAM palette bits = 1 use record `+0x0B` (Harry, Vigor);
  `composeSprite` reports them per pixel in `palettes`.
- One-shots end at `end_check!`.

## 4. Never guess

- A width comes from a trace or from reading the handler's `$5D` advances on every
  path. If neither exists, the opcode stays out of the table and walks stop there
  with `stoppedAt`. Variable widths (`0x57`) come from `lengthAt`.
- The real opcode range ends at `0x64` (`0x60`–`0x64` are HUD commands). Table entries past it point into data. All 1,752 record scripts complete; a script that stops now is a regression.
- Names marked unverified in the doc (`sound`, `op_3f`, `op_40`, `op_48`–`op_4a`)
  describe the handler, not a confirmed on-screen effect. Don't promote them without
  a trace.
- Static runs assume the idle case: on screen, not in state `$0100`, no linked
  entity, unset variables read 0, `hold_random` takes the middle of its range.
  Say so wherever a result depends on it.

## 5. Characters tab behaviour that encodes these rules

- Attacks play at the rounded facing (`facing`, `facingRounded`); the stage overlay says so.
- The Stamina selector maps to attack levels and shows the power factor.
- Palette precedence: viewer's choice (`paletteForced`) > script `palette` > weapon/form
  of the first owner > character > inferred (shared sprites, neighbouring sprites,
  nearest record). The Dog's own fields keep its Act 1 palette; `ACTn_` ids use form n.
- List previews face south (8) and fall back to the fullest frame when the last is a wisp.
- The script listing (`scriptListing`) attaches `palette` (address + colours) and `projectile`
  (its animation record and palette) to those lines; the Script tab previews them beneath the
  command and explains `mode` bits. Keep that data server-side: the webview has no ROM.

## 6. Check after any change

`node tests/memory/sprites.test.js` covers the group counts (783/1752/274/21), id
resolution (Magmar `$4DD2`, Dog `ACT3_FALL_2` `$449E`), interpreter vs. linear-walk
parity on idles (≥137/142), the Flowering Death counted loop, the Mosquito
checkpoint step, the disassembly notation, the `$D9D6` spear projectile (tick 16,
29 px ahead, 5 px/tick), the weapon palette slots, attack facing rounding, script and
placeholder palettes, Dog form palettes, and `effect_done` endings.
