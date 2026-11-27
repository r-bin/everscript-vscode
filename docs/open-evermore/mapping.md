# Open Evermore: the game mapping file

Status: **built (2026-11-25, v0.471.0)** for the US release: `tools/open-evermore/evermore/map/us.json`, read
through `evermore/map.mts`; drafts for the PAL releases through `locate` (§6). Not yet: reading the manifest's
§3's `regions`. Back to [README.md](README.md). Labels as there. Related: [manifest.md](manifest.md) §1.3–§1.4,
[roadmap.md](roadmap.md) (names, not addresses), [../evermore-releases.md](../evermore-releases.md).

**Question (owner, 2026-11-25).** Explode and implode held a lot of knowledge about the memory map: where each table
is, which code reads it, and where a resource may go (where strings may go, where menu texts may go). Can it move
into the manifest, or a mapping file? Keep in mind the language releases: the same content compiled to other banks.

**Answer.** Into a mapping file per release, not the manifest. A user cannot change what the engine reads, and the
tree carries no derived data. The user's choices (free and reserved space, preferred banks) belong in
`manifest.json` (§3). Instruction shapes and record formats stay in code (§4).

---

## 1. What the codecs knew

About 220 distinct file offsets in 34 codecs *(repo, v0.470.0)*, in five groups:

| Group | Examples | Now |
|---|---|---|
| **A. Placement rules** (`Rule`, `codec.mts`) | strings `{ lowerHalf, noCrossBank, below: 4 MiB }`, texts bank `$C4`, scripts window `$92–$BF`, maps `{ upperHalf, noCrossBank, maxSize: 32 KiB }`, music `noBankEnd`, metasprites `$CA–$D3` | `placement` in the map (§2.2) |
| **B. Sites**: where a table is and the operands that read or bound it | strings key table immediates `$8C:CCF7`, `$8C:CD35`; tiles readers (6); ingredients count reads and writes (9), ring sites (37) | `addresses` in the map (§2.1) |
| **C. Image facts** | the bytes read past the 3 MiB end (`$B0:E293`+) | `pastEnd` in the map |
| **D. Instruction shapes and checks** | strings `SITE = [$A9, -1, $00, $85, $28, …]`; `tableAt` wants `lda.l` (`$BF`) | code (§4) |
| **E. Record formats** | strides, vanilla counts, limits | code (§4) |

Several facts were repeated: the weapon records in three codecs, the ring pointers in four, the bank-`$C4` base in
eight and the 4 MiB bound in seven. Each is now one entry.

---

## 2. `map/<release>.json` *(repo)*

`<release>` is the variant id of `src/games/evermore/descriptor.ts` (`us`, `eu`, `de`, `fr`, `es`, `es-rev2`), the
`base.release` explode writes into `manifest.json`.

```jsonc
{
  "release": "us", "name": "Secret of Evermore (USA)", "what": "…",
  "extends": "us",                      // another release only: its entries replace the parent's of the same name
  "addresses": { "<kind>": { "<entry>": <value> } },
  "placement": { "<kind>[/<form>]": { "why": "…", … } },
  "pastEnd": [["$B0:E293", 1984]]
}
```

### 2.0 Memory regions *(v0.474.0; parts and saved blocks v0.475.0)*

`"memory": { "wram": { "<region>": { "span": ["$7E:0000", "$7E:00FF"], "reach": "direct", "why": "…" } } }`: each memory's
regions in address order, no hole or overlap inside a bank. `reach` says how the engine addresses the region (`direct`:
1-byte direct page; `mirror`: 16-bit absolute from the code banks, so only `$0000`-`$1FFF`; `bank`: 16-bit absolute with
the data bank set; `long`). It is what forces a variable into its region. Read with `map.memory('wram')`. The `wram`
kind's files carry no addresses ([wram.md](wram.md) §0).

A region may list `parts` (v0.475.0), `[name, vanilla start, what it holds]` in order, the first at the region's start:
each is one file of the tree (`wram/<name>.json`), so names are unique across regions and never another kind's file name
(`metatiles.json`, `font.json`). `saved` lists the blocks of the region the save routine copies (`[first, last]`).

