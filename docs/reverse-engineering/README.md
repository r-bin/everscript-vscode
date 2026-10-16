# Reverse engineering Secret of Evermore

The master page: what we want, which approaches we have, how each goal is reached, and which
approach to improve or borrow from. Details live in the pages linked below.

Last updated 2026-10-12 (v0.201.9).

**Build everything we know into a recomp and see what blocks it:** `npm run recomp` ([tools/recomp/README.md](../../tools/recomp/README.md)).

## Pages

| Page | Approach / topic |
|---|---|
| [cdl.md](cdl.md) | **Our CDL recorder + Asar export**: strengths, limits, what the emulator could record next |
| [cdl-export-build-recomp.md](cdl-export-build-recomp.md) | Workflow: record → export → build ROM + `.cdl` → snesrecomp C |
| [cdl-design-history.md](cdl-design-history.md) | Original design and what was built (§9) |
| [asm-to-c-port.md](asm-to-c-port.md) | **snesrecomp + lockstep `hle_func`**: the path to C, room ids, status |
| [incremental-decomp-guide.md](incremental-decomp-guide.md) | **Step-by-step incremental decomp**: from mechanical C to verified idiomatic C with examples |
| [ghidra.md](ghidra.md) | **Ghidra + ghidra-snes**: what for, plugin gaps, setup with workarounds, VFS |
| [docs/recomp/](../recomp/README.md) | **Static recompilation (snesrecomp)**: [setup](../recomp/setup.md), [Game RTL glue](../recomp/game-rtl.md), [debugging](../recomp/debugging.md), [bugs & roadmap](../recomp/bugs-and-todos.md) |
| [recomp-bug-hunt.md](recomp-bug-hunt.md) | *(Moved to [docs/recomp/bugs-and-todos.md](../recomp/bugs-and-todos.md))* |
| [recomp-host.md](recomp-host.md) | *(Moved to [docs/recomp/game-rtl.md](../recomp/game-rtl.md))* |
| [rea.md](rea.md) | **REA** (MCP over Ghidra): answers, spike recipe and results |
| [formats.md](formats.md) | File formats we use, compatible formats to emit, what REA's formats add |
| [other-tools.md](other-tools.md) | Mesen2, Asar, DiztinGUIsh, bsnes-plus, everscript, SA-1 investigation |
| [community-ghidra-notes.md](community-ghidra-notes.md) | Old hand-annotated community Ghidra project: its terms vs ours, tables, field names, formulas, leads to check |
| [docs/patches/](../patches/README.md) | **Patches & community hacks**: catalog of public patches, balance overhauls, engine bugfixes, and system mods |

Skills: `cdl-recorder`, `ghidra-analysis`, `game-knowledge`, `snes-memory-mapping`,
`snes-asm-asar-patching`. Agent: `re-curator` (§7).

---

## 1. Goals, in priority order

| # | Goal | Done means |
|---|---|---|
| **G1** | **Complete RAM map + ROM map** | Every WRAM byte has an owner, a size and a purpose (or is proven unused). Every ROM byte has an owner: code, a named table, or a decoded asset |
| **G2** | **Recomp with function names; every asset decoded and explained** | snesrecomp output boots; its functions carry our names; every ROM asset has a decoder, a format doc and a viewer or editor |
| G3 | Decomp in readable C | Engine routines replaced one by one with hand-written C that passes the per-frame WRAM diff |
| G4 | SA-1 patch | The game runs on an SA-1 layout and offloads work to the SA-1 |
| G5 | Mashup with other games | Content (rooms, sprites, music, mechanics) moved between SoE and other SNES games (e.g. Secret of Mana), shipped as a patch that reads the user's own ROMs |

G1 and G2 feed the rest: G3 needs names and known data, G4 needs a shiftable disassembly (every
pointer symbolised), G5 needs decoders, encoders and free space.

## 2. The approaches in one table

