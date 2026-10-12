# REA (Reverse Engineer Anything) and this repo

Evaluated 2026-10-12 against the REA README and its `docs/` folder
(<https://github.com/morluto/rea>, MIT). We have not installed or run it yet. Everything
marked **spike** below is untested and must be checked before we depend on it.

## TL;DR

| Question | Short answer |
|---|---|
| What is it? | An MCP server + CLI (`rea`, npm package `rea-agents`) that lets an agent drive Ghidra / IDA / Hopper and other analyzers, and returns findings with their evidence. |
| Does it know SNES / 65816? | **No.** Raw-binary mode admits only x86, x86_64, ARM, AArch64. The only legacy profile is 16-bit DOS. |
| Can we make it work? | Probably partly: Ghidra + a third-party 65816 processor extension + `REA_GHIDRA_LANGUAGE_ID`. **Spike.** |
| Do we need to help it with SNES asm? | Yes, heavily: memory map and mirrors, M/X widths, DB/D, function entries, data vs code. Our CDL library already has most of this. |
| What can we expect? | Agent-driven reading of single routines (disassembly, xrefs, rough pseudocode), proposed names. Static only, nothing persists between sessions, 65816 pseudocode is often wrong. |
| Can it recomp/decomp SoE? | **No.** It produces no recompilable code. Recomp stays snesrecomp, decomp stays the `hle_func` + lockstep method (`docs/asm-to-c-port.md`). REA could help with naming during decomp cleanup. |
| Can our asset knowledge help it? | Yes. We can generate its seed file (functions, code, labels) from the CDL library, `tables.json`, `functions.json` and the localization tables, so Ghidra stops disassembling graphics and tables. |

---

## 1. What REA is

- One MCP server (plus an identical CLI) for reverse engineering native binaries, JS/Electron
  apps, .NET, Android, WASM, websites and firmware.
- **Native analysis is delegated** to Ghidra (headless `analyzeHeadless`), IDA or Hopper.
  For us only Ghidra matters, because IDA and Hopper refuse raw binaries.
- Tools it exposes for native targets include `open_binary`, `list_procedures`,
  `procedure_info`, `read_function_instructions`, `analyze_function` (decompile),
  xrefs/search/read-bytes, `annotate_native_function` and `close_binary`. The CLI has
  `rea inspect | function | decompile | xrefs | search | instructions | read-bytes | annotate-native-function`.
- Every Ghidra import is a **throwaway database**. The only edits it can make are function
  names and entry comments, and those are lost on close unless saved to a snapshot.
  Custom Ghidra scripts, the GUI and persistent project changes are not available.
- It is **static only**: no emulation of reset vectors, interrupts or memory-mapped I/O.

## 2. Install (macOS, user-level, nothing in the repo)

```sh
# 1. Prerequisites: Node >= 22.19 (or 24.11+), a JDK that your Ghidra version supports, Ghidra (REA tests against 12.1.x)
brew install openjdk@21            # or any JDK your Ghidra build supports
# download Ghidra from ghidra-sre.org and unzip, e.g. to ~/tools/ghidra_12.1.4_PUBLIC
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra_12.1.4_PUBLIC"   # put in ~/.zshrc

# 2. A 65816 processor module for Ghidra (stock Ghidra ships 6502/65C02, not 65816; check with
#    ls "$GHIDRA_INSTALL_DIR/Ghidra/Processors"). Use a community extension, install it through
#    Ghidra's File > Install Extensions, then note the language ID from its .ldefs file.
#    Check the extension's licence first. We install it only on our own machine and never
#    vendor it into this repo.

# 3. REA itself, registered for Claude Code
npx rea-agents setup --client claude_code   # writes the MCP entry to ~/.claude.json and a skill to ~/.claude/skills
npm install --global rea-agents            # optional: the `rea` CLI
rea doctor --provider ghidra --json        # confirms Ghidra and Java are found
```

Restart Claude Code after setup. Useful environment knobs (from REA `docs/installation.md`):

| Variable | Use for SoE |
|---|---|
| `REA_GHIDRA_LANGUAGE_ID` | The 65816 language ID from the extension's `.ldefs` (validated against the install) |
| `REA_GHIDRA_COMPILER_SPEC_ID` | Optional; the extension's cspec |
| `REA_GHIDRA_SEED_FILE` | TSV of `address<TAB>function|code|label[<TAB>name]` (see §5) |
| `REA_GHIDRA_DISABLED_ANALYZERS` | Switch off analyzers that wreck 65816 analysis, e.g. aggressive instruction finders that disassemble graphics |
| `REA_GHIDRA_STARTUP_TIMEOUT_MS`, `GHIDRA_HEADLESS_MAXMEM` | A 3 MB ROM with full auto-analysis may need more than the default 330 s / 2 GB |

The ROM stays where it already is, outside the repo (e.g. `../everscript/out/…`). REA
snapshots contain ROM bytes, so keep `snapshot_path` outside the repo as well (`traces/`
or the scratch directory; both are git-ignored).

## 3. How to use / trigger it

**From Claude Code (normal path):** the setup installs a skill and the MCP server, so a
plain request triggers it. Name the file and what you want to know, for example:

> Using REA with the Ghidra provider, open `../everscript/out/Secret of Evermore (U) [!].smc`
> as a 65816 HiROM image, analyze the function at `$90:8F6A`, list its callers and the
> WRAM it touches, and propose a name with evidence.

The agent then calls `open_binary` → `analyze_function` / xrefs → `close_binary`. In this
repo it should also:
- look up the address first (`game-knowledge` skill, `soe://` MCP);
- write what it learns into a knowledge entry in our own words (never paste pseudocode).

**From the terminal** (same tools; flags per REA `docs/raw-binary.md` and `docs/ghidra-dos.md`):

```sh
export REA_GHIDRA_LANGUAGE_ID='<65816 id from the extension .ldefs>'
export REA_GHIDRA_SEED_FILE="$PWD/traces/rea/soe-seeds.tsv"
rea function 0xC08650 --provider ghidra --json \
    --target-format raw-binary --entry-point 0xC08650 \
    "../everscript/out/Secret of Evermore (U) [!].smc"
```

**Spike:** `--architecture` only accepts `x86 | x86_64 | arm | arm64` for raw binaries.
Whether REA admits a raw image with only `REA_GHIDRA_LANGUAGE_ID` set (or a SNES loader
from the extension that recognizes the header) is the first thing to try. If it does not,
the honest options are §4.3 (contribute a SNES profile upstream) or using Ghidra directly
without REA.

## 4. Do we need to help it with SNES asm? Yes

Ghidra's 65816 support is the weak link, and `docs/asm-to-c-port.md` §5 already notes it
"gets widths and banks wrong too often". Below are the problems, and where our data fixes each.

### 4.1 Problems REA + stock Ghidra cannot solve alone

| Problem | Why it hurts | We already have |
|---|---|---|
| **Memory map.** REA's raw loader maps the whole file at one address. | For SoE (HiROM, unheadered) mapping file offset 0 at `$C00000` gives a correct linear view of banks `$C0–$EF`. But code runs from the `$80–$BF` mirrors (`$8C:CB9C`, `$90:8F6A`), and those mirrors are not mapped, so long addresses and xrefs in `$8x` banks do not resolve. | `snes-memory-mapping` skill; `soe://bus/` |
| **M/X widths.** The same bytes decode differently in 8- and 16-bit mode. | A wrong immediate width desynchronises everything after it. | CDL `rom.cdl` IDX8/ACC8 bits per opcode; `rets.bin` entry/exit widths; `functions.json` |
| **DB and D.** 16-bit absolute and direct-page operands depend on them. | xrefs to WRAM / tables are wrong or missing. | CDL `regs.bin` (DB/D per instruction) |
| **Jump tables / PHA+RTS dispatch.** | Ghidra misses most targets, so functions end early or never appear. | CDL edges, `indirect_dispatch` lists, FLOW_RETURN targets |
| **Code vs data.** | Auto-analysis disassembles graphics, LZSS blobs and tables. | CDL CODE/DATA bits, `tables.json`, ROM asset locations (§5) |
| **WRAM / registers have no names.** | Pseudocode is full of `DAT_7e3de5`. | `ram.asm`, `structs.h`, `src/localizations/`, `soe://ram/` |

### 4.2 What REA lets us pass in

Only the **seed file** (function / code / label at an address), the language ID and the
disabled-analyzer list. That covers entries, code-vs-data and names. It does **not** cover
M/X, DB or D context, mirrors, or data types. Those need Ghidra-side support.

### 4.3 Real fix: a SNES profile in REA (upstream contribution)

REA's DOS profile is a template: explicit format, pinned language, fixed load layout and a
pre-analysis script that sets segment registers. A `snes-hirom` / `snes-lorom` profile
would:
1. map the image at `$C0` and add the `$40`/`$80` mirrors as memory blocks;
2. take an optional per-address context file (M, X, DB, D) and apply it before analysis.
   We would produce that file from the CDL library;
3. verify the load image the way the DOS profile does.

REA is MIT, so contributing is fine. Code we write for it is ours. No ROM bytes or
extracted data go into the PR.

## 5. Using what we know about assets and code

Proposed generator (not built): `tools/gen-rea-seeds.js <cdl library dir> > traces/rea/soe-seeds.tsv`.

| Source | Becomes |
|---|---|
| `functions.json` entries (CDL export) | `function` rows, named from `src/localizations/functions.js` where known, else `func_XXXXXX` |
| `rom.cdl` CODE-marked opcode heads that are not yet a function | `code` rows (jump-table targets, FLOW_RETURN targets) |
| `tables.json` / table assets, ROM asset locations (map blobs, graphics, palettes, music packages, script banks: `soe://rom/assets/`, `src/localizations/tables.js`) | `label` rows such as `tbl_room_ptrs`, so Ghidra treats them as data and xrefs get names |
| knowledge entries under the `game-knowledge` paths | `label` rows with our names |

Combine this with `REA_GHIDRA_DISABLED_ANALYZERS` for the aggressive instruction / data
finders. The goal is for Ghidra to disassemble only bytes we know to be code. The seed file
contains addresses and our own names, never ROM bytes. It is generated, so it lives in
`traces/` and is not committed.

The `everscript-soe` MCP and REA complement each other. Ask both in the same session:
`soe://` for what we know (names, structs, assets, live WRAM), REA for the disassembly
around it.

## 6. What to expect

**Good for:**
- "Explain this routine": an agent reads a routine, follows callers/callees, and gives
  claims with evidence (addresses, instructions). This works well with the knowledge-entry
  workflow.
- Batch first-pass naming of the ~350 CDL-known functions, recorded as `confidence: guess`.
- Cross-checking a hypothesis from the emulator (e.g. "who writes `$7E3DE5`+n?").
- Its other analyzers can inspect our own build outputs (for example the snes9x WASM core).
  We have that source, though, so this adds little.

**Not good for / limits:**
- 65816 pseudocode is unreliable even with seeds. Treat it as a reading aid only, never as
  lifted code.
- No persistence: each `open_binary` re-imports and re-analyzes (minutes for 3 MB).
  Snapshots cache query results, not a Ghidra project.
- No runtime facts. Our CDL recorder already knows more about real widths, targets and
  data than static analysis can find.
- Only 5.3 % of the ROM is CDL-covered today (`asm-to-c-port.md` §11.3), so seeds will be
  sparse until coverage grows.
- Disassembly passes through the agent's model provider. That is acceptable for analysis,
  but the output must not be committed (see §8).

## 7. Recomp / decomp?

No. REA's "reconstruction readiness" is an internal conformance test for its own
fixtures, not a code generator.
- **Recomp:** stays snesrecomp, fed by our CDL export (`docs/workflows/cdl-export-build-recomp.md`).
  REA adds nothing that the CDL does not already provide more accurately.
- **Decomp (readable C):** stays one verified `hle_func` at a time against the lockstep diff
  (`asm-to-c-port.md` §6, §11.2). REA can help at the step where a human or agent must
  understand a routine and pick names before writing its C. The names then flow back into
  knowledge entries and the localization tables, and from there into the Asar export and
  `structs.h`.

## 8. Legal guardrails (AI_ARCHITECTURE_GUIDE.md §3.8)

- ROM, REA snapshots, Ghidra databases and decompiler/disassembly output stay out of the repo.
- What we commit: our own prose descriptions, addresses, names and evidence in knowledge
  entries, plus any tool code we write (seed generator, upstream profile).
- The 65816 Ghidra extension is installed locally and never vendored.

## 9. Proposed next steps

1. **Spike (½ day):** install Ghidra, a 65816 extension and REA. Try `open_binary` on the
   ROM with `REA_GHIDRA_LANGUAGE_ID`. Record go/no-go and the exact flags here.
2. If go: write `tools/gen-rea-seeds.js` (§5) and compare analysis of 3–4 known routines
   with and without seeds.
3. If widths/banks are still the blocker: draft the SNES profile for REA (§4.3) and propose
   it upstream.
4. If no-go: drop REA. Use Ghidra directly (with a script that applies CDL context), or
   keep using our own CDL disassembly + Asar export.
