# The symbolic export: Evermore in Asar with labels instead of numbers

Status: **assessment (2026-11-18); the export exists, the symbolisation is partial.** This page answers
three questions:

- What does it buy us when every address in the Asar export is a label?
- How far is the export today?
- What is still missing?

It is the first step of [README.md](README.md).

All counts come from the export of 2026-11-16 in `out/recomp/asar/` (`STEPS.md`, last entry), counted on
2026-11-18. Labels: *(repo)* = read in our code or that export; *(estimate)*; *(to verify)*.

---

## 1. The idea in one paragraph

The CDL recorder already knows, for every instruction that ran:

- what it read or wrote, and through which mirror
- the data bank and direct page it ran with
- which bytes were used as pointers

The Asar export already turns most of that into source that rebuilds the ROM byte for byte. If **every** number
that is really an address becomes a label or a label expression, the source can be edited like a program:

- insert an instruction
- move a table
- grow a bank

Asar recomputes every reference. No operand lists curated by hand, no IPS byte patches.

**The test that says "done"** is the padding test ([asm-to-c-port.md](../reverse-engineering/asm-to-c-port.md) §4):
insert bytes, rebuild, replay the stored playbacks, and get the same WRAM every frame.

---

## 2. What it can achieve

| # | Outcome | Today without it | With it |
|---|---|---|---|
| A1 | **Move a table by moving its label** | the table hack writes each reader's operand from a hand-made list (`tools/table-hack/tables.js`: 131 character-record operands found by byte pattern, plus an `mvn`) | move `char_records:` to another bank; Asar rewrites every reader |
| A2 | **Grow a table in place** | impossible when data follows it | the data after it shifts, and its readers follow |
| A3 | **Edit a routine inline** | a `JML` to free space and back, which adds cycles and needs free space | insert the instructions where they belong; everything after them shifts |
| A4 | **Reclaim and repack space** | free space is wherever nobody looked | wipe dead data, and let the layout pack the rest |
| A5 | **ExHiROM and SA-1 as a relink** | converters that patch bytes (`tools/exhirom/`, `tools/sa1/`) | change the `org`s and the mapper; the mirror forms the CDL saw say which reads need a different bank form (`bus.md`: ExHiROM 1 read site + 4 edges, SA-1 1,193 / 8,852, as seen) |
| A6 | **One build for game and mods** | the everscript compiler, the table hack and the patches each claim 4th-MB space on their own | everscript output and patches are `incsrc`'d into the same build; one layout, no overlaps |
| A7 | **Mods as source diffs** | IPS/BPS against a fixed ROM | a diff of `.asm` files (our part only, §6); BPS still produced for players |
| A8 | **Shared names everywhere** | names live in knowledge entries, Mesen labels and recomp seeds separately | one `build/out.sym` after every build, which the recomp, Mesen and the C-to-ROM build read |
| A9 | **The asm layer of the split tree** | — | one file per routine, named and commented ([README.md](README.md) §1) |

What it does **not** achieve on its own:

- It does not raise engine limits (id widths, pools, audio RAM; [README.md](README.md) §4.6).
- It does not make new code timing-neutral ([README.md](README.md) §4.5).
- Content inside data (script bytecode, animation scripts) moves only once those decoders write labels too (§5, M4).

---

## 3. What we already have

### 3.1 The export

`src/platform/cdl/asar-export.ts`, with these invariants from `src/platform/cdl/README.md` *(repo)*:

| Already true | Detail |
|---|---|
| **Byte-identical rebuild** | `build.sh` → `build/out.sfc` with the vanilla sha1; `build-cdl.js` carries the CDL flags to wherever labels move |
| **Every branch and jump is a label** | branches always (`seg_XXXXXX+$n` when no better name); `jsl`/`jml`/`jsr`/`jmp` to recorded code by name. Raw jump or branch targets in the export: **0** |
| **24-bit operands that hit a label** | resolved, also through a mirror or inside a known region (`map_table+$0001-$400000`) |
| **Table fields** | 16-bit operands into a table asset become `tbl_XXXXXX+$n` (168 tables are assets in `tables/`) |
| **Pointer runs found** | bytes the CDL saw used as pointers (`EXT_POINTER`) are written as `dw` words, with the target's name in a comment |
| **Never-reached and DMA bytes** | `incbin rom.bin:` runs, so the rebuild stays exact without disassembling them |
| **Game seeds** | Evermore's `gameRegions` (`src/games/evermore/cdl/regions.ts`): 127 rooms as `rooms/*.bin` + map table as `dl room_XX-$400000`, 3,002 strings as `str_<index>` + key table, room enter scripts, the two string key readers |
| **Names** | 4,724 symbol names, 14,529 Mesen labels, 21,901 comments, from knowledge entries |
| **No M/X conflicts** | 0 instructions kept as bytes for running with both register widths |

### 3.2 The CDL library behind it

