# Reverse engineering Secret of Evermore: tools, goals, plan

The one page that compares every reverse-engineering approach we have, says what each one can
reach, and how they combine. Details live in the linked docs; this page decides direction.

Last updated 2026-10-12 (v0.201.7).

---

## 1. Goals, in priority order

| # | Goal | Done means |
|---|---|---|
| **G1** | **Complete RAM map + ROM map** | Every WRAM byte has an owner, a size and a purpose (or is proven unused). Every ROM byte has an owner: code, a named table, or a decoded asset |
| **G2** | **Recomp with function names, every asset decoded and explained** | snesrecomp output boots; its functions carry our names, not `func_C08650`; every ROM asset has a decoder, a format doc and an editor or at least a viewer |
| G3 | Decomp in readable C | Engine routines replaced one by one with hand-written C that passes the per-frame WRAM diff |
| G4 | SA-1 patch | The game runs with an SA-1 cartridge layout and offloads work to the SA-1 |
| G5 | Mashup with other games | Content (rooms, sprites, music, mechanics) from other SNES games (e.g. Secret of Mana) or new content brought into SoE, or SoE content moved out. Legal note: a mashup ships as a patch that reads both games from the user's own ROMs |

G1 and G2 feed everything else: G3 needs names and known data, G4 needs a shiftable disassembly
(every pointer symbolised), G5 needs decoders, encoders and free space.

---

## 2. What we have

### 2.1 Our own tools (in this repo or next to it)

| Tool | What it gives | Where |
|---|---|---|
| **Embedded emulator + CDL recorder** | Runtime truth: code vs data per byte, M/X width per instruction, DB/D, call stack with real returns, jump-table targets, xrefs, WRAM R/W/width/values, DMA sources, SPC700 coverage. Mergeable library per ROM | `src/emulator/cdl/`, skill `cdl-recorder` |
| **Asar export** | Byte-identical, rebuildable disassembly; `ram.asm`, `tables/`, `enums`, `structs.h`, `functions.json`; snesrecomp `cfg` directives | `docs/workflows/cdl-export-build-recomp.md` |
| **snesrecomp** (external, fed by the export) | 65816 → C with M/X specialisation; `hle_func` to swap in hand-written C | `docs/asm-to-c-port.md` §5, §11 |
| **Headless snes9x under node** | Scripted runs, frame stepping, WRAM/VRAM dumps: automated coverage and lockstep diffs | memory note *headless boot* |
| **ROM tab (`src/rom/`)** | One owner per ROM byte for everything we can decode (rooms, graphics, sprites, animation, audio, strings, scripts), plus CDL counts per region | `src/rom/README.md` |
| **Decoders** | Rooms (LZSS, Markov grid, blob layout), map graphics, sprites, animation bytecode, sound packages, scripts (everscript decompiler) | `src/maps`, `src/sprites`, `src/music`, `../everscript` |
| **Knowledge base** | `functions.js`, `tables.js`, `ram-symbols` (names.json + tags), `soe://` MCP (ROM, assets, live WRAM, tags), everscript wiki `Rom-Map.md` / `Ram-Map.md` | skill `game-knowledge`, `docs/soe-filesystem-spec.md` |
| **Call-graph galaxy** | Visual map of the CDL library | `tools/call-graph-galaxy/` |

### 2.2 External tools

| Tool | What it gives | Status for us |
|---|---|---|
| **Ghidra + ghidra-snes** (MIT) | Static disassembly of the *whole* ROM, persistent project, GUI, scripting (Java/Python) to apply our context, C-header type import, decompiler | Works headless and in the GUI. Needs a local loader patch to map the `$80–$BF` code banks (see `docs/rea-reverse-engineering-mcp.md` §10) |
| **REA + Ghidra + ghidra-snes** (MIT) | An MCP/CLI front end over Ghidra: evidence-tagged answers, batch dossiers, agent-friendly | Works only with local patches to REA *and* ghidra-snes. Throwaway sessions, no custom scripts. Doc: `docs/rea-reverse-engineering-mcp.md` |
| **Mesen2** | Best SNES debugger: breakpoints, trace logger, its own CDL, label import | Useful for one-off investigations; our CDL uses its bit layout, so files interchange |
| **DiztinGUIsh** | Interactive CDL-driven disassembler → Asar | Windows-only; our export covers its output. See `docs/tracing-disassembler-and-asar-generation.md` §8 |
| bsnes-plus | Debugger with usage map | Superseded by Mesen2 + our CDL |

