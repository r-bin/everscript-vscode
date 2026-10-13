# Incremental Decompilation Guide: From 65816 Assembly to Clean C

> This guide documents the end-to-end process of transforming Secret of Evermore's assembly
> into clean, readable, portable C using the **static recompiler (`snesrecomp`) as an executable
> test harness and lockstep verification oracle**.
>
> Complementary reading:
> - [asm-to-c-port.md](asm-to-c-port.md) — Port pipeline roadmap, shiftable disasm, room ID census
> - [cdl-export-build-recomp.md](cdl-export-build-recomp.md) — CDL recording & Asar build instructions
> - [../recomp/debugging.md](../recomp/debugging.md) — Lockstep co-simulation & debugging tools

---

## 1. Core Principles

### 1.1 The Behavioral Oracle
Unlike N64 or PS1 decompilations (which were compiled from original C and target bit-exact
binary matching), Secret of Evermore was hand-written in 65816 assembly. There was never an
original C source or compiler to match.

Instead, the target is **behavioral equivalence**:
> **At the end of every frame, given identical inputs, the C implementation must produce a
> WRAM, VRAM, OAM, and CGRAM state bit-for-bit identical to the original ROM running on hardware.**

### 1.2 Why Recompile First?
Attempting a "clean room" decompilation from disassembly alone presents two fatal problems:
1. **No Day-1 Executable:** You cannot run your code until you manually rewrite hundreds of
   functions, the PPU rasterizer, APU audio driver, and main execution loop.
2. **Undebuggable Desyncs:** If your 30th rewritten function has an off-by-one error or subtle flag
   bug, locating it in a non-working game is nearly impossible.

With `snesrecomp`, **the entire game boots and plays natively on Day 1**. Every routine exists in
"mechanical C". You can replace routines **one at a time**, proving each replacement 100% correct
before touching the next.

---

## 2. The Step-by-Step Pipeline

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Identify Candidate Routine (Leaf first, e.g. Math/Logic) │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Inspect Assembly & CDL Metadata (WRAM offsets, widths)   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Review Mechanical Lift (Understand snesrecomp semantics) │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Configure HLE Hook in bankXX.cfg (hle_func)              │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Implement Clean Decompiled C (Structs, locals, enums)    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Lockstep Validation (npm run recomp:lockstep)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Walkthrough & Code Example

To illustrate, consider an engine routine that calculates and applies damage to an active entity:
`ApplyEntityDamage` (located at Bank `$84`, offset `$9A12`).

### Step 1: Inspect the 65816 Assembly

The original assembly operates on registers (`A`, `X`, `Y`), stack pushes/pulls, and raw WRAM offsets:

```assembly
; ==============================================================================
; ApplyEntityDamage ($84:9A12)
; Input:
;   X = Entity index (0 = Boy, 1 = Dog, 2..N = Enemies)
;   A = 16-bit incoming damage amount
; Modifies:
;   Entity struct in WRAM at $7E4E45 + (X * 0x70)
;   Offset +$14: current_hp (16-bit)
;   Offset +$22: status_flags (16-bit, bit 2 = DEAD)
; ==============================================================================
ApplyEntityDamage:
    REP #$20                ; 16-bit Accumulator
    PHA                     ; Save incoming damage on stack
    TXA                     ; A = entity index
    ; Compute offset: Y = X * 0x70
    STA $02
    ASL A : ASL A : ASL A   ; A = X * 8
    ADC $02                 ; A = X * 9 (approximate stride math)
    ...
    TAY                     ; Y = entity byte offset from $4E45
    PLA                     ; Pull damage back to A
    STA $00                 ; Store damage in scratchpad $7E0000

    ; Deduct HP
    LDA $4E45+0x14, Y       ; Load Entity.current_hp
    SEC
    SBC $00                 ; Subtract damage
    BCS .alive              ; If no borrow (Carry=1), HP > 0
    LDA #$0000              ; Underflow clamp: HP = 0
.alive:
    STA $4E45+0x14, Y       ; Store new HP
    BNE .done               ; If HP != 0, finish

    ; Entity died: update status flags
    LDA $4E45+0x22, Y       ; Load Entity.status_flags
    ORA #$0004              ; Set bit 2 (STATUS_DEAD)
    STA $4E45+0x22, Y
.done:
    RTS
```

