// Symbolic animation script bytecode codec ($C7–$C9, docs/entities/animation_script.md): discovers script
// boundaries, disassembles scripts into pointer-free lines (named metasprites, palettes, sounds, projectiles,
// formulas, WRAM, mode flags, labels, @target cross-jumps), and assembles/patches them back losslessly.
import { createRequire } from 'node:module';
import type { CountOf, NameAt, NameOf } from '../../codec.mts';
import type { Findings } from '../../findings.mts';
import { sha1 } from '../../tree.mts';
import { FORMULAS } from './menus.mts';
import { SOUND_COUNT, defaultSoundName } from './music.mts';
import { spritePaletteAddr, spritePaletteId, spritePaletteName } from './sprite-palettes.mts';
import { wramAddress, wramName } from './wram.mts';

const require = createRequire(import.meta.url);
const { disassembleAt, jumpTarget, MODE_BITS, opcode, segmentsAt, sprite24At, sprite2Operand, spriteOperand } = require('../../../../dist/games/evermore/maps/animation-opcodes');
const { romFileOffset } = require('../../../../dist/games/evermore/maps/rom');

const END = 0x80, LINKED_STUB = 0x0075;
const LABEL_LINE_RE = /^([a-z_][a-z0-9_]*):$/, LABEL_NAME_RE = /^[a-z_][a-z0-9_]*$/;
const ENTITY_VARS: [number, string][] = [[0x06, 'entity.sprite'], [0x09, 'entity.sprite2'], [0x7E, 'entity.scratch']];
const HUD_OPS: [number, string, number][] = [[0x60, 'hud_bar', 16], [0x61, 'hud_column', 4], [0x62, 'hud_gauge', 9], [0x63, 'hud_icon', 4], [0x64, 'hud_meter', 17]];
const PLAIN_OPS: [number, string][] = [[0x2D, 'loop'], [0x30, 'restart_here'], [0x43, 'wait_landed'], [0x44, 'sleep_hover'], [0x48, 'op_48'],
    [0x4E, 'op_4e'], [0x4F, 'op_4f'], [0x51, 'op_51'], [0x52, 'reset'], [0x53, 'end_check'], [0x55, 'op_55'], [0x58, 'segment_step'],
    [0x5B, 'mark_position'], [0x5C, 'op_5c'], [0x5D, 'effect_done']];
const PAL_OPS: [number, string][] = [[0x3D, 'upload_palette'], [0x3E, 'particle_burst'], [0x49, 'palette_slot6'], [0x4A, 'palette_alt'], [0x4B, 'palette']];
const VAR_OPS: [number, string, number][] = [[0x31, 'set8', 1], [0x32, 'set', 2], [0x33, 'set24', 3], [0x35, 'add8', 1], [0x36, 'add', 2]];

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const s8 = (v: number) => (v << 24) >> 24;
const s16 = (v: number) => (v << 16) >> 16;
const hex2 = (v: number) => v.toString(16).padStart(2, '0');
const hex4 = (v: number) => v.toString(16).padStart(4, '0');

export interface ScriptLineInfo { address: number; fileOffset: number; bytes: number[]; known: boolean; endFrame: boolean }
export interface DiscoveredScript { startBus: number; fileStart: number; fileEnd: number; lines: ScriptLineInfo[]; internalLabels: Set<number>; externalJumps: Map<number, number> }

export interface DisasmResolvers {
    metasprite(addr24: number): string;
    palette(addr16: number): string;
    sound(id: number): string;
    projectile(addr16: number): string;
    formula(id: number): string;
    extTarget(busAddr: number): string | null;
}

export interface AsmResolvers {
    metasprite(name: string): number | null; // returns initial/home 24-bit bus addr (or null if unknown)
    hasMetasprite(name: string): boolean;
    palette(name: string): number | null;    // returns base 16-bit addr in bank $90
    sound(name: string): number | null;
    projectile(name: string): number | null; // returns initial/home 16-bit addr in bank $90
    hasProjectile(name: string): boolean;
    formula(name: string): number | null;
    extTarget(ref: string): number | null;   // returns initial/home 16-bit offset
    hasExtTarget(ref: string): boolean;
}

export type ScriptPatch =
    | { kind: 'label'; offset: number; labelByteOffset: number }
    | { kind: 'ext_jump'; offset: number; target: string }
    | { kind: 'sprite_short'; offset: number; metasprite: string; endFrame: boolean }
    | { kind: 'sprite_24'; offset: number; metasprite: string }
    | { kind: 'projectile'; offset: number; projectile: string };

