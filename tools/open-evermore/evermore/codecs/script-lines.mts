// The lines of a script file (docs/open-evermore/resources.md §scripts): one command per line, the opcode by its name
// in opcodes/ (a hex byte works too), its operand bytes in hex, then `@script` for a call or a label for a jump;
// `label_<n>:` where a jump lands, `skip <n>` for bytes that are not the script's. `scriptText` writes a script from
// the ROM; `parse` reads a file and `assemble` builds a group of scripts into one item, working out jumps, relative
// calls and ids, and taking a longer form where a shorter one does not reach. Facts: scripts.mts.
import type { ImplodeContext, Segment, Span } from '../../codec.mts';
import { ENUM } from '../../enum.mts';
import { windowFile, windowPos } from '../../layout.mts';
import { KIND as OPCODES } from './opcodes.mts';

export const SCRIPTS = 'scripts', META = '_scripts.json';
/** File banks $92-$BF: their upper halves are the script window (4 MiB HiROM at most). */
export const WINDOW = { from: 0x12, to: 0x40 };
/** The operand an opcode names another script with, as the last bytes of its line. */
export const REF: Record<number, { size: number; form: 'u24' | 'cb' | 'c16' }> = {
    0x07: { size: 3, form: 'u24' }, 0x29: { size: 3, form: 'u24' }, 0xAF: { size: 3, form: 'u24' }, 0xB4: { size: 3, form: 'u24' },
    0xA5: { size: 1, form: 'cb' }, 0xB2: { size: 1, form: 'cb' }, 0xA6: { size: 2, form: 'c16' }, 0xB3: { size: 2, form: 'c16' },
};
/** A script named by its id: a global's index (one byte) or a trigger's table offset 3·id (a word). */
export const BY_ID: Record<number, { size: number; form: 'global' | 'trigger' }> = {
    0xA3: { size: 1, form: 'global' }, 0xB0: { size: 1, form: 'global' }, 0xA4: { size: 2, form: 'trigger' }, 0xB1: { size: 2, form: 'trigger' },
};
/** Jumps inside a script, by the size of their offset: a signed word from the operand's end, or a byte back. */
const JUMP: Record<number, 'r16' | 'rb'> = { 0x04: 'r16', 0x05: 'rb', 0x08: 'r16', 0x09: 'r16', 0x0A: 'r16', 0x0B: 'r16', 0x8E: 'r16', 0x8F: 'r16' };
/** The longer form a command may take when its offset does not reach: the same meaning, an absolute target. */
export const LONGER: Record<number, number> = { 0xA5: 0x29, 0xA6: 0x29, 0xB2: 0xAF, 0xB3: 0xAF, 0x05: 0x04 };
/** A line for bytes no command reaches (between commands or after a script's last one): the script skips them. */
export const SKIP = 'skip';
export const LABEL_RE = /^([a-z_][a-z0-9_]*):$/, LABEL_NAME_RE = /^[a-z_][a-z0-9_]*$/;

const hex2 = (b: number) => b.toString(16).padStart(2, '0');

/** A script as the ROM holds it: its name, its range and its commands by file offset (V.walk). */
export interface Script { name: string; at: number; end: number; ins: Map<number, any> }
/** An absolute call implode writes once the target is placed. */
export interface Patch { offset: number; target: string; file: string; line: number }

/** One script's file: its commands, a line each, `skip <n>` for bytes no command reaches, a `label_<n>:` line where a
 *  jump lands; its holes (positions). `refTo(at)`: `@name` for the script at a file offset, as this file writes it;
 *  `byId(form, value)`: where the script a global index or trigger offset names starts. */
