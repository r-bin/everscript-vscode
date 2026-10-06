# Architecture Proposal: Tracing Disassembler & Reconstructive Profiler (CDL + Asar Generation)

> **Goal**: Turn the embedded `snes9x2005-wasm` emulator into an automated ROM reverse-engineering and round-trip reassembly pipeline.
> By recording runtime CPU execution, DMA transfers, audio commands, and WRAM accesses, we can emit an **Asar-compatible** assembly disassembly and memory map that reassembles bit-for-bit into the source ROM.

---

## Executive Summary: Is it Possible?

**Yes, absolutely.** In fact, this is the gold standard approach in SNES romhacking, known as **dynamic tracing disassembly** powered by a **Code/Data Logger (CDL)** combined with **bus profiling** and **memory fingerprinting**.

Because the 65816 CPU dynamically switches between 8-bit and 16-bit accumulator/index register modes (`M` and `X` flags via `REP`/`SEP`), static disassembly of SNES binaries is mathematically undecidable without execution context. By capturing runtime execution directly inside the emulator core, we solve this fundamentally.

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        snes9x2005-wasm Core (C)                        │
│                                                                        │
│   ┌───────────────────┐     ┌──────────────────┐     ┌───────────────┐ │
│   │ 65816 CPU Core    │     │ S-SMP / SPC700   │     │ PPU / DMA     │ │
│   │ (Execution Hook)  │     │ (APU Port / RAM) │     │ (DMA Channel) │ │
│   └─────────┬─────────┘     └────────┬─────────┘     └───────┬───────┘ │
└─────────────┼────────────────────────┼───────────────────────┼─────────┘
              │                        │                       │
              ▼                        ▼                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│              High-Performance Ring Buffer / Bitmaps in WASM            │
│  - CDL Bytefield (1 byte per ROM byte: Code, Data, Index/Acc width)    │
│  - WRAM Access Metadata Array (128 KB × struct: access size, stride)   │
│  - DMA Asset Transfer Log (Source ROM offset ➔ Dest VRAM / ARAM)       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Frame-flush / On-demand
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Host / Extension Analyzer (TypeScript / Node)             │
│                                                                        │
│  1. Memory Layout Deduction (Cartridge Header + Mapping Vector)        │
│  2. WRAM Structural Fingerprinting (Byte vs Word vs Struct / Enum)     │
│  3. Asset Separation (Graphics / Tilemaps in VRAM, BRR Audio in ARAM)  │
│  4. Asar Reassembly Emitter (`main.asm`, `bank_XX.asm`, labels, `incbin`)
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Deducting Memory Layout & ROM Header

Before recording, the analyzer inspects the ROM header to establish the 24-bit address space translation:

1. **Header Location**:
   - Check `$00FFB0-$00FFDF` for LoROM.
   - Check `$007FB0-$007FDF` for HiROM (e.g. *Secret of Evermore* at `$C00000-$FFFFFF`).
   - Validate checksum complements: `sum + complement == 0xFFFF`.
2. **Addressing Mode & Speed**:
   - Map mode byte (`$20` = 2.68 MHz LoROM, `$21` = 2.68 MHz HiROM, `$30` / `$31` = 3.58 MHz FastROM).
   - Compute ROM size (e.g. `$0B` = 2 MB, `$0C` = 4 MB) and SRAM size.
3. **SNES Bus ⇄ ROM Offset Translation**:
   - Build a bidirectional coordinate converter:
     - `rom_offset = bus_to_rom(snes_addr)`
     - `snes_addr = rom_to_bus(rom_offset, bank_mode)`
   - Every opcode fetch, operand read, and data pointer can now be pegged directly to physical ROM offsets.

---

## 2. High-Performance Execution & CDL Tracking

### The Challenge
A SNES CPU runs at ~2.68 to 3.58 MHz (~45,000 to 60,000 CPU cycles per frame at 60 FPS). Logging millions of accesses over network IPC or Webview messaging will tank emulation framerates.

### The Solution: Zero-Overhead WASM Bitfields
We avoid logging every individual CPU tick as an event object. Instead, we allocate a flat array in WASM memory representing the ROM's **CDL (Code/Data Log)**.

For a 4 MB ROM, a 4 MB bytefield (or 1 byte per ROM address) requires only **4 MB of RAM**:

