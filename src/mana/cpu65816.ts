// Ownership: a 65816 CPU interpreter, enough to run self-contained game routines.
//
// Generic SNES knowledge only (WDC 65C816 instruction set, native mode). Used to run
// Secret of Mana's own animation routines (animate.ts) instead of re-deriving every
// effect by hand. No interrupts, no cycle timing, no emulation mode: a routine is
// entered with `call` (as by JSL) and runs until it returns to the sentinel.

export interface Bus {
    read(addr: number): number;
    write(addr: number, value: number): void;
}

const N = 0x80, V = 0x40, M = 0x20, X = 0x10, D = 0x08, I = 0x04, Z = 0x02, C = 0x01;
const SENTINEL = 0xFFFFFF;

export class Cpu65816 {
    a = 0; x = 0; y = 0; s = 0x1FFF; d = 0; db = 0; pb = 0; pc = 0; p = M | X | I;
    steps = 0;
    constructor(private bus: Bus) {}

    /** Run the routine at `addr` (24-bit) as if called by JSL; stop at its RTL (or RTS for `rts`). */
    call(addr: number, opts: { rts?: boolean; maxSteps?: number } = {}): void {
        if (opts.rts) {
            // JSR-style: push a 16-bit return address in the routine's bank; mark it.
            this.pb = addr >> 16;
            this.push16(0xFFFF - 1);
        } else {
            this.push8(0xFF); this.push16(0xFFFF - 1);
        }
        this.pc = addr & 0xFFFF;
        this.pb = (addr >> 16) & 0xFF;
        const limit = opts.maxSteps ?? 2_000_000;
        for (let n = 0; n < limit; n++) {
            if (((this.pb << 16) | this.pc) === SENTINEL || (opts.rts && this.pc === 0xFFFF)) return;
            this.step();
        }
        throw new Error(`65816: no return from ${addr.toString(16)} after ${limit} steps`);
    }

    // ── flags and registers ──────────────────────────────────────────────
    get m8(): boolean { return (this.p & M) !== 0; }
    get x8(): boolean { return (this.p & X) !== 0; }
    private setP(v: number): void {
        this.p = v & 0xFF;
        if (this.p & X) { this.x &= 0xFF; this.y &= 0xFF; }
    }
    private nz8(v: number): number { this.p = (this.p & ~(N | Z)) | (v & 0x80) | ((v & 0xFF) ? 0 : Z); return v & 0xFF; }
    private nz16(v: number): number { this.p = (this.p & ~(N | Z)) | ((v >> 8) & 0x80) | ((v & 0xFFFF) ? 0 : Z); return v & 0xFFFF; }
    private nzM(v: number): number { return this.m8 ? this.nz8(v) : this.nz16(v); }
    private nzX(v: number): number { return this.x8 ? this.nz8(v) : this.nz16(v); }
    private setA(v: number): void { this.a = this.m8 ? (this.a & 0xFF00) | (v & 0xFF) : v & 0xFFFF; }
    private getA(): number { return this.m8 ? this.a & 0xFF : this.a; }

    // ── memory ───────────────────────────────────────────────────────────
    private r8(a: number): number { return this.bus.read(a & 0xFFFFFF) & 0xFF; }
    private w8(a: number, v: number): void { this.bus.write(a & 0xFFFFFF, v & 0xFF); }
    private r16(a: number, wrap = false): number {
        const hi = wrap ? (a & 0xFF0000) | ((a + 1) & 0xFFFF) : a + 1;
        return this.r8(a) | (this.r8(hi) << 8);
    }
    private w16(a: number, v: number, wrap = false): void {
        const hi = wrap ? (a & 0xFF0000) | ((a + 1) & 0xFFFF) : a + 1;
        this.w8(a, v); this.w8(hi, v >> 8);
    }
    private rM(a: number): number { return this.m8 ? this.r8(a) : this.r16(a); }
    private wM(a: number, v: number): void { if (this.m8) this.w8(a, v); else this.w16(a, v); }
    private rX(a: number): number { return this.x8 ? this.r8(a) : this.r16(a); }
    private wX(a: number, v: number): void { if (this.x8) this.w8(a, v); else this.w16(a, v); }
    private fetch8(): number { const v = this.r8((this.pb << 16) | this.pc); this.pc = (this.pc + 1) & 0xFFFF; return v; }
    private fetch16(): number { const lo = this.fetch8(); return lo | (this.fetch8() << 8); }
    private fetch24(): number { const lo = this.fetch16(); return lo | (this.fetch8() << 16); }
    private push8(v: number): void { this.w8(this.s, v); this.s = (this.s - 1) & 0xFFFF; }
    private pull8(): number { this.s = (this.s + 1) & 0xFFFF; return this.r8(this.s); }
    private push16(v: number): void { this.push8(v >> 8); this.push8(v); }
    private pull16(): number { const lo = this.pull8(); return lo | (this.pull8() << 8); }

