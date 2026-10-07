# Animation enums → the real animations (design)

Status: design. Not implemented. The related value types are implemented (see the end).

## Goal

Hovering `ANIMATION_PLACEHOLDER.TELEPORT_OUT` (and `ANIMATION_ENEMY.LIZARD_ROLL`, …)
should show the animation itself, not just `= 0x00c8`: a preview frame, who owns it,
and a link that opens it in the Characters → Animations view.

## What the ids are (verified, see `.agents/skills/animation-script/SKILL.md`)

| id | resolves to | needs |
|---|---|---|
| `< 0x8000` (global) | animation record at `$C40000 + word[$C43C92 + id]` (`$8CE13C`), 212 entries | nothing: the id alone names the animation |
| `>= 0x8000` (relative) | the animated character's own field `+0x32 + (id & 0x7FFF)` | **which character** is animated |

- `ANIMATION_PLACEHOLDER.*` are global ids. They draw as character #25 (`$BDB2`).
- `ANIMATION_ENEMY.GORE = 0x8010` is relative: it is a different animation for every enemy.
- The extension already resolves both: `src/sprites/animation-catalog.js` (owners of each
  record, including `animate()` ids via `$C43C92`), `src/sprites/thumbnails.js`
  (`recordRestingSprite`), and `src/maps/animation-vm.ts` (runs a script into frames).

## Proposal

### 1. Global ids: no annotation needed

A hover on an enum member whose value is `< 0x8000` and whose enum is an animation
id enum (the `id:ANIMATION_ALL` parameter of `animate()` declares that: any enum
passed there) resolves the record through `$C43C92` and shows:

- the resting / first frame as an inline PNG (`data:` URI in the hover markdown),
- the record address and frame count, the owners from the animation catalog,
- `Open in Animations` (a command link that selects the record in the Characters tab).

Needs the ROM (`shared/rom-readers`) and the sprites domain from the language hover:
a new dependency `language → sprites` (read-only, pure functions). Cache by ROM
fingerprint + id.

### 2. Relative ids: the character comes from the call or an annotation

- At a call site, `animate(BOY, ONCE, ANIMATION_ENEMY.GORE)` names the character in
  its first argument: resolve `CHARACTER.*` / `ENEMY.*` to the character record and
  read its field.
- On the enum declaration there is no call, so the entry can say which character(s)
  it is meant for, in the comment convention the debugger already reads:

  ```evs
  enum ANIMATION_ENEMY {
      GORE = 0x8010,        // @character ENEMY.LIZARD
      LIZARD_ROLL = 0x007a, // global: needs no tag
  }
  ```

  `@character` may repeat; the hover shows one preview per character. Untagged
  relative ids show "relative to the animated character" and nothing else.

### 3. A doc block instead of a trailing comment?

`///` is a parser token (`DOC_COMMENT`) that only functions accept today; inside an
enum it is a syntax error. Trailing `// @tag` comments need no compiler change and
already work for `@type`. If doc blocks are wanted on enum entries, the parser has to
accept `annotation_list` before `enum_entry` first (compiler change, everscript repo).

## Open questions

- Which enums are animation ids? Proposal: those passed as `animate(..., id)` /
  declared as a parameter type `:ANIMATION_*`; alternatively a `// @animation-ids`
  tag on the `enum` line.
- Should the preview animate (several frames, a GIF-like strip) or stay one frame?
  One frame is cheap; a strip reuses `frame-compose.js`.

## Implemented: value types (v0.169.0)

The debugger shows memory values by enum name: `MEMORY.SELECTED_ALCHEMY_0` →
`ALCHEMY_INDEX.HARD_BALL  0x05 (5)`. The type is

- explicit: `SELECTED_ALCHEMY_0 = (Byte) <0x0ADA>, // @type ALCHEMY_INDEX`, or
- inferred: the enum whose constants the sources assign to or compare with it most
  (`src/debugger/value-types.js`).

The constants come from the compiler (`constants` in `out/source_map.json`).
