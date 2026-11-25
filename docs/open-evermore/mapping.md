# Open Evermore: moving memory-map facts out of the codecs

Status: **analysis and proposal (2026-11-25), nothing built.** Back to [README.md](README.md). Labels as there.
Related: [manifest.md](manifest.md) §1.3–§1.4 (regions and placement, designed but not read yet), [roadmap.md](roadmap.md)
(names, not addresses).

**Question (owner, 2026-11-25).** Explode and implode hold a lot of knowledge about the memory map: where each
table is, which code reads it, and where a resource may go (where strings may go, where menu texts may go, and so
on). Can that knowledge move into the manifest, or into a separate mapping file?

**Answer.** Mostly yes, but not into the manifest. About 220 distinct file offsets live in 34 codecs
*(repo: `grep 0x[0-9A-F]{5,6}` over `tools/open-evermore/evermore/`)*. They fall into five groups (§1). Three groups
are plain data: where things are, which pointer form reads them, and what space the game reads past its end. These
can move into a **game mapping file**, one per release (§2). The user's choices (free and reserved space, faster or
slower ROM, preferred banks) belong in `manifest.json` as manifest.md already designs it (§3). The other two groups
(instruction shapes and record formats) stay in code (§4).

---

## 1. What the codecs know today

| Group | Examples *(repo)* | Count | Moves? |
|---|---|---|---|
| **A. Placement rules** (the `Rule` of each item, `codec.mts`) | strings `{ lowerHalf, noCrossBank, below: 4 MiB }`; texts `{ above: $C4, below: $C5, noCrossBank }`; scripts `{ window: $92–$BF }`; maps `{ upperHalf, noCrossBank, maxSize: 32 KiB }`; music `{ upperHalf, noCrossBank, noBankEnd, below: 4 MiB }`; metasprites `$CA–$D3`; sprite blocks `above: base bank, below: 4 MiB` | ~25 shapes, 20 kinds | **yes**, as pointer forms (§2.1) |
| **B. Sites**: where a table is and the operands that read it | strings `SITES = [$8C:CCF7, $8C:CD35]`; scripts `READERS` (4); tiles `READERS` (6); ingredients `GET16`/`PUT16`/`GET8`/`BOUNDS`/`ICON_SITES` (14); items `TABLE_SITES`, `GET16`, `DISPATCH_AT`; music `COUNT_AT`, `POINTERS`, `PACKAGE_OF_MUSIC` | ~150 | **yes** (§2.2) |
| **C. Game facts about the image** | `PAST_END` (`$B0:E293`+, kinds.mts); the script window; `SPRITE_PALETTE_BASE`; bank-`$C4` text bank | ~10 | **yes** (§2.3) |
| **D. Instruction shapes and checks** | `SITE = [$A9, -1, $00, $85, $28, …]` (strings); `tableAt` requires `lda.l` (`$BF`); `ADC`/`LDA` opcodes (palettes) | per site | no: code (§4) |
| **E. Record formats** | strides (`PROJECTILE_STRIDE = 24`, `WEAPON_STRIDE = 36`), counts (`VANILLA = 127`), limits (`LIMIT = 0x10000 / 3`) | ~60 | no: format, not map (§4) |

**The same fact in several codecs.** The weapon records `$C4:38E6` appear in animation-analysis, sprite-palettes and
equipment. The ring pointers `$CE:8000` appear in alchemy, animation-analysis, menus and sprite-palettes. The
projectile table `$D0:D986` appears in three codecs, `TEMP = $2834` (WRAM) in four, the bank base `$C4` in eight
and the 4 MiB bound in seven. Moving these facts to one file fixes the duplication right away, before anything
else changes.

**A rule mixes three things.** Take `below: 0x400000`. It is a fact about the pointer (`$C0`-based, so it reaches only
the first 4 MB), written as an address range that holds only under `hirom`. Under `exhirom` the second 4 MB is
`$40–$7D`, and only a pointer form can say whether a reader reaches it (layouts.mts `pointer`). In the same way,
`pinned(home)` (graphics, projectiles, texts and metasprites at home) is not a fact about the map. It marks a reader
the codec does not rewrite yet. A mapping file has to keep these apart.