```c
// Standard SNES CDL Bitfield (compatible with Mesen-S, BizHawk BIZHAWK-CDL-2, and DiztinGUIsh)
#define CDL_CODE         0x01  // Executed as opcode (ExecFirst)
#define CDL_DATA         0x02  // Read as operand or data table
#define CDL_JUMP_TARGET  0x04  // Target of branch/jump (BRA, BNE, JMP) -> generates local label
#define CDL_SUB_ENTRY    0x08  // Target of subroutine call (JSR, JSL) -> generates global routine label
#define CDL_IDX_8        0x10  // Executed with Index register X=1 (8-bit index)
#define CDL_ACC_8        0x20  // Executed with Accumulator M=1 (8-bit accumulator)
#define CDL_COPROCESSOR  0x40  // Accessed by coprocessor (e.g., SA-1, Super FX / GSU, CX4)
#define CDL_INDIRECT     0x80  // Read indirectly via pointer table [addr,X] / ($xx),y

// Extended Everscript Engine Mask (tracked in a companion byte for deeper profiling)
#define EXT_DMA_SOURCE   0x01  // Source of hardware DMA (to VRAM, CGRAM, or OAM)
#define EXT_APU_TRANSFER 0x02  // Streamed to APU I/O ports $2140-$2143 (BRR / SPC sequence)
#define EXT_OPCODE_HEAD  0x04  // First byte of instruction (distinguishes opcode from operand)
#define EXT_CONFLICT_M   0x08  // Code executed with BOTH M=0 and M=1 (dynamic flag hazard)
#define EXT_CONFLICT_X   0x10  // Code executed with BOTH X=0 and X=1 (dynamic flag hazard)
```

### In-Engine Hook (Inside 65816 Opcode Fetch)
```c
// In CPU loop / S9xMainLoop / Opcode dispatcher:
uint32_t rom_offset = ConvertBusToRom(Registers.PB, Registers.PC);
uint8_t flags = CDL_CODE;
flags |= (Registers.P.M) ? CDL_ACC_8 : 0;
flags |= (Registers.P.X) ? CDL_IDX_8 : 0;

// Bitwise OR is idempotent! Duplicate accesses cost ~1 CPU instruction.
cdl_rom_buffer[rom_offset] |= flags;
```

---

## 2.5 Lessons Learned from Community Projects (Mesen-S, BizHawk, DiztinGUIsh, bsnes-plus)

Studying production CDL implementations reveals several critical design patterns and pitfalls to absorb:

### 1. Mesen-S & BizHawk Flag Alignment
- **Mesen-S (`DebugTypes.h`)** and **BizHawk (`BIZHAWK-CDL-2`)** established the standard 1-byte-per-ROM-byte format:
  - Bit 0: `Code`
  - Bit 1: `Data`
  - Bit 2: `Jump target`
  - Bit 3: `Subroutine target` (JSR/JSL)
  - Bit 4: `X flag = 1` (8-bit index)
  - Bit 5: `M flag = 1` (8-bit accumulator)
  - Bit 6: `Coprocessor / Block transfer`
  - Bit 7: `Indirect / CX4`
- **Interoperability Win**: By adopting this exact bit definition, Everscript's generated CDL can be directly imported into **DiztinGUIsh**, **bsnes-plus**, or **IDA Pro**, and conversely Everscript can import TAS playthrough CDLs generated in BizHawk or Mesen!

### 2. The "Opcode Head vs. Operand" Distinction (BizHawk Lesson)
- If bytes `[C0:1234, C0:1235, C0:1236]` are executed as `LDA $1234`, marking all 3 bytes simply as `CDL_CODE` makes it difficult for disassemblers if the CPU ever branches *into* the operand (or if data was mixed).
- **BizHawk's approach**: Differentiates `ExecFirst` (the opcode byte) vs `ExecOperand` (the argument bytes).
- **Disassembly Benefit**: Knowing the first byte prevents disassembler desynchronization when parsing contiguous code streams.

