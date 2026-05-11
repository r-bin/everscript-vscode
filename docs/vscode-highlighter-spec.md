# Everscript VS Code Syntax Highlighter — Spec

## Summary

A dedicated VS Code extension for `.evs` (Everscript) files — replacing the current C# workaround.  
Scope name: `source.evs`  
File extension: `.evs`  
Repo: sibling to this one, e.g. `everscript-vscode`

---

## Why not C#?

C# "borderline works" because Everscript shares some surface syntax (curly blocks, `//` comments, string literals). But C# tokenisation breaks on:

- `#memory(…)`, `#include(…)`, `#patch(…)` — treated as C# preprocessor directives (wrong colours, wrong bracket matching)
- `<0x1234>` — angular brackets inside expressions confuse C# generics rules
- `0d99` decimal literals — C# has no `0d` prefix; not highlighted as numbers
- `@install()`, `@inject(…)`, `@async()` — treated as C# attributes (partially OK) but annotation-specific names aren't distinguished
- `enum DIRECTION { … }` with `= <0xaddr>` values — C# expects `int` RHS
- `fun foo(…) { … }` — `fun` is not a C# keyword
- `ENUM_NAME.MEMBER` — partial highlight only, no semantic separation
- `map`, `area`, `group` block keywords — invisible to C#
- `MEMORY.XYZ`, `BOY`, `DOG`, `BOTH`, `NONE` — no special treatment in C#
- `0x1234..0x5678` (memory ranges) — `..` is a range, not a C# null-forgiving expression

---

## Token Categories (what to differentiate)

### 1. Keywords — control flow
```
if  else if  else  while  for  in
if!  else if!  while!  if_currency
```
Colour: classic keyword (e.g. blue / `keyword.control.evs`)

### 2. Keywords — declaration
```
fun  map  area  group  enum  val  var
```
Colour: declaration keyword (e.g. purple / `keyword.declaration.evs`)

### 3. Keywords — type annotations
```
signed  Byte  Word  Memory  Function  Arg  None
```
Colour: type (e.g. teal / `storage.type.evs`)

### 4. Literals — boolean
```
True  False
```
Colour: constant boolean (`constant.language.boolean.evs`)

### 5. Literals — numbers
Two forms must produce **identical** highlighting:

| Form | Example | Meaning |
|------|---------|---------|
| Hex  | `0x1a2b`, `0xFF` | classic hex |
| Decimal | `0d99`, `0d10` | prefixed decimal |

Both get `constant.numeric.evs`. Optional sign prefix (`+`/`-`) included.

### 6. Memory addresses — raw
```
<0x1a2b>            // bare address
<0x1234, 0x40>      // address + bitmask
<0x1234>..<0x1fff>  // memory range
```
These are **not** comparison operators. The angle brackets here delimit a memory dereference. Colour as `variable.other.address.evs` (e.g. orange/amber), distinct from numeric literals.

### 7. Enum member access
```
DIRECTION.NORTH    FLAG.DOG_UNAVAILABLE    MEMORY.BOY_LEVEL
```
Pattern: `UPPER_CASE.UPPER_CASE` or `UPPER_CASE.lower_case`.  
- Namespace part (`DIRECTION`): `entity.name.enum.evs`  
- Member part (`.NORTH`): `variable.other.enummember.evs`

### 8. Annotations / decorators
```
@install()    @install(0x99aac0)    @inject(ADDRESS.DEBUG_MENU_BUTTON_1)
@async()      @weak()               @count_limit(0x20)
```
- `@` sigil: `punctuation.definition.annotation.evs`
- Annotation name: `entity.name.function.decorator.evs`

### 9. Preprocessor directives
```
#memory(…)    #include(…)    #patch(…)
#if …         #endif
```
- Directive keyword: `keyword.preprocessor.evs`

### 10. Built-in / native functions
Functions that are part of the compiler (not defined by user `fun` declarations).  
From `parser.py → native_functions`:
```
eval  goto  code  set  unset  call  reference  deref
dead  alive  rand  randrange  len  rnd  string_key  function_key
entrance  soundtrack  map_transition  retained_object
```
Colour: `support.function.builtin.evs` (e.g. distinct from user-defined calls)

