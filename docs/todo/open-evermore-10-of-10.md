# Open Evermore: Roadmap to 10/10 (State, Audit & Execution Plan)

> Status: **Open Task Cluster (v0.478.0, 2026-11-28)**  
> Tracks the transition of Open Evermore from a reverse-engineering & ROM-rebuild foundation into a premier, game-agnostic SNES modding SDK.

---

## 1. The Scorecard (v0.478.0)

| Dimension | Score | Current State & Strengths | Primary Gap to 10/10 |
|---|---:|---|---|
| **Ease of use** | **6.0 / 10** | Single unified CLI (`explode`, `implode`, `prove`, `demo`), named JSON/PNG/script/`.asm` files, typed `<folder>/<name>` links, compile-time validation & round-trip safety nets, Rooms tab reads trees. | Misspelt CLI flags silently ignored, no `--help`, ~14s implode cycle, read-only Rooms tab (no save back or 1-click build), no `rename` command, no BPS patch export, no Everscript `.evs` bridge. |
| **Ease of extending** | **7.0 / 10** | Relocatable/growable: maps (256), dialogue strings (21,845), tiles (21,845), scripts (21,625), sprite blocks (21,845), metasprites, animations (`vacate_c4`), characters (256), ingredients (64), consumables (16), key items (40), Dog forms (>6), C1 FastROM ASM routines, 388 WRAM groups. | Added consumable counts & formula levels live in `temp[]` (wiped on room load); `formulas` (35), `ring_items` (162), `weapons` (14), `armour` (40), `$C4` menu text, and `$91` alchemy VM blocks remain capped/unexploded; ~1,294 vanilla routines are size-pinned. |
| **Game-agnosticism** | **4.5 / 10** | Core engine modules (`codec`, `layout`, `enum`, `explode`, `links`, `placement`) are small and generic; `evermore/map/us.json` demonstrates clean "locations in JSON, formats in codecs" separation. | `open-evermore.mts`, `manifest`, `implode`, `layouts`, and `play` hardcode Evermore + HiROM/ExHiROM (no LoROM, no `games.mts`/`game.json`); top-level tools read Evermore CDL/knowledge; PAL/EU Evermore does not run end-to-end. |
| **Pre-existing hacks suitability** | **5.5 / 10** | Re-authoring data/balance hacks is vastly cleaner; C0–C3 code + W2 WRAM solves historical 4th-MB bank collisions (`$F0`/`$F8`/`$FD`/`$FE`), making simultaneous 2P + Debug Menu + Hotkeys + MSU-1 architecturally possible. | Editing any pinned routine past its vanilla byte length triggers `code-size` (requiring manual `JSL`+`NOP` hooks); no composable mod format; no persistent WRAM expansion for saves/settings; no SPC700 disassembly; `prove` requires cycle-exact lockstep. |
| **Overall** | **5.8 / 10** | **9.0/10 as an RE & byte-exact rebuild engine** (96.3% of ROM exploded, G0 vanilla sha1, G1 lockstep proof, Asar parity); **~5.5/10 as a day-to-day modding SDK**. | Transforming lab infrastructure into a fast, editable, composable, game-agnostic modding workflow. |

---

## 2. Four Pillars to 10/10 (Actionable Task Checklists)

### Pillar 1: Usability & IDE Workflow (6.0 → 10/10)

Target: A tool that provides instant feedback, guides the modder safely, integrates directly into VS Code, and compiles `.evs` scripts seamlessly.

- [ ] **CLI Polish & Argument Safety (U1–U8 from `optimizing.md`)**
  - [ ] 🔴 **U1:** Parse CLI flags using `node:util` `parseArgs` with strict validation (reject unknown/misspelt flags like `--strcit` with usage and exit code 2).
  - [ ] 🔴 **U8:** Add standard `--help` action listing all verbs, flags, and parameter formats.
  - [ ] 🔴 **U6:** Add TTY stage progress indicators (`names`, `encode`, `place`, `build`, `roundTrip`) with elapsed milliseconds (`--quiet` for batch/CI).
  - [ ] 🔴 **U2:** Streamline terminal summary: display only modified/moved kinds, total relocated bytes, and human-readable `in place (N files)` instead of 43-row noise.
  - [ ] 🔴 **U4:** Protect against accidental data loss: `explode --force` refuses to overwrite modified files unless `--discard-edits` is passed; add `explode --kinds a,b --into <dir>` to refresh stale kinds cleanly.
  - [ ] 🔴 **U5:** Check manifest codec versions on `implode` and emit clear upgrade instructions when an older exploded tree encounters a newer codec.
