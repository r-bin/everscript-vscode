# File formats: what we use, what is compatible, what to add

## 1. What we have

| Layer | Files | Format | Verdict |
|---|---|---|---|
| CDL library (per ROM, outside the repo) | `rom.cdl` | one flag byte per ROM byte, Mesen-S / BizHawk bit layout, no header | ✅ keep. For Mesen2, also write its header variant (§3) |
| | `rom.ext`, `edges.bin`, `xrefs.bin`, `regs.bin`, `bases.bin`, `rets.bin`, `wram.*`, `*-hits.bin`, `aram.cdl`, `manifest.json` | our own compact binary records + JSON manifest | ✅ keep: fast to drain and merge, and every field has a commutative merge rule. Only we read them |
| Asar export | `main.asm`, `banks/`, `tables/`, `rooms/`, `ram.asm`, `enums.asm` | Asar source | ✅ the standard SNES assembler; rebuilds byte-identically |
| | `structs.h`, `tables.h` | C headers | ✅ already compatible: Ghidra parses C headers, snesrecomp and C ports include them |
| | `functions.json`, `tables.json`, `enums.json`, `structs.json` | our JSON | ✅ fine; candidates for one canonical symbol file (§2) |
| | `recomp/cfg/bankXX.cfg` | snesrecomp's directive format | ✅ required by its parser (`recompiler/v2/cfg_loader.py`) |
| Names | `functions.js`, `tables.js`, `src/script/names.json`, `knowledge/{ram,rom}/*.md` | JS tables, JSON, Markdown with front matter | ⚠️ four sources. Markdown entries are the target format (skill `game-knowledge`), but nothing loads them yet |

Overall the internal formats are sound. What is missing is **interchange**: our names and facts
reach only our own tools. Mesen2, Ghidra, REA, bsnes-plus and snesrecomp each want their own
format.

## 2. Proposal: one canonical symbol set, many adapters

Generate one file, `symbols.json`, from the name sources and the library. Write every tool
format from it, never by hand.

```text
functions.js ─┐
tables.js ────┤                          ┌─► Mesen2 labels (.mlb)
names.json ───┼─► symbols.json ──────────┼─► Ghidra seeds (TSV) + context (TSV) + structs.h
knowledge/*.md┤   (canonical, generated) ├─► REA seeds (same TSV)
CDL library ──┘                          ├─► WLA-DX style .sym (bsnes-plus and others)
                                         ├─► Asar labels / snesrecomp names
                                         └─► soe:// (already reads the sources)
```

One record per symbol:

| Field | Meaning |
|---|---|
| `addr` | execution bus address (`$8x` for upper-half code, see skill `snes-memory-mapping` §5) |
| `file` | file offset (dedupe key: one byte has two bus addresses in HiROM) |
| `space` | `rom`, `wram`, `sram`, `io` |
| `kind` | `function`, `code`, `label`, `table`, `var`, `struct`, … |
| `name`, `title` | identifier and human label |
| `size` / `end` | for data |
| `confidence` | `guess`, `likely`, `confirmed` |
| `source` | `curated` (our tables), `recorded` (CDL), `static` (Ghidra) |
| `evidence` | short strings, as in the knowledge entries |

The file holds addresses and our own names, no ROM bytes. It is generated, so it lives with the
export (outside the repo) or is produced on demand.

## 3. Compatible formats worth emitting

| Format | Consumer | Shape | Gain |
|---|---|---|---|
| **Mesen2 `.cdl`** | Mesen2 | ASCII `CDLv2`, then the ROM's CRC32 (little-endian), then one flag byte per ROM byte. Header-less files still load, with a warning (read in Mesen2's source, 2026-10-12) | Our coverage in the best SNES debugger, without the warning |
| **Mesen2 labels `.mlb`** | Mesen2 | one label per line: `memorytype:address[-end]:label[:comment]`; the address is an offset inside that memory type, in hex; newlines in comments are written as `\n` (read in Mesen2's source, 2026-10-12) | Our names while debugging. Check the exact SNES memory-type names (e.g. PRG ROM, work RAM) in Mesen2's `MemoryType` enum before writing the exporter |
| **Seed TSV** `addr<TAB>function\|code\|label[<TAB>name]` | REA (`REA_GHIDRA_SEED_FILE`), our Ghidra script | REA's format, simple enough to adopt as-is | Same file for REA and plain Ghidra |
| **Context TSV** `addr<TAB>M<TAB>X<TAB>DB<TAB>D` | our Ghidra script | ours | Fixes Ghidra's width and bank errors (ghidra.md §2) |
| WLA-DX style `.sym` (`bank:addr name`) | bsnes-plus and other debuggers/assemblers | widely used plain text; check each consumer's exact syntax | Low effort once `symbols.json` exists |

## 4. Does REA use better formats?

Not better for our data, but two ideas are worth taking:

- **Evidence envelope.** Every REA result carries the subject's SHA-256, the provider and its
  version, a digest of the analysis profile, the parameters and a `limitations` list. Ours: the
  library has the ROM SHA-1 in `manifest.json`, but exports and knowledge evidence carry no
  provenance. Borrow it: stamp every export (and `symbols.json`) with ROM SHA-1, library digest
  and tool version, so stale exports are detectable and evidence strings can cite their source.
- **Seed TSV.** Adopt as the Ghidra hand-off format (§3).
- Its output format TOON (token-efficient for LLMs) and its JSON evidence bundles are designed
  for REA's own pipeline. Our Markdown knowledge entries are already readable by agents.