/** Walk reachable instructions for every unique script start without crossing boundaries or gaps. */
export function discoverAnimationScripts(rom: Uint8Array, scriptStarts: number[], nameAt?: NameAt): Map<number, DiscoveredScript> {
    const byFile = new Map<number, number>();
    for (const sc of scriptStarts) if (sc) byFile.set(romFileOffset(rom, sc), sc);
    const sorted = [...byFile.entries()].sort((a, b) => a[0] - b[0]);
    const startSet = new Set(byFile.keys());
    const nextFile = new Map<number, number>();
    sorted.forEach(([f], i) => {
        const nxt = sorted[i + 1]?.[0];
        nextFile.set(f, nxt !== undefined && (nxt >> 16) === (f >> 16) ? nxt : ((f & ~0xFFFF) + 0x10000));
    });

    const out = new Map<number, DiscoveredScript>();
    for (const [fileStart, startBus] of sorted) {
        const nxt = nextFile.get(fileStart)!, seen = new Map<number, ScriptLineInfo>();
        const rtKey = nameAt?.('animations.script', fileStart);
        const isInternal = (ft: number) => ft === fileStart || (ft > fileStart && ft < nxt && !startSet.has(ft));
        const internalLabels = new Set<number>(), externalJumps = new Map<number, number>(), work = [startBus];
        while (work.length) {
            let p = work.pop()!;
            while (true) {
                const fp = romFileOffset(rom, p);
                if (seen.has(fp) || (fp !== fileStart && startSet.has(fp))) break;
                const l = disassembleAt(rom, p) as { address: number; bytes: number[]; endFrame: boolean; known: boolean };
                seen.set(fp, { address: p, fileOffset: fp, bytes: l.bytes, known: l.known, endFrame: l.endFrame });
                if (!l.known) break;
                const o = opcode(l.bytes[0]);
                if (!o || o.kind === 'loop') break;
                if (o.kind === 'jump') {
                    const tgt = jumpTarget(rom, p, o.kind) as number, ft = romFileOffset(rom, tgt);
                    if (isInternal(ft)) { internalLabels.add(ft); p = tgt; continue; }
                    externalJumps.set(fp, tgt); break;
                }
                if (o.kind === 'dec_jnz' || o.kind === 'jump_pos') {
                    const tgt = jumpTarget(rom, p, o.kind) as number, ft = romFileOffset(rom, tgt);
                    if (isInternal(ft)) { internalLabels.add(ft); work.push(tgt); }
                    else externalJumps.set(fp, tgt);
                }
                const afterBus = p + l.bytes.length, afterFile = fp + l.bytes.length;
                if (rtKey !== undefined && nameAt?.('animations.script_end', afterFile) === rtKey) break;
                if (o.kind === 'effect_done' && startSet.has(afterFile)) break;
                if (o.mnemonic === 'end_check' && l.endFrame && (startSet.has(afterFile) || !opcode(rom[afterFile]))) break;
                p = afterBus;
            }
        }
        const lines = [...seen.values()].sort((a, b) => a.fileOffset - b.fileOffset);
        const fileEnd = lines.length ? Math.max(...lines.map(l => l.fileOffset + l.bytes.length)) : fileStart;
        out.set(startBus, { startBus, fileStart, fileEnd, lines, internalLabels, externalJumps });
    }
    return out;
}

/** SHA-1 of raw script bytes with internal 16-bit label targets normalized to script-relative offsets. */
export function homeScriptSha1(raw: Uint8Array, info: DiscoveredScript): string {
    const copy = raw.slice();
    for (const l of info.lines) {
        if (!l.known) continue;
        const o = opcode(l.bytes[0]);
        if (!o) continue;
        if (o.kind === 'jump' || o.kind === 'dec_jnz' || o.kind === 'jump_pos' || o.kind === 'jump_if_linked') {
            if (o.kind === 'jump_if_linked' && u16(Uint8Array.from(l.bytes), 1) === LINKED_STUB) continue;
            if (info.externalJumps.has(l.fileOffset)) continue;
            const tgtRel = jumpTargetForBytes(l.address, l.bytes, o.kind) - info.startBus;
            const opOff = l.fileOffset - info.fileStart + (o.kind === 'jump' || o.kind === 'jump_if_linked' ? 1 : 2);
            copy[opOff] = tgtRel & 0xFF; copy[opOff + 1] = (tgtRel >> 8) & 0xFF;
        }
    }
    return sha1(copy);
}
function jumpTargetForBytes(addr: number, b: number[], kind: string): number {
    const i = kind === 'jump' || kind === 'jump_if_linked' ? 1 : 2;
    return ((addr & 0xFF0000) | b[i] | (b[i + 1] << 8)) >>> 0;
}

const varName = (b: number) => ENTITY_VARS.find(([k]) => k === b)?.[1] ?? `entity[0x${hex2(b)}]`;
const parseVar = (s: string): number | null => {
    const found = ENTITY_VARS.find(([, n]) => n === s);
    if (found) return found[0];
    const m = /^entity\[0x([0-9a-f]{1,2})\]$/i.exec(s);
    return m ? parseInt(m[1], 16) : null;
};