Not allowed: `SoETilesViewer`, `SoEScriptDumper` (GPLv3, AGENTS.md).

---

## 3. Side-by-side

| Capability | CDL + Asar + snesrecomp (ours) | Ghidra + ghidra-snes | REA (+ Ghidra + ghidra-snes) |
|---|---|---|---|
| Code vs data | ✅ exact, but only for executed bytes (~5 % of the ROM today) | ⚠️ guessed by flow analysis over the whole ROM; disassembles data if not told | same as Ghidra |
| M/X widths | ✅ recorded per instruction | ❌ default only; wrong after any `SEP/REP` it cannot follow, unless a script sets context | ❌ no way to pass context |
| DB / D | ✅ recorded | ❌ unknown → bad xrefs for 16-bit and DP accesses | ❌ |
| Jump tables, `PHA/PEA+RTS` | ✅ observed targets | ❌ mostly unresolved | ❌ |
| Callers / call graph | ✅ observed edges | ✅ static edges for direct `JSR/JSL`, including code never run (after the mirror patch) | ✅ same as Ghidra, via MCP |
| WRAM layout, structs, enums | ✅ widths, values, strides, enum handlers | ❌ | ❌ (labels only, via seeds) |
| Asset boundaries | ✅ for read / DMA'd data | ❌ | ❌ |
| Rebuildable output | ✅ byte-identical Asar | ❌ | ❌ |
| C output | ✅ machine C (snesrecomp) | ⚠️ pseudocode, not compilable, noisy on 65816 | ⚠️ same, marked `compilable: false` |
| Names | ✅ from our tables, into labels / snesrecomp | ✅ persistent in the project | ⚠️ seed file in, lost on close |
| Persistence | ✅ library on disk | ✅ project | ❌ re-import every session (~10 s) |
| Agent access | ⚠️ `soe://` MCP, no disassembly query | ❌ GUI / scripts | ✅ 170 MCP tools |
| Coverage limit | what was played | whole ROM, but quality drops where context is missing | same as Ghidra |
| Effort to keep working | ours | upstream + one local loader patch | upstream + patches to REA and ghidra-snes |

**In one line each:** the CDL knows *exactly* what ran and nothing else; Ghidra guesses about
*everything* and gets 65816 context wrong; REA is Ghidra with an agent-friendly front end and
fewer controls.

---

## 4. What each approach can reach, per goal

| Goal | CDL + Asar + snesrecomp | Ghidra + ghidra-snes | REA | Verdict |
|---|---|---|---|---|
| **G1 RAM map** | ✅ main source: every accessed byte with width, values, accessors; structs and enums | ⚠️ static xrefs to WRAM *only* for long addresses (`$7E:xxxx`); 16-bit ones need DB | ⚠️ same | CDL + longer recording; static xrefs add accessors from unplayed code |
| **G1 ROM map** | ✅ for executed code and read data; ROM tab owns everything decodable | ✅ finds code that never ran (direct-call reachable) | ✅ same, by agent | ROM tab + CDL, with Ghidra's static functions filling unplayed code |
| **G2 recomp** | ✅ the path (snesrecomp seeded from CDL); blocked on the host/frame driver | ❌ | ❌ | ours |
| **G2 names** | ✅ carrier: names flow into Asar labels and snesrecomp | ✅ good *workbench* for a human | ✅ good *workbench* for an agent: batch dossiers → proposed names | name in Ghidra/REA, store in `functions.js` |
| **G2 assets** | ✅ DMA/read boundaries, table assets | ❌ | ❌ | decoders in `src/maps` etc., ROM tab |
| G3 decomp | ✅ lockstep `hle_func` | ⚠️ reading aid | ⚠️ reading aid | ours; Ghidra/REA to understand a routine before writing its C |
| G4 SA-1 | ⚠️ `functions.json` lists SA-1 blockers per function | — | — | blocked by HiROM layout (`../evermore-sa1/README.md`): needs a shiftable disassembly first |
| G5 mashup | ⚠️ room moving works (v0.158.0); assets need encoders | — | — | decoders + encoders + free space; see `docs/asm-to-c-port.md` §8 |

