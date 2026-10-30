# Ghidra + ghidra-snes

Static analysis of the whole ROM with Ghidra 12.1.x and the ghidra-snes extension. Tested on
SoE on 2026-10-12. The run numbers are in [rea.md §10](rea.md#10-spike-results-2026-10-12) (REA
drives the same Ghidra underneath). Agent how-to: skill `ghidra-analysis`.

## 1. Should we use it, and for what?

**Yes, as a batch step and a reading bench. Not as a source of truth, not inside the extension.**

| Use it for | Why Ghidra | Feeds |
|---|---|---|
| **Static fill**: functions and direct-call edges in code the CDL never saw | Flow analysis from known entries reaches unplayed code. In the spike: 556 functions from 449 seeds, 234/361 with real callers | ROM map (G1), Asar export (code instead of `incbin`), snesrecomp seeds |
| **Accessors of long WRAM addresses** (`LDA $7E:xxxx`) in unplayed code | Static xrefs | RAM map (G1) |
| **Reading and naming** routines (GUI for humans, scripts/REA for agents) | Listing + callers + callees + named refs in one place, persistent project | `functions.ts`, knowledge entries (G2) |
| **Type-aware reading** | Parses C headers: our `structs.h` → struct fields in the listing | Naming, decomp prep |

**Do not use it for:**
- **Code/data truth, M/X widths, DB/D, jump targets.** The CDL records these from execution.
  Ghidra guesses them, and on 65816 it guesses badly.
- **C code.** The pseudocode is not compilable and is noisy, because DP and DB are unknown. Readable
  C comes from the snesrecomp + `hle_func` path ([asm-to-c-port.md](asm-to-c-port.md)).
- **Asset boundaries.** It cannot tell graphics from tables.
- **Anything at extension runtime.** It needs Java and a ~770 MB install. The extension must work
  without it.

Rule: **runtime beats static.** Where the CDL has a fact, it wins. Ghidra-only facts are tagged
`static` wherever they are stored.

## 2. Do we have to improve the SNES plugin first?

**One fix is required. The rest can be worked around with scripts.**

