# Script VM Turn Dispatcher & Thread Scheduler

- **ROM Locations**:
  - `script_scheduler_pass`: `$8C:CFFD` – `$8C:D028`
  - `script_thread_state_table`: `$8C:D029` – `$8C:D036`
  - `script_thread_state_handlers`: `$8C:D037` – `$8C:D095`
  - `script_thread_continue`: `$8C:D096` – `$8C:D0A5`
  - `script_vm_opcode_dispatch`: `$8C:D0A6` – `$8C:D0C2`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` during thread iteration.
- **WRAM Core Addresses**:
  - `$7E:1436`: Reentrancy guard / VM execution lock (1 when active, 0 when idle).
  - `$7E:2F28,x`: Active thread run-list array of 16-bit pointers into thread slot pool.
  - `$7E:28FC`..: Thread slot allocation structures (each slot is 16+ bytes).
  - DP `$7E`: Active thread slot pointer (in bank `$7E`).
  - DP `$80`: Current run-list index `x`.
  - DP `$82`–`$84`: 24-bit direct script instruction pointer `[$82]`.

---

## 1. Architectural Architecture & Turn Protocol

The Secret of Evermore event scripting engine is a cooperative multithreaded virtual machine executed once per field frame tick (at `$80:8C06` during the main game loop).

### The Thread Run List
Active threads are stored in an indexed run-list at `$7E:2F28,x`. Each entry is a 16-bit pointer to a thread slot in `$7E:28FC+`. The list is null-terminated by an entry containing `0x0000`.

### Thread Slot Layout
Each thread slot consists of at least 16 bytes:
- `+0x00`: Script instruction pointer low word (`uint16_t pc_low`)
- `+0x01`: Script instruction pointer high word (`uint8_t pc_high`, `uint8_t bank`) - note overlapping byte layout
- `+0x03`: Thread lifecycle state (`uint16_t state`, indexes jump table `$8C:D029`)
- `+0x05`: Wait target / parameter 1 (e.g. sleep timer deadline low, entity mask, text box ID, camera previous position X)
- `+0x07`: Wait target / parameter 2 (e.g. sleep timer deadline high, camera previous position Y)
- `+0x09`: Wait condition mask / entity busy bits
- `+0x0D`: Associated entity slot offset (for entity-bound scripts)
- `+0x0F`..: Thread-local scratch variables

### Carry Flag Protocol & Turn Semantics
During opcode execution (`$8C:D0A6`):
1. **Carry Set (`BCS $8C:D0A6`)**: The opcode handler finished its synchronous action and requests immediate continuation within the same frame tick. The loop continues without yielding.
2. **Carry Clear (`BCC $8C:D0B4`)**: The opcode handler yielded execution (e.g., `YIELD`, `SLEEP`, `WAIT_WALK`, `CHANGE_MAP`, `END`, or subroutine calls).
3. **Writeback & Termination**:
   - If the script pointer bank/high byte at DP `$83` is non-zero, the updated 24-bit pointer (`$82`–`$84`) is written back to the thread slot (`slot + 0` and `slot + 1`).
   - If DP `$83` is zero (script terminated via `END`), writeback is bypassed, leaving the slot deactivated.

---

## 2. Disassembly & Annotations

### Part 1: Top-Level Scheduler (`$8C:CFFD`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?asm=1&c=0)


### Part 2: Thread State Jump Table & Handlers (`$8C:D029`)
The jump table at `$8C:D029` indexes handlers by thread state byte (`+$03`):

| State | Address | Handler Purpose | Wake Condition |
|---|---|---|---|
| `0` | `$8C:E8BC` | Unused / Halting | `STP` / Invalid |
| `2` | `$8C:D09C` | Active / Running | Always continues execution at `pc` |
| `4` | `$8C:D037` | Sleeping | Frame counter `$0B19` $\ge$ deadline (`+0x05`/`+0x07`) |
| `6` | `$8C:D04A` | Entity Busy Wait | Entity busy mask (`+0x05` & `+0x09`) becomes non-zero |
| `8` | `$8C:D05C` | Dialog Box Wait | Dialog box state `$2429` $\ne$ `+0x05` |
| `10`| `$8C:D086` | Actor Walk Wait | Entity walk step `$107E,x` matches target `$10CE,x` |
| `12`| `$8C:D065` | Camera Settle | Camera coordinates DP `$BF` and `$C1` stop moving |

#### Mode 4: Sleep Timer Handler (`$8C:D037`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?asm=1&c=0)


#### Mode 6: Entity Busy Mask Wait (`$8C:D04A`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?asm=1&c=0)


#### Mode 8: Dialog / Text Box Wait (`$8C:D05C`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?asm=1&c=0)


#### Mode 10: Actor Walk Target Reached (`$8C:D086`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?asm=1&c=0)


#### Mode 12: Camera Stabilization Wait (`$8C:D065`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?asm=1&c=0)


---

### Part 3: Thread Wakeup & Opcode Dispatch Loop (`$8C:D096` – `$8C:D0C2`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CCFFD_dispatcher.c`](../../../reconstructed-c/8C/8CCFFD_dispatcher.c).
> [View in VFS: soe://rom/code/8CCFFD](soe://rom/code/8CCFFD?c=1&asm=0)