    // ── addressing modes: effective 24-bit addresses ─────────────────────
    private dp(off: number): number { return (this.d + off) & 0xFFFF; }
    private aDp(): number { return this.dp(this.fetch8()); }
    private aDpX(): number { return this.dp(this.fetch8() + this.x); }
    private aDpY(): number { return this.dp(this.fetch8() + this.y); }
    private aAbs(): number { return (this.db << 16) | this.fetch16(); }
    private aAbsX(): number { return ((this.db << 16) + this.fetch16() + this.x) & 0xFFFFFF; }
    private aAbsY(): number { return ((this.db << 16) + this.fetch16() + this.y) & 0xFFFFFF; }
    private aLong(): number { return this.fetch24(); }
    private aLongX(): number { return (this.fetch24() + this.x) & 0xFFFFFF; }
    private aInd(): number { return (this.db << 16) | this.r16(this.aDp(), true); }
    private aIndX(): number { return (this.db << 16) | this.r16(this.aDpX(), true); }
    private aIndY(): number { return ((this.db << 16) + this.r16(this.aDp(), true) + this.y) & 0xFFFFFF; }
    private aIndL(): number { const p = this.aDp(); return this.r8(p) | (this.r8((p + 1) & 0xFFFF) << 8) | (this.r8((p + 2) & 0xFFFF) << 16); }
    private aIndLY(): number { return (this.aIndL() + this.y) & 0xFFFFFF; }
    private aSr(): number { return (this.s + this.fetch8()) & 0xFFFF; }
    private aSrY(): number { return ((this.db << 16) + this.r16((this.s + this.fetch8()) & 0xFFFF, true) + this.y) & 0xFFFFFF; }
    private immM(): number { return this.m8 ? this.fetch8() : this.fetch16(); }
    private immX(): number { return this.x8 ? this.fetch8() : this.fetch16(); }