export function scriptText(rom: Uint8Array, s: Script, until: number, refTo: (at: number) => string, opName: (op: number) => string, byId: (form: 'global' | 'trigger', value: number) => number | undefined): { text: string; holes: Span[] } {
    const lines: string[] = [], holes: Span[] = [];
    // Labels, numbered in the order they lie in.
    const labels = new Map<number, string>();
    for (const i of s.ins.values()) if (JUMP[i.opcode] && i.target !== null) labels.set(windowPos(WINDOW, i.target & 0x3FFFFF), '');
    [...labels.keys()].sort((a, b) => a - b).forEach((p, k) => {
        if (!s.ins.has(windowFile(WINDOW, p))) throw new Error(`scripts: ${s.name} jumps to $${p.toString(16)}, where none of its commands starts`);
        labels.set(p, `label_${k + 1}`);
    });
    let skip = 0;
    const flush = (p: number) => { if (skip) { lines.push(`${SKIP} ${skip}`); holes.push({ start: p - skip, end: p }); skip = 0; } };
    for (let p = windowPos(WINDOW, s.at); p < until;) {
        const at = windowFile(WINDOW, p), i = s.ins.get(at);
        if (!i) { skip++; p++; continue; }
        flush(p);
        if (labels.has(p)) lines.push(`${labels.get(p)}:`);
        const bytes = Array.from({ length: i.size }, (_, k) => rom[windowFile(WINDOW, p + k)]);
        const r = REF[i.opcode], id = BY_ID[i.opcode], j = JUMP[i.opcode];
        const value = id ? bytes.slice(i.size - id.size).reduce((v, b, k) => v | (b << (8 * k)), 0) : 0;
        const named = id ? byId(id.form, value) : undefined;
        const tail = r ? [refTo(i.operands[i.operands.length - 1].target & 0x3FFFFF)]
            : named !== undefined ? [refTo(named)]
            : j && i.target !== null ? [labels.get(windowPos(WINDOW, i.target & 0x3FFFFF))!] : [];
        const cut = r ? r.size : named !== undefined ? id.size : j && i.target !== null ? (j === 'rb' ? 1 : 2) : 0;
        lines.push([opName(bytes[0]), ...bytes.slice(1, i.size - cut).map(hex2), ...tail].join(' '));
        p += i.size;
    }
    flush(until);
    return { text: lines.join('\n') + '\n', holes };
}

/** One line of a script file: a command (its operand to work out last), a label, or bytes that are not the script's. */
export type Entry =
    | { kind: 'cmd'; line: number; op: number; body: number[]; ref?: string; jump?: string }
    | { kind: 'label'; name: string }
    | { kind: 'skip'; size: number };

/** A script file → its lines; problems are findings at the line. */
export function parse(path: string, raw: string, ctx: ImplodeContext): Entry[] | null {
    const out: Entry[] = [], labels = new Set<string>();
    let ok = true;
    const bad = (n: number, rule: string, message: string) => { ctx.findings.error(rule, path, `/${n + 1}`, message); ok = false; };
    raw.split('\n').forEach((line, n) => {
        const tokens = line.trim().split(/\s+/).filter(Boolean);
        if (!tokens.length || tokens[0].startsWith('#')) return;
        const label = tokens.length === 1 ? LABEL_RE.exec(tokens[0]) : null;
        if (label) {
            if (labels.has(label[1])) return bad(n, 'duplicate-name', `label ${label[1]} is defined twice`);
            labels.add(label[1]); out.push({ kind: 'label', name: label[1] }); return;
        }
        if (tokens[0] === SKIP) {
            const k = Number(tokens[1]);
            if (tokens.length !== 2 || !Number.isInteger(k) || k < 1) return bad(n, 'invalid-value', '`skip <n>`: n bytes that are not this script\'s');
            out.push({ kind: 'skip', size: k }); return;
        }
        // The opcode by its name in opcodes/ (or as a hex byte), its operands in hex, then a script (`@name`) or a label.
        const op = /^[0-9a-fA-F]{2}$/.test(tokens[0]) ? parseInt(tokens[0], 16) : ctx.ids.get(OPCODES)?.get(tokens[0]);
        if (op === undefined) return bad(n, 'unknown-reference', `"${tokens[0]}" is no opcode in ${OPCODES}/`);
        const rest = tokens.slice(1), last = rest[rest.length - 1] ?? '';
        const ref = last.startsWith('@') ? last.slice(1) : undefined;
        const jump = !ref && JUMP[op] && !/^[0-9a-fA-F]{2}$/.test(last) && LABEL_NAME_RE.test(last) ? last : undefined;
        const body = ref !== undefined || jump !== undefined ? rest.slice(0, -1) : rest;
        if (!body.every(t => /^[0-9a-fA-F]{2}$/.test(t))) return bad(n, 'invalid-value', 'a line is one command: its opcode, its operand bytes in hex, then `@script` or a jump\'s label; or `label:`, or `skip <n>`');
        if (ref !== undefined && !REF[op] && !BY_ID[op]) return bad(n, 'invalid-value', `opcode $${hex2(op)} names no script; @${ref} needs a call: 07, 29, af, b4 (absolute), a5, a6, b2, b3 (relative), a3, b0 (global), a4, b1 (trigger)`);
        out.push({ kind: 'cmd', line: n + 1, op, body: body.map(t => parseInt(t, 16)), ...(ref !== undefined ? { ref } : {}), ...(jump ? { jump } : {}) });
    });
    for (const e of out) if (e.kind === 'cmd' && e.jump && !labels.has(e.jump)) bad(e.line - 1, 'unknown-reference', `no line \`${e.jump}:\` in this script: a jump stays inside its script`);
    return ok ? out : null;
}