### 3. Register State Ambiguity & Conflict Detection (`REP`/`SEP` Hazards)
- In games with heavily optimized code paths, a subroutine might be called from one place with `M=0` (16-bit accumulator) and from another with `M=1` (8-bit accumulator).
- In a naive CDL, if the subroutine sets `CDL_ACC_8` on one run and then runs again with `M=0`, bitwise OR would only record that `M=1` was seen.
- **bsnes-plus & DiztinGUIsh Solution**:
  - Track `FlagSeen_M0` vs `FlagSeen_M1`, and `FlagSeen_X0` vs `FlagSeen_X1`.
  - When *both* are set for the same instruction, tag this as a **Dynamic Mode Conflict**.
  - In Asar output, this emits a clear macro/warning or separates the routine so reassembly doesn't corrupt operand sizing!

### 4. CDL Merging (Crowdsourcing & Playthrough Union)
- **Alasdair Morrison's observation & BizHawk/bsnes-plus feature**: No single playthrough reaches 100% code coverage. Secret areas, alternate endings, different party members, and edge-case menus only trigger under specific conditions.
- **Mergeability**: Because CDL is a flat bitmask, merging two logs from different playthroughs (or a TAS speedrun run + an RPG 100% completion run) is a trivial bitwise OR:
  ```typescript
  function mergeCDL(target: Uint8Array, incoming: Uint8Array): void {
    for (let i = 0; i < target.length; i++) {
      target[i] |= incoming[i];
    }
  }
  ```
- This lets coverage accumulate across many sessions and many players instead of requiring one complete playthrough. Where the files live is decided in Section 9.2: a per-ROM library outside the workspace, not the repo.

### 5. DiztinGUIsh XML Project Format & Label Propagation
- DiztinGUIsh separates raw binary logs (`.cdl`) from the symbol project (`.dizraw`).
- When CDL marks a byte with `CDL_SUB_ENTRY`, it auto-generates a global label `sub_C01234:`.
- When marked with `CDL_JUMP_TARGET`, it auto-generates a local label `.loc_C01250:`.
- This clean separation ensures the Asar output reads like human-written assembly rather than a raw dump of absolute jumps.
Because duplicate accesses are compressed into a single bitwise OR operation, **millions of redundant loops (e.g. idle wait loops, DMA loops) have zero overhead**.

---

## 3. WRAM Profiling & Structural Fingerprinting

When the CPU accesses WRAM (`$7E0000-$7FFFFF`), we need to infer whether the address is:
- A single 8-bit `uint8` / byte flag.
- A 16-bit `uint16` / pointer / counter.
- A 24-bit pointer or 32-bit integer.
- An enum value.
- An element inside a duplicated struct (e.g. Boy entity vs Dog entity).

### Access Tracker Struct in WASM
For the 128 KB WRAM ($7E:0000–$7F:FFFF):
```c
typedef struct {
    uint8_t read_width_mask;   // bit 0: read as byte, bit 1: read as word
    uint8_t write_width_mask;  // bit 0: write as byte, bit 1: write as word
    uint8_t base_indexed_reg;  // accessed via [addr,X] or [addr,Y] or direct
    uint8_t min_val_seen;
    uint8_t max_val_seen;
    uint16_t instruction_site; // ROM PC that accesses this address
} WramAccessRecord; // 8 bytes * 128KB = 1 MB profile buffer
```

### Type Inference Rules
1. **Width Deduction**:
   - If an address is read/written with `LDA/STA` when `M=0`, or indexed via `LDX/STX` when `X=0`, it is marked as a **Word (16-bit)**.
   - If accessed with `M=1` and its neighboring byte is accessed independently by unrelated instructions, it is marked as a **Byte (8-bit)**.
   - If never written with values outside `[0..N]` where $N \le 12$, and compared via `CMP #val`, it is flagged as a candidate **Enum**.

2. **Entity Fingerprinting (Struct Cross-Correlation)**:
   - Example: *Secret of Evermore* stores the Boy's entity structure at `$7E4E45` and the Dog's entity structure at `$7E4EB5` (stride = `0x70` bytes).
   - **Fingerprint Vector**: For an entity base address $B$, the access pattern vector is:
     $$\vec{F}(B) = \{ (\Delta, \text{width}, \text{opcode}, \text{caller\_pc}) \}$$
     where $\Delta = \text{address} - B$.
   - **Cross-Correlation**: When the analyzer observes an access to $B_2 + \Delta$ by the same subroutine or with identical relative offsets:
     $$\text{Similarity}(B_1, B_2) = \frac{|\vec{F}(B_1) \cap \vec{F}(B_2)|}{\max(|\vec{F}(B_1)|, |\vec{F}(B_2)|)}$$
   - If similarity exceeds $85\%$, both memory regions are typed to the same `struct Entity` definition, and labeled accordingly in the generated assembly!