function palWithOffset(addr16: number, pal: (a: number) => string): string {
    const id = spritePaletteId(addr16);
    if (id !== null) return pal(addr16);
    const off = (addr16 - spritePaletteAddr(0)) % 32;
    const base = addr16 - off;
    if (off > 0 && spritePaletteId(base) !== null) return `${pal(base)}+${off}`;
    throw new Error(`sprite palette 0x${hex4(addr16)} lies outside $90:A7EB-$C98A`);
}
function modeTextNoDollar(v: number): string {
    const parts = (MODE_BITS as [number, string][]).filter(([bit]) => v & bit).map(([, n]) => n);
    const rest = (MODE_BITS as [number, string][]).reduce((r, [bit]) => r & ~bit, v);
    if (rest) parts.push(`0x${hex4(rest)}`);
    return parts.length ? parts.join(' | ') : '0';
}
function parseMode(s: string): number | null {
    if (s === '0') return 0;
    let out = 0;
    for (const part of s.split('|').map(x => x.trim())) {
        const bit = (MODE_BITS as [number, string][]).find(([, n]) => n === part)?.[0];
        if (bit !== undefined) out |= bit;
        else if (/^0x[0-9a-f]+$/i.test(part)) { const v = parseInt(part.slice(2), 16); if (v > 0xFFFF) return null; out |= v; }
        else return null;
    }
    return out;
}
function parseIntRange(s: string, min: number, max: number): number | null {
    if (!/^-?(?:0x[0-9a-f]+|\d+)$/i.test(s)) return null;
    const v = s.startsWith('-0x') || s.startsWith('-0X') ? -parseInt(s.slice(3), 16) : Number(s);
    return Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/** Disassemble one discovered animation script into zero-pointer symbolic lines. */
export function disassembleAnimationScript(rom: Uint8Array, info: DiscoveredScript, r: DisasmResolvers): string[] {
    const labels = new Map<number, string>();
    for (const l of info.lines) if (info.internalLabels.has(l.fileOffset)) labels.set(l.fileOffset, `label_${labels.size + 1}`);
    const out: string[] = [];

    for (const l of info.lines) {
        if (labels.has(l.fileOffset)) out.push(`${labels.get(l.fileOffset)!}:`);
        if (!l.known) throw new Error(`unknown animation opcode 0x${hex2(l.bytes[0])} at $${hex4(l.address & 0xFFFF)}`);
        const b = Uint8Array.from(l.bytes), op = b[0] & 0x7F, bang = l.endFrame ? '!' : '';
        const w = (i: number) => b[i] | (b[i + 1] << 8);
        const labelOf = (tgtBus: number) => labels.get(romFileOffset(rom, tgtBus)) ?? r.extTarget(tgtBus);
        let line: string;

        const plain = PLAIN_OPS.find(([k]) => k === op);
        if (plain) line = plain[1];
        else if (op === 0x00) line = 'nop';
        else if (op === 0x21) line = 'nop2';
        else if (op >= 0x01 && op <= 0x1E) line = `sleep ${op}`;
        else if (op === 0x20) line = `sleep ${b[1]}`;
        else if (op === 0x1F) line = `sleep_random ${b[1]}, ${b[2]}`;
        else if (op >= 0x22 && op <= 0x2B) line = `sprite ${r.metasprite(spriteOperand(rom, l.address))}`;
        else if (op === 0x2C) line = `sprite2 ${r.metasprite(sprite2Operand(rom, l.address))}`;
        else if (op === 0x5F) line = `sprite_long ${r.metasprite(sprite24At(rom, l.address + 1))}`;
        else if (op === 0x5E) line = `sprite_aim ${Array.from({ length: 8 }, (_, i) => r.metasprite(sprite24At(rom, l.address + 1 + 3 * i))).join(', ')}`;
        else if (op === 0x57) {
            const sg = segmentsAt(rom, l.address) as { total: number; groups: { count: number; sprite: number }[] };
            line = `segments ${sg.total}: ${sg.groups.map(g => `${g.count}x ${r.metasprite(g.sprite)}`).join(', ')}`;
        } else if (HUD_OPS.some(([k]) => k === op)) {
            const [, mn, cnt] = HUD_OPS.find(([k]) => k === op)!;
            line = `${mn} ${Array.from({ length: cnt }, (_, i) => r.metasprite(sprite24At(rom, l.address + 1 + 3 * i))).join(', ')}`;
        } else if (op === 0x2E || op === 0x2F) line = `${op === 0x2E ? 'sound' : 'sound_maybe'} ${r.sound(b[1])}`;
        else if (op === 0x37 || op === 0x38) line = `${op === 0x37 ? 'clear16' : 'clear'} ${varName(b[1])}`;
        else if (VAR_OPS.some(([k]) => k === op)) {
            const [, mn, sz] = VAR_OPS.find(([k]) => k === op)!;
            line = `${mn} ${varName(b[1])}, ${sz === 1 ? b[2] : sz === 2 ? s16(w(2)) : '0x' + (b[2] | (w(3) << 8)).toString(16).padStart(6, '0')}`;
        } else if (op === 0x34) {
            const a24 = b[1] | (b[2] << 8) | (b[3] << 16);
            const wn = wramName((a24 >> 16) === 0 && (a24 & 0xFFFF) < 0x2000 ? 0x7E0000 | a24 : a24);
            if (!wn) throw new Error(`0x34 poke target 0x${a24.toString(16)} has no WRAM name`);
            line = `poke ${wn}, ${w(4)}`;
        } else if (op === 0x39 || op === 0x3A) {
            const lbl = labelOf(jumpTarget(rom, l.address, op === 0x39 ? 'dec_jnz' : 'jump_pos'));
            if (!lbl) throw new Error(`unresolved branch in animation script`);
            line = `${op === 0x39 ? 'dec_jnz' : 'jump_pos'} ${varName(b[1])}, ${lbl}`;
        } else if (op === 0x3B) {
            const ext = info.externalJumps.get(l.fileOffset);
            if (ext !== undefined) {
                const ref = r.extTarget(ext);
                if (!ref) throw new Error(`unresolved external jump target $${ext.toString(16)}`);
                line = `jump @${ref}`;
            } else {
                const lbl = labels.get(romFileOffset(rom, jumpTarget(rom, l.address, 'jump')));
                if (!lbl) throw new Error(`unresolved local jump target`);
                line = `jump ${lbl}`;
            }
        } else if (op === 0x54) {
            line = w(1) === LINKED_STUB ? 'jump_if_linked' : `jump_if_linked ${labels.get(romFileOffset(rom, jumpTarget(rom, l.address, 'jump_if_linked'))) ?? '0x' + hex4(w(1))}`;
        } else if (op === 0x3C) line = `blend_palette ${w(1)}, ${palWithOffset(w(3), r.palette)}, ${palWithOffset(w(5), r.palette)}, ${w(7)}`;
        else if (op === 0x3D) line = `upload_palette ${w(1)}, ${palWithOffset(w(3), r.palette)}`;
        else if (op === 0x3E) line = `particle_burst ${palWithOffset(w(1), r.palette)}, ${w(3)}, ${w(5)}, ${w(7)}`;
        else if (op === 0x49 || op === 0x4A || op === 0x4B) line = `${PAL_OPS.find(([k]) => k === op)![1]} ${palWithOffset(w(1), r.palette)}`;
        else if (op === 0x3F) line = `op_3f ${w(1)}`;
        else if (op === 0x40) line = `op_40 ${s16(w(1))}`;
        else if (op === 0x41) line = 'step 0';
        else if (op === 0x42) line = `step ${s8(b[1])}`;
        else if (op === 0x45 || op === 0x46) line = `${op === 0x45 ? 'hop' : 'hop_maybe'} ${s16(w(1))}`;
        else if (op === 0x47) line = `strike ${s8(b[1])}, ${s8(b[2])}, ${b[3]}, ${b[4]}`;
        else if (op === 0x4C) line = `projectile ${r.projectile(w(1))}, ${s8(b[3])}, ${s8(b[4])}, ${s8(b[5])}`;
        else if (op === 0x4D) line = `mode ${modeTextNoDollar(w(1))}`;
        else if (op === 0x50) line = `hurtbox ${s16(w(1))}, ${s16(w(3))}`;
        else if (op === 0x56) line = `check_formula ${r.formula(w(1) / 2)}`;
        else if (op === 0x59) line = `segment #${(b[1] - 4) / 14}, ${s8(b[2])}, ${b[3]}, ${b[4]}, ${s8(b[5])}, ${s8(b[6])}`;
        else if (op === 0x5A) line = `op_5a ${b[1]}`;
        else throw new Error(`unsupported animation opcode 0x${hex2(op)}`);

        out.push(line + bang);
    }
    return out;
}

/** Normalize script lines for round-trip comparison (re-numbers local labels in appearance order). */
export function canonicalScriptLines(lines: string[]): string[] {
    const labelMap = new Map<string, string>();
    for (const raw of lines) {
        const m = LABEL_LINE_RE.exec(raw.trim());
        if (m && !labelMap.has(m[1])) labelMap.set(m[1], `label_${labelMap.size + 1}`);
    }
    return lines.map(raw => {
        const s = raw.trim().replace(/\s+/g, ' ');
        const m = LABEL_LINE_RE.exec(s);
        if (m) return `${labelMap.get(m[1])}:`;
        const bang = s.endsWith('!');
        const body = (bang ? s.slice(0, -1) : s).trim();
        const sp = body.indexOf(' ');
        if (sp < 0) return body + (bang ? '!' : '');
        const mn = body.slice(0, sp), args = body.slice(sp + 1).trim();
        if ((mn === 'jump' || mn === 'jump_if_linked') && labelMap.has(args)) return `${mn} ${labelMap.get(args)}${bang ? '!' : ''}`;
        if ((mn === 'dec_jnz' || mn === 'jump_pos') && args.includes(',')) {
            const [v, tgt] = args.split(',').map(x => x.trim());
            return `${mn} ${v}, ${labelMap.get(tgt) ?? tgt}${bang ? '!' : ''}`;
        }
        if (mn === 'mode') return `mode ${args.split('|').map(x => x.trim()).join(' | ')}${bang ? '!' : ''}`;
        return `${mn} ${args.replace(/\s*,\s*/g, ', ')}${bang ? '!' : ''}`;
    });
}

/** Assemble symbolic animation script lines into initial bytes and relocation patches. */
export function assembleAnimationScript(
    lines: string[],
    r: AsmResolvers,
    findings: Findings,
    file: string,
    jsonPtr: string,
): { bytes: Uint8Array; patches: ScriptPatch[]; externalTargets: string[]; ok: boolean } {
    const labelOffsets = new Map<string, number>();
    const pendingPatches: (ScriptPatch | { kind: 'pending_label'; offset: number; label: string; lineIdx: number })[] = [];
    const bytes: number[] = [], externalTargets: string[] = [];
    let ok = true;

    const err = (lineIdx: number, rule: 'invalid-value' | 'unknown-reference', msg: string) => {
        findings.error(rule, file, `${jsonPtr}/${lineIdx}`, msg); ok = false;
    };
    const parseMeta = (tok: string, lineIdx: number): number => {
        if (!r.hasMetasprite(tok)) { err(lineIdx, 'unknown-reference', `"${tok}" is no metasprite in sprites/metasprites/`); return 0xCA0000; }
        return r.metasprite(tok) ?? 0xCA0000;
    };
    const parsePal = (tok: string, lineIdx: number): number => {
        const m = /^([a-z0-9_]+)(?:\+(\d+))?$/.exec(tok);
        if (!m) { err(lineIdx, 'invalid-value', `"${tok}": expected a sprite palette name`); return 0; }
        const base = r.palette(m[1]), off = m[2] ? Number(m[2]) : 0;
        if (base === null) { err(lineIdx, 'unknown-reference', `"${m[1]}" is no sprite palette in palettes/sprites/`); return 0; }
        if (off >= 32) { err(lineIdx, 'invalid-value', `palette byte offset +${off} >= 32`); return 0; }
        return base + off;
    };
    const push16 = (v: number) => bytes.push(v & 0xFF, (v >> 8) & 0xFF);
    const push24 = (v: number) => bytes.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF);

    for (let i = 0; i < lines.length; i++) {
        const s = typeof lines[i] === 'string' ? lines[i].trim() : '';
        if (!s) { err(i, 'invalid-value', 'empty animation command'); continue; }
        const lm = LABEL_LINE_RE.exec(s);
        if (lm) {
            if (labelOffsets.has(lm[1])) { err(i, 'invalid-value', `duplicate label "${lm[1]}"`); continue; }
            labelOffsets.set(lm[1], bytes.length); continue;
        }
        const endFrame = s.endsWith('!'), body = (endFrame ? s.slice(0, -1) : s).trim();
        const sp = body.indexOf(' '), mn = sp < 0 ? body : body.slice(0, sp), rest = sp < 0 ? '' : body.slice(sp + 1).trim();
        const args = rest ? rest.split(',').map(x => x.trim()) : [];
        const off = bytes.length, opByte = (code: number) => code | (endFrame ? END : 0);
        const need = (n: number) => { if (args.length !== n) { err(i, 'invalid-value', `${mn} takes ${n} argument${n === 1 ? '' : 's'}`); return false; } return true; };

        const plain = PLAIN_OPS.find(([, n]) => n === mn);
        if (plain) { if (need(0)) bytes.push(opByte(plain[0])); }
        else if (mn === 'nop') { if (need(0)) bytes.push(opByte(0x00)); }
        else if (mn === 'nop2') { if (need(0)) bytes.push(opByte(0x21)); }
        else if (mn === 'sleep') {
            if (!need(1)) continue;
            const n = parseIntRange(args[0], 1, 255);
            if (n === null) err(i, 'invalid-value', 'sleep ticks 1..255');
            else if (n <= 30) bytes.push(opByte(n)); else bytes.push(opByte(0x20), n);
        } else if (mn === 'sleep_random') {
            if (!need(2)) continue;
            const a = parseIntRange(args[0], 0, 255), b = parseIntRange(args[1], 0, 255);
            if (a === null || b === null) err(i, 'invalid-value', 'sleep_random <0..255>, <0..255>'); else bytes.push(opByte(0x1F), a, b);
        } else if (mn === 'sprite') {
            if (!need(1)) continue;
            const a24 = parseMeta(args[0], i), bank = (a24 >> 16) & 0xFF;
            bytes.push(opByte((bank >= 0xCA && bank <= 0xD3 ? bank - 0xA8 : 0x22))); push16(a24 & 0xFFFF);
            pendingPatches.push({ kind: 'sprite_short', offset: off, metasprite: args[0], endFrame });
        } else if (mn === 'sprite2' || mn === 'sprite_long') {
            if (!need(1)) continue;
            bytes.push(opByte(mn === 'sprite2' ? 0x2C : 0x5F)); push24(parseMeta(args[0], i));
            pendingPatches.push({ kind: 'sprite_24', offset: off + 1, metasprite: args[0] });
        } else if (mn === 'sprite_aim') {
            if (!need(8)) continue;
            bytes.push(opByte(0x5E));
            args.forEach((a, k) => { push24(parseMeta(a, i)); pendingPatches.push({ kind: 'sprite_24', offset: off + 1 + 3 * k, metasprite: a }); });
        } else if (mn === 'segments') {
            const cm = /^(\d+)\s*:\s*(.+)$/.exec(rest);
            if (!cm) { err(i, 'invalid-value', 'segments <total>: <count>x <metasprite>, ...'); continue; }
            const total = Number(cm[1]), grpStrs = cm[2].split(',').map(x => x.trim());
            bytes.push(opByte(0x57), total);
            grpStrs.forEach(gs => {
                const gm = /^(\d+)x\s+(.+)$/.exec(gs);
                if (!gm) { err(i, 'invalid-value', `"${gs}": expected "<count>x <metasprite>"`); return; }
                const pOff = bytes.length;
                bytes.push(Number(gm[1])); push24(parseMeta(gm[2].trim(), i));
                pendingPatches.push({ kind: 'sprite_24', offset: pOff + 1, metasprite: gm[2].trim() });
            });
        } else if (HUD_OPS.some(([, n]) => n === mn)) {
            const [code, , cnt] = HUD_OPS.find(([, n]) => n === mn)!;
            if (!need(cnt)) continue;
            bytes.push(opByte(code));
            args.forEach((a, k) => { push24(parseMeta(a, i)); pendingPatches.push({ kind: 'sprite_24', offset: off + 1 + 3 * k, metasprite: a }); });
        } else if (mn === 'sound' || mn === 'sound_maybe') {
            if (!need(1)) continue;
            const id = r.sound(args[0]);
            if (id === null) err(i, 'unknown-reference', `"${args[0]}" is no sound in music/sounds/`);
            else bytes.push(opByte(mn === 'sound' ? 0x2E : 0x2F), id);
        } else if (mn === 'clear' || mn === 'clear16') {
            if (!need(1)) continue;
            const v = parseVar(args[0]);
            if (v === null) err(i, 'invalid-value', `"${args[0]}": expected entity variable`); else bytes.push(opByte(mn === 'clear16' ? 0x37 : 0x38), v);
        } else if (VAR_OPS.some(([, n]) => n === mn)) {
            if (!need(2)) continue;
            const [code, , sz] = VAR_OPS.find(([, n]) => n === mn)!, v = parseVar(args[0]);
            const val = parseIntRange(args[1], sz === 2 ? -32768 : 0, sz === 1 ? 255 : sz === 2 ? 32767 : 0xFFFFFF);
            if (v === null || val === null) { err(i, 'invalid-value', `invalid operand for ${mn}`); continue; }
            bytes.push(opByte(code), v);
            if (sz === 1) bytes.push(val); else if (sz === 2) push16(val & 0xFFFF); else push24(val);
        } else if (mn === 'poke') {
            if (!need(2)) continue;
            const wa = wramAddress(args[0]), val = parseIntRange(args[1], 0, 0xFFFF);
            if (wa === undefined) { err(i, 'unknown-reference', `"${args[0]}" is no WRAM name`); continue; }
            if (val === null) { err(i, 'invalid-value', 'poke value 0..65535'); continue; }
            const bank = (wa >> 16) === 0x7E && (wa & 0xFFFF) < 0x2000 ? 0x00 : (wa >> 16);
            bytes.push(opByte(0x34), wa & 0xFF, (wa >> 8) & 0xFF, bank); push16(val);
        } else if (mn === 'dec_jnz' || mn === 'jump_pos') {
            if (!need(2)) continue;
            const v = parseVar(args[0]);
            if (v === null || !LABEL_NAME_RE.test(args[1])) { err(i, 'invalid-value', `${mn} <var>, <label>`); continue; }
            bytes.push(opByte(mn === 'dec_jnz' ? 0x39 : 0x3A), v, 0, 0);
            pendingPatches.push({ kind: 'pending_label', offset: off + 2, label: args[1], lineIdx: i });
        } else if (mn === 'jump') {
            if (!need(1)) continue;
            if (args[0].startsWith('@')) {
                const ref = args[0].slice(1);
                if (!r.hasExtTarget(ref)) { err(i, 'unknown-reference', `"${ref}" is no animation target in animations/`); continue; }
                bytes.push(opByte(0x3B)); push16(r.extTarget(ref) ?? 0);
                externalTargets.push(ref); pendingPatches.push({ kind: 'ext_jump', offset: off + 1, target: ref });
            } else if (!LABEL_NAME_RE.test(args[0])) err(i, 'invalid-value', 'jump <label> or jump @<animation>');
            else { bytes.push(opByte(0x3B), 0, 0); pendingPatches.push({ kind: 'pending_label', offset: off + 1, label: args[0], lineIdx: i }); }
        } else if (mn === 'jump_if_linked') {
            if (!rest) { bytes.push(opByte(0x54)); push16(LINKED_STUB); }
            else if (args.length === 1 && LABEL_NAME_RE.test(args[0])) {
                bytes.push(opByte(0x54), 0, 0); pendingPatches.push({ kind: 'pending_label', offset: off + 1, label: args[0], lineIdx: i });
            } else err(i, 'invalid-value', 'jump_if_linked [label]');
        } else if (mn === 'blend_palette') {
            if (!need(4)) continue;
            const slot = parseIntRange(args[0], 0, 0xFFFF), p1 = parsePal(args[1], i), p2 = parsePal(args[2], i), cnt = parseIntRange(args[3], 0, 0xFFFF);
            if (slot === null || cnt === null) err(i, 'invalid-value', 'blend_palette <slot>, <pal1>, <pal2>, <count>');
            else { bytes.push(opByte(0x3C)); push16(slot); push16(p1); push16(p2); push16(cnt); }
        } else if (mn === 'upload_palette') {
            if (!need(2)) continue;
            const slot = parseIntRange(args[0], 0, 0xFFFF), p = parsePal(args[1], i);
            if (slot === null) err(i, 'invalid-value', 'upload_palette <slot>, <palette>'); else { bytes.push(opByte(0x3D)); push16(slot); push16(p); }
        } else if (mn === 'particle_burst') {
            if (!need(4)) continue;
            const p = parsePal(args[0], i), w1 = parseIntRange(args[1], 0, 0xFFFF), w2 = parseIntRange(args[2], 0, 0xFFFF), w3 = parseIntRange(args[3], 0, 0xFFFF);
            if (w1 === null || w2 === null || w3 === null) err(i, 'invalid-value', 'particle_burst <palette>, <w1>, <w2>, <w3>');
            else { bytes.push(opByte(0x3E)); push16(p); push16(w1); push16(w2); push16(w3); }
        } else if (PAL_OPS.some(([, n]) => n === mn)) {
            if (!need(1)) continue;
            bytes.push(opByte(PAL_OPS.find(([, n]) => n === mn)![0])); push16(parsePal(args[0], i));
        } else if (mn === 'op_3f' || mn === 'op_40') {
            if (!need(1)) continue;
            const v = mn === 'op_3f' ? parseIntRange(args[0], 0, 0xFFFF) : parseIntRange(args[0], -32768, 32767);
            if (v === null) err(i, 'invalid-value', `invalid ${mn} operand`); else { bytes.push(opByte(mn === 'op_3f' ? 0x3F : 0x40)); push16(v & 0xFFFF); }
        } else if (mn === 'step') {
            if (!need(1)) continue;
            const v = parseIntRange(args[0], -128, 127);
            if (v === null) err(i, 'invalid-value', 'step -128..127');
            else if (v === 0) bytes.push(opByte(0x41)); else bytes.push(opByte(0x42), v & 0xFF);
        } else if (mn === 'hop' || mn === 'hop_maybe') {
            if (!need(1)) continue;
            const v = parseIntRange(args[0], -32768, 32767);
            if (v === null) err(i, 'invalid-value', `${mn} -32768..32767`); else { bytes.push(opByte(mn === 'hop' ? 0x45 : 0x46)); push16(v & 0xFFFF); }
        } else if (mn === 'strike') {
            if (!need(4)) continue;
            const dx = parseIntRange(args[0], -128, 127), dy = parseIntRange(args[1], -128, 127), w = parseIntRange(args[2], 0, 255), h = parseIntRange(args[3], 0, 255);
            if (dx === null || dy === null || w === null || h === null) err(i, 'invalid-value', 'strike <dx>, <dy>, <w>, <h>');
            else bytes.push(opByte(0x47), dx & 0xFF, dy & 0xFF, w, h);
        } else if (mn === 'projectile') {
            if (!need(4)) continue;
            const dx = parseIntRange(args[1], -128, 127), dy = parseIntRange(args[2], -128, 127), dz = parseIntRange(args[3], -128, 127);
            if (!r.hasProjectile(args[0])) { err(i, 'unknown-reference', `"${args[0]}" is no projectile in characters/projectiles/`); continue; }
            if (dx === null || dy === null || dz === null) { err(i, 'invalid-value', 'projectile <name>, <dx>, <dy>, <dz>'); continue; }
            bytes.push(opByte(0x4C)); push16(r.projectile(args[0]) ?? 0); bytes.push(dx & 0xFF, dy & 0xFF, dz & 0xFF);
            pendingPatches.push({ kind: 'projectile', offset: off + 1, projectile: args[0] });
        } else if (mn === 'mode') {
            if (!need(1)) continue;
            const m = parseMode(args[0]);
            if (m === null) err(i, 'invalid-value', `"${args[0]}": expected mode flags joined by " | "`); else { bytes.push(opByte(0x4D)); push16(m); }
        } else if (mn === 'hurtbox') {
            if (!need(2)) continue;
            const x = parseIntRange(args[0], -32768, 32767), y = parseIntRange(args[1], -32768, 32767);
            if (x === null || y === null) err(i, 'invalid-value', 'hurtbox <x>, <y>'); else { bytes.push(opByte(0x50)); push16(x & 0xFFFF); push16(y & 0xFFFF); }
        } else if (mn === 'check_formula') {
            if (!need(1)) continue;
            const id = r.formula(args[0]);
            if (id === null) err(i, 'unknown-reference', `"${args[0]}" is no formula in alchemy/formulas/`); else { bytes.push(opByte(0x56)); push16(2 * id); }
        } else if (mn === 'segment') {
            if (!need(6)) continue;
            const km = /^#(\d+)$/.exec(args[0]), k = km ? Number(km[1]) : -1;
            const depth = parseIntRange(args[1], -128, 127), tx = parseIntRange(args[2], 0, 255), ty = parseIntRange(args[3], 0, 255), x = parseIntRange(args[4], -128, 127), y = parseIntRange(args[5], -128, 127);
            if (k < 0 || 4 + 14 * k > 255 || depth === null || tx === null || ty === null || x === null || y === null) err(i, 'invalid-value', 'segment #<k>, <depth>, <tx>, <ty>, <x>, <y>');
            else bytes.push(opByte(0x59), 4 + 14 * k, depth & 0xFF, tx, ty, x & 0xFF, y & 0xFF);
        } else if (mn === 'op_5a') {
            if (!need(1)) continue;
            const v = parseIntRange(args[0], 0, 255);
            if (v === null) err(i, 'invalid-value', 'op_5a <0..255>'); else bytes.push(opByte(0x5A), v);
        } else err(i, 'invalid-value', `unknown animation command "${mn}"`);
    }

    const patches: ScriptPatch[] = [];
    for (const p of pendingPatches) {
        if (p.kind !== 'pending_label') { patches.push(p); continue; }
        const targetOff = labelOffsets.get(p.label);
        if (targetOff === undefined) err(p.lineIdx, 'unknown-reference', `label "${p.label}" is not defined in this script`);
        else { bytes[p.offset] = targetOff & 0xFF; bytes[p.offset + 1] = (targetOff >> 8) & 0xFF; patches.push({ kind: 'label', offset: p.offset, labelByteOffset: targetOff }); }
    }
    return { bytes: Uint8Array.from(bytes), patches, externalTargets, ok };
}

