# COP and BRK Trap Entries

- **COP entry:** `$80:885E`, one `STP` instruction.
- **BRK entry:** `$80:885F`, one `STP` instruction.
- **Source:** [COP disassembly](soe://bus/80885e.asm?rom=vanilla), [BRK disassembly](soe://bus/80885f.asm?rom=vanilla).
- **C reconstruction:** [`80885E_interrupt_traps.c`](../../../reconstructed-c/80/80885E_interrupt_traps.c).

Both indexed entries stop the 65C816 rather than returning. The host model delegates to the existing non-returning `cpu_stop()` abstraction, matching the instruction semantics. This reconstruction covers the entry bytes only; it does not assert which hardware vector selects them.