---

## 4. Hardware Asset Tracking (VRAM & ARAM)

You asked:
> *"when the vram is written we track the source (because you dont write code to vram, but tiles). Can the same be assumed for audio assets?"*

### 4.1 VRAM Source Tracking (Graphics / Tilemaps)
SNES games write to VRAM (`$2118` / `$2119`) almost exclusively via hardware **DMA channels 0–7** (`$4300-$437F`).
- When a DMA transfer to `$2118/$2119` triggers:
  1. Record the source address: `A1Tx` (Source Low/High) and `A1Bx` (Source Bank).
  2. Record the byte count: `DASx`.
  3. Map the source range `[Source, Source + Size]` in ROM directly to:
     - `ASSET_VRAM_GRAPHICS` or `ASSET_VRAM_TILEMAP`.
- In the generated Asar disassembly:
  - This whole slice of ROM is extracted to a binary file (e.g. `assets/graphics_128000.bin`) and referenced with `incbin "assets/graphics_128000.bin"`.

### 4.2 Can the Same be Assumed for Audio Assets (ARAM / SPC700)?
**Yes, with one key distinction: the SPC700 communicates via a 4-byte I/O handshake.**

Unlike VRAM (which is on the PPU bus and directly fed via DMA), the Audio RAM (ARAM 64 KB) sits behind the separate **Sony SPC700 coprocessor**. The SNES CPU communicates with the SPC via 4 communication ports:
- `$2140` / `$2141` / `$2142` / `$2143` (APUIO0–APUIO3).

#### How Audio Assets are Loaded
When the main CPU transfers songs or sound samples (BRR audio) to the audio chip:
1. **Transfer Routine**: The SNES CPU runs a streaming transfer loop that reads consecutive bytes from a ROM address table and writes them to `$2140-$2143`.
2. **Detection Rule**:
   - Hook writes to `$2140-$2143`.
   - When the CPU executes an APU stream transfer loop, inspect the pointer registers (`[dp]`, `addr,X`, or long pointer).
   - Trace the source ROM bank: this identifies the compressed sound bank, sequence data, and BRR sample tables!
3. **Audio is Never Executed by the 65816**:
   - Bytes transferred to the APU are guaranteed to be **data/samples/SPC code**, never 65816 main CPU code.
   - We safely categorize them as `ASSET_AUDIO_STREAM` or `ASSET_SPC_BLOCK` and emit them as `incbin`.

---

## 5. Performance Strategy: Handling Millions of Accesses

To keep the emulator running at full 60 FPS in WASM without micro-stutters:

| Component | Strategy | Performance Impact |
|---|---|---|
| **CPU Opcode Tracking** | Fixed-size 4 MB bitfield in WASM linear memory (`ROM_SIZE`). Direct bitwise OR. | < 2% CPU overhead. Zero heap allocations. |
| **WRAM Tracking** | Direct array index lookup `wram_meta[addr & 0x1FFFF]`. | Single memory write per WRAM store. |
| **DMA Tracking** | Hook the DMA transfer trigger in `$420B` / `$420C`. SNES executes DMA only a few times per frame (during VBlank). | Zero overhead during active frame render. |
| **APU Handshake** | Hook port writes to `$2140-$2143`. Track source pointer base register. | Minimal. |
| **Dumping / Export** | Dump on user demand (e.g. button click) or auto-sync delta blocks across the Webview boundary every few seconds. | Zero frametime impact during gameplay. |

---

## 6. Output: Asar-Compatible Reassembly Specification

The ultimate output is an Asar project that compiles back to the exact ROM byte-for-bit:

### Project Directory Structure
```text
disassembly/
├── main.asm                 # Root Asar entry point (header, bank includes, vector table)
├── config.asm               # Memory map defines, architecture mode
├── ram.asm                  # Generated WRAM symbol map with deduced types & structs
├── banks/
│   ├── bank_00.asm          # Disassembled code and tables
│   ├── bank_01.asm
│   └── bank_C0.asm          # Secret of Evermore engine code
└── assets/
    ├── vram_tiles_018000.bin
    ├── apu_sample_03A000.bin
    └── unreferenced_data.bin
```

