# `soe://tags/`: open items

> Status: **plan, nothing built.** Spec: [soe-tags-spec.md](../soe-tags-spec.md).
> Findings below were read from the `everscript` sources on 2026-10-09.

## Compiler and data

1. **`@tag` on enums and enum entries (`everscript` repo).** Today annotations only
   attach to functions (`compiler/parser.py`: `function : annotation_list function`),
   and any unknown name raises `invalid annotation`. Needed:
   - `enum : annotation_list ENUM IDENTIFIER { … }` and
     `enum_entry : annotation_list IDENTIFIER = expression`
   - `@tag(...)`, `@tag_parent(child, parent)`, `@layout(ENUM)` as no-ops for code
     generation (they must not change the compiled output; diff `out/` before and after)
   - string params: the lexer has `STRING` / `STRING_RAW`; check they are accepted in
     `param_list`
2. **`tools/generate_data.py`.** Collect the three annotations into `index.json` and
   record each enum entry's file and line (today only `name`, `value`, `comment`).
3. **Grammar.** `@tag("hp")` inside an enum body already highlights through the flat
   `#annotation` rule. Add a case to `src/language/tests/highlight.test.evs` and add
   `tag`, `tag_parent`, `layout` to the annotation list used by completion.
4. **First annotated enums:** `ATTRIBUTE` (scope `character`, player-only section
   narrowed to `player`, `_BOY` / `_DOG` as bases), `ATTRIBUTE_GENERAL` (scope `player`,
   `POINTER_BOY` / `POINTER_DOG` as bases), `CHARACTER_ADDRESS` (`ENTITY_*` as `enemy`
   bases), and the `BOY_*` / `DOG_*` entries of `02_ram.evs`.

## Design checks

5. **Tag tree.** `character → player → boy/dog`, `character → enemy`. Check that the
   `ATTRIBUTE` section above `// BOY/DOG SPECIFIC` (`0x00`–`0x8c`) really applies to
   enemies too, and that `0x8e`–`0xac` (`POINTER_STATUS_BAR_INFO` … `PIXIE_DUST`) is
   player-only. A few enemy records in the emulator are enough to tell.
6. **The `// weird` section of `ATTRIBUTE`** (`PALETTE_BLACK_GREEN = 0x00`,
   `INVISIBLE = 0x05`, …) reuses offsets with a different meaning (values that cause
   glitches). Those entries should not become `character.*` tags; possibly
   `@tag("glitch")`, or none.
7. **Duplicate names in one enum** (`UNKNOWN = 0x10`, `0x12`, `0x32`, `0x86`, `0x8c`).
   Tag ids must be unique: use the offset (`character.unknown_32`) or leave them untagged.

## Data to verify in the emulator

8. **`$0A37` (wiki: `BOY_CURRENT_HP`).** It fits no enum (`POINTER_BOY 0x0a26 + 0x11`
   is not an `ATTRIBUTE_GENERAL` entry). Current HP is `$4EB3`. Take damage and watch
   both addresses (`soe://ram/0a37.json`, `soe://ram/4eb3.json`).
9. **Charge rate.** `ATTRIBUTE_GENERAL.CHARGE_RATE = 0x2f` gives `$0A55`. Data Crystals
   gives `7E0A54–7E0A55`. Find out whether it is a byte at `0x2f` or a word at `0x2e`.
10. **`ATTRIBUTE.MAX_HP = 0x0f` vs `ATTRIBUTE_GENERAL.MAX_HP = 0x0f`.** Same offset in
    two layouts (`$4E98` entity record, `$0A35` stats block). Check whether one is a
    copy of the other and which one the game writes first.

## Wiki corrections (`everscript/wiki/ram/Ram-Map.md`)

Found while writing the spec; the enums contradict these rows:

| Row | Wiki | Enum says |
|---|---|---|
| `0x0a3f` | `BOY_MAGIC_DEFENSE` | `POINTER_BOY + ATTACK (0x19)`: attack |
| `0x0a43` | `BOY_MAGIC_ATTACK` | `POINTER_BOY + MAGIC_DEFENSE (0x1d)`: magic defense |
| `0x0a37` | `BOY_CURRENT_HP` | no entry (item 8) |

Fix them once tags exist: a tag page shows the conflict, so the fix can be checked
against it.
