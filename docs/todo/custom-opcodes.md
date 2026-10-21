# Custom script opcodes

How to give Evermore's script VM new opcodes, how many opcode numbers are free, and what a custom
opcode can do. Builds on the opcode documentation ([../scripts/opcodes.md](../scripts/opcodes.md),
`soe://rom/assets/scripts/opcodes/<xx>.md`) and the ExHiROM work ([../exhirom/README.md](../exhirom/README.md))
for code space. Facts are from the handlers' code (v0.320); nothing here is built or tested yet.

Legend: ✅ read from the code · 🟡 to build · 🔴 to verify first · 💡 idea

## 1. The numbers

| Way | Engine change | New opcode numbers | Cost per instruction |
|---|---|---|---|
| A. Repoint free table entries | none (2 bytes per entry + one 4-byte stub) | **40** with no feature lost, **58** if the unused vanilla features go too | 1 byte + operands |
| B. Append `0xC3`-`0xFF` | 3-byte patch of the dispatcher + 8-byte stub | **+61** (all 256 bytes used) | 1 byte + operands |
| C. Prefix opcode | none beyond A | **+256** per prefix with a byte sub-op (65,536 with a word) | 2 (or 3) bytes + operands |
| D. Custom expression terms | none (2 bytes per sub-op entry + one stub) | **5** terms usable inside any expression | 1 byte inside the expression |

With A + B: **101** custom opcodes without losing anything vanilla uses or Everscript emits (119 if the
unused vanilla features are given up). C makes the count unlimited.

## 2. How dispatch works (✅)

- `$8C:D0A6` reads the opcode through `[$82]`, `AND #$00FF`, `ASL`, `TAX`, `JSR ($E8BD,x)`. So
  **X = 2 × opcode** on entry (the `0x44` handler uses that to tell `0x47` apart), A/X/Y are 16-bit,
  the data bank is `$7E`, and the handler address is a **16-bit pointer in bank `$8C`**.
- The handler returns with `RTS` to `$8C:D0B2`: **carry set** = run the next instruction in the same
  frame, **carry clear** = this thread's turn ends; it resumes at the next instruction next frame.
- No range check: `0xC3`-`0xFF` read their "pointers" from the code of the expression evaluator
  (`$8C:EA43`...), so they cannot be repointed without moving the table.
- Bank `$8C` is full. Free bytes: **16 at `$8C:D880`-`$D88F`** (zero padding after the `0x4D` handler;
  nothing references it, and no Everscript patch writes there ✅) and 30 zero bytes at `$8C:A1FF` (🔴 not checked whether it is data).
  Handlers therefore live in an extension bank, reached through a stub in that padding.

### The stub (one for all custom opcodes)

```asm
org $8CD888
ext_entry:  jml ext_dispatch        ; 4 bytes; X = 2 * opcode is still set
```

`ext_dispatch` (any bank) does `jmp (ext_table,x)` into its own 256-entry table. A custom handler
ends with `jml $8CD87F` — that byte is the `RTS` of the `0x4D` handler — so the `RTS` runs in bank
`$8C` and returns to the dispatcher with the handler's carry. Long-call helpers are fine in between.

## 3. Way A: free entries in the table (no engine change)

Point the table word at `$8C:E8BD + 2 × op` to `$D888`.

**Free with nothing lost (40):**

- 27 `STP` bytes (they stop the CPU today): `01-03 06 0F 13 1F 24 25 28 2F 34-37 3E 40 41 4F 53 56 57 67 6B 72 8B B8`.
- 11 second forms that no original script uses; the other byte of the pair stays:
  `15 16 31 32 38 39 45 46 49 4A 4B`.
- `23` (writes `$0E6E`, which nothing reads) and `4C` (skip a byte; unused).

**Free if an unused vanilla feature goes (18 more):** `12` (write argument byte), `21` (restart the room),
`48` (default message box), `5E`-`61` (object state ops), `64`-`66`, `68`-`6A` (speaker figures), `7B`
(byte poke), `8A` (open the shop), `90` (fade to brightness), `B1`, `B7`. Several of these are useful
for hacks ([kaizo-opcodes.md](kaizo-opcodes.md)), so take them last.

Not free: `4D` (Everscript `nop()` emits it) and everything vanilla scripts use.
✅ Checked (v0.320.2): no Everscript wrapper, enum used as an opcode (`WALK_TYPE`, `MESSAGE_BOX_TYPE`) or
compiler builtin emits any byte of either list. Repeat the check when Everscript grows:
`grep -rhoiE "code\(\s*0x[0-9a-f]{1,2}" everscript/in` plus the enums passed to `code(...)`.

## 4. Way B: append `0xC3`-`0xFF` (one engine patch)

Replace the dispatcher's `JSR ($E8BD,x)` at `$8C:D0AF` (3 bytes) with `JSR $D880` (3 bytes) and put a
range check in the padding:

```asm
org $8CD0AF
    jsr $D880
org $8CD880
    cpx #$0186          ; 2 * $C3
    bcs ext_entry       ; $C3-$FF: ours
    jmp ($E8BD,x)       ; $00-$C2: the vanilla handler, whose RTS returns to $D0B2
ext_entry:              ; $D888
    jml ext_dispatch
```

12 of the 16 free bytes. Way A entries point at `$D888` too. The cost is one compare and branch on
every script instruction (5 cycles).

## 5. Way C: a prefix opcode

One custom opcode, e.g. `0x01 n`, reads a sub-opcode byte (or word) and dispatches on it: 256 (or 65,536)
more opcodes at one extra byte each. Good for rare, large features; keep the common ones on single bytes.

## 6. Way D: custom expression terms

The expression evaluator (`$8C:EA43`) reads a byte, takes the low 7 bits as the sub-op, and jumps
through the table at `$8C:F041`. A term handler leaves its value in DP `$02` (low word) / `$04` (high
word) and jumps back to `$8C:EA49`. Five entries, **`$19`, `$2F`, `$5D`, `$5E`, `$5F`**, point at
`$8C:F03F` (`BRA` to itself: a hang). Repointing them to a second stub (`jml ext_term`, 4 bytes; the
handler ends with `jml $8CEA49`) gives five terms that work in every `if`, write and argument, e.g.
`if (sram_flag(3))`. Unary terms take their argument from the value before them, like the built-in
`deref` (`$55`). Sub-ops `$70`-`$7F` read past the table and are not usable.

## 7. Writing a handler

| Need | How (✅ from the vanilla handlers) |
|---|---|
| a byte operand | `lda [$82]` / `inc $82` / `and #$00FF` |
| a word operand | `lda [$82]` / `inc $82` / `inc $82` |
| an expression | `jsl $8CEA43` → A = value (DP `$02`/`$04` = 32 bits) |
| an entity expression | `jsl $8CEC8E` → Y and DP `$4C` = the entity |
| this thread's slot | DP `$7E`; arguments at `slot + $0F`, bound entity `slot + $0D` |
| the opcode's own address | `$82` - 1 on entry (`$82`-`$84` is the 24-bit pointer) |
| run again next frame (poll) | set `$82` back to the opcode, `CLC` |
| sleep n frames | slot `+$05`/`+$07` = `$0B19` + n - 1, slot `+$03` = 4, `CLC` (as `$8C:D220`) |
| call / start / end / jump | tail-jump into the vanilla handler tails: `jml $8CD3DA` (call: pointer in DP `$26`/`$28`), `jml $8CD40E` (start a thread), `jml $8CD2E1` (end the script), `jml $8CD434` (jump by the next word). They end in an `RTS` in bank `$8C`, so the return is right. |
| flags | bit masks at `$80:A87F` (set) / `$80:A887` (clear), as `0x0C` |
| engine services | freeze `$8F:CD78`, unfreeze `$8F:CD4D`, place `$8F:C2E4`, animate `$90:8124`, damage `$8F:C121` / `$8F:C16E`, heal `$8F:C0A5`, sound `$8C:82DC`, text `$8C:9E03`, map object state `$90:A36D`, spawn tail `$8C:DD19`. Mind each routine's data bank (vanilla wraps bank-`$80` calls in `PEA $8080` / `PLB`). |

🔴 Operands are read with a 16-bit `INC $82`, which does not step into the next script bank: an
instruction must not straddle a 32 KB window. Everscript should already keep instructions whole; check.

## 8. What a custom opcode can do: examples

### 8.1 Loot in one instruction (address + flag + state)

A vanilla gourd costs **26 bytes**:

```
if (<0x2268, 0x80>) goto end;          6   already taken?
<0x2391> = 0x0204;                     6   item
<0x2395> = 1;                          5   object
call_id(0x3a);                         2   hand it over
<0x2268, 0x80> = <0x22ea, 0x01>;       6   taken = the driver's result
end();                                 1
```

**Custom version:** `loot(u8 object, u16 flag_bit, u16 item)`, 6 bytes. The handler tests the flag
(`jml $8CD2E1` when set), writes `$2391`/`$2395`, saves the flag bit in a spare WRAM word, then
tail-calls global `0x3a`. The flag write has to wait for the driver's result, so the instruction after
it is a 1-byte `loot_done` that copies `$22EA` bit 0 into the saved flag. **8 bytes instead of 26:
about 16.6 KB over the 922 pickups.**

Your variant, "the flag is set by a function", is the general form. Vanilla opcodes only take
*constant* flag numbers (`0x0C`; reads through sub-op `$05`). Two customs make them dynamic:
`flag_set(E bit, E value)` (way A) and a term `flag(E bit)` (way D). Then every pickup is a
`call_global_with_args(item, object, flag)` (`0xB0`, about 10 bytes) into one shared loot script that
tests and sets `flag(arg)`. That is slower but needs no special `loot_done`. The enter script's
`object_state_by_flag` (`0x5D`) stays as it is.