- [ ] **Performance & Build Latency (P1–P7 from `optimizing.md`)**
  - [ ] 🔴 **P1 & P2:** Raw-buffer comparison first in round-trip (`Buffer.equals`), falling back to `JSON.stringify` instead of `json()` formatting (~7s saved).
  - [ ] 🔴 **P4:** Skip round-trip re-explode on `--strict` when file hashes match vanilla exploded baseline (~9s saved on unchanged trees).
  - [ ] 🔴 **P5:** Optimize string encoder with character-indexed candidate token map and per-run memoization (~2.5s saved).
  - [ ] 🔴 **Incremental Implode:** Cache encoded blobs by input hash so one-file edits re-implode in <1.0s.
- [ ] **Editor & Modder Workflow Loop**
  - [ ] 🟡 **Bidirectional Rooms Tab:** Enable "Save" in the Rooms tab (`tree-map.ts roomToTree`) directly updating `maps/rooms/<map>/` files rather than ROM blobs.
  - [ ] 🟡 **One-Click Build & Run:** Command to run `implode` and boot the active map in the embedded emulator or MesenCE.
  - [ ] 🟡 **Problems Panel Integration:** Map `report.json` findings (`error`, `warning`) to VS Code diagnostic markers at exact file locations.
  - [ ] 🔴 **`rename` CLI Action:** Provide `open-evermore rename <kind> <old_name> <new_name>` that updates filenames and rewrites all incoming `<folder>/<name>` and `@name` references across the tree.
  - [ ] 🔴 **BPS Patch Export:** Generate legally distributable `.bps` patches comparing vanilla base ROM against `_build/evermore.sfc`.
  - [ ] 🔴 **Everscript (`.evs`) Tree Integration:** Allow the Everscript compiler to read `_enum.json`s and emit scripts directly into `scripts/` using tree-native names.

---

### Pillar 2: Unlimited Extensibility without Cliffs (7.0 → 10/10)

Target: Any game resource can be added, lengthened, or moved without hitting artificial ROM table caps, byte-length ceilings, or temporary RAM wipes.

- [ ] **Persistent WRAM & Extended Memory Allocation**
  - [ ] 🔴 **W4 & W8 (`wram-allocation.md`):** Relocate WRAM pointer targets and DMA sources; enable saved WRAM allocation past vanilla bounds so new consumables, key items, and formulas retain counts and levels across room transitions and battery saves (eliminating `temp[]`).
  - [ ] 🔴 **M2–M6 (`memory.md`):** Complete region maps for VRAM, CGRAM, OAM, and ARAM, allowing programmatic allocation for new graphics and audio transfers.
- [ ] **Lift Remaining Fixed ROM Table Caps (`growable-items.md`)**
  - [ ] 🔴 **`formulas` (35 cap):** Generate the 9 parallel `$C4` tables, move readers, and lift formula cap to 64.
  - [ ] 🔴 **`menus/ring_items` (162 cap):** Relocate `$8E:8000` ring item table, allowing arbitrary new ring items without sharing 11 `debug_*` slots.
  - [ ] 🔴 **`equipment/weapons` (14) & `armour` (40):** Make weapon records growable and introduce an `armour_slots` kind so new equipment types don't depend on hardcoded code ranges (`$8E:9DAE`).
  - [ ] 🔴 **`strings/menu/` ($C4 text):** Allow menu and item text strings to grow past vanilla byte lengths by relocating text pools.
  - [ ] 🔴 **`music/packages` (71 cap):** Decode sound packages and generate SPC700 pointer tables dynamically.
- [ ] **Explode Unclaimed Engine Subsystems from `_base/`**
  - [ ] 🔴 **`alchemy/blocks`:** Explode the 83-op alchemy effect VM (`$91:8000`, `$91:80A6`) as symbolic bytecode scripts, enabling custom spell visual effects and damage logic (e.g. true HP-halving Laser).
  - [ ] 🔴 **Auxiliary Data Tables:** Explode Dog level growth curves (`$8C:9515`), weapon skill thresholds (`$C4:5B4A`), and Call Bead spell powers (`$C4:5F17`).
  - [ ] 🔴 **Header (S8 / C5):** Explode hardware vectors (`$00:FFC0`) as symbolic routine references in `header.json`.
- [ ] **Unpin Vanilla Assembly Routines (C4 of `open-evermore-code.md`)**
  - [ ] 🔴 **Group & Jump Table Relocation:** Move `jsr.w` local clusters and `(abs,x)` jump tables into FastROM with generated bank stubs or trampolines, allowing vanilla routines to grow in byte size without triggering `code-size` errors.
- [ ] **Verification & FastROM Placement**
  - [ ] 🟡 **Manifest Placement (`placement.mts`):** Enforce `fast` vs `any` placement policies, routing hot loops to FastROM and cold data to ExHiROM with `slow-hot` warnings.
  - [ ] 🟩 **Headless MesenCE Verification (`demos.md`):** Expand automated Lua screenshot/state assertion pipeline for new art, metasprites, and custom rooms.