---

### Step 2: The Mechanical Recompiler C (`snesrecomp` Output)

When `snesrecomp` runs, it translates the assembly instruction-by-instruction into native C.
**Important:** We do *not* edit this file, as it is automatically regenerated every build.

```c
// Generated file: out/recomp/project/src/game/bank_84.c (DO NOT EDIT DIRECTLY)
void func_849A12_M0X0(CpuState *cpu) {
    // REP #$20
    cpu->p &= ~FLAG_M;

    // PHA
    cpu_push16(cpu, cpu->a);

    // TXA ; math ...
    uint16_t ent_idx = cpu->x;
    uint16_t offset = ent_idx * 0x70;
    cpu->y = offset;

    // PLA ; STA $00
    uint16_t damage = cpu_pop16(cpu);
    wram_write16(0x0000, damage);

    // LDA $4E45+0x14, Y ; SBC $00
    uint16_t hp = wram_read16(0x4E45 + 0x14 + cpu->y);
    uint32_t diff = (uint32_t)hp - damage;

    if (diff & 0x10000) {   // Underflow borrow
        hp = 0;
    } else {
        hp = (uint16_t)diff;
    }

    // STA $4E45+0x14, Y
    wram_write16(0x4E45 + 0x14 + cpu->y, hp);

    if (hp == 0) {
        // LDA $4E45+0x22,Y ; ORA #$0004 ; STA $4E45+0x22,Y
        uint16_t flags = wram_read16(0x4E45 + 0x22 + cpu->y);
        flags |= 0x0004;
        wram_write16(0x4E45 + 0x22 + cpu->y, flags);
    }
}
```

---

### Step 3: Register the High-Level Override (`hle_func`)

In `tools/recomp/host/config/bank84.cfg` (or `recomp/cfg/bank84.cfg`), declare that address `$9A12`
should be handled by our custom C implementation:

```ini
# tools/recomp/host/config/bank84.cfg
bank = 84

# Replace mechanical function with custom C handler
hle_func 9a12 HLE_ApplyEntityDamage
```

When building, `snesrecomp` replaces calls to `func_849A12` with our wrapper.

---

### Step 4: Implement Clean Decompiled C

Create your clean implementation in the game runtime layer (`tools/recomp/host/src/entities.c`
or `src/decomp/combat.c`):

#### 4.1 Type Definitions (`entities.h`)
```c
#ifndef SOE_ENTITIES_H
#define SOE_ENTITIES_H

#include <stdint.h>
#include <stdbool.h>

typedef enum {
    STATUS_POISONED   = (1 << 0),
    STATUS_CONFUSED   = (1 << 1),
    STATUS_DEAD       = (1 << 2),
    STATUS_INVINCIBLE = (1 << 3),
} EntityStatusFlags;

// Entity record matching WRAM $7E4E45 (stride: 0x70 bytes)
typedef struct {
    uint16_t x_pos;             // +0x00
    uint16_t y_pos;             // +0x02
    uint16_t z_pos;             // +0x04
    uint8_t  _pad0[0x0E];
    uint16_t current_hp;        // +0x14
    uint16_t max_hp;            // +0x16
    uint8_t  _pad1[0x0A];
    uint16_t status_flags;      // +0x22
    uint8_t  _pad2[0x4C];
} EntityRecord;

#define MAX_ENTITIES 16

#endif // SOE_ENTITIES_H
```

