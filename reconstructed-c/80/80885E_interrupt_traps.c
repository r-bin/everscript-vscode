extern _Noreturn void cpu_stop(void); /* 65C816 STP */

_Noreturn void cop_handler(void) {
    cpu_stop();
}

_Noreturn void brk_handler(void) {
    cpu_stop();
}