# `soe://tags/`: open items

> Status: **plan, nothing built.** Spec: [soe-tags-spec.md](../soe-tags-spec.md).
> Findings below were read from the `everscript` sources on 2026-10-09.

## Now: `tags.json` in the plugin

1. **Write `src/resources/tags/tags.json`** (spec §5.1): `character`, `player`, `boy`,
   `dog`, `enemy` with precompiled sub-tag links. Start from the sums in spec §1
   (`$4EB3`, `$4F1D`, `$0A35`–`$0A55`, dog `$0A70`/`$4F37` bases), each with its
   `source` text. Keep the script or notes that computed them out of the plugin's
   runtime.
2. **Loader checks:** unknown parent, inheritance cycle, a sub-tag link that does not
   resolve under `soe://`. All are load errors, shown by `Everscript: Check soe:// Resources`.

## Later: tags from `core.evs`

Only once `core.evs` ships inside the compiler, so the plugin reads the enums
statically from the compiler version it bundles, without depending on an `everscript`
checkout or its version (spec §5.4). Then the precompiled links in `tags.json` could be
generated instead of written by hand:

- `@tag` / `@tag_parent` / `@layout` annotations on enums and entries. Today
  annotations only attach to functions (`compiler/parser.py`), and unknown names raise
  `invalid annotation`. They must not change compiled output.
- `ATTRIBUTE` (scope `character`, `// BOY/DOG SPECIFIC` part = `player`, `_BOY`/`_DOG`
  bases), `ATTRIBUTE_GENERAL` (scope `player`, `POINTER_BOY`/`POINTER_DOG` bases),
  `CHARACTER_ADDRESS` (`ENTITY_*` = `enemy`).

## Design checks

3. **Tag graph.** `character → player → boy/dog`, `character → enemy`. Check that the
   `ATTRIBUTE` section above `// BOY/DOG SPECIFIC` (`0x00`–`0x8c`) really applies to
   enemies too, and that `0x8e`–`0xac` (`POINTER_STATUS_BAR_INFO` … `PIXIE_DUST`) is
   player-only. A few enemy records in the emulator are enough to tell.
4. **The `// weird` section of `ATTRIBUTE`** (`PALETTE_BLACK_GREEN = 0x00`,
   `INVISIBLE = 0x05`, …) reuses offsets with a different meaning (values that cause
   glitches). Those entries should not become `character.*` tags; possibly
   a `glitch` tag, or none.
5. **Duplicate names in one enum** (`UNKNOWN = 0x10`, `0x12`, `0x32`, `0x86`, `0x8c`).
   Tag ids must be unique: use the offset (`character.unknown_32`) or leave them out.

## Data to verify in the emulator

6. **`$0A37` (wiki: `BOY_CURRENT_HP`).** It fits no enum (`POINTER_BOY 0x0a26 + 0x11`
   is not an `ATTRIBUTE_GENERAL` entry). Current HP is `$4EB3`. Take damage and watch
   both addresses (`soe://ram/0a37.json`, `soe://ram/4eb3.json`).
7. **Charge rate.** `ATTRIBUTE_GENERAL.CHARGE_RATE = 0x2f` gives `$0A55`. Data Crystals
   gives `7E0A54–7E0A55`. Find out whether it is a byte at `0x2f` or a word at `0x2e`.
8. **`ATTRIBUTE.MAX_HP = 0x0f` vs `ATTRIBUTE_GENERAL.MAX_HP = 0x0f`.** Same offset in
    two layouts (`$4E98` entity record, `$0A35` stats block). Check whether one is a
    copy of the other and which one the game writes first.

## Wiki corrections (`everscript/wiki/ram/Ram-Map.md`)

Found while writing the spec; the enums contradict these rows:

| Row | Wiki | Enum says |
|---|---|---|
| `0x0a3f` | `BOY_MAGIC_DEFENSE` | `POINTER_BOY + ATTACK (0x19)`: attack |
| `0x0a43` | `BOY_MAGIC_ATTACK` | `POINTER_BOY + MAGIC_DEFENSE (0x1d)`: magic defense |
| `0x0a37` | `BOY_CURRENT_HP` | no entry (item 6) |

Fix them once tags exist: a tag page shows the conflict, so the fix can be checked
against it.