| Gap in ghidra-snes (commit `d33ce5d`) | Impact on SoE | Fix |
|---|---|---|
| **HiROM `$80–$BF:8000–FFFF` not mapped as code** (only bank `$00`'s mirror, more only via the GUI) | Every `JSL $8x…` goes to "non-existing memory". All SoE code runs from `$8x` | **Required.** Local ~10-line loader patch (§3 step 3). Upstream: an option "map HiROM execution banks", file-backed |
| Mirror blocks are byte-mapped | Ghidra refuses functions in mapped blocks | Same fix: file-backed blocks |
| M/X flags | The language has context bits `ctx_MF` / `ctx_XF` and follows `SEP`/`REP`. It does not follow `PLP` (documented in `658xx.sinc`) | Script: set `ctx_MF`/`ctx_XF` at each function entry and after each `PLP` from the CDL (`rom.cdl` ACC8/IDX8 bits, `rets.bin`) |
| DB and D are not modelled | 16-bit absolute and direct-page operands get no or wrong references | Script: add references from CDL `regs.bin` (DB/D per instruction). Real fix upstream: DB/D as context registers |
| No analyzer for header/vectors | Cosmetic | None needed (it is on their roadmap) |
| Header detection rejects patched ROMs (checksum must match) | `../everscript/out/*.smc` fails | Use the clean ROM, or fix the checksum on a copy |

The scripts are ours (MIT-compatible, in `tools/ghidra/` once written). They read the CDL library
and the name sources. Nothing in them comes from the ROM.

## 3. Setup guide (macOS, tested)

1. **Ghidra 12.1.x + JDK 21**: `brew install ghidra` (or unzip a release from ghidra-sre.org), `brew install openjdk@21`.
   ```sh
   export GHIDRA_INSTALL_DIR=/opt/homebrew/opt/ghidra/libexec
   export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
   ```
2. **Build ghidra-snes** (MIT, <https://github.com/joshleaves/ghidra-snes>, no release yet):
   ```sh
   git clone https://github.com/joshleaves/ghidra-snes && cd ghidra-snes
   ./gradlew buildExtension -x test          # zip lands in dist/
   ```
3. **Patch the loader** (until upstream has an option). In `SnesRomLoader.loadRom`, right after
   `createBlockHighHalfRomMirrors(…, 0x00)`, add: for HiROM, for each ROM bank `b` (up to `$40`),
   call `mapChunkToCanonicalSpace(…, "bank_%02x_hirom_hi", (0x80+b)<<16 | 0x8000, romOffset + b<<16 + 0x8000, 0x8000, …)`
   and `MemoryMap.createBlockSystemRegionMirrors(program, 0x80 + b)`. Rebuild.
4. **Install into the Ghidra install**, not the user folder:
   ```sh
   unzip dist/*.zip -d "$GHIDRA_INSTALL_DIR/Ghidra/Extensions/"
   "$GHIDRA_INSTALL_DIR/support/sleigh" "$GHIDRA_INSTALL_DIR/Ghidra/Extensions/ghidra-snes/data/languages/65816.slaspec"
   ```
   The `.sla` is not in the zip, so compile it once. With Homebrew the install is in the Cellar,
   and `brew upgrade ghidra` deletes the extension, so redo this step after upgrading. The user
   folder (`~/Library/ghidra/…/Extensions`) also works for the GUI, but not for tools that start
   Ghidra with their own settings folder (REA).
5. **Import the clean ROM** (SHA-1 `79e77386…`):
   ```sh
   "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" ~/ghidra-projects soe -import "<clean rom>"
   ```
   Expect `Using Loader: SNES ROM Loader`, `65816:LE:24:snes:default`, `mode=HiROM`.
6. **Seed from the CDL** before analysis: functions at their *execution* address (`$8x` for
   upper-half code), names from `functions.ts`, WRAM labels from knowledge entries. Run
   `npm run ghidra:seeds` (`tools/ghidra/gen-seeds.mts`) to emit `traces/rea/soe-seeds.tsv`
   (987 functions, 3,709 code targets, 4,195 labels from the 90.3% CDL) and
   `traces/rea/soe-context.tsv` (M/X widths). Without seeds Ghidra finds 1 function.
7. Keep projects, exports and listings **outside the repo**.

## 4. Do we need a skill?

Yes, and it now exists: `.agents/skills/ghidra-analysis/SKILL.md`. It holds the traps that cost
hours in the spike: execution bank, file-backed blocks, install location, clean ROM, seed
addresses, the decompiler hang, and runtime-beats-static. It also covers what to use Ghidra for
and what not.

## 5. Should Ghidra data go into the VFS (`soe://`)?

**Not Ghidra itself; its *derived facts*, through the CDL library.**

- `soe://` must work without Ghidra installed, and a Ghidra project is a binary database derived
  from the ROM. So no live Ghidra queries and no stored projects.
- Instead, a headless export writes **static facts** into the per-ROM library next to the
  recordings (planned file `static.json`: functions, direct-call edges, long-address xrefs, each
  tagged `source: ghidra`, merged by set union like every other library file). The library is
  already outside the repo and already read by `soe://`, the ROM tab and the Asar export, so the
  static facts show up everywhere without new plumbing.
- `soe://` gains nothing Ghidra-specific. It shows "callers: 3 recorded, 2 static".
- Disassembly in `soe://` keeps coming from our own `disasm.ts`, run on the user's ROM.

## 6. Ghidra alone vs. REA

Ghidra alone covers our goals: everything REA returned came from Ghidra, and a headless Ghidra
script can also do what REA cannot: apply M/X/DB/D context, keep a persistent project, and export
`static.json`. REA's only extra is an MCP interface for agents. See [rea.md](rea.md) §0.