### 8.2 SRAM: New Game+ and other cross-save data

✅ SRAM is 8 KB at `$30:6000`-`$7FFF` (header `$03`). The four save slots are `$30:6002` +
n × `$0331`, 815 bytes each with a checksum (`$8D:B478`, `$8D:C905`), ending near `$30:6CC6`. About
**4.9 KB after them is outside every checksum**. Kaizo's `save_file_growth` patch grows each slot by 68
bytes (stride `$0375`, slots at `$6002`/`$6377`/`$66EC`/`$6A61`), so there the slots end at `$30:6DD6` ✅.
**Use `$30:7000`-`$7FFF` (4 KB)**: free with and without the patch.

- `sram_write(E offset, E value)` (opcode): `sta.l $307000,x`.
- `sram(E offset)` (unary term, way D): `lda.l $307000,x`.
- New Game+: the outro sets `sram_write(NG_PLUS, 1)`; the new-game script checks
  `if (sram(NG_PLUS))` and grants items, sets flags or raises the difficulty. Write a magic word next to
  it so a blank cartridge (random or `$FF` bytes) does not count as unlocked.
- Also: a death counter or best times across saves, unlocks per completed run, a "hard mode" flag the
  title screen sets.

### 8.3 Change a character's palette

✅ What the engine does (`docs/entities/runtime_stats.md` § Changing the palette): an entity's `+$0C` is a
slot offset (0, 2 … 14) into eight sprite palettes; `+$75` is the home slot the game restores;
`$7E:1278 + slot` names what the slot holds; `$90:CF3A` copies 16 colours into the buffer at
`$7E:6289 + slot × 16`; `0x97` uploads the buffer with `$80:85FA` while holding `$0F3C`.

- `set_palette(E entity, u24 colours)`: slot = `+$0C`; copy 16 colours from the pointer (any bank, e.g.
  the extension) into the slot's buffer, mark `$1278 + slot`, upload (`$0F3C` + 1, `$80:85FA`, - 1).
  Colours that no record has become possible, and no donor entity is needed (unlike Kaizo's
  `add_palette_donor`).
- `set_color(E entity, E index, E bgr555)`: one colour, for flashes or heat-up effects.
- 🔴 The slot is shared by every entity drawn with it; the Boy's and Dog's slots (`$0C`, `$0E`) are
  reloaded from `$0A2F` on restore; the damage flash may re-copy colours. Test in the emulator.

### 8.4 More ideas

| Idea | Kind | Why |
|---|---|---|
| `room_clear()`: are all enemies dead? | term | arenas without a counter per enemy |
| `wait_room_clear` | polling opcode (rewind + `CLC`) | replaces script loops that poll every frame (less lag) |
| `count_enemies(type)`, `nearest_enemy()` | terms | targeting, phases |
| `damage_percent(entity, pct)` | opcode | difficulty scaling without a formula per boss |
| `flags_set(u16 byte, u8 mask, u8 value)` | opcode | several flags in 5 bytes instead of 6 each |
| `switch(E) { word offsets }` | opcode | jump tables instead of `if` chains |
| `memcpy`, `memset` on WRAM | opcode | resetting puzzle state |
| `joypad()` | term | challenge rules ("don't attack"), secret inputs |
| `countdown(n)` with an on-screen number | opcode + HUD | timed rooms |
| `print_number(window, E)` | opcode | numbers in dialogue (vanilla only formats money, `0xA0`) |
| `random(a, b)` | term | ranges; vanilla has `random` and `random_below` only |

What a custom opcode **cannot** do cheaply: run for many frames inside one call (the whole field waits;
yield with `CLC` instead), or hold state in its own registers between frames (keep it in the slot's
argument bytes or WRAM).

## 9. Tooling the plugin needs (🟡)

- `script-vm/spec.ts` has to learn custom opcodes and terms per hack (today they are a `DecodeError`
  at their address), so the script viewer, `soe://` pages and the walk decode patched ROMs. For example,
  a hack descriptor next to the variant descriptor listing each custom opcode's operands, flow and name.
- The opcode pages should show "custom (hack X)" for repointed entries; the knowledge entries describe
  vanilla only.
- Everscript: a wrapper per custom opcode (`code(0x01, ...)`), and the patch (`patches/custom_opcodes.asm`)
  holding the table writes, the stub and the handlers in the extension bank.
- Tests: decode a patched ROM, and run each custom opcode headless (sample playbacks) before release.

## Tasks

1. ✅ Free list confirmed against Everscript (§3); SRAM and `$8C:D880` against Kaizo's patches (§2, §8.2).
2. 🟡 `custom_opcodes.asm`: stub, `ext_dispatch`, one trivial opcode (e.g. `sram_write`), headless test.
3. 🟡 Decoder support for custom opcodes (§9).
4. 💡 `loot` + `loot_done`, `flag_set` / `flag()`, `sram()`, `set_palette`, `room_clear()`.
