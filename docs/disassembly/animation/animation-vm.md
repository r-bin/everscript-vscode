# Animation Bytecode VM & Keyframe Interpreter

- **ROM Locations**:
  - `anim_vm_tick_loop`: `$90:80CE` – `$90:8114`
  - `anim_vm_opcode_table`: `$90:8000` – `$90:80CF` (jump table of handlers)
- **CPU State**: 8-bit A (`SEP #$21`), 16-bit Index (`REP #$10`), Data Bank `$7E`
- **WRAM Core Addresses**:
  - DP `$5D`–`$5F`: 24-bit direct animation bytecode instruction pointer `[$5D]`.
  - `slot + 0x00`: 16-bit low word of animation script PC.
  - `slot + 0x02`: 8-bit ROM bank byte of animation script.
  - `slot + 0x05`: Current keyframe hold duration timer (countdown ticks).
  - `slot + 0x0E`: Total ticks elapsed in current animation state.

---

## 1. Architectural Architecture & Keyframe Hold Mechanics

Secret of Evermore animates sprites (the boy, dog, NPCs, enemies, projectiles) using a dedicated bytecode VM in Bank `$90`.

### Keyframe Hold & Resume Protocol
Each animation keyframe specifies a visual graphic frame, a collision hurtbox, optional particle/sound effects, and a **hold duration**:
1. **Bit 7 Terminal Flag**: The high bit of each command byte indicates the **end of frame definition**. The low 7 bits (`cmd & 0x7F`) index the opcode jump table at `$90:8000`.
2. **Hold Opcode**: Sets the frame countdown timer (`slot + 0x05`). Commands placed *before* the hold execute once when the frame begins (e.g. keyframe attack trigger or SFX); commands placed *after* the hold execute every frame tick while holding.
3. **Timer Decrement**: Every tick, the VM decrements `slot + 0x05`. When the timer expires (`0`), the VM advances the instruction pointer `slot + 0x00` to decode the next keyframe.

---

## 2. Disassembly & Annotations

```assembly
; ==============================================================================
; anim_vm_tick_loop ($90:80CE)
; Input: Y = Active animation slot pointer ($7E:xxxx)
; Executes one frame tick for an animated entity.
; ==============================================================================
$9080CE  22 7B 81 90 JSL $90817B       ; Update physics positioning offsets
$9080D2  BB          TYX               ; X = animation slot pointer
$9080D3  FE 0E 00    INC $000E,X       ; Elapsed frame ticks counter++

; Load 24-Bit Bytecode Pointer:
$9080D6  BE 00 00    LDX $0000,Y       ; Low word of animation PC
$9080D9  86 5D       STX $5D           ; DP $5D = PC low
$9080DB  E2 21       SEP #$21          ; 8-bit A, clear Carry
$9080DD  B9 02 00    LDA $0002,Y       ; Bank byte of animation PC
$9080E0  85 5F       STA $5F           ; DP $5F = PC bank
$9080E2  7B          TDC               ; Clear upper accumulator bits

; Fetch & Dispatch Bytecode Command:
$9080E3  A7 5D       LDA [$5D]         ; Fetch command byte
$9080E5  0A          ASL A             ; Shift bit 7 into Carry (Bit 7 = End-of-Frame)
$9080E6  E8          INX               ; Advance instruction pointer
$9080E7  86 5D       STX $5D
$9080E9  AA          TAX               ; X = (cmd & 0x7F) * 2
$9080EA  B0 10       BCS $9080FC       ; If Carry set, this is terminal command for frame!

; Non-Terminal Command:
$9080EC  FC 00 80    JSR ($8000,X)     ; Dispatch opcode handler via jump table!
$9080EF  7B          TDC
$9080F0  A7 5D       LDA [$5D]         ; Fetch next command byte
$9080F2  0A          ASL A             ; Shift bit 7 into Carry
$9080F3  E6 5D       INC $5D           ; Advance instruction pointer
$9080F5  D0 02       BNE $9080F9
$9080F7  E6 5E       INC $5E           ; Handle page wrap
$9080F9  AA          TAX
$9080FA  90 F0       BCC $9080EC       ; If Carry clear, loop fetching more commands

; Terminal Frame Command:
$9080FC  FC 00 80    JSR ($8000,X)     ; Execute final frame opcode handler

; Frame Duration Countdown:
$9080FF  BB          TYX               ; X = animation slot
$908100  DE 05 00    DEC $0005,X       ; Decrement frame hold duration timer
$908103  F0 05       BEQ $908108       ; If timer == 0, advance to next keyframe!
$908105  C2 30       REP #$30          ; 16-bit A/X
$908107  6B          RTL               ; Still holding, return

; Frame Finished — Write Back Advanced PC:
$908108  A9 01 9D    LDA #$9D01
$90810B  05 00       ORA $00
$90810D  C2 30       REP #$30          ; 16-bit A/X
$90810F  A5 5D       LDA $5D           ; Advanced bytecode PC
$908111  9D 00 00    STA $0000,X       ; Save PC back to slot +0x00
$908114  6B          RTL
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint16_t pc_offset;     // +0x00: Animation bytecode offset
    uint8_t  pc_bank;       // +0x02: Animation bytecode ROM bank
    uint8_t  flags;         // +0x03: Loop / status flags
    uint16_t hold_timer;    // +0x05: Countdown timer for current keyframe
    uint16_t sprite_frame;  // +0x07: Current graphics frame index
    uint16_t elapsed_ticks; // +0x0E: Lifetime tick counter in current animation
} AnimationSlot;

extern const uint8_t g_rom[0x400000];

typedef void (*AnimOpcodeHandler)(AnimationSlot *slot, uint32_t *pc);
extern const AnimOpcodeHandler g_anim_opcode_table[128]; // Jump table at $90:8000

extern void update_anim_physics_offset(AnimationSlot *slot);

/**
 * Executes one tick of an animated sprite's bytecode script.
 * Corresponds to $90:80CE.
 */
void anim_vm_tick(AnimationSlot *slot) {
    update_anim_physics_offset(slot);
    slot->elapsed_ticks++;

    uint32_t pc = ((uint32_t)slot->pc_bank << 16) | slot->pc_offset;

    // Decode commands until end-of-frame marker (Bit 7)
    bool end_of_frame = false;
    while (!end_of_frame) {
        uint8_t cmd_byte = g_rom[pc++];
        end_of_frame = (cmd_byte & 0x80) != 0;
        uint8_t opcode = cmd_byte & 0x7F;

        AnimOpcodeHandler handler = g_anim_opcode_table[opcode];
        if (handler != NULL) {
            handler(slot, &pc);
        }
    }

    // Decrement hold duration timer
    if (slot->hold_timer > 0) {
        slot->hold_timer--;
    }

    // When keyframe hold expires, advance instruction pointer to next frame
    if (slot->hold_timer == 0) {
        slot->pc_offset = (uint16_t)(pc & 0xFFFF);
    }
}
```
