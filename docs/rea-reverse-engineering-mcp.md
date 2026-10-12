# REA (Reverse Engineer Anything) and this repo

Evaluated 2026-10-12 against the REA README and its `docs/` folder
(<https://github.com/morluto/rea>, MIT), then tested the same day with REA 6.4.0, Ghidra 12.1.4
and ghidra-snes (§10). §1–§9 are the desk study. Where §10 contradicts them, §10 wins.

## TL;DR

| Question | Short answer |
|---|---|
| What is it? | An MCP server + CLI (`rea`, npm package `rea-agents`) that lets an agent drive Ghidra / IDA / Hopper and other analyzers, and returns findings with their evidence. |
| Does it know SNES / 65816? | **No.** Raw-binary mode admits only x86, x86_64, ARM, AArch64. The only legacy profile is 16-bit DOS. |
| Can we make it work? | **Only with a patch to REA.** Ghidra + ghidra-snes import SoE fine, but REA 6.4.0 refuses any file that is not ELF/MZ/Mach-O. A local patch on that check works (§10). |
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

1. ~~Spike~~ done, see §10: go with a patch.
2. Seeds help: 1 → 475 procedures. Still to do: compare 3–4 known routines with and without
   seeds, and add `code`/`label` rows (tables, assets) to the seeds.
3. If widths/banks are still the blocker: draft the SNES profile for REA (§4.3) and propose
   it upstream.
4. If no-go: drop REA. Use Ghidra directly (with a script that applies CDL context), or
   keep using our own CDL disassembly + Asar export.

## 10. Spike results (2026-10-12)

We set this up in a local folder outside the repo (`~/Documents/GitHub/rea-snes-spike`, which
has its own README). Nothing from it is committed.

### What worked

- **ghidra-snes** (<https://github.com/joshleaves/ghidra-snes>, MIT) has no release, so we
  built it from source: `GHIDRA_INSTALL_DIR=… ./gradlew buildExtension` with JDK 21. It
  provides the `SNES ROM Loader` and language `65816:LE:24:snes`. The `.sla` was not built,
  so we compiled it once with `$GHIDRA_INSTALL_DIR/support/sleigh …/65816.slaspec`.
- Headless Ghidra then imports the clean US ROM as HiROM. It maps banks `$C0–$EF`, WRAM,
  I/O and the bank `$00` ROM mirror. It does **not** map the `$80–$BF` mirrors the code runs
  from, so use `$C0`-based addresses: `$8C:D0A6` → `0xCCD0A6`.
- With the REA patch below, `rea inspect` and `rea function` run in about 7 s each. They
  include a full re-import and auto-analysis every time.
- **Seeds matter.** Unseeded, Ghidra finds 1 procedure (reset). A seed file built from the
  retail CDL library (`rom.cdl` SUB bit = 449 entries, 73 named from
  `src/localizations/functions.js`) gives 475 procedures, and names show up in the output.
- REA's MCP server starts (170 tools) from a project `.mcp.json` in the spike folder.

### What blocked, and the workaround

| Trap | Detail | Workaround |
|---|---|---|
| REA rejects the ROM | REA 6.4.0 (npm == `main`) checks the header itself and accepts only ELF, MZ and Mach-O (`dist/domain/binaryTarget.js`). `--target-format` only takes `dos-com`. The documented raw-binary mode is not exposed in the CLI. In code it allows only 4 CPUs and refuses a language override (`GhidraLauncher.ts`). | Local 3-line patch: when the file size is a multiple of `$8000`, report it as a known format. Ghidra then picks the SNES loader itself. The subject shows up as `format: elf, architecture: x86`, which is cosmetic but wrong. |
| Extension not seen by REA | REA starts Ghidra with a temporary settings folder, so extensions in `~/Library/ghidra/<ver>/Extensions` are ignored. Its language catalog only scans `$GHIDRA_INSTALL_DIR/Ghidra/Extensions`. | Install the extension into the Ghidra install. With Homebrew that is inside the Cellar, and `brew upgrade` removes it. |
| Patched ROMs rejected | ghidra-snes accepts a header only if the stored checksum matches the file. `../everscript/out/*.smc` is patched (sum `$4453` ≠ stored `$FE2E`). | Use the clean ROM, or fix the checksum on a copy. |

### Quality on a known routine (`$8C:D0A6`, script opcode dispatch)

- **Assembly: correct.** The 16-bit `AND #$00FF` and `JSR ($E8BD,X)` decode right.
- **Jump table: not resolved.** No callees, no callers, `outgoing_references` only has the loop
  branch. Our CDL edges know the targets, but REA has no way to pass them in.
- **Pseudocode: noise.** DP is unknown (`in_DP + 0x82`), and every direct-page access branches
  on the emulation-mode flag. It is useless as C and barely helps as a reading aid. This
  matches `asm-to-c-port.md` §5.

### Verdict

REA works for SoE only with a local patch. It adds an agent-friendly, evidence-tagged
front end over Ghidra, but no SNES knowledge. The upstream SNES profile (§4.3) is still the
real fix: it should admit SNES ROMs, map the mirrors, and take DP/DB/M/X and jump-table
targets from our CDL. Until then, our own CDL disassembly + Asar export is more accurate.
REA is worth it only for ad-hoc "explain this routine" questions.