### 11. Core library functions (from `in/core/`)
High-value functions worth highlighting as `support.function.evs`. Key subset:

```
transition  load_map  fade_in  fade_out  sleep  yield  nop
animate  attribute  available  face  teleport  teleport_relative
add_enemy  damage  heal  set  unset  unlock  conversation
question  conversation_question  dialog  text  subtext  debug_subtext
music  music_fade  sound  sfx_effect
attach_script  attach_to_script  entity_script_controlled
wait  find_all  destroy  call_async  call_id
show_hud  show_shop  save
```

(Full list: see `docs/vscode-highlighter-spec.md` § Appendix)

### 12. Special identifiers
Unqualified constants used as function arguments throughout:

```
BOY  DOG  BOTH  NONE  ACTIVE  INACTIVE  LAST_ENTITY
NORTH  SOUTH  EAST  WEST  UNKNOWN
BOY_ENTITY  DOG_ENTITY  SCRIPT_OWNER  SCRIPT_TARGET
```
Colour: `variable.language.evs` — same priority tier as `True`/`False` (language built-ins, not user enum values).

### 13a. Entity references (new in v0.1)
Angle-bracket entity tokens that appear as function arguments:

```
<BOY>  <DOG>  <LAST_ENTITY>  <SCRIPT_OWNER>  <ACTIVE>  <SCRIPT_TARGET>
```
- `<` and `>` brackets: `punctuation.definition.entity-ref.evs`
- Identifier inside: `variable.other.entity-ref.evs`

These are distinct from memory-address `<0x1234>` syntax (no hex digits, no comma/range).

### 13b. Memory accessors (new in v0.1)
Array-style accessors for built-in memory domains:

```
object[0]   arg[1]   script[2]   time[3]
```
- Keyword before `[`: `variable.other.accessor.evs`

### 13. String literals
Two flavours:
- `"…"` — standard string (may contain `[CHOICE]`, `[MEM1]` etc.)  
  Colour: `string.quoted.double.evs`
- `'…'` — raw string  
  Colour: `string.quoted.single.evs`

In-string control codes like `[CHOICE_INLINE]`, `[MEM1]` could get a sub-scope `constant.other.placeholder.evs` for extra visibility (optional).

### 14. Comments
```
// single line
```
Colour: `comment.line.double-slash.evs`

### 15. Operators
Standard: `= == != < > <= >= && || ! ~ + - * / << >> & | ^ .. ++ -- += -= *= /= &= |= <<= >>=`  
Scope: `keyword.operator.evs`

### 16. Block structures
`{ }` `( )` `[ ]` — `punctuation.bracket.evs` with bracket matching enabled.  
`.` in member access — `punctuation.accessor.evs`

### 17. Label destinations
```
LOOP:    START:
```
All-caps identifier followed by `:`. Colour: `entity.name.label.evs`

### 18. User-defined function names
At declaration site: `fun foo_bar(…)` — `foo_bar` → `entity.name.function.evs`  
At call site: `foo_bar(…)` — `entity.name.function.call.evs`

### 19. Map / area / group names
`map brians_room(BRIAN)` — `brians_room` → `entity.name.type.map.evs`

---

## Grammar Strategy

Use a **TextMate grammar** (`.tmLanguage.json`) — compatible with VS Code's standard tokenisation engine and with Semantic Highlighting disabled for performance.

