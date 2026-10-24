# IRQ Dispatch

- **Entry trampoline:** `$80:84EA` jumps to `$80:84EE`.
- **Handler body:** `$80:84EE`.
- **Source:** [IRQ body disassembly](soe://bus/8084ee.asm?rom=vanilla), [trampoline disassembly](soe://bus/8084ea.asm?rom=vanilla).
- **C reconstruction:** [`8084EE_irq_dispatch.c`](../../../reconstructed-c/80/8084EE_irq_dispatch.c).

## Behavior

The body sets A/X width to 16 bits, saves DB, A, X, and Y, then switches A to 8-bit mode and reads `$4211` (`TIMEUP`) to acknowledge the IRQ. It pushes the current program bank and the fixed return address `$8501`, then performs `JML [$012B]` through the 24-bit WRAM vector at `$7E:012B`..`$7E:012D`.

The indirect target is expected to return with `RTL`, which resumes at `$80:8501`. That continuation first executes `ORA ($7A,x)`, then restores Y, X, A, and DB before `RTI`; the interrupt frame restores the interrupted program bank, PC, and processor status. The configured target written by `$80:8507` is `$80:858B`, whose body is `RTL`.

The C model represents the TIMEUP read and indirect long dispatch as callbacks. It preserves the saved CPU registers around the callback and does not assign application meaning to the hook target beyond its observed return contract. It abstracts the transient `ORA ($7A,x)` read: its A result is discarded by the following `PLA`, and its processor-status result is discarded by `RTI`; no additional game-state effect is established here.