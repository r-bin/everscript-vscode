// Build the combo POC: Evermore and Secret of Mana on one 8 MB SA-1 image, Start switches the game
// (docs/combo/poc.md). Both games come from the user's ROM library; nothing of either game is in the repo.
//   npm run combo -- [evermore rom] [mana rom] [out.sfc]      (default output: out/combo/combo.sfc)
// The steps:
//   1. Evermore's two views (tools/sa1/layout.mts): LoROM copy for its code in blocks 2-3, linear in blocks 4-7
//   2. Mana: linear in blocks 1 and 7, its upper halves of banks $00-$1F LoROM-arranged in block 0
//   3. bank $00: the combo header (SA-1, 8 MB, 256 KB BW-RAM) and vector table (vectors.ts below)
//   4. the SA-1 boot block from tools/sa1/boot.mts (its jump at $80:802D)
//   5. combo.asm assembled with Asar into $B8:9000+, with register tables decoded from Evermore's ROM
//   6. hooks into each game (every patch checks the original bytes first), checksum, MesenCE header check
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { MB, IMAGE_SIZE, LINEAR, loRomFile, writeViews } from '../sa1/layout.mts';
import { finishChecksum, assertMesenPicksBlockZero } from '../sa1/header.mts';
import { bootBlock, BOOT, COLD } from '../sa1/boot.mts';
import { JML } from '../sa1/asm.mts';

const require = createRequire(import.meta.url);
const { hardwareMirror } = require('../exhirom/convert.js');

export const REPO = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
/** Where combo.asm is assembled to: LoROM view of block 3, after the SA-1 boot block at $B8:8000. */
export const CODE = 0xB89000;
const ASM = join(REPO, 'tools', 'combo', 'combo.asm');
const HEADER = 0x7FB0, VECTORS = 0x7FE0;   // in block 0 (bank $00:FFB0 / $FFE0)
const MANA_BLOCKS = [1, 7];                 // Mana file 0x000000 → block 1, 0x100000 → block 7 (docs/combo/README.md §3)

const strip = (b: Uint8Array) => (b.length % 1024 === 512 ? b.subarray(512) : b);
const hex = (v: number, n = 2) => v.toString(16).toUpperCase().padStart(n, '0');
/** HiROM file offset of a bus address ($00-$3F/$80-$BF:8000+ or $C0+). */
const hiromFile = (bus: number) => ((bus >> 16) & 0x3F) * 0x10000 + (bus & 0xFFFF);

function expect(rom: Uint8Array, bus: number, bytes: number[], what: string): void {
    const at = hiromFile(bus), got = [...rom.subarray(at, at + bytes.length)];
    if (got.some((b, i) => b !== bytes[i])) {
        throw new Error(`${what}: $${hex(bus >> 16)}:${hex(bus & 0xFFFF, 4)} holds ${got.map(b => hex(b)).join(' ')}, expected ${bytes.map(b => hex(b)).join(' ')} (not the US ROM?)`);
    }
}

/**
 * The PPU register writes a stretch of Evermore's code makes with constants, in order, as (register low byte,
 * value) pairs: what the switch writes again when Evermore resumes. Stops at RTL, or at an instruction it doesn't
 * know. Data ports and address registers (OAM, VRAM, CGRAM) and $2100 (the NMI writes it) are left out.
 */
