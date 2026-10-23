/*
 * Routine: $B1A000 (asm_to_c_port)
 * Bank: $B1 (ROM Offset: $31A000)
 * Source: docs/reverse-engineering/asm-to-c-port.md
 */

// lifted from $908F6A — room loader, entry state M=1 X=0
void f_908F6A(Cpu *c) {
    c->A = (c->A & 0xFF00) | ram8(0x0ADB);      // LDA $0ADB
    asl8(c); asl8(c);                           // ASL ; ASL
    c->X = c->A;                                // TAX (X=0 → copies all 16 bits, incl. B)
    c->A = rom16(0x9FFDE7 + c->X);              // LDA $9FFDE7,X
    ...
}
