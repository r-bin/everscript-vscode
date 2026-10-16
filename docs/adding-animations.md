# Adding animations: what an animation needs, and what the table hack frees

This page covers the four layers a new animation goes through, the limit of each in vanilla, and
what `tools/table-hack` changes so that new animations fit. The example is the Act 0 Dog (the
white puppy) and its missing poses: the plan is
[todo/act0-dog-animations.md](todo/act0-dog-animations.md), the open items are in
[todo/table-hack.md](todo/table-hack.md).

Facts are marked *(disasm)*, *(scan)* (static scan of the whole ROM, checked against this ROM's
CDL), *(test)* (headless, bundled snes9x core, v0.226.0) or *(to verify)*.

## 1. The four layers

```
who plays it ──16-bit record id──▶ record group in bank $C4 (4 bytes per facing)
record ──24-bit pointer──▶ animation script (anywhere)
script `sprite` cmd 0x22..0x2B ──bank = cmd + $A8, 16-bit──▶ sprite info in banks $CA..$D3
sprite info chunk ──16-bit block id──▶ block pointer table ──23-bit offset──▶ pixels
```

"Who plays it" is one of:

- a character record's animation fields (`+0x32…`, [character_table.md](script-format/character_table.md));
- a Dog form slot (`$CF945F` lists six forms, slot `s` at `+10 + 2s`, `src/games/evermore/sprites/dog-forms.js`);
- a global `animate()` id (`$C43C92 + 2·id`, read by `$8C:E13C`);
- a weapon (`$C438E6`).

Each layer is data the engine already reads through an id or a pointer, so nothing here changes
engine code.

| Layer | Vanilla | Limit in vanilla | After the table hack |
|---|---|---|---|
| record groups | 1752 records `$C4:3E3A–$599A` | **no free space in `$C4`**. A record id is a 16-bit offset into bank `$C4`. | **pool `$C4:3C92–$3E39` (424 bytes)**, freed by moving the `animate()` id table: 26 four-facing groups or 106 one-facing records |
| `animate()` ids | 212 | ends where the record table starts | 212 / 2048 (`$B1:F000`) |
| scripts | 1595 in `$C7–$C9` | none: a 24-bit pointer | unchanged; new scripts can go in the extension |
| sprite infos | 5128 from `$CA:0003` | bank = command + `$A8`, so only `$CA–$D3`, and no proven free space there | **unchanged, still the bottleneck** ([todo](todo/table-hack.md)) |
| 16×16 block ids | 4854, table full | the pointer table `$EC0000` is followed by other data | 4854 / 10922 (`$F8:0000`) |
| 8×8 block ids | 6265, table full | the pointer table `$D80000` is followed by other data | 6265 / 10922 (`$F9:0000`) |
| pixels | `$D90000` / `$D10000` + 23-bit offset | none: the offset reaches `$FFFFFF` *(to verify: that the add carries across banks)* | new pixels can go in the extension |

## 2. What the table hack moves for animations

| Move | Readers *(scan)* | New place | Freed |
|---|---|---|---|
| `animate()` ids, 212 words | `lda.l $C43C92,x` at `$8C:E13C`, the only one. The other 100 byte patterns are data. | `$B1:F000` (file `0x31F000`) | `$C4:3C92–$3E39`, now the **animation record pool** (`ANIMATION_RECORD_POOL` in `tools/table-hack/tables.js`) |
| 16×16 block pointers, 4854 × 3 | `lda.l $EC0001,x` `$80:9742`, `lda.l $EC0000,x` `$80:9751` and `$80:A2E6` (all CDL code; no `lda #$EC` anywhere) | `$F8:0000` (file `0x380000`, lower half, so the readers use the `$F8` form) | `$EC:0000–$38E1` |
| 8×8 block pointers, 6265 × 3 | `lda.l $D80001,x` `$80:A4FC`, `lda.l $D80000,x` `$80:A50B` and `$80:A800` (all CDL code) | `$F9:0000` (file `0x390000`) | `$D8:0000–$496A` |

Records stay where they are, so every vanilla record id, form slot and character field stays
valid. New records get ids `$3C92…$3E36`, which the engine reads like any other.

The other things in bank `$C4` stay put: the weapon table, alchemy tables and names. They are read
through about 80 `lda #$00C4` pointer setups, most in code the CDL never recorded, so moving the
whole bank is not an operand rewrite *(scan)*. Two 542-byte zero runs in `$C4` (`$09E4`, `$1666`)
were never touched in the CDL, but zeros are not proof of free space. They are not used.

## 3. Checked

- **Proof** (`npm run table-hack:prove`, attract-loop playback): `animate_ids`, `sprite_blocks_16`
  and `sprite_blocks_8` each play exactly like the original, alone and together with every other
  table move. The playback reaches their readers: animate ids 4×, 16×16 blocks 1170×,
  8×8 blocks 1026× (sample-playbacks skill).
- **The Act 0 Dog**, built from `tools/table-hack/evs/act0-dog.evs` (tools/table-hack/README.md):

  ```sh
  npm run table-hack -- --rom <clean rom> --ips <everscript.ips> \
      --add-animation 0x4502:4 --dog-slot 4:12=@0,4:14=0x4526
  ```

  The script sets `DOG_WRITE = DOG.PUPPER` and leaves the Dog idle in Brian's room until it sits
  (form 4 slot 12).
  - **Vanilla:** it sits as the Act 1 wolf (`$4302`), a wolf drawn in the puppy's palette.
  - **With the test content:** slot 12 points at record group `$3C92`, a copy of the puppy's own
    stand (`$4502`) in the new pool, and the puppy appears instead of the wolf *(test)*.
  - Slot 14 (bark) is pointed at the puppy's own bark `$4526`.

  A copy is used only because there is no new art yet. A real sit needs new scripts, sprite infos
  and blocks.

The Dog form slots are at `$CF936D + 10 + 2s` for Act 0. Slot 14 (bark) is therefore `$CF9393`,
and `$CF938F` is slot 12 (sit). The plan doc had them swapped; it is corrected now.

## 4. How to add a real new pose (once the art exists)

1. **Pixels**: write the new blocks into the extension. Append their 23-bit offsets to the moved
   block tables (`sprite_blocks_16` / `_8` extra entries in `tables.js` `build()`). The new ids
   follow the vanilla ones (4854+, 6265+).
2. **Sprite info**: a `[count][dataOffset]` header plus 5-byte chunks naming the new block ids. It
   must sit in `$CA–$D3`; that space is the open item.
3. **Script**: copy the matching wolf script as a template and swap its `sprite` operands. Put it
   in the extension. Check it with `runAnimation()`: it must reach `loop` or `end_check!`.
4. **Record group**: write it into the pool (`--add-animation` shows the write; a real build writes
   the new script pointers), one 4-byte record per facing.
5. **Wire it**: point the form slot, character field or `animate()` id at the new record id.