Beside the mapping file, `<release>.wram-readers.json` is the WRAM reader census (`tools/open-evermore/wram-census.mts`, from
the vanilla CDL library; `map.wramCensus()`): per vanilla place the operands that reach it (movable), or why not
(pinned). ROM addresses and offsets only, generated, checked in. A release without one moves nothing.

### 2.1 Addresses

Written as the game addresses them (HiROM; the file offset is the address `& $3FFFFF`). The codecs read them by
name through `map.mts`, `import * as map from '../map.mts'`:

| Value | Accessor | Example |
|---|---|---|
| `"$8C:CCF7"` | `map.file` (file offset), `map.bus` (exactly as written: the form the game's own pointers use), `map.offset` (16 bits) | `alchemy.ingredient_names` `$C4:5FF3`; `characters.records` `$8E:B678` |
| `"$8C:CE6A+2"`, `"$8D:B677-3"` | `map.readers`: the operand of an `lda.l` and what it adds to the table | `scripts.table_readers`, `experience.boy_readers` |
| `"$8C"` | `map.bank` (an address gives its bank too) | `sprite_blocks_16.base` `$D9` |
| `[ … ]` | `map.files`, `map.readers` | `rings.boy_options_sites` |

A list that code pairs with its own words (a ring site's `when`) is zipped by index, and a length mismatch throws
(`menus.mts` `sitesOf`). `common.data_bank` (`$C4:0000`) is the bank the records, menu texts and fonts sit in.

### 2.2 Placement

The kind-level rule the allocator gets (`map.rule(kind)` → `Rule`). Per-item rules stay in code: a resource pinned at
its home (`pinned`, its reader is not rewritten yet), an animation script's bank (its connected group's), a music
package that crossed a bank (its offset kept).

| Field | Rule | Used by |
|---|---|---|
| `half` `upper` / `lower` | `upperHalf` / `lowerHalf` | maps, palettes, music, characters / strings |
| `banks` `"$C4"`, `"$CA-$D3"` | `above`, `below` (file offsets, end exclusive) | texts, animation records, metasprites |
| `window` `"$92-$BF"` | `window` (upper halves read as one space) | scripts, `music/window` |
| `reach` `first4MiB` | `below` 4 MiB: a `$80`/`$C0`-form pointer reaches the first 4 MB in any layout | strings, music, characters, sprite blocks, grown tables |
| `bankOffset`, `noCrossBank`, `noBankEnd`, `noPageCross`, `maxSize` | as named | |

`why` is required in spirit: each says what in the engine makes the rule.

### 2.3 One release per process

The codecs read the map when they load. The CLI therefore reads the ROM (explode) or the manifest (implode, prove)
first, calls `selectRelease`, and only then imports `evermore/kinds.mts`. Selecting another release after the codecs
read one throws; reading with none selected means `us` (tests, tools that import a codec). An unknown ROM (no
variant) is read as `us`, and the codecs' own checks refuse what they do not know ("another release?"). A release
without a file stops with `no mapping file for release "<id>"`.

### 2.4 Proof *(2026-11-25)*

The migration changed no byte: a tree exploded with v0.470.0 and one exploded with the map are identical
(36,792 files, `diff -r`); `implode --strict` gives the vanilla sha1; `implode --random 7` and `--random 12345` give
the same sha1 with both, so the placement rules are the same. `tests/open-evermore/map.test.mts` (unit) checks that
every value parses, that every address a codec asks for is in `us.json` and every one there is asked for, the rules
against the literals they replaced, `extends`, and the one-release rule.

---

## 3. What goes in `manifest.json`

The manifest holds what the user may decide (manifest.md §1.3–§1.4). Explode writes one `rom` region and an empty
`placement`.

- **`regions`** *(proposal)*: explode writes `free` and `reserved` (the everscript hacks at `$F0`, `$FC–$FF`, table-hack.md §1).
- **`placement`** *(repo, v0.473.0, manifest.md §1.4)*: per kind, `banks` and `half`, which only narrow the map's rule
  (`rule-loosened` otherwise); `speed` and `prefer` planned. Measured 2026-11-27 on a fresh US tree:
  `strings` `$C0-$C3` builds the vanilla sha1 (`--strict`); `strings` `$F0-$FF` with `--random 7` puts all 3,002 strings
  in the 4th MB and round-trips; `texts` `$C5` and `strings` `half: upper` are `rule-loosened`.
- **Strings and menu texts.** The map says strings go in a lower half of the first 4 MB, never across a bank, and
  menu texts in bank `$C4`. A manifest may say `"strings": { "banks": "$C0-$C3" }`, never `"texts": { "banks":
  "$C5" }`. Texts outside `$C4` need a codec that rewrites the bank immediates of their readers: those readers then
  become addresses of the map, and its placement changes. Codec work, not a map edit.

---

## 4. What stays in code, and why

- **Instruction shapes and checks.** How a codec knows a site is what it claims to be. The map says *where*; the
  codec says *what it expects there* and refuses a ROM that does not match. Data describing code shapes would be
  code in strings (AI_ARCHITECTURE_GUIDE.md).
- **Record formats.** Strides, fields, vanilla counts, limits: a kind's encoder and schema. (A PAL build has other
  counts too, such as about 3,080 strings: a release that needs them moves them into its map then.)