---

## 2. The game mapping file *(proposal)*

**Where:** `tools/open-evermore/evermore/map/<release>.json` (for now only `us-1.0.json`). It holds game facts, so
it goes with the game's codecs, not in the tree. A user cannot change what the engine reads, and the tree carries no
derived data (roadmap.md). Each entry names the knowledge entry or doc that gives its evidence (standing rule 2). The
addresses are written once, here, and the codecs import them by name.

### 2.1 Pointer forms and kinds

A **pointer form** says how the engine turns stored bits into an address. From the form and the layout, the tool
works out where a resource can be reached. A kind then names its form and adds only the limits that come from how
its data is read.

```jsonc
"pointerForms": {
  "long":        { "bits": 24, "why": "lda.l / 3-byte entry: any ROM bank" },
  "lowerKey":    { "offset": "bits 0-14, lower half", "bank": "bits 15-22 + $C0", "why": "dialogue-text-decoder.md" },
  "upper16":     { "half": "upper", "bank": "stored separately, $80-$BF form" },
  "bank16":      { "bank": "fixed per kind", "why": "16-bit pointer, the reader loads the bank as an immediate" },
  "bankPlus7":   { "bank": "base + 7 bits", "why": "sprite-blocks.mts: base $D9 (16x16), $D1 (8x8)" },
  "window":      { "banks": "$92-$BF", "half": "upper", "why": "packed script pointer, docs/scripts/vm.md" },
  "bankOffset":  { "why": "kept by 16-bit address, only the bank moves" }
},
"kinds": {
  "strings":     { "form": "lowerKey", "noCrossBank": true },
  "texts":       { "form": "bank16", "bank": "$C4", "why": "printed by $8C:9E03 with bank #$C4" },
  "scripts":     { "form": "window" },
  "maps":        { "form": "upper16", "noCrossBank": true, "maxSize": "32KiB" },
  "music":       { "form": "upper16", "noCrossBank": true, "noBankEnd": true, "why": "progress.md §2, bank turns cost cycles" },
  "metasprites": { "form": "bank16", "banks": "$CA-$D3" },
  "tiles":       { "form": "long", "noCrossBank": true, "why": "DMA source stays in its bank" },
  "characters":  { "form": "bankOffset", "offset": "$B678", "half": "upper" }
}
```

- **The reach comes from the layout.** `lowerKey` reaches the lower halves of `$C0–$FF`. Under `exhirom` that still
  means the first 4 MB, and the tool works this out (layouts.mts) instead of every codec writing `below: 4 MiB`.
- **Rule fields stay as they are.** `codec.mts`'s `Rule` stays the allocator's input. One function turns
  (kind entry, layout) into a `Rule`, so layout.mts does not change, and neither do G0 or the random proofs.
- **Per-item rules stay in code.** An animation script's bank is its connected group's bank (animations.mts:415).
  An item at home (`pinned`) stays a codec decision with its own reason ("reader not rewritten"). The mapping file
  gives only the kind's widest allowed space.

### 2.2 Sites

```jsonc
"sites": {
  "strings.keyTable":   { "at": "$91:D000", "readers": ["$8C:CCF7", "$8C:CD35"], "knowledge": "routines/…" },
  "scripts.table":      { "readers": ["$8C:CE64+0", "$8C:CE6A+2", "$8C:D3B6+0", "$8C:D3BC+2"] },
  "tiles.table":        { "readers": ["$8C:C899+0", "$8C:C8A2+2", "$90:A16B+1", "$90:A171+0", "$90:A238+1", "$90:A23E+0"] },
  "weapons.records":    { "at": "$C4:38E6", "stride": 36, "count": 12 },
  "rings.pointers":     { "at": "$CE:8000", "count": 162 }
}
```

- An entry gives an address and, for a reader, the amount it adds (`+2`). The instruction shape it must match
  stays with the codec, which checks it at explode, as `tableAt` and the strings `SITE` pattern do now. A mismatch
  still says "another release?". It now also names the mapping file to fix.
- **What this gains:** a PAL build (docs/evermore-releases.md) becomes a new `<release>.json` plus the checks,
  not a set of code edits, as long as its instruction shapes match. `manifest.base.release` selects the file.