### Sample Output: `ram.asm` (With Fingerprinted Structs)
```asar
; ==============================================================================
; Autogenerated WRAM Map & Entity Structs
; ==============================================================================

struct Entity
    .state:         skip 1   ; uint8 (Enum: 0=idle, 1=walk, 2=attack)
    .direction:     skip 1   ; uint8 (0=N, 1=E, 2=S, 3=W)
    .x_pos:         skip 2   ; uint16 (deduced via 16-bit LDA/STA)
    .y_pos:         skip 2   ; uint16
    .hp:            skip 2   ; uint16
    .anim_frame:    skip 1   ; uint8
endstruct

org $7E4E45
BoyEntity: instanceof Entity

org $7E4EB5
DogEntity: instanceof Entity   ; 94% fingerprint match with BoyEntity!
```

### Sample Output: `bank_C0.asm` (Asar-Compliant Code & Data)
```asar
org $C01234
check_player_direction:
    php
    rep #$20                 ; Accumulator 16-bit
    lda BoyEntity.x_pos      ; Resolved from WRAM symbol map!
    cmp #$0120
    bcc .skip_turn

    sep #$20                 ; Accumulator 8-bit
    lda #$02                 ; Enum candidate: DIR_SOUTH
    sta BoyEntity.direction

.skip_turn:
    plp
    rts

; Unexecuted or DMA-transferred regions are cleanly preserved as binaries
org $C04000
Graphics_PlayerRunSprites:
    incbin "assets/vram_tiles_C04000.bin"
```

---

## 7. Implementation Roadmap & Milestones

1. **Phase 1: WASM CDL Buffer**
   - Add a 4 MB bitfield buffer in `src/emulator/core/snes9x2005-wasm/source/debugger.c`.
   - Instrument the opcode fetch cycle to log execution flags and register widths (`M`/`X`).
2. **Phase 2: Hardware Access Hooks**
   - Hook DMA registers (`$420B`, `$43x0-$43xF`) to catch source ROM offsets flowing into VRAM.
   - Hook `$2140-$2143` to catch audio transfers.
   - Add WRAM profiling buffer (128 KB).
3. **Phase 3: Host Exporter & Disassembler Engine**
   - Implement 65816 disassembler in TypeScript (`src/emulator/disassembler/`).
   - Parse CDL flags: generate label targets for subroutines and branch destinations.
   - Emit `incbin` directives for pure data and unexecuted chunks.
4. **Phase 4: Struct & Type Correlator**
   - Correlate identical access offsets across entity blocks.
   - Emit Asar `struct` definitions and human-readable label aliases.
5. **Phase 5: Asar Verification Suite**
   - Run `asar disassembly/main.asm output.sfc`.
   - Verify cryptographic hash match: `hash(output.sfc) == hash(original.sfc)`.

---

## 8. Can We "Just Use DiztinGUIsh"? (Comparison & Hybrid Architecture)

A natural question arises: *DiztinGUIsh already exists, imports CDL/tracelogs, and exports Asar `.asm` files. Why not simply use it instead of building this pipeline?*

### Feature Matrix: DiztinGUIsh vs. Everscript Tracing Pipeline

| Requirement | DiztinGUIsh | Everscript Embedded Engine | Impact / Gap |
|---|:---:|:---:|---|
| **65816 Disassembly to Asar `.asm`** | ✅ Yes | Planned (TS / Webview) | DiztinGUIsh is proven and mature for core disassembly. |
| **LoROM / HiROM Bank Mapping** | ✅ Yes | ✅ Yes | Both inspect cartridge headers and compute bus vectors. |
| **CDL / Usage Map Ingestion** | ✅ Yes | ✅ Yes | Both understand Code vs. Data flags. |
| **WRAM Dynamic Type Inference** (Byte vs. Word) | ❌ No | ✅ **Yes** | DiztinGUIsh is a *ROM disassembler*; it does not profile WRAM access widths. RAM must be labeled and sized manually by hand. |
| **Entity / Struct Fingerprinting** (Boy + $\Delta$ $\approx$ Dog + $\Delta$) | ❌ No | ✅ **Yes** | DiztinGUIsh has no cross-correlation engine for discovering repeating structs or entity strides. |
| **Enum Detection** (Bounded sets, `CMP #val`) | ❌ No | ✅ **Yes** | Requires tracking value spaces and operand comparator sites at runtime. |
| **Hardware Asset Separation** (DMA $\rightarrow$ VRAM, APU $\rightarrow$ ARAM) | ❌ No | ✅ **Yes** | DiztinGUIsh lumps all unexecuted ROM into generic byte dumps (`db` / `incbin`). It cannot distinguish a 4bpp sprite sheet from sound samples. |
| **Cross-Platform / In-IDE Integration** | ❌ Windows-only (.NET WinForms) | ✅ **Web / macOS / Linux (VS Code)** | DiztinGUIsh is a standalone Windows C# app; Everscript runs directly in macOS/Linux VS Code with the embedded WASM core. |

