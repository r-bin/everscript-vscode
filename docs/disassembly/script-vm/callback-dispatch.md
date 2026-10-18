# Script VM Subroutine Calls, Callbacks & Argument Dispatch

- **ROM Locations**:
  - `script_op_b3_call_back_far_with_args`: `$8C:D331` – `$8C:D34B`
  - `script_op_b2_call_back_with_args`: `$8C:D34C` – `$8C:D365`
  - `script_op_b1_call_trigger_with_args`: `$8C:D392` – `$8C:D394`
  - `script_op_a4_call_trigger`: `$8C:D395` – `$8C:D39C`
  - `script_op_b0_call_global_with_args`: `$8C:D39D` – `$8C:D3B5`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$8C`
- **WRAM Core Addresses**:
  - `$7E:2F28,x`: Active thread run-list.
  - Thread slot offset `+0x0B`: Saved caller return PC.
  - Thread slot offset `+0x0D`: Saved caller return Bank.
  - Thread slot offset `+0x3E`: Parent thread slot index (call stack chaining).
  - DP `$8A`: Argument status word.
  - `$92:8000`: Master script bank header (trigger pointer table origin).
  - `$92:8008`: Master global script pointer table origin.

---

## 1. Architectural Role & Call Stack Management

Secret of Evermore's scripting language implements structured subroutines (with argument passing and nested execution) via thread suspension and parent-child chaining in WRAM:

```mermaid
flowchart TD
    Opcode["Execute Call Opcode (0xA4, 0xB0, 0xB1, 0xB2, 0xB3)"] --> HasArgs{"Has Arguments? (0xB0..0xB3)"}
    HasArgs -->|Yes| ReadArgs["Evaluate Expression Stack ($8C:D315) -> Push to Frame"]
    HasArgs -->|No (0xA4)| ResolveTarget["Resolve Script Pointer"]
    ReadArgs --> ResolveTarget

    ResolveTarget --> AllocSlot["Allocate Child Thread Slot ($8C:CF18)"]
    AllocSlot --> SaveReturn["Store Caller PC in Parent Slot +0x0B, Bank in +0x0D"]
    SaveReturn --> LinkParent["Child Slot +0x3E = Parent Slot ID"]
    LinkParent --> InsertRunList["Insert Child into Run-List ($7E:2F28)"]
    InsertRunList --> SuspendParent["Suspend Parent Thread (Yield Execution)"]
```

### 1. Opcode Classification & Operands
- **Opcode `0xA4` (`call_trigger`)**:
  - Operand: `u16` trigger index.
  - Reads 16-bit trigger pointer from `$92:8000 + word[$92:8000] + 2*idx`.
  - Suspends current thread and spawns a child thread running the target trigger script.
- **Opcode `0xB1` (`call_trigger_with_args`)**:
  - Operands: `Args...`, `u16` trigger index.
  - Evaluates argument expressions into thread argument registers via `$8C:D315`, then falls into the `0xA4` trigger launcher.
- **Opcode `0xB0` (`call_global_with_args`)**:
  - Operands: `Args...`, `u8` global script ID.
  - Resolves target address from global script table `$92:8008 + 2*idx`.
  - Allocates thread and suspends caller.
- **Opcode `0xB2` (`call_callback_with_args`)**:
  - Operands: `Args...`, `cb` (16-bit local script address in current script bank).
  - Executes local function within the room script blob.
- **Opcode `0xB3` (`call_back_far_with_args`)**:
  - Operands: `Args...`, `c16` (24-bit far pointer: bank + address).
  - Permits calling routines across separate ROM banks (e.g., from Bank `$92` into Bank `$91`).

---

## 2. Disassembly & Annotations

```assembly
; ==============================================================================
; script_op_b3_call_back_far_with_args ($8C:D331)
; ==============================================================================
$8CD331  20 15 D3    JSR $D315         ; Evaluate arguments stack into registers
$8CD334  B1 08       LDA ($08)         ; Read far target address from PC
$8CD336  85 12       STA $12
$8CD338  E6 08       INC $08
$8CD33A  E6 08       INC $08
$8CD33C  B1 08       LDA ($08)         ; Read far target bank
$8CD33E  85 14       STA $14
$8CD340  E6 08       INC $08
$8CD342  E6 08       INC $08
$8CD344  A5 14       LDA $14           ; Bank
$8CD346  A6 12       LDX $12           ; Offset
$8CD348  4C 5C D3    JMP $D35C         ; Chain thread and suspend caller

; ==============================================================================
; script_op_b2_call_back_with_args ($8C:D34C)
; ==============================================================================
$8CD34C  20 15 D3    JSR $D315         ; Evaluate arguments
$8CD34F  B1 08       LDA ($08)         ; Read 16-bit local target offset
$8CD351  85 12       STA $12
$8CD353  E6 08       INC $08
$8CD355  E6 08       INC $08
$8CD357  A5 0A       LDA $0A           ; Inherit current script bank
$8CD359  A6 12       LDX $12
$8CD35B  80 00       BRA $D35D

; ==============================================================================
; Thread Call Chaining Common Helper ($8C:D35C)
; ==============================================================================
$8CD35C  20 18 CF    JSR $CF18         ; Allocate new script slot (returns index in Y)
$8CD35F  A5 08       LDA $08           ; Current PC
$8CD361  99 0B 00    STA $000B,y       ; Store in return PC field of caller
$8CD364  A5 0A       LDA $0A           ; Current Bank
$8CD366  99 0D 00    STA $000D,y       ; Store in return Bank field
$8CD369  8A          TXA               ; Child thread initial PC
$8CD36A  85 08       STA $08
$8CD36C  60          RTS

