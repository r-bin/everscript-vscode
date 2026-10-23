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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CD331](soe://rom/code/8CD331?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CD331_callback_dispatch.c`](../../../reconstructed-c/8C/8CD331_callback_dispatch.c).
> [View in VFS: soe://rom/code/8CD331](soe://rom/code/8CD331?c=1&asm=0)

