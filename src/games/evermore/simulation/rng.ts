// Ownership: the game's random number generator, $80:859B. Pure.
//
// Four words at $0133/$0135/$0137/$0139 stirred into each other with
// rotate-and-add-with-carry; the result is the new $0133. Each `rol` takes
// the carry the previous instruction left, and the entry carry is the
// caller's: from the script operand handlers ($8C:EC56 for 0x2a, $8C:EC96 for
// 0x2b) it is always 0 — the evaluator's `rol $8A` leaves bit 7 of $8A, which
// only ever holds 0 or 1. Checked against the running game by
// tests/simulation/scheduler.test.js.

export const RNG_STATE = 0x0133;

/** One draw: the next state (words at $0133, $0135, $0137, $0139) and the value returned. */
export function rngNext(w: readonly number[], carryIn = 0): { state: number[]; value: number } {
    let [a, b, cc, d] = w; // $0133, $0135, $0137, $0139
    let carry = carryIn;
    const rol = (v: number): number => { const r = ((v << 1) | carry) & 0xffff; carry = (v >> 15) & 1; return r; };
    const adc = (x: number, y: number): number => { const r = x + y + carry; carry = r > 0xffff ? 1 : 0; return r & 0xffff; };
    let acc = rol(d);
    if (carry) cc = (cc + 1) & 0xffff;      // `inc` keeps the carry
    d = acc = adc(acc, b);
    acc = rol(cc);
    if (carry) b = (b + 1) & 0xffff;
    cc = acc = adc(acc, a);
    acc = rol(b);
    if (carry) a = (a + 1) & 0xffff;
    b = acc = adc(acc, cc);
    acc = rol(a);
    if (carry) d = (d + 1) & 0xffff;
    a = acc = adc(acc, d);
    return { state: [a, b, cc, d], value: a };
}

/** `randrange` (operator 0x2b): the high word of rng × n, i.e. a value in [0, n). */
export function rngBelow(value: number, n: number): number {
    return Math.floor((value * (n & 0xffff)) / 0x10000) & 0xffff;
}