---

## 5. Combining them

They are complementary, not alternatives. One loop, with **one name source**:

```text
          play / scripted headless runs
                    │
                    ▼
     CDL library (runtime truth, ~5 % today)
       │                     │
       │ seeds: functions,   │ export
       │ M/X, DB/D, labels   ▼
       ▼               Asar project ──► snesrecomp C ──► hle_func C (G3)
  Ghidra + ghidra-snes        ▲                ▲
  (static, whole ROM)         │                │
       │ statically found     │ labels         │ function names
       │ functions, callers   │                │
       ▼                      │                │
  REA / human: read, name ──► functions.js / knowledge entries / ram-symbols
                               (the single name source; seeds read it back)
```

Rules that make it work:
1. **Names live in one place** (`src/localizations/` and the knowledge entries). Ghidra
   projects, REA sessions and snesrecomp configs are generated from it, never edited as the
   source of truth.
2. **Runtime beats static.** Where the CDL has a fact (width, target, code/data), it overrides
   Ghidra. Ghidra fills only what the CDL has not seen, and those bytes stay marked "static".
3. **Everything checks against the ROM.** Asar rebuilds byte-identically; recomp/C checks
   against the per-frame WRAM diff.

---

## 6. Ideas worth cherry-picking

| From | Idea | Into | Gain |
|---|---|---|---|
| Ghidra | Static reachability from known entries | Asar export: mark statically found code as code instead of `incbin` (`asm-to-c-port.md` §11.4.1 already suggests the snesrecomp manifest) | More of the ROM map is code, more recomp seeds — without playing |
| Our CDL | M/X, DB, D, jump targets as a **Ghidra script** (context register + references) | Ghidra project | Fixes Ghidra's three biggest 65816 errors for the covered part |
| ghidra-snes patch | Map `$80–$BF` upper halves as *file-backed* blocks | Ghidra / REA | Calls link, seeds land where code runs (all 449 CDL entries are upper-half code) |
| REA | Seed TSV format (`addr<TAB>function|code|label<TAB>name`) | Our exporter | One generic hand-off format for Ghidra, REA, Mesen labels |
| REA | Evidence-tagged dossiers per function (asm, callers, callees, refs) | An agent naming loop | Batch first-pass names with evidence, `confidence: guess` |
| REA | Load-image verification (checks mapped bytes against the file) | Our Asar export check | Already have byte-identical rebuild; nothing to add |
| Headless harness | Scripted input + save state per room → long unattended CDL sessions | CDL library | The biggest lever for G1: coverage is 5 % |
| Mesen2 | Label file export (`.mlb`) from `functions.js` / `ram-symbols` | Mesen2 debugging | Our names in the best debugger |

---

## 7. Recommended order

1. **Coverage (G1).** Scripted headless runs through every room, menu, boss and death; merge
   into the library. Without this, every tool above stays at ~5 %.
2. **Static fill (G1).** Ghidra headless with the patched ghidra-snes, seeded from the CDL;
   export statically found functions and their direct-call edges back into the library as
   "static" facts; Asar export marks them as code.
3. **Naming loop (G2).** Batch dossiers (REA or a plain Ghidra script) → proposed names with
   evidence → `functions.js` / knowledge entries → seeds, Asar labels, snesrecomp names.
4. **Recomp boot (G2).** The host / frame driver for snesrecomp (`asm-to-c-port.md` §11.3.1).
5. **Assets (G2).** Close the ROM tab's unknown regions one decoder at a time; each gets a
   format doc and a viewer.
6. G3 / G4 / G5 build on the above: `hle_func` replacements, shiftable disassembly for SA-1 and
   free space, encoders for mashups.

## 8. Legal

Same rules everywhere (AI_ARCHITECTURE_GUIDE.md §3.8): the ROM, CDL libraries, Ghidra projects,
REA snapshots, disassembly, pseudocode and decoded assets stay outside the repo. The repo holds
our code and our own descriptions: names, addresses, formats and evidence.