### The Recommendation: The Hybrid Interoperability Strategy

Rather than reinventing a full interactive disassembly GUI from scratch, or conversely abandoning WRAM/asset analysis to use DiztinGUIsh manually, the optimal path is a **two-tier hybrid strategy**:

```text
┌────────────────────────────────────────────────────────┐
│     Everscript Embedded Snes9x Emulator (WASM)         │
│  - Emits Standard BIZHAWK-CDL-2 (.cdl)                 │
│  - Emits WRAM Fingerprint Log (.wramprof)              │
│  - Emits DMA/APU Asset Map (.assetmap)                 │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   External DiztinGUIsh   │  │    Everscript Analyzer   │
│         (Windows)        │  │     (VS Code Engine)     │
│                          │  │                          │
│ - Ingests .cdl           │  │ - Auto-generates:        │
│ - Manual opcode tuning   │  │   • `ram.asm` (structs)  │
│ - Interactive branch GUI │  │   • `assets/` (graphics) │
│                          │  │   • Pure Asar reassembly │
└──────────────────────────┘  └──────────────────────────┘
```

1. **Everscript does what DiztinGUIsh cannot do**:
   - Profiles WRAM at runtime to generate high-level Asar `struct Entity` declarations and enum constants in `ram.asm`.
   - Traps DMA and APU loops to carve out clean graphics and sound files in `assets/`.
2. **Standardized Interoperability**:
   - Because our WASM CDL buffer implements the standard Mesen / BizHawk bit layout (see Section 2.5), users who want DiztinGUIsh's interactive Windows GUI can **export the `.cdl` file straight into DiztinGUIsh** with zero conversion needed.
3. **Turnkey Zero-Friction in VS Code**:
   - For users on macOS or Linux, or those who want an automated 1-click reassembly, Everscript's built-in TypeScript engine uses the CDL + WRAM profile to generate the complete Asar directory structure (`main.asm`, `ram.asm`, `bank_XX.asm`, `assets/`) directly inside the workspace.

---

### 8.1 Can We Run DiztinGUIsh on macOS?

The technical feasibility of running DiztinGUIsh directly on macOS breaks down as follows:

1. **Architecture Impediment**:
   - DiztinGUIsh is architected as two projects:
     - `Diz.Core`: Pure C# logic (parsers, disassembly data models, Asar exporter).
     - `Diz.App.Winforms`: A heavy **Windows Forms (WinForms)** desktop GUI.
   - WinForms is tightly coupled to Windows GDI and the Windows message pump. While Microsoft ported core .NET to macOS/Linux (.NET Core / .NET 6+), **WinForms was never ported to macOS**.