- It also makes the map visible. One file lists every byte of code implode rewrites. The ROM tab and `soe://` can
  then show "implode writes here".

### 2.3 Image facts

`pastEnd` (`$B0:E293`+, 1,984 bytes), the `window`s the proof translates (kinds.mts `POINTER_WINDOWS`), and the
fixed text bank. SNES and converter facts (the SA-1 boot block `$B8:8000`, ExHiROM bank `$40`, WRAM `$7E–$7F`)
stay in layouts.mts. They hold for any game (standing rule 4).

---

## 3. What goes in `manifest.json` instead

The manifest holds what the user may decide (manifest.md §1.3–§1.4). Today explode writes a single `rom` region and
an empty `placement` (manifest.mts `manifestFor`). Implode reads only `free` regions and never reads `placement`
(implode.mts stage 5). With §2 in place:

- **`regions`:** explode writes `free` and `reserved` (the everscript hacks at `$F0`, `$FC–$FF`, table-hack.md §1)
  as manifest.md §1.3 designs.
- **`placement`:** per kind, these settings can only tighten a rule (the `rule-loosened` error names the mapping
  entry): `speed`, `banks` (a subset of what the form reaches), `half`, `prefer`.
  Example: keep dialogue in `$C0–$C3` and put grown ingredients in the 4th MB.
- **Strings and menu texts as the worked case.** The mapping file says that strings go in a lower half,
  reachable by a key, never across a bank, and that texts go in bank `$C4`. The manifest may say
  `"strings": { "banks": "$C0-$C3" }`. It cannot say `"texts": { "banks": "$C5" }`: that loosens the rule and is an
  error. To move texts out of `$C4`, a codec has to rewrite the bank immediates at the text readers. Those
  readers then become sites, and the kind's form changes. That work is codec work, not a mapping edit.

---

## 4. What stays in code, and why

- **Instruction shapes and checks (D).** They are how a codec knows that a site is what it claims to be. Data
  that describes code shapes would be "code in strings" (AI_ARCHITECTURE_GUIDE.md). The mapping file says
  *where*. The codec says *what it expects there* and refuses a ROM that does not match.
- **Record formats (E).** Strides and field layouts belong to a kind's encoder and its schema. Moving them out
  would scatter one format over two files. Vanilla counts can come from the mapping file where a site holds
  them (`count` above). Limits follow from the pointer form (`0x10000 / 3`).
- **WRAM** (`TEMP = $2834`, items' `SAVED` ranges). These are allocations for the `wram` kind
  ([wram.md](wram.md), docs/todo/wram-allocation.md), not part of the ROM map. They should come from the `wram`
  kind by name, not from a second file.

---

## 5. Order of work and cost *(proposal)*

1. **Shared constants, no new format.** One `evermore/map.mts` that exports the addresses several codecs share
   (weapon records, ring pointers, projectile table, `$C4`, 4 MiB). This is quick, fixes the duplication, and
   G0 proves it (no byte changes).
2. **Sites into `map/us-1.0.json`**, kind by kind, with the codec's shape check kept. G0 and one `--random` seed
   per kind (feedback: test what breaks, no multi-seed prove for a move like this).
3. **Pointer forms and kinds (§2.1)**, with the `Rule` derived from them. The derived rules must equal today's under
   `hirom`, which a unit test can check rule by rule for every item of a vanilla explode. The `exhirom` reach then
   comes for free.
4. **Read `placement` in implode** (§3) with `rule-loosened`. Explode writes the real `regions`.

Risk: low for 1–2 (data moves, G0 catches every mistake). Step 3 changes how rules are made, and the rule-equality
test is what makes it safe.

## 6. Open questions for the owner

- One file per release (`us-1.0.json`), or one file with a column per release once a second release appears?
- Should the sites also be published in `soe://` (for example `soe://rom/open-evermore/sites.md`), so the ROM tab
  and the AI can see which bytes implode rewrites?
- Should a kind's `pinned` items (readers not rewritten yet) be listed in the mapping file as known gaps, or stay
  in each codec's header comment?
