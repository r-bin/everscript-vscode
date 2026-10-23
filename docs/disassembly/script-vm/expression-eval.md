# Script VM Expression & Argument Evaluator

- **ROM Locations**:
  - `script_vm_read_args`: `$8C:D315` – `$8C:D330`
  - `script_vm_eval_expression`: `$8C:EA43` – `$8C:EA65`
  - `script_vm_subop_table`: `$8C:F041` – `$8C:F100`
- **CPU State**: 16-bit A/X (`REP #$30`), toggles to 8-bit (`SEP #$30`) during sub-op byte fetch.
- **WRAM Core Addresses**:
  - `$7E:0E80`..`$7E:0EFF`: Evaluated argument array (`uint16_t args[16]`) for script commands.
  - DP `$02`–`$05`: 32-bit expression accumulator (`uint32_t expr_acc`).
  - DP `$82`–`$84`: 24-bit direct script instruction pointer `[$82]`.
  - DP `$8A`: Expression continuation flag (Bit 0 set when the current sub-op has bit 7 set, indicating terminal sub-op).

---

## 1. Architectural Role & Postfix Stack Evaluation

Secret of Evermore opcodes do not receive static immediate arguments alone. Many opcodes (such as arithmetic conditionals, entity controls, dialog formatting, and alchemy setup) accept dynamic expressions (`E`) or counted argument lists (`A`).

### Counted Arguments (`A`)
An argument block begins with a 1-byte count $n$. The VM reads $n$, iterates $n$ times, evaluates each expression via `JSL $8C:EA43`, and stores the 16-bit results into consecutive words at `$7E:0E80 + 2*i`.

### Postfix Expression Bytecode
Expressions use Reverse Polish Notation (postfix evaluation):
- Operands (constants, memory values, entity attributes, RNG values) place their values into the accumulator (`$02`–`$05`).
- `PUSH` (`0x29`) pushes the 32-bit accumulator onto the SNES hardware stack.
- Binary operators (`+`, `-`, `*`, `/`, `==`, `<`, etc.) pull the previous operand from the stack, apply the operation to the current accumulator, and update the accumulator.
- **Terminal Marker (Bit 7)**: Each sub-op byte contains the 7-bit opcode in bits 0–6. Bit 7 is the termination flag:
  - If Bit 7 is `0`, another sub-op immediately follows.
  - If Bit 7 is `1`, this is the final sub-op of the expression. The evaluator returns to caller after executing it.

---

## 2. Disassembly & Annotations

### Part 1: Argument List Reader (`$8C:D315`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CD315](soe://rom/code/8CD315?asm=1&c=0)


### Part 2: Expression Evaluator Engine (`$8C:EA43`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CD315](soe://rom/code/8CD315?asm=1&c=0)


### Part 3: Representative Sub-Op Handlers
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CD315](soe://rom/code/8CD315?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CD315_expression_eval.c`](../../../reconstructed-c/8C/8CD315_expression_eval.c).
> [View in VFS: soe://rom/code/8CD315](soe://rom/code/8CD315?c=1&asm=0)