2. **Compatibility Layer Options on macOS**:
   - **Wine / CrossOver / Whisky**:
     - Can run .NET 4.x WinForms executables on macOS via Wine.
     - *Caveat*: DiztinGUIsh relies on IPC / local socket connections to communicate with custom BSNES builds for live tracelog capturing. Wine socket bridging and GDI rendering often introduce visual glitches, DPI scaling bugs on Retina displays, and IPC sync drops.
   - **Mono (`mono DiztinGUIsh.exe`)**:
     - Mono's macOS WinForms implementation is essentially abandoned, lacks 64-bit Cocoa integration on modern macOS versions (macOS Sonoma / Sequoia), and crashes on launch.
   - **Virtual Machine (Parallels / UTM / Windows 11 ARM)**:
     - The only 100% reliable way to run DiztinGUIsh on an Apple Silicon Mac today is inside Windows 11 ARM via Parallels or UTM (using Windows' built-in x64-on-ARM emulation).

3. **Could we extract `Diz.Core` into Everscript?**:
   - Because `Diz.Core` contains the 65816 disassembly engine, one theoretical path is compiling `Diz.Core` into a CLI tool using .NET 8 (which runs natively on macOS ARM64).
   - *However*, because our VS Code extension already runs on Node/TypeScript with an embedded WASM SNES core, having a clean TypeScript 65816 disassembler (or compiling a C disassembler to WASM) eliminates any external runtime dependencies (`dotnet`, Wine, VMs) entirely for Mac users.



---

## 9. Our Approach: Storage, Persistence & Visualization

Sections 1–8 cover what can be recorded. This section records what we decided about **how the recording is switched on, kept in memory, saved to disk, merged and shown**.

### 9.1 Default Off

- CDL recording is **off by default**. A setting (`everscript.cdl.enabled`, default `false`) plus a toggle in the emulator's bottom bar switches it on per session.
- When it is off:
  - No CDL/WRAM-profile buffers are allocated in WASM memory.
  - The CPU hook is a single predictable branch on a global `cdl_enabled` byte, so a normal play session costs nothing measurable.
  - Nothing is written under the library folder.
- When it is switched on, the buffers are allocated and **seeded from the library file for this ROM** (Section 9.2). A new session adds to what is already known instead of starting at zero.

### 9.2 Per-ROM Library Outside the Project

Each ROM gets its own folder, keyed by hash, **outside the workspace**, in the extension's global storage (the same place `custom-maps/` and `widgets.json` already live):

```text
<globalStorageUri>/cdl-library/
└── <sha1-of-rom>/                  # SHA-1 of the ROM bytes, copier header (512 B) stripped
    ├── manifest.json               # header title, size, map mode, hash, format version, session log
    ├── rom.cdl                     # 1 byte per ROM byte, Mesen-S / BizHawk bit layout (Section 2)
    ├── rom.ext                     # 1 companion byte per ROM byte (EXT_* flags: opcode head, DMA, APU, M/X conflict)
    ├── wram.prof                   # WRAM profile (Section 9.4), fixed-size binary
    ├── wram-sites.bin              # sparse: WRAM address → set of ROM PCs that touched it
    └── assets.json                 # DMA → VRAM/CGRAM/OAM and APU source ranges
```

Why this layout:
- **Keyed by hash, not by path or filename**: the same ROM opened from a different folder, a different workspace or a different machine lands in the same entry. A patched ROM gets a different hash and its own entry, so coverage from a modified build never contaminates the vanilla map.
- **Outside the repo**: recording data is large, binary and personal to the player. It must not dirty the git worktree or ship in the `.vsix`.
- **Export / Import commands** (`Everscript: Export CDL…`, `Everscript: Import CDL…`) move a library entry or a single `.cdl` in and out. Import **merges** (Section 9.3). It never replaces.
- The manifest validates the hash before any merge. A file recorded against a different ROM is refused.

### 9.3 Everything Must Be Mergeable

The goal is that **you never have to finish the game in one sitting**. Coverage accumulates over many sessions, save states and players.

**Rule**: every field we store must merge with an operation that is **commutative, associative and idempotent** (a join). Then:
- the order in which sessions are merged does not matter,
- merging the same file twice is harmless (no double counting),
- a crash mid-session loses at most the unflushed delta, never already-saved knowledge.

| Data | Merge operation |
|---|---|
| `rom.cdl`, `rom.ext` flag bytes | bitwise OR |
| WRAM read/write width masks, access-mode flags | bitwise OR |
| WRAM values-seen bitmap (256 bits per address) | bitwise OR |
| WRAM min / max value | `min` / `max` |
| Access sites (WRAM address → ROM PCs) | set union (capped per address) |
| DMA / APU source ranges | interval union |
| Session log in `manifest.json` | union by session id |

**Hit counters are deliberately excluded.** "How often was this executed" cannot be merged idempotently (re-importing a file would double it), and the analysis does not need it. A heat view, if we add one, belongs to the live session only and is never persisted.

### 9.4 High Performance: Record in Memory, Flush in Batches

The SSD is **never** touched per instruction, per access or per frame.

```text
65816 hook ──OR──► WASM buffers (rom.cdl / rom.ext / wram.prof)   ← every instruction, in-memory only
                        │  + per-64 KB-bank "dirty" bit, set when any byte gains a NEW bit
                        ▼
                 periodic flush (every ~30 s, and on pause / save state / panel close / extension deactivate)
                        │  only dirty banks are copied out of WASM memory
                        ▼
webview ──postMessage (transferable ArrayBuffer)──► extension host
                        │  OR-merge into the library copy kept in host memory
                        ▼
                 atomic write: write *.tmp, then rename over the real file
```

Details:
- **Change detection is cheap.** The hook computes `old | flags`; only when that differs from `old` does it write and set the bank's dirty bit. Idle loops that re-execute known code never dirty anything, so a long session in a menu flushes nothing.
- **Flushes ship deltas only.** With 64 KB dirty granularity, a typical flush moves a few banks, not 4 MB.
- **Atomic rename** means a crash or VS Code being killed mid-write leaves the previous file intact.
- **WRAM profile in WASM**: a fixed-size array indexed by `addr & 0x1FFFF`: width masks, access-mode flags (`CMP #imm`, used as `JMP (abs,X)` index, `TSB/TRB`, `AND/ORA #single-bit`), min/max, and a 32-byte values-seen bitmap. That is about 5 MB, allocated only while recording is on.

### 9.5 Visualizing the ROM CDL

A **ROM Coverage** view styled after the classic CDL visualizers (one horizontal strip per 64 KB bank, `C0`–`FF` for the 4 MB HiROM, one pixel per byte, wrapped to the strip width):

| Colour category | Source |
|---|---|
| Unreached | no flags set |
| Opcode | `EXT_OPCODE_HEAD` |
| Operand | `CDL_CODE` without opcode head |
| Data (8/16/24/32-bit) | `CDL_DATA`, width from the reading instruction |
| Pointer (16/24/32-bit) | `CDL_INDIRECT`, or data later used as a jump/long address |
| Graphics | `EXT_DMA_SOURCE` toward VRAM / CGRAM / OAM |
| Music | `EXT_APU_TRANSFER` |
| Text | ranges claimed by the existing Everscript text/script decoders |
| Empty | unreached **and** `$00`/`$FF` fill runs |
| M/X conflict | `EXT_CONFLICT_M` / `EXT_CONFLICT_X` (highlighted overlay) |

- A per-bank **coverage %** sits next to each bank label, so "what is still unexplored" is visible at a glance.
- Hover shows the bus address, ROM offset and decoded flags. Click jumps to that address in the disassembly view once it exists.
- The view can **update live** while recording (it repaints from the same dirty-bank deltas the flush uses), or open a library entry with the emulator closed.
- The same view renders an **imported** `.cdl` from BizHawk / Mesen, since the bit layout is identical.

### 9.6 Visualizing WRAM & Identifying Enums

The WRAM profile is shown as a **type map** over `$7E0000–$7FFFFF`, preferably as a layer on the existing Memory Radar WRAM grid rather than a separate grid:

- Colour by inferred type: byte, word, 24-bit pointer, **enum candidate**, **bit-flag field**, struct member (Section 3 fingerprinting), untouched.
- Hover shows the observed value set, access widths and the ROM sites that touch the address.

**Enum heuristics** (all computed from mergeable data, so they get stronger as sessions accumulate):

| Signal | Interpretation |
|---|---|
| Few distinct values (values-seen bitmap popcount ≤ ~16), mostly contiguous from 0 | enum candidate |
| Compared against immediates (`CMP #imm`) at several sites | strong enum signal; the immediates name the members |
| Used as index into a jump table (`ASL` → `JMP (abs,X)` / `JSR (abs,X)`), values all even | state-machine enum (value = index × 2) |
| Written with `TSB`/`TRB`, or tested with `AND #single-bit` / `BIT` | **bit-flag field**, not an enum |
| Same address, same distinct value set, at the same offset in struct copies | enum belongs to the struct member, not one instance |

The output is a list of **enum candidates** (address, value set, comparing sites, confidence). The user can confirm and name them. Confirmed names go into the generated `ram.asm` and back into Everscript hover/completion.