#### 4.2 Clean Implementation (`entities.c`)
```c
#include "entities.h"
#include "game_memory.h" // Provides g_wram base pointer

// Pure, idiomatic C game logic:
void Entity_ApplyDamage(EntityRecord *ent, uint16_t damage) {
    if (ent->status_flags & (STATUS_INVINCIBLE | STATUS_DEAD)) {
        return;
    }

    if (damage >= ent->current_hp) {
        ent->current_hp = 0;
        ent->status_flags |= STATUS_DEAD;
    } else {
        ent->current_hp -= damage;
    }
}

// HLE Glue Adapter (interfacing with snesrecomp CPU state):
void HLE_ApplyEntityDamage(CpuState *cpu) {
    uint8_t entity_slot = (uint8_t)cpu->x;
    uint16_t damage = cpu->a;

    // Resolve pointer to entity in WRAM ($7E4E45)
    EntityRecord *entities = (EntityRecord *)&g_wram[0x4E45];
    
    if (entity_slot < MAX_ENTITIES) {
        Entity_ApplyDamage(&entities[entity_slot], damage);
    }

    // Simulate RTS
    // (snesrecomp handles return execution when hle_func completes)
}
```

---

### Step 5: Lockstep Verification

Run the automated lockstep verification test against a known input recording:

```bash
npm run recomp:lockstep -- --rom "/path/to/Secret of Evermore (U) [!].smc"
```

The runner executes:
1. **Machine A (Emulator):** `snes9x2005-wasm` executing the unmodified vanilla ROM.
2. **Machine B (Recomp):** Native recompiled binary executing our new `HLE_ApplyEntityDamage`
   alongside the remaining mechanical functions.
3. **Comparison:** At the start of V-Blank (frame boundary), all 128 KB of WRAM, 64 KB of VRAM,
   544 bytes of OAM, and 512 bytes of CGRAM are compared byte-for-byte.

```text
[LOCKSTEP] Frame 00100: OK (RAM Diff: 0)
[LOCKSTEP] Frame 00500: OK (RAM Diff: 0)
[LOCKSTEP] Frame 01200 (Combat Triggered): OK (RAM Diff: 0)
[LOCKSTEP] Frame 02000: OK (RAM Diff: 0)
==> 100% Behavioral Equivalence Proven!
```

---

## 4. Troubleshooting Divergences

If the lockstep runner detects a divergence:
```text
[LOCKSTEP DIVERGENCE] Frame 01243:
  Address $7E4E59 (Entity 0 status): Expected 0x0004, Got 0x0000
```

1. **Check Register Widths ($M/X$):**
   Did the original code expect 8-bit or 16-bit accumulator? If $M=1$ (8-bit), high bytes in `c->A`
   are ignored by the 65816.
2. **Check Status Flags (Carry, Overflow):**
   Subtractions on 65816 require `SEC` before `SBC`. If the carry bit logic handled underflow
   differently than unsigned C subtraction, diffs will emerge on edge cases (e.g. `damage == hp`).
3. **Check Side Effects:**
   Did the original assembly write to direct page temporary variables (e.g., `STA $00`) that a
   subsequent interrupt or callee reads? If so, the C wrapper must replicate those writes.

---

## 5. Transitioning: Compat Mode to Native Mode

Decompilation progresses through two distinct architectural modes:

| Phase | Memory Model | Purpose |
|---|---|---|
| **Phase 1: Compat Mode** | All C structs map directly onto `g_wram[$7E0000]` addresses. | Maintains the lockstep test oracle. Every function can be verified against vanilla snes9x. |
| **Phase 2: Native Mode** | Memory is allocated via standard C allocators; IDs become 32-bit/pointers. | Free from SNES hardware constraints (e.g., 256-room limit, 16-bit math, 64 KB bank boundaries). |

> **Rule:** Never migrate a subsystem to Native Mode until all of its dependencies have passed
> Phase 1 Compat Mode verification. Extending before verification prevents distinguishing
> bugs from intentional changes.