| Capability | CDL + Asar + snesrecomp (ours) | Ghidra + ghidra-snes | REA (over Ghidra) |
|---|---|---|---|
| Code vs data | ✅ exact, for executed bytes only (~5 % today) | ⚠️ guessed over the whole ROM | same as Ghidra |
| M/X widths, DB/D | ✅ recorded | ❌ unless a script applies them from the CDL | ❌ no way to pass them |
| Jump tables, `PHA/PEA+RTS` | ✅ observed targets | ❌ mostly unresolved | ❌ |
| Call graph | ✅ observed | ✅ static, direct calls, incl. unplayed code (after the loader patch) | ✅ same as Ghidra |
| WRAM layout, structs, enums | ✅ | ❌ | ❌ |
| Asset boundaries | ✅ for read / DMA'd data | ❌ | ❌ |
| Rebuildable output | ✅ byte-identical Asar | ❌ | ❌ |
| C | ✅ machine C (snesrecomp), readable via `hle_func` | ⚠️ pseudocode, unusable on 65816 | ⚠️ same |
| Persistence | ✅ library | ✅ project | ❌ re-import per session |
| Agent access | ⚠️ `soe://` (no disassembly queries yet) | ❌ GUI / scripts | ✅ MCP |
| Upkeep | ours | one local loader patch (upstreamable) | patches to REA *and* ghidra-snes |

**In one line each:** the CDL knows *exactly* what ran and nothing else. Ghidra guesses about
*everything* and gets 65816 context wrong unless we feed it ours. REA is Ghidra with an agent
front end and fewer controls. **Decision: CDL first, Ghidra (headless, scripted) as the static
complement, REA optional.**

## 3. How each goal is reached

### G1 — RAM map + ROM map (highest priority)

| Step | Approach | Status / what to build |
|---|---|---|
| 1. Raise coverage from ~5 % | CDL + headless harness: scripted inputs from a save state per room, menu, boss, death | harness exists; scripted runs and save-state set to build ([cdl.md](cdl.md) §3) |
| 2. Record context | CDL improvements 1–3: room/mode/NMI tags, data lineage, DMA destinations | to build ([cdl.md](cdl.md) §2) |
| 3. Fill unplayed code statically | Ghidra headless, seeded + context-applied from the CDL, exports `static.json` into the library | loader patch done locally; seed/context export and Ghidra scripts to build ([ghidra.md](ghidra.md)) |
| 4. Name and explain | `re-curator` agent passes over the gaps, writing `functions.js` / knowledge entries with evidence | agent defined (§7) |
| 5. Publish the maps | generator: knowledge entries + library + ROM tab model → RAM map and ROM map (wiki §4 and `soe://`) | ROM tab exists; entry loader and map generator to build |

### G2 — Named recomp + every asset decoded (highest priority)

| Step | Approach | Status / what to build |
|---|---|---|
| 1. Boot snesrecomp output | host / frame driver ([docs/recomp/game-rtl.md](../recomp/game-rtl.md)) | **boots to the intro** (v0.201.10); lockstep identical to counter 305, timing drift after |
| 2. Names into the C | curated names → Asar labels, snesrecomp `func` names, Mesen2 labels | **done** (v0.201.9, `npm run recomp`); `symbols.json` as the canonical file still to build ([formats.md](formats.md) §2) |
| 3. Assets | one decoder + format doc + viewer per unknown ROM-tab region; data lineage (G1 step 2) shows which regions are graphics, tilemaps, palettes or scripts | rooms, map graphics, sprites, animation, audio, scripts done; the rest by region |
| 4. Verify | per-frame WRAM hash log (CDL improvement 8) as the oracle | to build |
| – Track progress | `npm run recomp` → `out/recomp/REPORT.md`: rebuild identical?, snesrecomp native vs interpreter-only, coverage, names, comments, WRAM names, prioritised to-do | **done** (`tools/recomp/`) |

### G3 — Decomp in C

snesrecomp boots (G2.1) → replace leaf routines first (decompressors, room loader: their
semantics are already ported in `src/games/evermore/maps`) with `hle_func` C, checked by the per-frame diff.
Ghidra/REA help read a routine before writing its C. CDL improvement 4 (register snapshots)
gives argument conventions.

### G4 — SA-1

Blocked by the HiROM layout ([other-tools.md](other-tools.md), `../evermore-sa1`); effort and alternatives: [layout-options.md](../exhirom/layout-options.md). Needs a
shiftable disassembly (every pointer form symbolised, [asm-to-c-port.md](asm-to-c-port.md) §8)
so the code can move. Then `functions.json` SA-1 blockers and CDL cycle counts (improvement 7)
pick the candidates.

