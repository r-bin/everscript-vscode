# Open Evermore: animations, explored

Status: **exploration (2026-11-20), nothing built.** Back to [README.md](README.md); the step is S7 in
[progress.md](progress.md). The language and the machine are [../entities/animation_script.md](../entities/animation_script.md)
and the `animation-script` skill; what the table hack already moved is [../adding-animations.md](../adding-animations.md).
This page is what binds each layer for an explode/implode, measured on the US ROM, and the order to explode them in.

## 1. The layers and what binds them

```
who plays it ──16-bit record id──▶ record group in bank $C4 ──24-bit pointer──▶ animation script ($C7–$C9)
script `sprite` command ──bank = command + $A8, 16-bit──▶ sprite info ($CA–$D3) ──block id──▶ block table ──▶ pixels
```

| Layer | Vanilla | Bound by | Can move? |
|---|---|---|---|
| record groups | 783 groups, 1,752 records, `$C4:3E3A–$5999` | a record id is a 16-bit offset into bank `$C4`; **61 16-bit immediates in recorded code equal a group head** (e.g. `$80:C6ED`, `$80:C71C`) besides the data that names them | **no**: ids are fixed, records stay in `$C4` |
| `animate()` ids | 212 words at `$C4:3C92`, 210 on a group head | one reader, `$8C:E13C` (`lda.l $C43C92,x`) | **yes** (table hack, proven): frees `$C4:3C92–$3E39` as a pool for 26 new 4-facing groups |
| scripts | 1,595 in `$C7` (657), `$C8` (283), `$C9` (655); none crosses a bank | a record's 24-bit pointer; jumps (`jump`, `dec_jnz`, `jump_pos`, `jump_if_linked`: 222) are **absolute 16-bit** in the script's own bank | yes, any bank, if every jump is rewritten |
| sprite infos | 4,640 named by `sprite` commands, 190 more by 24-bit operands (`sprite2`, `sprite_long`, `sprite_aim`) | `sprite` (`0x22–0x2B`, 7,673 uses) takes its bank from the command byte: `$CA–$D3` only | inside `$CA–$D3`, rewriting the command byte; anywhere for the 24-bit forms |
| block tables | 16×16: 4,854 at `$EC0000`; 8×8: 6,265 at `$D80000` | three readers each (table hack, proven) | yes |
| pixels | `$D90000` / `$D10000` + 23-bit offset | the block table entry | yes |
| palettes | sprite palettes in bank `$90` (full) | bank `$90` readers | only by the hook (drifts the RNG) |

Other referrers of record ids, each a table of its own kind: character records (`+$32…`, bank `$8E`), Dog form
slots (`$CF945F`), weapons (`$C438E6`), projectiles (`$90:D9A6 + id`, `+$00`), alchemy effect records (⚗ in the
Scripts tab). Event scripts name animations by `animate()` id, never by record.

## 2. What makes animation scripts harder than event scripts

| | event scripts (S6, built) | animation scripts |
|---|---|---|
| shared code | none: every instruction belongs to one script | **7,314 commands reached from more than one record**: facings enter the same body at different points; 153 scripts' ranges interleave |
| jumps | relative (moving a script keeps them) | absolute 16-bit in the bank (moving a script rewrites them) |
| widths | every opcode known | **19 commands of unknown width** (some scripts cannot be walked to their end yet) |
| entry | a table or a pointer names the start | a record names the start; a 4-facing group's records each name one |

So one file per script would duplicate shared bodies. The unit is a **body**: the commands of the scripts that
share or interleave, with an entry label per record that enters it. Measured: 1,442 bodies, 1,429 of them a
single script; the largest is 12 scripts in 32,671 bytes, then 31 scripts in 22,137.

## 3. Proposed tree (for the owner to decide)

```
animations/_enum.json             record groups by id: names[] keyed by record offset, ids fixed (code holds them)
animations/<animation>.json       one group: flags (1, 4 or 8 facings), the entry each facing plays (body + label)
animation_scripts/<body>.txt      one command per line (bytes, as scripts/), `<label>:` lines for entries and jump
                                  targets, `@label` for a jump operand, `@sprite_<name>` for a sprite operand
sprites/<info>.json + blocks      a sprite info's chunks naming blocks; blocks as indexed PNG
```

- Record ids stay fixed (61 code immediates name them); new groups take ids in the pool the `animate()` id table
  frees, so the id table is the first table to generate.
- Bodies move freely (any bank, never across one), their jumps generated from labels.
- Sprite infos move inside `$CA–$D3`, the `sprite` command byte generated from where each landed.

## 4. Order

1. **`animate()` ids** as a generated table (one reader, proven): the record pool opens.
2. **Animation scripts** as bodies: needs the 19 unknown widths found (`animation-opcodes.ts`), then a lossless
   explode of every body with jumps as labels; G0, random, prove (the attract loop plays hundreds of them).
3. **Records**: the groups by fixed id; new ones in the pool.
4. **Sprite infos and blocks**: the block tables as generated items (readers proven), pixels as PNG, infos inside
   `$CA–$D3`. Then the characters (`$8E`) and the enemy index (readers proven).

Open: the 19 widths; whether the 542-byte zero runs in `$C4` (`$09E4`, `$1666`) are free; how the 61 code
immediates use the ids they hold (each one names a record the code plays).
