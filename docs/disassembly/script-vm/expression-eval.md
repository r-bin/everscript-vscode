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
```assembly
; ==============================================================================
; script_vm_read_args ($8C:D315)
; Reads argument count n from script pointer [$82], then evaluates n expressions
; and writes the resulting 16-bit values to $0E80, $0E82, $0E84...
; ==============================================================================
$8CD315  A7 82       LDA [$82]         ; Fetch argument count byte
$8CD317  E6 82       INC $82           ; Advance script pointer
$8CD319  29 FF 00    AND #$00FF        ; A = argument count n
$8CD31C  A2 00 00    LDX #$0000        ; X = argument output offset (bytes)

$8CD31F  48          PHA               ; Preserve remaining argument count
$8CD320  DA          PHX               ; Preserve output array byte offset
$8CD321  22 43 EA 8C JSL $8CEA43       ; Evaluate one expression -> returns 16-bit in A
$8CD325  FA          PLX               ; Restore output array offset
$8CD326  9F 80 0E 00 STA $000E80,X     ; Store evaluated word into $7E:0E80 + X
$8CD32A  68          PLA               ; Restore remaining count
$8CD32B  E8          INX
$8CD32C  E8          INX               ; X += 2 (advance word pointer)
$8CD32D  3A          DEC A             ; Decrement count
$8CD32E  D0 EF       BNE $8CD31F       ; Loop until all arguments evaluated
$8CD330  60          RTS
```

### Part 2: Expression Evaluator Engine (`$8C:EA43`)
```assembly
; ==============================================================================
; script_vm_eval_expression ($8C:EA43)
; Evaluates bytecode expression, stores 32-bit result in DP $02/$04, returns 16-bit in A.
; ==============================================================================
$8CEA43  E2 30       SEP #$30          ; 8-bit A and Index registers
$8CEA45  64 8A       STZ $8A           ; $8A = 0 (reset terminal flag)
$8CEA47  80 06       BRA $8CEA4F       ; Jump directly into sub-op fetch

; Loop Re-Entry Point (Called after non-terminal sub-op):
$8CEA49  E2 30       SEP #$30          ; 8-bit A and Index
$8CEA4B  A5 8A       LDA $8A           ; Check terminal flag
$8CEA4D  D0 11       BNE $8CEA60       ; If terminal bit was set, finish!

; Fetch & Dispatch Sub-Op:
$8CEA4F  A7 82       LDA [$82]         ; Read sub-op byte from script pointer
$8CEA51  E6 82       INC $82           ; Advance pointer low word
$8CEA53  D0 02       BNE $8CEA57
$8CEA55  E6 83       INC $83           ; Handle 64 KB page crossing
$8CEA57  0A          ASL A             ; Shift bit 7 into Carry (Bit 0..6 shifted left)
$8CEA58  26 8A       ROL $8A           ; Rotate Carry into DP $8A bit 0
$8CEA5A  AA          TAX               ; X = (sub_op & 0x7F) * 2
$8CEA5B  C2 30       REP #$30          ; 16-bit A and Index
$8CEA5D  7C 41 F0    JMP ($F041,X)     ; Indirect jump into sub-op table!

; Expression Complete:
$8CEA60  C2 30       REP #$30          ; 16-bit A and Index
$8CEA62  A5 02       LDA $02           ; Load low word of result into A
$8CEA64  6B          RTL               ; Return to caller
```