    // ── ALU ──────────────────────────────────────────────────────────────
    private adc(v: number): void {
        const c = this.p & C;
        if (this.p & D) { this.adcDecimal(v, c); return; }
        const a = this.getA(), bits = this.m8 ? 8 : 16, mask = (1 << bits) - 1, sign = 1 << (bits - 1);
        const r = a + v + c;
        this.p = (this.p & ~(C | V)) | (r > mask ? C : 0) | ((~(a ^ v) & (a ^ r) & sign) ? V : 0);
        this.setA(this.nzM(r & mask));
    }
    private adcDecimal(v: number, c: number): void {
        const digits = this.m8 ? 2 : 4;
        const a = this.getA();
        let r = 0, carry = c;
        for (let i = 0; i < digits; i++) {
            let d = ((a >> (4 * i)) & 15) + ((v >> (4 * i)) & 15) + carry;
            carry = d > 9 ? 1 : 0;
            if (carry) d -= 10;
            r |= (d & 15) << (4 * i);
        }
        this.p = (this.p & ~C) | (carry ? C : 0);
        this.setA(this.nzM(r));
    }
    private sbc(v: number): void {
        if (this.p & D) {
            const digits = this.m8 ? 2 : 4, a = this.getA();
            let r = 0, borrow = (this.p & C) ? 0 : 1;
            for (let i = 0; i < digits; i++) {
                let d = ((a >> (4 * i)) & 15) - ((v >> (4 * i)) & 15) - borrow;
                borrow = d < 0 ? 1 : 0;
                if (borrow) d += 10;
                r |= (d & 15) << (4 * i);
            }
            this.p = (this.p & ~C) | (borrow ? 0 : C);
            this.setA(this.nzM(r));
            return;
        }
        this.adc(v ^ (this.m8 ? 0xFF : 0xFFFF));
    }
    private cmp(r: number, v: number, eight: boolean): void {
        const mask = eight ? 0xFF : 0xFFFF;
        const t = (r - v) & mask;
        this.p = (this.p & ~C) | (r >= v ? C : 0);
        if (eight) this.nz8(t); else this.nz16(t);
    }
    private bit(v: number, imm: boolean): void {
        const a = this.getA();
        this.p = (this.p & ~Z) | ((a & v) ? 0 : Z);
        if (!imm) {
            const top = this.m8 ? v : v >> 8;
            this.p = (this.p & ~(N | V)) | (top & (N | V));
        }
    }
    /** Read-modify-write on memory or A: op gets (value, eight) and returns the new value. */
    private rmw(addr: number | null, op: (v: number, eight: boolean) => number): void {
        const eight = this.m8;
        if (addr === null) { this.setA(op(this.getA(), eight)); return; }
        this.wM(addr, op(this.rM(addr), eight));
    }
    private asl = (v: number, e: boolean) => { const t = e ? 0x80 : 0x8000; this.p = (this.p & ~C) | ((v & t) ? C : 0); return this.nzM((v << 1) & (e ? 0xFF : 0xFFFF)); };
    private lsr = (v: number, _e: boolean) => { this.p = (this.p & ~C) | (v & 1 ? C : 0); return this.nzM(v >> 1); };
    private rol = (v: number, e: boolean) => { const t = e ? 0x80 : 0x8000; const c = this.p & C; this.p = (this.p & ~C) | ((v & t) ? C : 0); return this.nzM(((v << 1) | c) & (e ? 0xFF : 0xFFFF)); };
    private ror = (v: number, e: boolean) => { const c = this.p & C; this.p = (this.p & ~C) | (v & 1 ? C : 0); return this.nzM((v >> 1) | (c ? (e ? 0x80 : 0x8000) : 0)); };
    private inc = (v: number, e: boolean) => this.nzM((v + 1) & (e ? 0xFF : 0xFFFF));
    private dec = (v: number, e: boolean) => this.nzM((v - 1) & (e ? 0xFF : 0xFFFF));
    private tsb = (v: number, _e: boolean) => { this.p = (this.p & ~Z) | ((v & this.getA()) ? 0 : Z); return v | this.getA(); };
    private trb = (v: number, _e: boolean) => { this.p = (this.p & ~Z) | ((v & this.getA()) ? 0 : Z); return v & ~this.getA(); };

    private branch(cond: boolean): void {
        const off = this.fetch8();
        if (cond) this.pc = (this.pc + ((off << 24) >> 24)) & 0xFFFF;
    }
    private blockMove(step: number): void {
        const dst = this.fetch8(), src = this.fetch8();
        this.db = dst;
        this.w8((dst << 16) | this.y, this.r8((src << 16) | this.x));
        const xm = this.x8 ? 0xFF : 0xFFFF;
        this.x = (this.x + step) & xm; this.y = (this.y + step) & xm;
        this.a = (this.a - 1) & 0xFFFF;
        if (this.a !== 0xFFFF) this.pc = (this.pc - 3) & 0xFFFF;
    }

    step(): void {
        this.steps++;
        const op = this.fetch8();
        const hi = (op >> 5) & 7, mode = op & 0x1F;
        // The regular ALU group: ORA AND EOR ADC STA LDA CMP SBC by addressing mode.
        if (op !== 0x89 && ((op & 0x03) === 0x01 || (op & 0x1F) === 0x03 || (op & 0x1F) === 0x07
            || (op & 0x1F) === 0x0F || (op & 0x1F) === 0x12 || (op & 0x1F) === 0x13
            || (op & 0x1F) === 0x17 || (op & 0x1F) === 0x1F)) {
            this.alu(hi, this.aluAddr(mode, hi === 4));
            return;
        }
        this.other(op);
    }