/** Build disasm resolvers for exploding animation scripts using programmatic or round-trip names. */
export function makeScriptDisasmResolvers(
    rom: Uint8Array,
    name: NameOf,
    countOf: CountOf,
    nameAt: NameAt,
    metaNames: Map<number, string>,
    projNameAt: (addr16: number) => string | null,
    extTarget: (busAddr: number) => string | null,
): DisasmResolvers {
    return {
        metasprite: a => {
            const n = metaNames.get(a);
            if (!n) throw new Error(`missing metasprite name for $${a.toString(16)}`);
            return n;
        },
        palette: a => {
            const pn = spritePaletteName(rom, a, name, countOf, nameAt);
            if (!pn) throw new Error(`missing sprite palette for $${a.toString(16)}`);
            return pn;
        },
        sound: id => {
            if (id >= SOUND_COUNT) throw new Error(`sound id ${id} out of range`);
            return countOf('sounds') !== undefined ? name('sounds', id) : defaultSoundName(id);
        },
        projectile: a => {
            const n = projNameAt(a);
            if (!n) throw new Error(`missing projectile name for $${a.toString(16)}`);
            return n;
        },
        formula: id => {
            if (id < 0 || id >= FORMULAS.length) throw new Error(`formula id ${id} out of range`);
            return countOf('formulas') !== undefined ? name('formulas', id) : FORMULAS[id];
        },
        extTarget,
    };
}
