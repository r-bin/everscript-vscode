/*
 * Routine: $8C:E8BC (invalid script opcode 0xB8)
 * Source: docs/disassembly/script-vm/opcode-b8-invalid-stop.md
 */

extern _Noreturn void cpu_stop(void); /* 65C816 STP */

_Noreturn void script_op_b8_invalid_stop(void) {
    cpu_stop();
}

_Noreturn void script_op_8b_invalid_stop(void) {
    cpu_stop();
}