---

### Pillar 3: Multi-Game Architecture & Zero-Evermore Generic Core (4.5 → 10/10)

Target: The core explode/implode/prove engine contains zero Evermore-specific assumptions, functioning as a generic SNES ROM reconstitution toolchain.

- [ ] **Game Registry & Configuration (`game-agnostic-open-rom.md` A0–A7)**
  - [ ] 🔴 **A0 & A1:** Create game registry (`games.mts`); eliminate direct `evermore/` imports in `open-evermore.mts`; route CLI via `--game <id>`.
  - [ ] 🔴 **A2:** Define typed `game.json` (tree output paths, build ROM name, cartridge mapping, sample playbacks, proof tolerances).
  - [ ] 🔴 **A3:** Extract SNES bus mapping (LoROM, HiROM, ExHiROM, SA-1) and header generation into `src/platform/snes/`. Add full **LoROM** support.
  - [ ] 🔴 **A4:** Move all four-plus-digit ROM address literals out of codecs into mapping files (`evermore/map/<release>.json`).
  - [ ] 🔴 **A5:** Externalize playback tolerances (`maxDrift`, pointer tolerances) to `game.json`.
  - [ ] 🔴 **A7:** Relocate Evermore-specific diagnostic utilities (`wram-census`, `code-census`, `memory-probe`) into `evermore/tools/`.
- [ ] **Multi-Release & Secondary Game Proving**
  - [ ] 🔴 **Full PAL/EU Evermore Support:** Complete `evermore/map/pal.json` and generate European code/WRAM censuses to allow European ROMs to explode, implode, and prove byte-identically.
  - [ ] 🔴 **Second SNES Target Proof:** Construct a minimal working vertical slice for *Secret of Mana* (`som`) or *Terranigma* (`terra`) using the generic engine with zero core modifications.

---

### Pillar 4: Pre-Existing Romhack Integration & Composable Modding (5.5 → 10/10)

Target: Classic and modern Evermore hacks (2-Player, Gameplay Balance, Debug Menu, MSU-1, Bugfixes) can be expressed, maintained, and stacked together without memory collisions.

- [ ] **First-Class Composable Mod & Overlay Architecture**
  - [ ] 🟡 **Graduate `demos.mts` to Mod Packages:** Standardize directory-based mod overlays (`mods/<name>/`) with declarative recipes (`clone`, `patchJson`, `appendEnum`, `patchScript`, `writeText`) and conflict detection.
  - [ ] 🔴 **Composable Assembly Routines:** Allow mods to drop standalone `code/<routine>.asm` files into their overlay, assembled dynamically without fixed `org`s and resolved against base ROM symbols.
  - [ ] 🔴 **Unified 4th-MB Ownership:** Eliminate bank contention between Hotkeys (`$F8`), C-to-ROM (`$F8–$FB`), MSU-1 (`$FE:6000`), and 2-Player (`$F0`) by placing all custom kernels through Open Evermore's symbolic FastROM allocator.
- [ ] **Event-Based Proofs for Modified Gameplay**
  - [ ] 🟡 **Relaxed / Event-Based Validation:** Complement lockstep `prove` (which requires cycle identity) with MesenCE goal-oriented verification scripts for gameplay/balance patches that deliberately alter frame timing and combat math.
- [ ] **Audio Driver & Legacy Patch Tooling**
  - [ ] 🔴 **SPC700 Driver Disassembly:** Decode SPC700 sound engine sequences and ARAM tables, enabling sound delay fixes and clean MSU-1 audio streaming hooks without binary blobs.
  - [ ] 💡 **Legacy IPS/Asar Patch Importer:** Tool to disassemble legacy binary patches (e.g. FuSoYa 2P, Ninakoru Balance) and generate structured Open Evermore overlay recipes.

---

## 3. Related Trackers & Documentation

- [Roadmap & Design Limits](../open-evermore/roadmap.md)
- [Performance & Usability Optimization](../open-evermore/optimizing.md)
- [Code Kind & Assembly Migration](../open-evermore/code.md) & [Tracker](open-evermore-code.md)
- [WRAM Allocation Tracker](wram-allocation.md) & [Memory Spec](../open-evermore/memory.md)
- [Growable Items & Tables](growable-items.md) & [Extending Guide](../open-evermore/extending.md)
- [Game-Agnostic Engine Design](game-agnostic-open-rom.md)
- [Playable Demos & MesenCE Verification](../open-evermore/demos.md)
- [Public Patches Analysis](../patches/README.md) & [2-Player Architecture](../soe-2player-patch-analysis.md)