- **WRAM** (`TEMP = $2834`, the save ranges): the `wram` kind's ([wram.md](wram.md)).
- **Generated tables' rule** (`{ noCrossBank }`): a property of the tool's tables, not of a reader.

---

## 5. The language releases

The PAL builds are recompiled, not patched (evermore-releases.md §5): the character records stay at `$8E:B678`, but
the string key table moved to `$92:8000` with another decompressor, and code and data elsewhere sit at other
addresses. So:

- **A release is one file.** `eu.json` would `extends: "us"` and give what differs; `de.json` could extend `eu`
  (same build family), `es-rev2.json` extend `es`. Placement is engine behaviour and usually inherits.
- **Where the codec differs** (the PAL text system), the map is not enough: the codec gains the other form, and its
  addresses go to that release's file.

## 6. Drafting a release's map: `locate` *(repo)*

`open-evermore.mts locate <rom> [--out <dir>]` (`evermore/map-locate.mts`) finds every address of `us.json` again in
another release by the US ROM's bytes: the 16–64 bytes at it, found once (a table, a record, unchanged code), else
the 8–48 bytes before and after it with its own 3 left out (an operand that now points elsewhere). Only a unique hit
counts; banks are not searched. It writes `out/open-evermore-map/<release>.draft.json`: what moved, in `extends: "us"`
form, and `open`, what a person has to find. **A draft is a proposal**: each entry is checked against that release's
code before the file goes to `evermore/map/`.

Measured 2026-11-25 on the five PAL ROMs (218 addresses, 4 of them banks):

| Release | same place | moved, found by bytes | moved, found by the code around | not found |
|---|---:|---:|---:|---:|
| us (self-check) | 214 | 0 | 0 | 0 |
| eu | 37 | 40 | 7 | 130 |
| fr, es, es-rev2 | 41 | 46 | 9 | 118 |

- Found: mostly data tables (alchemy, equipment, consumables, HUD, music, palettes) and a few reader sites
  (eu: the enemy index readers at `$8C:E0A3`… for US `$8C:DCA2`…).
- Not found, as expected: everything of the strings kind (rebuilt text system), and most code sites (recompiled
  code around them). The character records are `open` though they are at the same address: their first bytes
  differ.
- Not checked yet: no PAL draft has been proven by exploding that ROM. That is the next step for a PAL release.

## 7. Decided and open

- *Decided (2026-11-25):* one file per release, `extends` for what is shared; release ids are the variant ids.
- *Open:* publish the addresses in `soe://` (which bytes implode rewrites) for the ROM tab and the AI?
- *Open:* list the `pinned` items (readers not rewritten yet) in the map as known gaps?
- *Next:* §3's `regions` (the hacks' reserved space); `speed` and `prefer`; a PAL draft proven by exploding its ROM.