The `cdl-recorder` skill, `library-ext.ts` and `xref-index.ts` provide *(repo)*:

- `xrefs.bin`: per instruction, the address it read or wrote, the width, whether it was a pointer, and DMA
- `regs.bin`: DB and D per instruction, Y at pointer sites; `bases.bin`: the pointer bases at indirect reads
- `bus.cdl`: the mirror each byte was read or executed through
- `edges.bin`: calls, jumps, indirect jumps, returns; and from these, the 60 jump tables and 2 pointer jumps
  that the recomp seeds already know

### 3.3 Coverage

From the latest export *(repo: STEPS.md)*:

| | Bytes | Share |
|---|---|---|
| code that ran | 119,478 | 3.8 % |
| data that was read | 2,539,231 | 80.7 % |
| DMA | 174,327 | |
| never touched | 305,210 | **9.7 %** |

- The never-touched bytes are written as 1,272 `incbin` runs of 248,438 bytes.
- DMA graphics take 2,194 runs of 167,880 bytes.
- 987 functions are disassembled.

### 3.4 Work done by hand that the export should absorb

- **`tools/table-hack/tables.js`**: per table, its bounds and every reader operand. For the character records, a
  byte-pattern scan for `<op>.l $8E00xx,X` in the code banks. This is the hand-made version of §4.1.
- **`tools/exhirom/` and `tools/sa1/`**: the mirror audit and the rewrites.
- **[asm-to-c-port.md](../reverse-engineering/asm-to-c-port.md) §8.1**: the list of pointer forms.

---

## 4. What is still a number (counted)

### 4.1 24-bit operands into ROM: 265

Classified by what the CDL saw at each one *(repo: counted 2026-11-18)*:

| Form | Count | Example | Meaning |
|---|---|---|---|
| **bank + field, X holds a 16-bit address** | 212 | `lda.l $8E0007,x` | field +7 of a record whose address is in X; the operand's low word is a field offset, not a table |
| same, and X sometimes points into WRAM | 48 | `lda.l $8E0007,x ; [$7E0A2D, …]` | the Boy's and Dog's records live in WRAM (`$0A26` / `$0A70`), the rest in ROM: the bank byte picks ROM, the address in X picks the record |
| a plain base the export missed | 5 | `lda.l $80BF0E,x ; [data_C0BF10]` | a biased base (`data_C0BF10-2`) |

By bank: `$8E` 126 (character records), `$91` 48 (alchemy blocks), `$C4` 34 (animation records), `$8F` 24,
`$90` 21, `$80` 6, others 6.

**So the big job is not "find the table base" but "name the bank".** These operands mean
`bank(char_records) | field`. The 16-bit addresses that X takes come from data, for example the enemy index
holds record addresses. They must become `dw char_record_N` (low word) too, or the records cannot move. This
is why the table hack kept the records at the same offsets in their new bank ([extension-tables.md](../extension-tables.md)).

### 4.2 16-bit operands `$8000–$FFFF`: 244

- **140 read WRAM:** DB = `$7E`, and the address happens to be `$8000+`. Not ROM, nothing to move.
- **104 read ROM through DB:** 100 have no label at the target yet, 4 have one. Each needs two things:
  - the operand as `label` (low word)
  - the instruction that set DB (`lda #$9C : pha : plb`, `phk : plb`, `pea`) as `bank(label)`

  `regs.bin` has the DB value per instruction; finding the instruction that set it is a short backward walk.

### 4.3 Pointer words in data: 867 in 227 `dw` lines

- **855 already point at a label** (the comment shows it). Writing `dw label` instead of `dw $xxxx` is mechanical.
- **12 point at nothing known.**

Most are jump tables read by `jsr ($xxxx,x)` in the same bank. They are the cheapest win: code behind a jump
table becomes movable.

### 4.4 Immediates that build an address: not counted

There are 7,544 16-bit immediates (`lda #$xxxx` …); most are plain numbers. The address ones are:

- split constants such as `adc #$C322` + `lda #$9C` (the map palette loader, [extension-tables.md](../extension-tables.md))
- `mvn`/`mvp` bank operands
- DMA source setup (`$43x2–$43x4`)
- pointers staged into direct page before a `[dp],y` read

The CDL has the *result* of each (the read address, `bases.bin`, the DMA source). Linking it back to the
immediates is a data-flow step the export does not do yet.

### 4.5 Data with addresses inside: only rooms and strings

Beyond rooms and strings, the export writes no labels inside data:

- script bytecode (packed 24-bit pointers, bank `$92 + n`, [table-hack.md](../table-hack.md) §1)
- the script pointer table
- animation scripts and records
- the sprite block tables, the enemy index, the song tables
- the 344 lookup tables kept inline (186 sparse, 134 with an untrusted length)

The decoders exist (`src/games/evermore/script`, `animation-script` skill, `rom/model/`); they have not been
turned into `gameRegions` yet.

### 4.6 Code that never ran