/** A command's size in a given form: its opcode, its operand bytes, and the operand implode works out. */
function sizeOf(e: Extract<Entry, { kind: 'cmd' }>, op: number): number {
    return 1 + e.body.length + (e.ref !== undefined ? REF[op]?.size ?? BY_ID[op].size : e.jump !== undefined ? (JUMP[op] === 'rb' ? 1 : 2) : 0);
}

/** A script of a group, parsed, with its folder-resolved references. */
export interface Member { name: string; file: string; entries: Entry[] }

/**
 * A group's bytes, as one item: each member's commands in the given forms (`forms`: command → opcode; longer forms
 * replace those that do not reach, unless `strict`), relative calls and jumps worked out, absolute calls as patches
 * (0 in the bytes), ids by the scripts enum. `free`: every relative call takes its absolute form, so each script may
 * go anywhere. Problems are findings.
 */
export function assemble(members: Member[], ctx: ImplodeContext, opts: { strict: boolean; free: boolean }, globalsFrom: number) {
    const cmds = members.flatMap(m => m.entries.filter((e): e is Extract<Entry, { kind: 'cmd' }> => e.kind === 'cmd'));
    const forms = new Map(cmds.map(c => [c, opts.free && REF[c.op] && REF[c.op].form !== 'u24' ? LONGER[c.op] : c.op]));
    const memberOf = new Map(members.flatMap(m => m.entries.map(e => [e, m] as const)));
    const at = new Map<Entry, number>(), start = new Map<string, number>(), label = new Map<string, number>();
    const layout = () => {
        let pos = 0;
        for (const m of members) {
            start.set(m.name, pos);
            for (const e of m.entries) {
                at.set(e, pos);
                if (e.kind === 'label') label.set(`${m.name}:${e.name}`, pos);
                else pos += e.kind === 'skip' ? e.size : sizeOf(e, forms.get(e)!);
            }
        }
        return pos;
    };
    // Relaxation: a form that does not reach takes the longer one; lengths only grow, so this ends.
    let length = layout();
    for (let changed = true; changed;) {
        changed = false;
        for (const c of cmds) {
            const op = forms.get(c)!, m = memberOf.get(c)!;
            let reaches = true;
            if (c.jump !== undefined && JUMP[op] === 'rb') { const back = at.get(c)! - label.get(`${m.name}:${c.jump}`)!; reaches = back >= 1 && back <= 0x100; }
            if (c.ref !== undefined && REF[op] && REF[op].form !== 'u24') {
                const t = start.get(c.ref), back = t === undefined ? -1 : at.get(c)! - t;
                reaches = back >= 1 && back <= (REF[op].form === 'cb' ? 0x100 : 0x10000);
            }
            if (!reaches && !opts.strict) { forms.set(c, LONGER[op]); changed = true; }
        }
        if (changed) length = layout();
    }
    const bytes = new Uint8Array(length), patches: Patch[] = [], holes: Span[] = [], segments: Segment[] = [];
    const problems: [string, string, string, string][] = [];
    for (const m of members) {
        // The written form's offsets, for the proof: runs where the commands keep their distance.
        let written = 0, run: Segment | null = null;
        const file = m.file;
        for (const e of m.entries) {
            const p = at.get(e)!;
            if (e.kind === 'label') continue;
            const size = e.kind === 'skip' ? e.size : sizeOf(e, forms.get(e)!), was = e.kind === 'skip' ? e.size : sizeOf(e, e.op);
            if (!run || run.dst + run.length !== p || run.src + run.length !== written) { run = { key: `${SCRIPTS}/${m.name}`, src: written, dst: p, length: 0 }; segments.push(run); }
            run.length += Math.min(size, was);
            if (size !== was) run = null;
            written += was;
            if (e.kind === 'skip') { holes.push({ start: p, end: p + e.size }); continue; }
            const op = forms.get(e)!;
            bytes[p] = op;
            bytes.set(e.body, p + 1);
            const operand = p + 1 + e.body.length, put = (v: number, n: number) => { for (let k = 0; k < n; k++) bytes[operand + k] = (v >> (8 * k)) & 0xFF; };
            if (e.jump !== undefined) {
                const t = label.get(`${m.name}:${e.jump}`)!;
                if (JUMP[op] === 'rb') { const back = p - t; if (back < 1 || back > 0x100) problems.push(['out-of-range', file, `/${e.line}`, `${e.jump} is ${-back} bytes from here: goto_back only jumps 1-256 bytes back (goto reaches further)`]); put(0x100 - back, 1); }
                else { const d = t - (operand + 2); if (d < -0x8000 || d > 0x7FFF) problems.push(['out-of-range', file, `/${e.line}`, `${e.jump} is ${d} bytes away: a jump reaches 32 KiB either way`]); put(d & 0xFFFF, 2); }
            } else if (e.ref !== undefined && REF[op]?.form === 'u24') patches.push({ offset: operand, target: e.ref, file, line: e.line });
            else if (e.ref !== undefined && REF[op]) {
                const t = start.get(e.ref), back = t === undefined ? -1 : p - t, reach = REF[op].form === 'cb' ? 0x100 : 0x10000;
                if (back < 1 || back > reach) problems.push(['out-of-range', file, `/${e.line}`, `@${e.ref} is a relative call backwards: with --strict it must come before this line in the same group (${META} groups), at most ${reach} bytes back`]);
                put(reach - back, REF[op].size);
            } else if (e.ref !== undefined) {
                const id = ctx.ids.get(SCRIPTS)?.get(e.ref), form = BY_ID[op].form;
                const v = id === undefined ? undefined : form === 'global' ? id - globalsFrom : 3 * id;
                if (v === undefined) problems.push(['unknown-reference', file, `/${e.line}`, `@${e.ref} has no id: ${form === 'global' ? 'a global' : 'a trigger'} call names a script of ${SCRIPTS}/${ENUM}`]);
                else if (form === 'global' ? v < 0 || v > 0xFF : v > 0xFFFF) problems.push(['out-of-range', file, `/${e.line}`, form === 'global' ? `@${e.ref} (id ${id}) is no global: globals are ids ${globalsFrom}-${globalsFrom + 255}` : `@${e.ref} (id ${id}): a trigger offset 3·id fits 16 bits`]);
                else put(v, BY_ID[op].size);
            }
        }
    }
    return { bytes, patches, holes, segments, problems, offsets: members.map(m => ({ name: m.name, offset: start.get(m.name)! })) };
}