export function constantRegisterWrites(rom: Uint8Array, from: number, to: number, m16: boolean): [number, number][] {
    const skip = new Set([0x00, 0x02, 0x03, 0x04, 0x15, 0x16, 0x17, 0x18, 0x19, 0x21, 0x22]);
    const out: [number, number][] = [];
    let a = 0, x16 = true;
    const put = (reg: number, v: number) => {
        if (reg >= 0x2100 && reg <= 0x2133 && !skip.has(reg & 0xFF)) out.push([reg & 0xFF, v & 0xFF]);
    };
    for (let pc = from; pc < to;) {
        const o = hiromFile(pc), op = rom[o], w = rom[o + 1] | (rom[o + 2] << 8);
        if (op === 0x6B) break;
        let len: number;
        switch (op) {
            case 0xA9: a = m16 ? w : rom[o + 1]; len = m16 ? 3 : 2; break;                   // LDA #
            case 0x8D: case 0x9C: {                                                          // STA / STZ abs
                const v = op === 0x9C ? 0 : a;
                put(w, v); if (m16) put(w + 1, v >> 8);
                len = 3; break;
            }
            case 0x8F: { const v = a; put(w, v); if (m16) put(w + 1, v >> 8); len = 4; break; } // STA long (bank $00)
            case 0xE2: if (rom[o + 1] & 0x20) m16 = false; if (rom[o + 1] & 0x10) x16 = false; len = 2; break;
            case 0xC2: if (rom[o + 1] & 0x20) m16 = true; if (rom[o + 1] & 0x10) x16 = true; len = 2; break;
            case 0xA2: len = x16 ? 3 : 2; break;                                             // LDX #
            case 0x60: return out;                                                           // RTS
            case 0x9A: case 0x5B: case 0x4B: case 0xAB: case 0x48: case 0x8B: len = 1; break; // TXS TCD PHK PLB PHA PHB
            case 0xF4: len = 3; break;                                                       // PEA
            default: return out;
        }
        pc += len;
    }
    return out;
}

/** The register tables combo.asm reads (tables.asm, generated per build from the user's ROM). */
function tablesAsm(ev: Uint8Array, mana: Uint8Array): string {
    // Mana's title writes as (register, low, high): a second write to the same register is its high byte
    const shadow = (name: string, pairs: [number, number][]) => {
        const rows: number[][] = [];
        for (const [r, v] of pairs) {
            const last = rows[rows.length - 1];
            if (last && last[0] === r) last[2] = v; else rows.push([r, v, v]);
        }
        return `${name}:\n` + rows.map(t => `    db ${t.map(b => '$' + hex(b)).join(',')}`).join('\n') + '\n    db $00\n';
    };
    const list = (name: string, pairs: [number, number][]) =>
        `${name}:\n` + pairs.map(([r, v]) => `    db $${hex(r)},$${hex(v)}`).join('\n') + '\n    db $00\n';
    const boot = constantRegisterWrites(ev, COLD, 0x80810A, true);     // the reset's register set-up
    const scene1 = constantRegisterWrites(ev, 0x80B3B0, 0x80B410, true);
    const scene2 = constantRegisterWrites(ev, 0x8EE08B, 0x8EE120, true);
    const title = constantRegisterWrites(mana, 0xC027E5, 0xC0281E, false);   // Mana's title screen
    if (boot.length < 30 || scene1.length < 10 || scene2.length < 10 || title.length < 10) throw new Error('register set-up not where expected');
    return ['; generated by tools/combo/convert.mts from the user\'s ROMs; not committed',
        list('ev_boot_regs', boot), list('ev_scene1_regs', scene1), list('ev_scene2_regs', scene2), shadow('ma_title_shadow', title)].join('\n');
}

/** Assembles combo.asm at CODE; returns the bytes and the labels. */
function assemble(ev: Uint8Array, mana: Uint8Array, work: string): { code: Uint8Array; labels: Record<string, number> } {
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, 'tables.asm'), tablesAsm(ev, mana));
    const wrapper = join(work, 'build.asm');
    writeFileSync(wrapper, `norom\norg 0\nbase $${hex(CODE, 6)}\nincsrc "${ASM}"\nincsrc "tables.asm"\n`);
    const bin = join(work, 'combo.bin'), sym = join(work, 'combo.sym');
    writeFileSync(bin, new Uint8Array(0));
    execFileSync(process.env.ASAR || 'asar', ['--no-title-check', '--symbols=wla', `--symbols-path=${sym}`, wrapper, bin], { stdio: 'pipe' });
    const labels: Record<string, number> = {};
    for (const line of readFileSync(sym, 'utf8').split('\n')) {
        const m = /^([0-9A-F]{2}):([0-9A-F]{4}) (\S+)$/i.exec(line.trim());
        if (m) labels[m[3]] = parseInt(m[1] + m[2], 16);
    }
    return { code: new Uint8Array(readFileSync(bin)), labels };
}

export interface Report { checksum: number; codeBytes: number; labels: Record<string, number>; scores: Record<string, number> }