    /** Address for the ALU group (null = immediate value fetched by alu). */
    private aluAddr(mode: number, isStore: boolean): number | null {
        switch (mode) {
            case 0x01: return this.aIndX();
            case 0x03: return this.aSr();
            case 0x05: return this.aDp();
            case 0x07: return this.aIndL();
            case 0x09: if (isStore) throw new Error('65816: STA immediate'); return null;
            case 0x0D: return this.aAbs();
            case 0x0F: return this.aLong();
            case 0x11: return this.aIndY();
            case 0x12: return this.aInd();
            case 0x13: return this.aSrY();
            case 0x15: return this.aDpX();
            case 0x17: return this.aIndLY();
            case 0x19: return this.aAbsY();
            case 0x1D: return this.aAbsX();
            case 0x1F: return this.aLongX();
        }
        throw new Error('65816: bad ALU mode ' + mode);
    }

    private alu(kind: number, addr: number | null): void {
        if (kind === 4) { this.wM(addr as number, this.getA()); return; }
        const v = addr === null ? this.immM() : this.rM(addr);
        switch (kind) {
            case 0: this.setA(this.nzM(this.getA() | v)); break;
            case 1: this.setA(this.nzM(this.getA() & v)); break;
            case 2: this.setA(this.nzM(this.getA() ^ v)); break;
            case 3: this.adc(v); break;
            case 5: this.setA(this.nzM(v)); break;
            case 6: this.cmp(this.getA(), v, this.m8); break;
            case 7: this.sbc(v); break;
        }
    }