; ==============================================================================
; script_op_b1_call_trigger_with_args ($8C:D392)
; ==============================================================================
$8CD392  20 15 D3    JSR $D315         ; Evaluate arguments
$8CD395  B1 08       LDA ($08)         ; Script opcode 0xA4 entry: read trigger index
$8CD397  0A          ASL A             ; 2 bytes per pointer
$8CD398  AA          TAX
$8CD399  BF 00 80 92 LDA $928000       ; Pointer table base offset
$8CD39D  18          CLC
$8CD39E  7F 00 80 92 ADC $928000,x     ; Add trigger offset
$8CD3A2  AA          TAX
$8CD3A3  A9 92 00    LDA #$0092        ; Triggers reside in Bank $92
$8CD3A6  4C 5C D3    JMP $D35C         ; Chain thread

; ==============================================================================
; script_op_b0_call_global_with_args ($8C:D39D)
; ==============================================================================
$8CD3A9  20 15 D3    JSR $D315         ; Evaluate arguments
$8CD3AC  B1 08       LDA ($08)         ; Read global index
$8CD3AE  29 FF 00    AND #$00FF
$8CD3B1  0A          ASL A
$8CD3B2  AA          TAX
$8CD3B3  BF 08 80 92 LDA $928008,x     ; Global script pointer table ($92:8008)
$8CD3B7  AA          TAX
$8CD3B8  A9 92 00    LDA #$0092
$8CD3BB  4C 5C D3    JMP $D35C
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define SCRIPT_BANK_92 0x92

typedef struct ScriptThread {
    uint8_t  slot_id;           // Thread slot index (0..31)
    uint16_t pc;                // +0x08: Program Counter
    uint8_t  bank;              // +0x0A: ROM Bank
    uint16_t return_pc;         // +0x0B: Caller return PC
    uint8_t  return_bank;       // +0x0D: Caller return Bank
    uint8_t  parent_slot;       // +0x3E: Parent thread link
    bool     is_active;
} ScriptThread;

extern ScriptThread g_script_threads[32]; // $7E:2F28 run-list slots
extern const uint16_t g_trigger_table_origin; // word[$92:8000]
extern const uint16_t g_trigger_pointers[];   // $92:8000 + origin
extern const uint16_t g_global_pointers[];    // $92:8008

extern void script_vm_eval_args(ScriptThread *thread);       // $8C:D315
extern ScriptThread *script_vm_allocate_slot(void);          // $8C:CF18

/**
 * Spawns a child thread to execute a subroutine, suspending the caller.
 * Corresponds to $8C:D35C.
 */
static void script_chain_call(ScriptThread *caller, uint8_t target_bank, uint16_t target_pc) {
    ScriptThread *child = script_vm_allocate_slot();
    if (!child) {
        return; // Allocation failure
    }

    // Save caller return context
    caller->return_pc = caller->pc;
    caller->return_bank = caller->bank;

    // Link parent-child hierarchy
    child->parent_slot = caller->slot_id;
    child->bank = target_bank;
    child->pc = target_pc;
    child->is_active = true;

    // Suspend caller until child finishes
    caller->is_active = false;
}

/**
 * Opcode 0xB3: Call far subroutine with arguments across ROM banks.
 * Corresponds to $8C:D331.
 */
void script_op_b3_call_back_far_with_args(ScriptThread *thread, const uint8_t *rom_stream) {
    script_vm_eval_args(thread);

    uint16_t target_pc = *(const uint16_t *)(rom_stream + thread->pc);
    thread->pc += 2;
    uint8_t target_bank = rom_stream[thread->pc++];

    script_chain_call(thread, target_bank, target_pc);
}

/**
 * Opcode 0xB2: Call local subroutine with arguments within the same script bank.
 * Corresponds to $8C:D34C.
 */
void script_op_b2_call_back_with_args(ScriptThread *thread, const uint8_t *rom_stream) {
    script_vm_eval_args(thread);

    uint16_t target_pc = *(const uint16_t *)(rom_stream + thread->pc);
    thread->pc += 2;

    script_chain_call(thread, thread->bank, target_pc);
}

/**
 * Opcode 0xA4 & 0xB1: Call room trigger script.
 * Corresponds to $8C:D392 and $8C:D395.
 */
void script_op_call_trigger(ScriptThread *thread, const uint8_t *rom_stream, bool with_args) {
    if (with_args) {
        script_vm_eval_args(thread);
    }

    uint16_t trigger_idx = *(const uint16_t *)(rom_stream + thread->pc);
    thread->pc += 2;

    uint16_t target_pc = g_trigger_pointers[trigger_idx];
    script_chain_call(thread, SCRIPT_BANK_92, target_pc);
}

/**
 * Opcode 0xB0: Call global script with arguments.
 * Corresponds to $8C:D39D.
 */
void script_op_b0_call_global_with_args(ScriptThread *thread, const uint8_t *rom_stream) {
    script_vm_eval_args(thread);

    uint8_t global_idx = rom_stream[thread->pc++];
    uint16_t target_pc = g_global_pointers[global_idx];

    script_chain_call(thread, SCRIPT_BANK_92, target_pc);
}
```