248 KB stays `incbin`. Any jump, table read or pointer inside it is invisible to the CDL. A static pass can
cover part of it:

- disassemble from known entry points: snesrecomp's static manifest, jump table entries the CDL never took
- scan every operand for a known label's address, as the table hack does

Neither feeds the export today.

---

## 5. What is missing, in order

| # | Missing | Work | Size *(estimate)* | Unlocks |
|---|---|---|---|---|
| **M0** | `tools/recomp/build.js` calls the export **without** `gameRegions`. Every export since 2026-10-30 says "no game regions" in `STEPS.md`, so `out/recomp/asar/` has no room or string labels. The CDL tab's export (`src/games/evermore/cdl/tools.ts`) passes them. | pass `evermoreRegions`; check the recomp seeds still match | hours | A1 for rooms and strings in this export |
| **M1** | pointer words as `dw label` (§4.3) | in `dataLines`, write the name when the target has one and the bank is the run's own | a day | movable code behind jump tables |
| **M2** | biased bases (§4.1, 5 operands) | in `resolveLong`, use the xref targets: one labelled target region ⇒ `label±bias` | hours | |
| **M3** | **bank-bound pools** (§4.1, 260 operands) | define a pool per bank with records (`$8E` characters, `$91` alchemy, `$C4` animations …); write operands as `pool_bank\|$field`; write the 16-bit record addresses in data as `dw record&$FFFF` | days per pool; first `$8E`, because the table hack already proved it | A1 for records, which is what new enemies, spells and animations need |
| **M4** | DB-relative operands (§4.2, 104) | label + `bank(label)` at the instruction that set DB, found from `regs.bin` | days | tables read through DB |
| **M5** | address immediates (§4.4) | a backward data-flow pass from each recorded read, `bases.bin` and DMA source to the immediates that built it | a week+ | split constants, `mvn`, DMA sources |
| **M6** | addresses inside data (§4.5) | one `gameRegions` producer per decoder: scripts first (they hold the most pointers), then animations, sprite tables, song tables | a week per kind | content moves: the split tree's assets |
| **M7** | never-ran code (§4.6) | static disassembly from known entries + operand scan; and more recording | open-ended | the rest of the ROM; until then those bytes must stay in place (`incbin` at a fixed `org`) |
| **M8** | **the proof** | (a) a ratchet check: count raw operands and pointer words per form, fail when one grows (`tools/check-*.mts` style); (b) the padding test per bank: insert N bytes, rebuild, replay with `sample-playbacks`, diff WRAM, report the first frame | days | G1 |
| **M9** | layout as data | the `org` per bank and per moved item comes from one layout file the build reads, not edited by hand in `banks/*.asm` | days | A4, A5, A6 |

**Where the work goes.** M1–M5 are passes in `tools/split/symbolise.mts`. They act through two optional
hooks in the export, and the export's code stays as it is ([tool.md](tool.md) §10.2). M8 is part of the same
tool (`report.mts`, `prove.mts`). M0 is a one-line fix in `tools/recomp/`.

**Order:** M0 → M8a (so progress is measured) → M1, M2 (cheap) → M3 for `$8E` → M8b on bank `$8E` → M4, M5 → M6 → M7.

The first visible result is **the character records moved by changing one `org`**, with the attract-loop
playback still identical. It repeats the table hack's proven move without its hand-made operand list.

---

## 6. Rules that do not change

- **Generated, never committed.** The export is the game's code and data in text form. It is generated from the
  user's ROM into `out/` and never enters a repository (AGENTS.md §0.1; `src/platform/cdl/README.md`: "Text
  taken from the user's ROM: it never enters a repository").
  - What we commit: the exporter, `gameRegions`, knowledge entries (names and comments), layout rules, and our
    own mods.
  - Edits to the game's routines are therefore overlays (our `.asm` in `mods/`, `incsrc`'d after the generated
    file), not edits in `banks/*.asm`.
- **Byte-identical first.** Every symbolisation step must keep G0: the unedited export still builds the vanilla
  sha1. A form that cannot be written as an expression stays a number, with a comment saying why.
- **Unknown stays fixed.** Bytes the export does not understand (`incbin`, raw operands) keep their address.
  Only labelled items move. The ratchet (M8a) shows how much is still pinned.
- **Facts go to knowledge entries.** A pool, a pointer form or a reader found on the way is written down in
  the same commit (`game-knowledge` skill).

---

## 7. Open questions

1. Should the pools of M3 be named per bank (`bank_8E_records`) or per content (`char_records`)? Content
   names read better, but one bank may hold several kinds *(to verify per bank)*.
2. Does the symbolic export replace the table hack, or does the table hack stay as the "no rebuild" route for
   people without Asar? *(owner's call)*
3. The recomp reads `out/recomp/asar/`. Does it break when labels move, or is moving only ever done in a
   separate build? Proposal: moves happen only in a separate output folder; the recomp keeps the vanilla export.