    private other(op: number): void {
        const xm = () => (this.x8 ? 0xFF : 0xFFFF);
        switch (op) {
            // ── branches and jumps
            case 0x10: return this.branch(!(this.p & N));
            case 0x30: return this.branch(!!(this.p & N));
            case 0x50: return this.branch(!(this.p & V));
            case 0x70: return this.branch(!!(this.p & V));
            case 0x90: return this.branch(!(this.p & C));
            case 0xB0: return this.branch(!!(this.p & C));
            case 0xD0: return this.branch(!(this.p & Z));
            case 0xF0: return this.branch(!!(this.p & Z));
            case 0x80: return this.branch(true);
            case 0x82: { const o = this.fetch16(); this.pc = (this.pc + ((o << 16) >> 16)) & 0xFFFF; return; }
            case 0x4C: this.pc = this.fetch16(); return;
            case 0x5C: { const t = this.fetch24(); this.pc = t & 0xFFFF; this.pb = t >> 16; return; }
            case 0x6C: { const p = this.fetch16(); this.pc = this.r16(p, true); return; }
            case 0x7C: { const p = this.fetch16(); this.pc = this.r16((this.pb << 16) | ((p + this.x) & 0xFFFF), true); return; }
            case 0xDC: { const p = this.fetch16(); this.pc = this.r16(p, true); this.pb = this.r8((p + 2) & 0xFFFF); return; }
            case 0x20: { const t = this.fetch16(); this.push16((this.pc - 1) & 0xFFFF); this.pc = t; return; }
            case 0xFC: { const p = this.fetch16(); this.push16((this.pc - 1) & 0xFFFF); this.pc = this.r16((this.pb << 16) | ((p + this.x) & 0xFFFF), true); return; }
            case 0x22: { const t = this.fetch24(); this.push8(this.pb); this.push16((this.pc - 1) & 0xFFFF); this.pc = t & 0xFFFF; this.pb = t >> 16; return; }
            case 0x60: this.pc = (this.pull16() + 1) & 0xFFFF; return;
            case 0x6B: this.pc = (this.pull16() + 1) & 0xFFFF; this.pb = this.pull8(); return;
            case 0x40: this.setP(this.pull8()); this.pc = this.pull16(); this.pb = this.pull8(); return;
            // ── stores / loads of X, Y, zero
            case 0x84: return this.wX(this.aDp(), this.y);
            case 0x94: return this.wX(this.aDpX(), this.y);
            case 0x8C: return this.wX(this.aAbs(), this.y);
            case 0x86: return this.wX(this.aDp(), this.x);
            case 0x96: return this.wX(this.aDpY(), this.x);
            case 0x8E: return this.wX(this.aAbs(), this.x);
            case 0x64: return this.wM(this.aDp(), 0);
            case 0x74: return this.wM(this.aDpX(), 0);
            case 0x9C: return this.wM(this.aAbs(), 0);
            case 0x9E: return this.wM(this.aAbsX(), 0);
            case 0xA0: this.y = this.nzX(this.immX()); return;
            case 0xA4: this.y = this.nzX(this.rX(this.aDp())); return;
            case 0xB4: this.y = this.nzX(this.rX(this.aDpX())); return;
            case 0xAC: this.y = this.nzX(this.rX(this.aAbs())); return;
            case 0xBC: this.y = this.nzX(this.rX(this.aAbsX())); return;
            case 0xA2: this.x = this.nzX(this.immX()); return;
            case 0xA6: this.x = this.nzX(this.rX(this.aDp())); return;
            case 0xB6: this.x = this.nzX(this.rX(this.aDpY())); return;
            case 0xAE: this.x = this.nzX(this.rX(this.aAbs())); return;
            case 0xBE: this.x = this.nzX(this.rX(this.aAbsY())); return;
            case 0xE0: return this.cmp(this.x, this.immX(), this.x8);
            case 0xE4: return this.cmp(this.x, this.rX(this.aDp()), this.x8);
            case 0xEC: return this.cmp(this.x, this.rX(this.aAbs()), this.x8);
            case 0xC0: return this.cmp(this.y, this.immX(), this.x8);
            case 0xC4: return this.cmp(this.y, this.rX(this.aDp()), this.x8);
            case 0xCC: return this.cmp(this.y, this.rX(this.aAbs()), this.x8);
            case 0x89: return this.bit(this.immM(), true);
            case 0x24: return this.bit(this.rM(this.aDp()), false);
            case 0x34: return this.bit(this.rM(this.aDpX()), false);
            case 0x2C: return this.bit(this.rM(this.aAbs()), false);
            case 0x3C: return this.bit(this.rM(this.aAbsX()), false);
            // ── read-modify-write
            case 0x0A: return this.rmw(null, this.asl);
            case 0x06: return this.rmw(this.aDp(), this.asl);
            case 0x16: return this.rmw(this.aDpX(), this.asl);
            case 0x0E: return this.rmw(this.aAbs(), this.asl);
            case 0x1E: return this.rmw(this.aAbsX(), this.asl);
            case 0x4A: return this.rmw(null, this.lsr);
            case 0x46: return this.rmw(this.aDp(), this.lsr);
            case 0x56: return this.rmw(this.aDpX(), this.lsr);
            case 0x4E: return this.rmw(this.aAbs(), this.lsr);
            case 0x5E: return this.rmw(this.aAbsX(), this.lsr);
            case 0x2A: return this.rmw(null, this.rol);
            case 0x26: return this.rmw(this.aDp(), this.rol);
            case 0x36: return this.rmw(this.aDpX(), this.rol);
            case 0x2E: return this.rmw(this.aAbs(), this.rol);
            case 0x3E: return this.rmw(this.aAbsX(), this.rol);
            case 0x6A: return this.rmw(null, this.ror);
            case 0x66: return this.rmw(this.aDp(), this.ror);
            case 0x76: return this.rmw(this.aDpX(), this.ror);
            case 0x6E: return this.rmw(this.aAbs(), this.ror);
            case 0x7E: return this.rmw(this.aAbsX(), this.ror);
            case 0x1A: return this.rmw(null, this.inc);
            case 0xE6: return this.rmw(this.aDp(), this.inc);
            case 0xF6: return this.rmw(this.aDpX(), this.inc);
            case 0xEE: return this.rmw(this.aAbs(), this.inc);
            case 0xFE: return this.rmw(this.aAbsX(), this.inc);
            case 0x3A: return this.rmw(null, this.dec);
            case 0xC6: return this.rmw(this.aDp(), this.dec);
            case 0xD6: return this.rmw(this.aDpX(), this.dec);
            case 0xCE: return this.rmw(this.aAbs(), this.dec);
            case 0xDE: return this.rmw(this.aAbsX(), this.dec);
            case 0x04: return this.rmw(this.aDp(), this.tsb);
            case 0x0C: return this.rmw(this.aAbs(), this.tsb);
            case 0x14: return this.rmw(this.aDp(), this.trb);
            case 0x1C: return this.rmw(this.aAbs(), this.trb);
            // ── register increments and transfers
            case 0xE8: this.x = this.nzX((this.x + 1) & xm()); return;
            case 0xC8: this.y = this.nzX((this.y + 1) & xm()); return;
            case 0xCA: this.x = this.nzX((this.x - 1) & xm()); return;
            case 0x88: this.y = this.nzX((this.y - 1) & xm()); return;
            case 0xAA: this.x = this.nzX(this.x8 ? this.a & 0xFF : this.a); return;
            case 0xA8: this.y = this.nzX(this.x8 ? this.a & 0xFF : this.a); return;
            case 0x8A: this.setA(this.nzM(this.x)); return;
            case 0x98: this.setA(this.nzM(this.y)); return;
            case 0x9B: this.y = this.nzX(this.x); return;
            case 0xBB: this.x = this.nzX(this.y); return;
            case 0xBA: this.x = this.nzX(this.x8 ? this.s & 0xFF : this.s); return;
            case 0x9A: this.s = this.x; return;
            case 0x5B: this.d = this.nz16(this.a); return;
            case 0x7B: this.a = this.nz16(this.d); return;
            case 0x1B: this.s = this.a; return;
            case 0x3B: this.a = this.nz16(this.s); return;
            case 0xEB: { this.a = ((this.a >> 8) | (this.a << 8)) & 0xFFFF; this.nz8(this.a); return; }
            // ── stack
            case 0x48: if (this.m8) this.push8(this.a); else this.push16(this.a); return;
            case 0x68: this.setA(this.nzM(this.m8 ? this.pull8() : this.pull16())); return;
            case 0xDA: if (this.x8) this.push8(this.x); else this.push16(this.x); return;
            case 0xFA: this.x = this.nzX(this.x8 ? this.pull8() : this.pull16()); return;
            case 0x5A: if (this.x8) this.push8(this.y); else this.push16(this.y); return;
            case 0x7A: this.y = this.nzX(this.x8 ? this.pull8() : this.pull16()); return;
            case 0x08: this.push8(this.p); return;
            case 0x28: this.setP(this.pull8()); return;
            case 0x8B: this.push8(this.db); return;
            case 0xAB: this.db = this.nz8(this.pull8()); return;
            case 0x0B: this.push16(this.d); return;
            case 0x2B: this.d = this.nz16(this.pull16()); return;
            case 0x4B: this.push8(this.pb); return;
            case 0xF4: this.push16(this.fetch16()); return;
            case 0xD4: this.push16(this.r16(this.aDp(), true)); return;
            case 0x62: { const o = this.fetch16(); this.push16((this.pc + ((o << 16) >> 16)) & 0xFFFF); return; }
            // ── flags
            case 0x18: this.p &= ~C; return;
            case 0x38: this.p |= C; return;
            case 0x58: this.p &= ~I; return;
            case 0x78: this.p |= I; return;
            case 0xB8: this.p &= ~V; return;
            case 0xD8: this.p &= ~D; return;
            case 0xF8: this.p |= D; return;
            case 0xC2: this.setP(this.p & ~this.fetch8()); return;
            case 0xE2: this.setP(this.p | this.fetch8()); return;
            case 0xFB: this.p |= M | X; this.x &= 0xFF; this.y &= 0xFF; return;   // XCE: stay native-sized
            // ── block moves, misc
            case 0x54: return this.blockMove(1);
            case 0x44: return this.blockMove(-1);
            case 0xEA: return;
            case 0x42: this.fetch8(); return;
            case 0xCB: case 0xDB: throw new Error('65816: WAI/STP');
            case 0x00: case 0x02: throw new Error(`65816: BRK/COP at ${((this.pb << 16) | this.pc).toString(16)}`);
        }
        throw new Error(`65816: opcode ${op.toString(16)} at ${((this.pb << 16) | ((this.pc - 1) & 0xFFFF)).toString(16)}`);
    }
}
