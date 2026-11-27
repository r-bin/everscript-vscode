# Open Evermore: code (S9), why it is not exploded and how it gets there

Back to [README.md](README.md). Status: **not exploded (2026-11-27)**. Every 65C816 routine is still in
`_base/unexploded.bin` at its vanilla address. Only the names exist: `soe://rom/code/<routine>/` serves each known
routine by name, and the kinds that point at code (opcodes, behaviours, attack procs, ring actions …) name their
handlers. That is the single 🟩 in [progress.md](progress.md) S9.
Labels: *(repo)* = exists today; *(measured)* = counted on 2026-11-27, method given; *(proposal)*; *(owner's call)*;
*(to verify)*. The short spec of the kind is [resources.md](resources.md) §code. This page gives the state, the
reasons and the steps.

---

## 1. Short answer

We never exploded code because it breaks the hard rule (README.md §1): *an exploded resource is reached only
through what implode generates*. Code is reached in eight ways that implode cannot regenerate yet. They are bank-local
`jsr`/`jmp`, `(abs,x)` jump tables, `pea` return addresses, `phk : plb` data banks, fall-through, mid-routine
entries, vectors, and pointers to code that live in WRAM (§4). The engine is also cycle-sensitive (§4 h), so a routine
that moves and gains cycles leaves lockstep. Every other kind was chosen first because its readers were few and known.

What already exists makes the first step cheap. The CDL Asar export **reassembles the whole ROM byte-identical**,
and that is the codec's base (§3). Explode's index of named items and WRAM names supplies the labels, so a jump or
read in that asm hits a name instead of a number (§3.1).

## 2. What `_base/` still holds *(measured)*

Method: the spans of `out/open-evermore/_base/_base.json` (explode v0.474.0) and of a v0.475.0 tree, crossed with
the vanilla CDL library's `rom.cdl` (bit `0x01` = executed, `0x02` = read as data).

| | Bytes |
|---|---:|
| Owned by no kind | 240,970 (7.7 % of 3 MiB) |
| … of which recorded code | 119,008 (7,049 of them are WRAM operands the `wram` kind rewrites in place) |
| … of which read as data | 77,756 |
| … never touched | 34,760 + 9,446 of `$00`/`$FF` fill |
| Recorded code in the whole ROM | 119,478, so ~99.6 % of it is in `_base/` |

[roadmap.md](roadmap.md) §2 gave ~0.6 MB on 2026-11-22. That was before metasprites, animations and WRAM were
exploded. About **0.24 MB** is left now, and half of it is code.

Code by bank (unowned / recorded code): `$80` 32,176 / 19,737 · `$8C` 30,970 / 19,829 · `$8D` 24,957 / 23,130 ·
`$8E` 15,418 / 11,460 · `$8F` 25,042 / 20,247 · `$90` ~15.9 K / 13,256 · `$91` ~23.1 K / 11,349. No other bank has
recorded code. The CDL is a lower bound: code that never ran is not marked. Examples are the 80 named entries the CDL
never saw and banks `$93`/`$96`/`$9A`.

## 3. What we already have

| Piece | Where | State |
|---|---|---|
| Routine names | knowledge entries `kind: code` in `src/games/evermore/localizations/knowledge/routines/` | *(repo)* 1,544 (+9 `sub`), all with `end:`; `$80` 175, `$8C` 393, `$8D` 80, `$8E` 130, `$8F` 392, `$90` 226, `$91` 147 |
| Name ↔ address in the codecs | `tools/open-evermore/evermore/codecs/readers.mts` `routines(bank)` | *(repo)* a name stands for a fixed 16-bit address in one bank |
| Per-routine views | `soe://rom/code/<routine>/` (info, `.asm`, `.c`, pseudo-C) | *(repo)* read views, not guaranteed to reassemble *(to verify)* |
| **Byte-exact disassembly** | `src/platform/cdl/asar-export.ts` → `out/recomp/asar/` (48 bank files, 987 functions, `build.sh`) | *(repo)* `build/out.sfc` has the vanilla sha1 (2026-11-22): **G0 for the whole ROM as asm** |
| Assembler | Asar 1.90pre, outside the repo (`tools/recomp/build.js` finds it: `--asar`, `ASAR`, PATH, `../asar`) | *(repo)* not bundled, no wasm |
| Code that implode writes today | `codecs/consumable-hooks.mts`, `codecs/ingredient-hooks.mts` | *(repo)* hand-assembled byte arrays, placed as `grown_tables`, tested on `cpu65816.ts` |
| Operands patched inside `_base/` code | dog forms, ingredient readers, `$8C:CCF5`/`$8C:CD35`, 218 mapping-file sites, WRAM census | *(repo)* a code kind must take each over as a typed operand |
| C | `reconstructed-c/`, C to ROM (Calypsi, banks `$F8-$FB`) | *(repo)* documentation. Its calls cost 7-60× the asm and WRAM drifts, so it is never a source of the tree (AGENTS.md §0.11) |

In the export, every branch, jump and call has a label as its target. Some of those labels are only numbers in
disguise, and other operands are still raw numbers *(measured)*:

| Still a number | Count | Symbolic-export step |
|---|---:|---|
| branches to `seg_<bank>+$off` (a bank offset, not a label) | 227 | M1 (a local label each) |
| 24-bit ROM operands (`$8E` 126, `$91` 48, `$C4` 34, …) | ~265 | M2, M3 |
| ROM operands read through DB | 104 | M4 |
| 16-bit immediates that may be addresses | 7,544 (681 are `≥$8000`) | M5 (data flow) |
| pointer words in data (855 of 867 already hit a label) | 867 | M1, M6 |
| never-run code kept as `incbin` | ~248 KB with DMA data | M7 |

Steps M0-M9 are in [../split-and-link/symbolic-export.md](../split-and-link/symbolic-export.md) §5. None is
done. M0 is that `tools/recomp/build.js` exports without `gameRegions`, so rooms and strings have no labels.

### 3.1 The combination: the Asar export, labelled by explode *(owner's idea, 2026-11-27; proposal)*

The export already reassembles byte for byte. Explode already knows, by name, almost every byte that is not code. To
combine them, make the export take **explode's index as its symbol source**, so that a jump or a read in the asm hits a
label instead of a number:

| Explode knows *(repo)* | Becomes in the asm |
|---|---|
| every kind's items: `_base.json` pools (1,057), tables (3,789), homes (33,821), each with a kind and a name | a data label per item (`maps_pyramid_outside`, `strings_dialogue_…`). A 24-bit or DB-relative operand that lands in an item becomes `label+offset` (most of M0, M2, M3 and M6 for exploded data) |
| the mapping file: 218 code-immediate sites the codecs patch, the `pastEnd` and pointer windows | the operand written as the label or id symbol it stands for (`!music_<name>`, `#map_id(…)`) |
| WRAM: 1,216 variables in 56 parts, the reader census (7,049 operand bytes) | the WRAM operands as names (`ram.asm` from the `wram` kind, not from the old map) |
| routine names (`routines(bank)`), handler tables by name | code labels and `dw handler` entries |
| enums of every kind | id symbols in immediates where a codec already rewrites them |

Implode then builds one Asar project. The code files are `incsrc`, each kind's built items are `incbin` at the
address placement gave them, and a generated `symbols.asm` holds `label = $bank:addr` for every placed item. A data
kind can now move freely even when code reads it with a 24-bit operand, because Asar writes that operand from the
label. Today a codec patches each such operand by hand. So the code files become the one place where those reader
sites live, and the operand patches in §3 stop being special cases.

This settles the references *from* code *to* data. It does not settle code reaching code (§4 a-i). So C0 still pins
every routine, but it pins it inside a file where the operands are names.

## 4. What makes a routine hard to move *(measured on the export, ran code only)*

| | Hazard | Count | Evermore example |
|---|---|---:|---|
| a | bank-local `jsr.w` / `jmp.w`: callee in the caller's bank | 298 / 578 | the full banks `$8E`, `$8F`, `$91`, `$C4`, `$CA-$D3` have no free byte ([extending.md](extending.md) §6) |
| b | `(abs,x)` jump tables: 16-bit entries, targets in the table's bank | 26 `jsr` + 35 `jmp` | opcodes `$8C:E8BD` (195), effect ops `$91:8000` (83, `jsr ($8000,x)` at `$91:9750`), animation ops `$90:8000` (128), attack procs `$8F:B6AE`, behaviours `$8F:CBE0`, entity sub-ops `$8C:F041` |
| b′ | push-and-`rts` dispatch: the entries are `label-1` | 1 known | `$8C:F170` reads `$8C:F21E`, after `pea $F16D` |
| c | `jsl` / `jml`: free to move once labelled | 2,819 (500 targets) / 131 | every `jsl` targets the FastROM `$8x` mirror (`label-$400000`), and a move must keep it |
| d | return addresses built with `pea` | 178 `pea` (some are DB constants) | vblank `phk : pea $84C0 : jml [$0125]`, IRQ `pea $8501 : jml [$012B]`, `pea $9820` at `$8F:9817` |
| e | `phk : plb`: DB = the code's bank, so `.w` reads follow the code | 51 | 104 ROM operands read through DB |
| f | fall-through, mid-routine entries, data between code | ~483 named entries are not call targets | `$8F:866B`, `$90:8376`, `$80:D113`; handler tables with code right after them |
| g | vectors: 16-bit, targets in `$00:8000-$FFFF` | 6 | NMI `$823A`, IRQ `$84EA`, RESET `$8020`, COP/BRK `$885E`/`$885F` |
| h | cycles: the engine is time-sliced (a spare-time loop until NMI), so any change of cycles moves work between frames | — | promoted script calls leave WRAM step at frame 2,935 ([progress.md](progress.md) §2); C to ROM drifts per frame; `$40+` banks are slow ROM |
| i | pointers to code held in WRAM | 3 hooks + stack | `$7E0125`, `NMI_USER_HOOK_FAR_PTR` `$7E0128`, `IRQ_USER_HOOK_FAR_PTR` `$7E012B` (3 targets); 14 `pei ($22) : pei ($24)` around `jsl per_frame_field_tick` |
| j | other releases | — | PAL `$C0` code is shifted by `+$34C`, and 424 of 539 routines moved ([../evermore-releases.md](../evermore-releases.md)); the kind is US-only until PAL maps exist |

How much the CDL can see *(measured)*: of the 367 distinct targets in the six jump tables above, 301 (82 %) ran. The
other 18 % need a static pass from the table entry (M7). Bank `$91` ran 75 of its 82 effect-op targets, so the old
note that its handlers were never recorded is out of date.

## 5. The steps *(proposal)*

Each step ends at the usual gates (README.md §7): G0 stable, `--random` round trip, then `prove`.

| Step | What | Gate | Needs |
|---|---|---|---|
| **C0** | **Explode code pinned, labelled by explode** (§3.1). `code/<routine>.asm` is the Asar export cut per routine, with explode's names as its symbols. Each file carries its vanilla `org` as a placement rule (`bankOffset` + bank). Implode generates `_build/main.asm` + `symbols.asm` and runs Asar. No routine moves, but every data kind it reads may move | G0 (vanilla sha1); `--random` moves the other kinds and Asar rewrites the operands; `prove` | Asar in implode (owner's call 1); the cut (owner's call 3); `asar-export.ts` reads an explode index; the codecs' operand patches retired one by one |
| C1 | **New routines by name**: `code/<name>.asm` without `org` is placed by `placement.mts` in the 4th MB. Handler tables, `header.json` and other code name it, and a bank-local table gets a generated `jml` stub in its bank. The item and ingredient hooks move from TS byte arrays into this form | G0 with no new file; G2 with one new opcode or charm effect played | a "same bank as" rule or a stub per bank; 16 free bytes in `$8C` (`$8C:D880-$D88F`, [../todo/custom-opcodes.md](../todo/custom-opcodes.md)) |
| C2 | Symbols M0, M1, M4: game regions, local labels for the 227 `seg_+off` branches, DB-relative operands | the export still G0, and a padding test per bank (M8) | `asar-export.ts` |
| C3 | **Move `jsl`-only leaves**: an `rtl` routine with no `jsr.w` caller, no `phk : plb`, no `pea`/`per` and no mid entry. It moves inside FastROM (`$80-$BF` upper half, `$C0-$FF`) | `--random` + `prove --strict` | an xref count: which routines qualify (85 pure leaves among 291 bindable routines in replay 01) |
| C4 | Move a bank's handlers with their table (b), or a whole `jsr.w` group (a) | `prove --strict` | a free range in the bank or a stub; never a cross-bank change under `--strict` |
| C5 | Header vectors by name (S8) | G0 | C0 |
| C6 | M5-M7: address immediates, pointers in data, never-run code | the ratchet only shrinks | data flow, a static pass |

What stays pinned for good *(proposal)*: vector stubs and the NMI/IRQ trampolines; the `pea` return sites (`$80:84C0`,
`$80:8501`, `$8F:9820`, `$8C:F16D`) and the `label-1` table `$8C:F21E`; fall-through pairs; spin-waits on NMI and the
APU; the WRAM hook targets until their writers are symbolic; the SPC upload at `$8C:8000`; and every routine the CDL
never saw.

**The cycle rule** *(proposal)*. Under `--strict` (what `prove` builds), a routine moves only if its call form, its
bank and its FastROM speed stay the same. That gives the same cycles. A move that turns `jsr` into `jsl` or adds a
stub is a `--promoted`-class change, like absolute script calls: it plays the same scenes but not the same frames.

## 6. Decisions for the owner

1. **Asar in implode.** Bundle it (a binary, or a wasm build of the LGPL library) or require `ASAR` the way
   `tools/recomp` does. Without it, C1 hooks stay hand-assembled.
2. **Who places code.** Open Evermore's allocator writes an `org` per routine (as resources.md says), or Asar's
   `freecode`. Only one allocator can own the free space, so the proposal is ours.
3. **The cut.** One file per knowledge entry (1,553, some overlapping, ~483 of them mid-entries, and the summed sizes
   133,751 B exceed the 119,478 B recorded) or one per CDL function (987)? A fall-through chain must be one file
   either way.
4. **One owner for the 4th MB.** The hotkey hack uses `$F80000`, and C to ROM claims `$F8-$FB`. Everscript patches
   overlap at `$FE5000` and `$FE6000`, and MSU-1 also uses `$FE6000`. A code kind ends this only if those patches
   come in as tree files.
5. **Start with C1 before C0?** [review.md](review.md) §5 proposes a light hook mechanism first: new routines by name,
   with vanilla pinned. That gives modders new behaviour (an op that halves HP, a charm's effect, a Dog form's
   ability) without exploding the 119 KB.

## 7. Open questions *(to verify)*

- How many of the 681 `≥$8000` immediates are code addresses, and how many `jsr` sites take inline parameters?
- Which routine fills the 64 long pointers at `$7E0140`? Does any save field hold a code address?
- The WRAM census keys its reader sites by file address. When a routine moves, are they re-keyed to routine +
  offset, or are they holes in its item?
- What are the three `$EE` 24-bit operands, and the ~500 recorded code bytes that lie inside other kinds' pools?
- The C-to-ROM docs give three G1 counts (181 entries, 289, 315) and the code-vfs skill gives 27, which is stale.
