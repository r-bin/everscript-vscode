// Ownership: a minimal SNES bus for running game routines on cpu65816.ts.
//
// Generic SNES hardware: HiROM cartridge mapping, 128 KB WRAM (bank $7E/$7F,
// mirrored at $00-$3F/$80-$BF:0000-1FFF), VRAM through $2115-$2119/$2139-$213A,
// CGRAM through $2121/$2122/$213B, the multiply/divide unit ($4202-$4206,
// $4214-$4217) and general DMA ($420B, $43x0-$43x6) in both directions.
// Everything else reads 0 and ignores writes.

import { Bus } from './cpu65816';
import { hiromFileOffset } from '../../../platform/snes/hirom';

export class SnesBus implements Bus {
    readonly wram = new Uint8Array(0x20000);
    readonly vram = new Uint8Array(0x10000);
    readonly cgram = new Uint8Array(0x200);
    /** Characters (32-byte units of VRAM) written since the last `takeDirtyChars`. */
    private dirty = new Set<number>();
    private io = new Uint8Array(0x2000);       // $2100-$21FF and $4200-$43FF shadows, last written
    private vmaddr = 0;
    private vprefetch = 0;
    private cgaddr = 0;
    private cglatch = -1;
    private cgreadHigh = false;
    private mulA = 0xFF;
    private mulResult = 0;
    private divQuot = 0;

    constructor(private rom: Uint8Array) {}

    takeDirtyChars(): number[] {
        const out = [...this.dirty];
        this.dirty.clear();
        return out;
    }

    private romRead(off: number): number { return this.rom[off % this.rom.length] ?? 0; }

    read(addr: number): number {
        const bank = addr >> 16, a = addr & 0xFFFF;
        if (bank === 0x7E || bank === 0x7F) return this.wram[addr & 0x1FFFF];
        if ((bank & 0x40) === 0) {                    // $00-$3F, $80-$BF
            if (a < 0x2000) return this.wram[a];
            if (a >= 0x8000) return this.romRead(((bank & 0x3F) << 16) | a);
            return this.readIo(a);
        }
        return this.romRead(hiromFileOffset(addr));           // $40-$7D, $C0-$FF: HiROM
    }

    write(addr: number, v: number): void {
        const bank = addr >> 16, a = addr & 0xFFFF;
        if (bank === 0x7E || bank === 0x7F) { this.wram[addr & 0x1FFFF] = v; return; }
        if ((bank & 0x40) === 0) {
            if (a < 0x2000) { this.wram[a] = v; return; }
            if (a < 0x8000) this.writeIo(a, v);
        }
    }

    private vmStep(): number {
        const s = this.io[0x15] & 3;
        return s === 0 ? 1 : s === 1 ? 32 : 128;
    }

    private readIo(a: number): number {
        switch (a) {
            case 0x2139: {
                const v = this.vprefetch & 0xFF;
                if (!(this.io[0x15] & 0x80)) this.vramReadAdvance();
                return v;
            }
            case 0x213A: {
                const v = this.vprefetch >> 8;
                if (this.io[0x15] & 0x80) this.vramReadAdvance();
                return v;
            }
            case 0x213B: {
                const v = this.cgram[(this.cgaddr * 2 + (this.cgreadHigh ? 1 : 0)) & 0x1FF];
                if (this.cgreadHigh) this.cgaddr = (this.cgaddr + 1) & 0xFF;
                this.cgreadHigh = !this.cgreadHigh;
                return v;
            }
            case 0x4214: return this.divQuot & 0xFF;
            case 0x4215: return this.divQuot >> 8;
            case 0x4216: return this.mulResult & 0xFF;
            case 0x4217: return this.mulResult >> 8;
        }
        if (a >= 0x4300 && a < 0x4380) return this.io[a - 0x4300 + 0x1300];
        return 0;
    }

    private vramReadAdvance(): void {
        const w = this.vmaddr & 0x7FFF;
        this.vprefetch = this.vram[w * 2] | (this.vram[w * 2 + 1] << 8);
        this.vmaddr = (this.vmaddr + this.vmStep()) & 0xFFFF;
    }

    private writeIo(a: number, v: number): void {
        if (a >= 0x2100 && a < 0x2200) this.io[a - 0x2100] = v;
        if (a >= 0x4300 && a < 0x4380) { this.io[a - 0x4300 + 0x1300] = v; return; }
        switch (a) {
            case 0x2116: case 0x2117: {
                this.vmaddr = this.io[0x16] | (this.io[0x17] << 8);
                const w = this.vmaddr & 0x7FFF;
                this.vprefetch = this.vram[w * 2] | (this.vram[w * 2 + 1] << 8);
                return;
            }
            case 0x2118: case 0x2119: {
                const w = this.vmaddr & 0x7FFF;
                this.vram[w * 2 + (a - 0x2118)] = v;
                this.dirty.add(w >> 4);
                const highInc = (this.io[0x15] & 0x80) !== 0;
                if ((a === 0x2119) === highInc) this.vmaddr = (this.vmaddr + this.vmStep()) & 0xFFFF;
                return;
            }
            case 0x2121: this.cgaddr = v; this.cglatch = -1; this.cgreadHigh = false; return;
            case 0x2122:
                if (this.cglatch < 0) { this.cglatch = v; return; }
                this.cgram[(this.cgaddr * 2) & 0x1FF] = this.cglatch;
                this.cgram[(this.cgaddr * 2 + 1) & 0x1FF] = v & 0x7F;
                this.cgaddr = (this.cgaddr + 1) & 0xFF;
                this.cglatch = -1;
                return;
            case 0x4202: this.mulA = v; return;
            case 0x4203: this.mulResult = this.mulA * v; return;
            case 0x4204: case 0x4205: this.io[a - 0x4200 + 0x1200] = v; return;
            case 0x4206: {
                const dividend = this.io[0x1204] | (this.io[0x1205] << 8);
                if (v === 0) { this.divQuot = 0xFFFF; this.mulResult = dividend; return; }
                this.divQuot = Math.floor(dividend / v); this.mulResult = dividend % v;
                return;
            }
            case 0x420B: for (let ch = 0; ch < 8; ch++) if (v & (1 << ch)) this.dma(ch); return;
        }
    }

    private dma(ch: number): void {
        const r = (i: number) => this.io[0x1300 + ch * 16 + i];
        const ctrl = r(0), bAddr = 0x2100 | r(1);
        let aAddr = r(2) | (r(3) << 8);
        const aBank = r(4);
        let size = r(5) | (r(6) << 8);
        if (size === 0) size = 0x10000;
        const toB = (ctrl & 0x80) === 0, fixed = (ctrl & 0x08) !== 0, step = (ctrl & 0x10) ? -1 : 1;
        const pattern = [[0], [0, 1], [0, 0], [0, 0, 1, 1], [0, 1, 2, 3], [0, 1, 0, 1], [0, 0], [0, 0, 1, 1]][ctrl & 7];
        for (let i = 0; i < size; i++) {
            const a = (aBank << 16) | aAddr, b = bAddr + pattern[i % pattern.length];
            if (toB) this.writeIo(b, this.read(a)); else this.write(a, this.readIo(b));
            if (!fixed) aAddr = (aAddr + step) & 0xFFFF;
        }
        this.io[0x1300 + ch * 16 + 5] = 0; this.io[0x1300 + ch * 16 + 6] = 0;
    }
}