export function convert(evSource: Uint8Array, manaSource: Uint8Array, work: string): { image: Uint8Array; report: Report } {
    const ev = strip(evSource), mana = strip(manaSource);
    if (ev.length !== 3 * MB || (ev[0xFFD5] & ~0x10) !== 0x21) throw new Error('expected the 3 MB HiROM Secret of Evermore ROM');
    if (mana.length !== 2 * MB || mana[0xFFD5] !== 0x21) throw new Error('expected the 2 MB HiROM Secret of Mana ROM');
    // The game facts the code and the hooks rely on (docs/combo/poc.md): fail on any other ROM.
    expect(ev, 0x808020, [0xA9, 0x8F, 0x8D, 0x00, 0x21, 0x18, 0xFB], 'Evermore reset entry');
    expect(ev, 0x80848F, [0xAD, 0x18, 0x42, 0x80, 0x0C], 'Evermore pad-1 read');
    expect(ev, 0x80B3B0, [0xE2, 0x20, 0xA9, 0x03], 'Evermore scene set-up 1');
    expect(ev, 0x8EE08B, [0xA9, 0x8F, 0x00, 0x8D, 0x00, 0x21], 'Evermore scene set-up 2');
    expect(ev, 0x8CE249, [0xAD, 0x80, 0x0F, 0x8F, 0x2C, 0x21, 0x00], 'Evermore screen shadows');
    expect(ev, 0x8C8000, [0x08, 0xC2, 0x10, 0xE2, 0x20, 0x78], 'Evermore sound init');
    expect(mana, 0x00FFEA, [0x00, 0x01], 'Mana NMI vector');
    expect(mana, 0x008004, [0x18, 0xFB, 0xE2, 0x30, 0x5C, 0x10, 0x00, 0xC1], 'Mana reset entry');
    expect(mana, 0xC30000, [0x4C, 0x2C, 0x00], 'Mana sound init');
    expect(mana, 0xC027E0, [0x8B, 0xA9, 0x00, 0x48, 0xAB], 'Mana title set-up');
    expect(mana, 0xCFFE34, [0xAD, 0x18, 0x42, 0x8D, 0x42, 0x00], 'Mana field pad read');
    expect(mana, 0x02B5E7, [0xE2, 0x30, 0xA9, 0x8F], 'Mana PPU reset');
    expect(mana, 0x01FD52, [0xE2, 0x30, 0xA9, 0x09], 'Mana BG set-up');
    expect(mana, 0x02AAB1, [0xE2, 0x30, 0xA5, 0x20], 'Mana screen set-up');

    const image = new Uint8Array(IMAGE_SIZE).fill(0xFF);
    // 1. Evermore; its 4th MB answers like the original cartridge (tools/sa1/convert.mts "hardware")
    writeViews(image, off => off < ev.length ? ev[off] : ev[hardwareMirror(off, ev.length)]);
    image.fill(0, LINEAR + 0xFFDC, LINEAR + 0xFFE0);    // the linear copy of Evermore's header must not win (header.mts)
    // 2. Mana
    image.set(mana.subarray(0, MB), MANA_BLOCKS[0] * MB);
    image.set(mana.subarray(MB, 2 * MB), MANA_BLOCKS[1] * MB);
    for (let bank = 0; bank < 0x20; bank++) image.set(mana.subarray(bank * 0x10000 + 0x8000, bank * 0x10000 + 0x10000), bank * 0x8000);
    // 3. header: Evermore's fields, made SA-1 / 8 MB / 256 KB BW-RAM, our own title
    const header = ev.slice(0xFFB0, 0xFFE0);
    header.set(new TextEncoder().encode('EVERMORE+MANA COMBO  '), 0x10);
    header[0x25] = 0x23; header[0x26] = 0x35; header[0x27] = 0x0D; header[0x28] = 0x08;
    header.set([0xFF, 0xFF, 0x00, 0x00], 0x2C);
    image.set(header, HEADER);
    // 4. SA-1 boot block (cold boot of Evermore) and its jump
    const boot = bootBlock(ev);
    image.set(boot.bytes, loRomFile(BOOT));
    image.set(JML(BOOT).bytes, loRomFile(COLD));
    // 5. combo code
    const { code, labels } = assemble(ev, mana, work);
    const need = ['combo_reset', 'evermore_reset_entry', 'evermore_pad', 'mana_pad', 'mana_nmi', 'ev_scene1_hook', 'ev_scene2_hook', 'ma_title_hook', 'ma_list_hook', 'mana_field_pad', 'ma_reset_hook', 'ma_bg_hook', 'ma_screen_hook'];
    for (const n of need) if (labels[n] === undefined) throw new Error(`combo.asm has no label ${n}`);
    if (loRomFile(CODE) + code.length > loRomFile(0xB8FFFF) + 1) throw new Error('combo code does not fit in bank $B8');
    image.set(code, loRomFile(CODE));
    const entry = ev.subarray(0x8020, 0x8020 + 13);   // Evermore's reset entry, ends JML $80:802D
    if (entry[9] !== 0x5C || entry[10] !== 0x2D || entry[11] !== 0x80 || entry[12] !== 0x80) throw new Error('Evermore reset entry does not end in JML $80:802D');
    image.set(entry, loRomFile(labels.evermore_reset_entry));
    // vector table: reset → the spare slot $FFE0 (JML combo_reset); NMI/IRQ → the I-RAM stubs; COP/BRK/ABORT → STP
    const vec = new Uint8Array(32);
    const w16 = (o: number, v: number) => { vec[o] = v & 0xFF; vec[o + 1] = v >> 8; };
    vec.set(JML(labels.combo_reset).bytes, 0x00);
    for (const o of [0x04, 0x06, 0x08, 0x14, 0x18]) w16(o, 0xFFEC);
    vec[0x0C] = 0xDB; vec[0x0D] = 0xDB;
    w16(0x0A, 0x3000); w16(0x0E, 0x3004); w16(0x1A, 0x3000); w16(0x1E, 0x3004); w16(0x1C, 0xFFE0);
    w16(0x10, 0xFFFF); w16(0x12, 0xFFFF); w16(0x16, 0xFFFF);
    image.set(vec, VECTORS);
    // 6. hooks into Evermore's LoROM code copy (Mana's is installed at run time by mana_nmi)
    image.set(JML(labels.evermore_pad).bytes, loRomFile(0x80848F));
    image.set(JML(labels.ev_scene1_hook).bytes, loRomFile(0x80B3B0));
    image.set(JML(labels.ev_scene2_hook).bytes, loRomFile(0x8EE08B));
    // hook into Mana's ROM (its $C0 view is block 1); its WRAM hooks are installed at run time by mana_nmi
    image.set([...JML(labels.ma_title_hook).bytes, 0xEA], MANA_BLOCKS[0] * MB + 0x27E0);
    image.set([0x22, ...JML(labels.mana_field_pad).bytes.slice(1), 0xEA, 0xEA], MANA_BLOCKS[0] * MB + 0xFFE34);
    // field display set-ups run from banks $01-$02:8000+, the LoROM-arranged copy in block 0
    image.set(JML(labels.ma_reset_hook).bytes, loRomFile(0x02B5E7));
    image.set(JML(labels.ma_bg_hook).bytes, loRomFile(0x01FD52));
    image.set(JML(labels.ma_screen_hook).bytes, loRomFile(0x02AAB1));
    const checksum = finishChecksum(image);
    const scores = assertMesenPicksBlockZero(image);
    return { image, report: { checksum, codeBytes: code.length, labels, scores } };
}

function main(): void {
    const args = process.argv.slice(2);
    const rom = require('../rom');
    const evPath: string = rom.baseRomOrExit('evermore', args[0]);
    const manaPath: string = rom.romOrExit('mana', args[1]);
    const out = args[2] || join(REPO, 'out', 'combo', 'combo.sfc');
    const { image, report } = convert(new Uint8Array(readFileSync(evPath)), new Uint8Array(readFileSync(manaPath)), join(dirname(resolve(out)), 'build'));
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, image);
    console.log(`wrote ${out}: 8 MB SA-1, checksum $${hex(report.checksum, 4)}, combo code ${report.codeBytes} bytes at $B8:9000`);
    for (const n of ['combo_reset', 'combo_switch', 'evermore_pad', 'mana_pad', 'mana_nmi']) console.log(`  ${n.padEnd(14)} $${hex(report.labels[n] >> 16)}:${hex(report.labels[n] & 0xFFFF, 4)}`);
    console.log(`  MesenCE header scores: ${Object.entries(report.scores).map(([k, s]) => `0x${k}=${s}`).join(' ')}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