Key ordering rules:
1. Comments must be matched before everything else (greedy `//.*`)
2. `#memory`, `#include`, `#patch` before `#if`/`#endif` (longer prefix first)
3. Memory address `<0x…>` must be matched **before** the `<` comparison operator
4. `ENUM.MEMBER` pattern must be matched before plain identifiers
5. `0d[0-9]+` must be matched before plain decimals (which don't exist in this language anyway)
6. Annotation `@name(…)` before bare `@`

---

## File Structure of the Extension

```
everscript-vscode/
├── package.json              # extension manifest
├── syntaxes/
│   └── everscript.tmLanguage.json
├── language-configuration.json   # bracket matching, comment toggling, auto-close
├── themes/
│   └── everscript-dark.json  # optional curated colour theme
├── CHANGELOG.md
└── README.md
```

---

## language-configuration.json highlights

- Comment toggle: `//`
- Auto-close pairs: `"` `'` `(` `[` `{` `<` (inside address context)
- Surrounding pairs: same
- Brackets for indent: `{ }` `( )`
- `wordPattern`: include `0x`, `0d`, `_` as word chars

---

## Customisation

The grammar uses explicit, granular scope names. Users can override colours in `settings.json`:

```jsonc
"editor.tokenColorCustomizations": {
    "textMateRules": [
        { "scope": "variable.other.address.evs", "settings": { "foreground": "#ff9900" } },
        { "scope": "constant.numeric.evs",        "settings": { "foreground": "#b5cea8" } },
        { "scope": "support.function.evs",         "settings": { "foreground": "#dcdcaa" } }
    ]
}
```

---

## Themes

Two bundled token themes:

| Theme | Description |
|-------|-------------|
| Everscript Dark | Opinionated dark theme mirroring the existing C# colour feel but corrected |
| Everscript Light | (stretch goal) |

Colours follow a semantic palette: addresses amber, numbers green, keywords blue, core functions yellow, enums teal, annotations lilac-italic.

---

## Color Priority Tiers (Everscript Dark theme)

Tokens are assigned to one of nine tiers by semantic importance:

| Priority | Color | Hex | Scopes |
|----------|-------|-----|--------|
| P1 — language keywords | Blue | `#569CD6` | `keyword.control.evs`, `keyword.declaration.evs`, `constant.language.boolean.evs`, `variable.language.evs` (BOY/LAST_ENTITY/NORTH — same as True/False) |
| P2 — types & enum names | Teal | `#4EC9B0` | `storage.type.evs`, `entity.name.enum.evs` |
| P3 — enum members | Light blue | `#9CDCFE` | `variable.other.enummember.evs` |
| P4 — all functions | Yellow | `#DCDCAA` | `support.function.builtin.evs`, `support.function.evs`, `entity.name.function.call.evs` (unified — C#-like) |
| P5 — hardware / ROM access | Amber **bold** for directives | `#FF9900` | `variable.other.address.evs`, `punctuation.definition.address.evs`, `punctuation.definition.entity-ref.evs`, `variable.other.entity-ref.evs`, `variable.other.accessor.evs`, `punctuation.section.accessor.evs`, `punctuation.definition.annotation.evs`, `entity.name.function.decorator.evs` (bold) |
| P6 — build directives | Lilac | `#C586C0` | `keyword.preprocessor.evs` |
| P7 — strings | Orange-brown | `#CE9178` | `string.quoted.double.evs`, `string.quoted.single.evs` |
| P8 — numbers | Light green | `#B5CEA8` | `constant.numeric.hex.evs`, `constant.numeric.decimal.evs`, `constant.numeric.binary.evs` |
| P9 — comments | Grey-green italic | `#6A9955` | `comment.line.double-slash.evs` |

### Key design decisions

**P5 expansion: annotations join the hardware-access tier (v0.1.5)**

`@install` and `@inject` are **ROM linker directives** that determine the physical byte offset where the compiled function is placed in the ROM binary. If the address is wrong the ROM is corrupted. This is fundamentally different from how decorators/annotations work in most languages:

| Language | Annotation/attribute | Typical colour | Semantic role |
|----------|----------------------|----------------|---------------|
| Python `@decorator` | `#DCDCAA` yellow (VS Code Dark+) | Optional metadata; calls a wrapper function |
| Java `@Override` | Muted gold (IntelliJ Darcula) | Informational; checked at compile time |
| C# `[Serializable]` | Grey/default (VS Code) | Informational metadata |
| Rust `#[proc_macro]` | Orange in codegen themes | Transforms token stream |
| C `__attribute__((section("...")))` | Same as address literals (Sourcetrail, many assembler IDEs) | Places symbol at specific memory section |
| **Everscript `@install(0x99aac0)`** | **Amber bold (P5)** | **Specifies the exact ROM byte offset for this function** |

The C `__attribute__((section(...)))` analogy is strongest: both map a symbol to a specific location in the binary's address space. Assembler IDEs consistently colour `.org`, `SECTION`, and section placement pseudo-ops the same as address literals. Everscript follows this convention.

Bold font-style distinguishes the directive keyword (`@install`) from the address value it contains (which is also amber but not bold).

**`<NAME>` entity references: unified amber (v0.1.5)**

Previously `<` and `>` were amber while the identifier inside was teal (P2). The split made `<BOY>` look like a teal word with amber brackets rather than a cohesive construct. Since the whole token is a single entity handle dereference (analogous to pointer syntax), all three parts are now amber — same as address syntax `<0x1234>`.

Cross-language: XML entity refs `&name;` and C++ template params `<T>` often use a consistent single colour for the delimiters and their content when the content is "part of the syntax" rather than an independent identifier.

**`object[n]` / `arg[n]` bracket highlighting (v0.1.5)**

The `[` and `]` around accessor indices are now scoped `punctuation.section.accessor.evs` → amber. Previously only the keyword (`object`, `arg`) was amber while the brackets were white, making the construct look split. Now the full `arg[0]` reads as a single amber unit.

**Functions unified (P4, unchanged)**

No distinction between builtin/core/user-defined at the colour level. Scope names differ for per-user overrides via `settings.json`.

**`variable.other.entity-ref.evs` moved from P2 → P5**

The entity ref identifier (e.g. `BOY` inside `<BOY>`) was previously teal (P2, same as enum namespaces). This was inconsistent: `<BOY>` the construct is hardware access (P5), but the identifier read as a type name (P2). Moved to amber to make the whole `<BOY>` token visually consistent.


## Stretch Goals

- ~~**Hover docs**: LSP or simple token hover showing what a known function/enum does~~ ✅ implemented
- ~~**Snippets**: `fun`, `if`, `map`, `enum` expansion snippets~~ ✅ implemented
- ~~**Go-to-definition**: resolve `reference(foo)` → `fun foo(…)` declaration~~ ✅ implemented
- **Diagnostics**: flag undefined identifiers at parse time (requires Python subprocess)
- **Semantic tokens**: post-tokenisation colouring for user-defined function names vs built-ins

---

## Language Intelligence Features (v0.1.2+)

### Hover Documentation

The hover provider is priority-ordered as follows (first match wins):

1. **Number literal** — `numberAt()` regex `/0[xX][0-9a-fA-F]+|0[dD]\d+|0[bB][01]+/`. Shows hex + decimal + binary + byte size (hex: ceil(digits/2) bytes; decimal/binary: value-based).
2. **Declaration name guard** — if cursor word matches `^(fun|enum|map|area|group|val)\s+WORD`, suppress all hover and return null.
3. **Accessor guard** — if the character immediately after the word is `[`, suppress function/enum hover (word is a memory accessor such as `object`, `arg`, `script`, `time`).
4. **Qualified member** — `ENUM.MEMBER` pattern detected by `enumNameBeforeDot()`. Shows member value + comment; falls back to unqualified member lookup, then specials.
5. **Enum name** — word matches a key in `idx.enums`. Shows full enum block (up to 30 members).
6. **Function name** — word matches a key in `idx.functions`. Shows all signatures + native/core label.
7. **Special identifier** — word matches a key in `idx.specials` (`BOY`, `DOG`, `NORTH`, `True`, etc.).
8. **Unqualified enum member** — word matches `/^[A-Z_][A-Z0-9_]*$/` and appears in the reverse member map. Shows `ENUM.MEMBER = value` for each parent enum; full enum listing shown when there is exactly one parent.

#### Reverse member map

`buildReverseMemberMap(idx)` lazily builds a `Map<memberName, [{enumName, value, comment}]>` from `idx.enums`. Cached after first build. Enables tooltips for bare `SOUTH`, `ACT4_DOOR_OPENING`, etc.

#### Data file

`data/index.json` (generated by `tools/generate_data.py`):
```json
{
  "functions": { "name": ["sig1", "sig2"] },
  "native":    ["name", ...],
  "enums":     { "name": [{"name": "MEMBER", "value": "0x00", "comment": "..."}] },
  "specials":  { "BOY": "description", ... },
  "annotations": ["install", "inject", ...]
}
```

### Completion

Trigger characters: `.` (dot) and `@`.

| Context | Items |
|---------|-------|
| `ENUM.` prefix | All members of that enum (EnumMember kind, with value as detail) |
| `@` prefix | All annotation names as snippets |
| Bare identifier | 521 core+native functions (snippets), workspace functions, 111 enum names |

Function completions are sorted with `~` prefix to push below VS Code builtins. `sigToSnippet(sig)` converts `fun(param:TYPE, ...)` to `fun(${1:param}, ...)$0`.

### Document Symbols / Outline

`provideDocumentSymbols` scans each line for:
- `fun NAME(...)` → `SymbolKind.Function`
- `map NAME(` / `area NAME(` → `SymbolKind.Module`
- `group NAME(` → `SymbolKind.Package`
- `enum NAME {` → `SymbolKind.Enum`
- `val NAME =` → `SymbolKind.Constant`

Results populate the Outline panel and breadcrumb bar.

### Go-to Definition

`provideDefinition` handles two cases:
1. `#include("path")` → resolves relative to the current file's directory → opens the file.
2. Any identifier → looks up `_workspaceIndex` → returns all declaration locations.

### Find All References

`provideReferences` searches all `**/*.evs` files for `\bWORD\b`. Restricted to identifiers containing at least one lowercase letter (avoids noisy results for enum names / constants).

### Workspace Index

`buildWorkspaceIndex()` scans all `**/*.evs` files, extracts `(fun|map|area|group|enum|val)\s+NAME` declarations, and stores them in `_workspaceIndex: Map<name, [{uri, line, kind}]>`. Refreshed on any `.evs` file create/change/delete via `FileSystemWatcher`.

### Dead Branch Dimming

`updateDeadBranchDecorations(editor, idx)` scans each document line for:

```
if(!?) (condition)
```

`isStaticallyDead(condition, negated, idx)` returns true for:
- `condition === 'False'` or `condition === '0'` and `!negated`
- `condition === 'True'` or `condition === '1'` and `negated`
- `ENUM.MEMBER` where `Number(member.value) === 0` (or `!== 0` when negated)

When dead, `findBlockRange(document, line)` counts `{` / `}` pairs (skipping `//` comments) to find the block extent, which is decorated at 35% opacity using `TextEditorDecorationType({ opacity: '0.35' })`.

Decorations are refreshed on:
- `onDidChangeActiveTextEditor`
- `onDidChangeTextDocument`

### Snippets

22 snippets in `snippets/everscript.json`. Trigger prefixes:

`fun`, `map`, `area`, `group`, `enum`, `val`, `var`, `if`, `if!`, `ife`, `while`, `while!`, `for`, `#memory`, `#include`, `@install`, `@inject`, `@async`, `transition`, `sleep`, `conversation`, `add_enemy`

---


## Appendix: Full Core Function List

Below is the complete list extracted from `in/core/` for inclusion in `support.function.evs`:

```
_add_enemy  _add_placeholder  _animate_hole  _destroy  _dialog  _face
act2_axe2_wall  act2_lotus_bridge_1  act4_evermoremachine_in
add_bombable  add_colored_enemy  add_enemy  add_enemy_spawner  add_hole
add_placeholder  add_shop_item  animate  animate_boy  animate_hole
anti_cheese_magic_spam  anti_cheese_mosquito  arg  arg_signed
attach_script  attach_sterling_script  attach_to_script  attribute
attribute_bit  available  await_answer  await_buy_result  await_sell_result
bark  beam_link_absolute  beam_link_entity  beam_wall  bomb_absolute
bomb_entity  bomb_relative  bombable_object  bombable_trigger
bone_whip  bonfire_activate  bonfire_dialog  brightness
calculate_scaled_vector  call_async  call_id  cannonball  cast  cast_team
change_z  character_selection  cheat_menu_armor_chest  cheat_menu_weapon
check_alchemy_type  check_code_konami  check_code_leftright
check_damage_type  check_dog_stairs  check_fake_wall  check_range
check_switch  clear_music_stack  clear_shop  clear_status_effects
clear_subtext  code  color_filter  color_filter_fade_from  color_filter_fade_to
conversation  conversation_dialog  conversation_end  conversation_question
conversation_start  crash_both  crash_land  cure  currency_convert
currency_get  currency_take  cycle_weapon  damage  dash_teleport
debug_boy  debug_dog  debug_entity  debug_marker  debug_memory
debug_status_effects_helper  debug_subtext  debug_tile  debug_z_level
decrement_no_running  decrement_pacified  default_conversation_answer
delayed_fall_damage_deadly  desert_damage  desert_screen  destroy
dialog  dodge_roll  dog_fountain  dog_stairs
door_act4_airlock_in  door_act4_airlock_out  door_act4_beam_in  door_act4_beam_out
drag  drop_bomb  empty_check  enable_subtext  end  entity
entity_script_controlled  error_message  error_walk_back
explode_barrier  explode_boss  explode_last_entity
face  face_each  face_target  fade_in  fade_out  fade_out_black
fade_to_music  fake_b  fake_chest  fake_chest_init  fake_compativeness
fake_loot  fake_loot_gourd  fake_pit_scanner  fake_walls
fall_damage  fanfare_boss  fanfare_end  fanfare_item  fanfare_start
find_all  font  free_camera  free_map  full_heal
generic_crash  generic_crash_through  generic_door  generic_fall
generic_fall_gomi  generic_impact  generic_object_door  generic_pit
generic_switch_floor  generic_tunnel  generic_yeet
guard_alchemy_animation_damage  guard_axe_2  guard_b  guard_bone
guard_boy  guard_critter  guard_dead  guard_dog  guard_false  guard_no_hp
guard_not_flag  guard_spear_2  guard_true  guard_weapon  guard_z
handle_cheat_menu  hatch_enemy  heal  heel  hint  homing_cannonball
hookshot  increment_no_running  increment_pacified  init_map
item_pay  item_to_string  level_up  load_map  loot
mario_fireflower  mario_yump  meteor  modulo  morph  morph_hold  morph_toggle
move_towards  music  music_enter  music_fade  music_volume
nop  object  object_animator  open_message_box
outro_end  outro_start  outro_stats  outro_text_box
play_music  player_control  poise_break  poise_break_decay
pop_music  prepare_transition  price  print_time
projectile  projectile_barage_delayed  projectile_beam  projectile_delayed
puke_shoot  push_music  quantum_jump  question  quick_draw_weapon
range_checker  reboot  replace_enemy  replace_enemy_with_type
reset_alchemy_types  reset_timer  reward  rimsala_gate
ring_shoot  rocket_jump  safe_subtract  sand_tunnel  save  save_dialog
select_alchemy  set_args  set_camera  set_camera_entity
sfx_effect  shell_boat_in  shell_boat_move  shell_boat_out
shoot_entity_absolute  shoot_entity_entity  shoot_entity_relative
shop_buy  shop_sell  show_currency  show_hud  show_shop
single_animation  sleep  small_explosion  smart_animate
smart_conversation  smart_sound  smart_text_box  smart_timer  sound
spaceship_rocket  spear_toss  stack_sprite  sterling_grab  sterling_grab_3d
subtext  swap_characters  swap_enemies
teleport  teleport_relative  teleport_screen
teleporter_animation_in  teleporter_animation_out
teleporter_in  teleporter_out  test_palette  text  text_box
text_end  text_start  tile_animate  tile_flashing
toss_shoot  track_speed  trade_items  trading_error  transition
unlock  unlock_alchemy  unlock_armor  unlock_charms  unlock_consumables
unlock_ingredients  unlock_money  unlock_trading_goods
unlock_weapon_level  unlock_weapons  update_no_running  update_pacified
update_ui  volume  wait  walk  windwalker_rocket
wow_archaeology  wow_archaeology_guard  yield  zelda_power_glove
zelda_power_glove_stop
```