### G5 — Mashups

Needs encoders next to every decoder (rooms are done, v0.158.0), free space from the
shiftable disassembly, and the same decode/encode work for the other game. Ship only patches
and tools; both games' data comes from the user's ROMs at runtime.

## 4. Which approach to improve, which to borrow from

| Improve | What | Why |
|---|---|---|
| **CDL recorder** | context tags, data lineage, DMA destinations, table read values, register snapshots, cycles, frame hash log ([cdl.md](cdl.md) §2) | the most accurate source; these turn "accessed" into "what for" |
| **Export** | `symbols.json` + adapters (Mesen2 `.cdl`/`.mlb`, seed + context TSV, `.sym`), provenance stamp ([formats.md](formats.md)) | names and facts reach every tool |
| **ghidra-snes** (upstream PR) | execution-bank mapping as a loader option; DB/D as context | removes our only local patch |
| **Ghidra scripts** (ours) | apply seeds + M/X/DB/D context from the CDL; export `static.json` | static fill with our context |
| REA (upstream PR, optional) | SNES profile | only if we want REA's MCP for agents |

| Borrow | From | Into |
|---|---|---|
| Static reachability | Ghidra | library `static.json` → Asar export marks code, more recomp seeds |
| Seed TSV format | REA | our Ghidra hand-off |
| Evidence envelope (input digest, tool version, limitations) | REA | stamps on exports and evidence strings |
| Batch dossiers → naming | REA | `re-curator` passes, using Ghidra or REA output |
| Header-detection scoring, MMIO labels | ghidra-snes | nothing to do: our ROM tab already covers it |
| Interactive debugging with our names | Mesen2 | `.mlb` export |

## 5. How they combine

```text
          play / scripted headless runs
                    │
                    ▼
     CDL library (recorded facts, per ROM) ◄───── static.json (Ghidra, tagged static)
       │                  │                               ▲
       │ symbols.json,    │ export                        │ headless scripts
       │ seeds, context   ▼                               │
       └──────────► Ghidra + ghidra-snes ─────────────────┘
                          │ dossiers (or REA)
                          ▼
   re-curator ─► functions.js / tables.js / knowledge entries   (single name source)
                          │
           ┌──────────────┼───────────────┬──────────────┐
           ▼              ▼               ▼              ▼
     Asar labels   snesrecomp names   soe:// + maps   Mesen2 labels
```

Rules: names live in one place; runtime beats static; everything checks against the ROM (Asar
rebuilds byte-identically, C passes the per-frame diff).

## 6. Recommended order

1. **Coverage** (G1.1): scripted headless runs, merged into the library.
2. **Context tags + DMA destinations** (G1.2, CDL improvements 1 and 3): cheap and big for the maps.
3. **`symbols.json` + seed/context export, Ghidra scripts, `static.json`** (G1.3).
4. **`re-curator` passes** (G1.4), continuously.
5. **Entry loader + map generator** (G1.5).
6. **snesrecomp host / frame driver** (G2.1), then names into the C (G2.2).
7. Assets region by region (G2.3), using data lineage (CDL improvement 2).
8. G3 / G4 / G5 on top.

## 7. The `re-curator` agent

`.agents/agents/re-curator.md` (also reachable for Claude Code through `.claude/agents/`). One
pass: pick the highest-value gaps (or a given scope), look up, gather evidence from the CDL
library, curated sources, `soe://`, and Ghidra/REA dossiers when available, then write names and
entries with confidence and evidence and report what still needs the emulator. It follows the
`game-knowledge` and `release-ritual` skills.

It is only as good as its inputs. Missing pieces that would make it fully streamlined:
`symbols.json`, an in-repo seed/dossier export, the entry loader, and the map generator (§3 G1).
Until then it writes `functions.js` / `tables.js` lines and RAM entries by hand, which is how
the first 12 names and 7 entries were made (rea.md §10.3).

## 8. Legal

The ROM, CDL libraries, Ghidra projects, REA snapshots, disassembly, pseudocode and decoded
assets stay outside the repo. The repo holds our code and our own descriptions: names,
addresses, formats and evidence (AI_ARCHITECTURE_GUIDE.md §3.8).