### Part 3: Representative Sub-Op Handlers
```assembly
; Sub-Op 0 ($8C:EA62): End / Return current accumulator
$8CEA62  A5 02       LDA $02
$8CEA64  6B          RTL

; Sub-Op 2 ($8C:EA9D): Unsigned 8-bit Immediate Constant
$8CEA9D  A7 82       LDA [$82]         ; Read constant byte
$8CEA9F  E6 82       INC $82
$8CEAA1  29 FF 00    AND #$00FF
$8CEAA4  85 02       STA $02           ; Store in accumulator low word
$8CEAA6  64 04       STZ $04           ; Clear accumulator high word
$8CEAA8  4C 49 EA    JMP $EA49         ; Loop to check termination or fetch next

; Sub-Op 4 ($8C:EABB): Unsigned 16-bit Immediate Constant
$8CEABB  A7 82       LDA [$82]         ; Read 16-bit word
$8CEABD  E6 82       INC $82
$8CEABF  E6 82       INC $82
$8CEAC1  85 02       STA $02           ; Accumulator low word = immediate
$8CEAC3  64 04       STZ $04           ; Accumulator high word = 0
$8CEAC5  4C 49 EA    JMP $EA49
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint32_t stack[16];
    uint8_t  sp;
} EvalStack;

extern const uint8_t g_rom[0x400000];
extern uint16_t g_script_args[16]; // $7E:0E80

// Sub-Op Function Handlers
static void subop_push(EvalStack *stack, uint32_t val) {
    if (stack->sp < 16) {
        stack->stack[stack->sp++] = val;
    }
}

static uint32_t subop_pop(EvalStack *stack) {
    return (stack->sp > 0) ? stack->stack[--stack->sp] : 0;
}

/**
 * Evaluates a single dynamic expression from bytecode.
 * Corresponds to $8C:EA43.
 */
uint32_t script_vm_eval_expression(uint32_t *pc) {
    EvalStack stack = { .sp = 0 };
    uint32_t acc = 0;
    bool is_last = false;

    while (!is_last) {
        uint8_t raw_byte = g_rom[(*pc)++];
        is_last = (raw_byte & 0x80) != 0;
        uint8_t subop = raw_byte & 0x7F;

        switch (subop) {
            case 0x00: // End / Return
                return acc;

            case 0x01: { // Signed byte constant
                int8_t b = (int8_t)g_rom[(*pc)++];
                acc = (uint32_t)(int32_t)b;
                break;
            }

            case 0x02: { // Unsigned byte constant
                uint8_t b = g_rom[(*pc)++];
                acc = (uint32_t)b;
                break;
            }

            case 0x03: { // Signed word constant
                int16_t w = (int16_t)(g_rom[*pc] | (g_rom[*pc + 1] << 8));
                *pc += 2;
                acc = (uint32_t)(int32_t)w;
                break;
            }

            case 0x04: { // Unsigned word constant
                uint16_t w = (uint16_t)(g_rom[*pc] | (g_rom[*pc + 1] << 8));
                *pc += 2;
                acc = (uint32_t)w;
                break;
            }

            case 0x1A: { // Addition (+)
                uint32_t left = subop_pop(&stack);
                acc = left + acc;
                break;
            }

            case 0x1B: { // Subtraction (-)
                uint32_t left = subop_pop(&stack);
                acc = left - acc;
                break;
            }

            case 0x17: { // Multiplication (*)
                uint32_t left = subop_pop(&stack);
                acc = left * acc;
                break;
            }

            case 0x18: { // Division (/)
                uint32_t left = subop_pop(&stack);
                acc = (acc != 0) ? (left / acc) : 0;
                break;
            }

            case 0x22: { // Equality (==)
                uint32_t left = subop_pop(&stack);
                acc = (left == acc) ? 1 : 0;
                break;
            }

            case 0x23: { // Inequality (!=)
                uint32_t left = subop_pop(&stack);
                acc = (left != acc) ? 1 : 0;
                break;
            }

            case 0x29: // Push accumulator to stack
                subop_push(&stack, acc);
                break;

            default:
                // Handle remaining memory, flag, and entity sub-ops
                break;
        }
    }

    return acc;
}

/**
 * Reads a counted list of expressions and stores them in $0E80.
 * Corresponds to $8C:D315.
 */
void script_vm_read_args(uint32_t *pc) {
    uint8_t count = g_rom[(*pc)++]; // Argument count n
    for (uint8_t i = 0; i < count; i++) {
        uint32_t val = script_vm_eval_expression(pc);
        g_script_args[i] = (uint16_t)(val & 0xFFFF);
    }
}
```

