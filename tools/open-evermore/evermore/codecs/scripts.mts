// The `scripts` kind (docs/open-evermore/resources.md §scripts): every event script as a <name>.txt, one line per
// command (the opcode by its name in opcodes/, then its operand bytes in hex), a reference to another script written
// `@<name>` in place of its operand. One file is one entry of the Scripts tab (a room's enter script, a step-on or B
// trigger, a global) or a script those call. A script only rooms reach lives in the folder of the first of them
// (maps/<map>/scripts/<name>.txt, owner 2026-11-20); the others (globals, the boot script, what globals reach) in
// scripts/. On a round trip a script stays in the folder the tree had it in. Names are unique across both. Reached only through what implode generates: the pointer table, the enter-script table (maps), the boot
// pointer in the header and the absolute calls between scripts.
//
// Facts used (docs/scripts/vm.md, src/games/evermore/script-vm, tools/table-hack/tables.js):
//   window       script code lives in the upper halves of banks $92-$BF, read as one space: the program counter
//                steps from $xx:FFFF on to $xx+1:8000. A packed pointer p is a position in it: bank $92 + (p >> 15),
//                address $8000 | (p & $7FFF)
//   header       $92:8000: word +0 the pointer table's offset from $92:8000 (stays, in _base/), word +8 where the
//                globals start in it, a packed pointer at +$0C: the script the game boots ($8C:CE3C)
//   table        one packed pointer per id; trigger ids and 0xA4/0xB1 operands are byte offsets (3·id), globals
//                (0xA3/0xB0, one byte) index it from word +8. Read only by lda.l $928000,x / $928002,x at $8C:CE63,
//                $8C:CE69, $8C:D3B5, $8C:D3BB after adding word +0 to X (a static scan found no other reader): a moved
//                table is reached by rebasing those four operands by -word +0, the header stays
//   starts       code starts scripts only through $8C:CF18, called from five places in the script engine, each
//                fed by the table, the enter table, the boot pointer or an opcode's operand
//   references   absolute: u24 operands (0x07, 0x29, 0xAF, 0xB4); relative backwards: one byte (0xA5, 0xB2, 1-256
//                bytes) or a word (0xA6, 0xB3, up to 64 KiB). Jumps stay inside a script. Scripts tied by relative
//                calls form a group placed as one item, in order (_scripts.json `groups`); no vanilla script shares
//                an instruction with another or lies inside another's range
//   gaps         bytes no command reaches, inside a script or between the scripts of a group, are not the script's
//                (bank $95 keeps tiles between two scripts that call each other): `skip <n>`, a hole in the item
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { piecesOf, windowFile, windowPos } from '../../layout.mts';
import { json, NAME_RE, readText, sha1, text } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { locate as locateMaps, roomBlobs } from './maps.mts';
import { DEFAULT_OPCODE, KIND as OPCODES } from './opcodes.mts';

const require = createRequire(import.meta.url);
const V = require('../../../../dist/games/evermore/script-vm');
const maps = require('../../../../dist/games/evermore/maps');
const { globalScriptName } = require('../../../../dist/games/evermore/script-model/names');

export const KIND = 'scripts';
const DIR = KIND, META = '_scripts.json', TABLE = `${DIR}/_table`;
/** The pseudo kind whose symbols tell a round trip which map folder held a script (`<map>/<script>`). */
const HOME = 'scripts.home';
const MAP_DIR = 'maps', IN_MAP = 'scripts';
/** Where a script's file is: its map's folder, or scripts/. */
export const scriptPath = (name: string, home?: string): string => home ? `${MAP_DIR}/${home}/${IN_MAP}/${name}.txt` : `${DIR}/${name}.txt`;
const PATH_RE = new RegExp(`^(?:${DIR}/([^/]+)|${MAP_DIR}/([^/]+)/${IN_MAP}/([^/]+))\\.txt$`);
/** A tree path → [script name, home map] when it is a script file. */
export function scriptOf(path: string): [string, string | undefined] | null {
    const m = PATH_RE.exec(path);
    return m ? (m[1] !== undefined ? [m[1], undefined] : [m[3], m[2]]) : null;
}
const FORMAT = 'open-evermore/scripts', VERSION = 1;
/** File banks $92-$BF: their upper halves are the script window (4 MiB HiROM at most). */
export const WINDOW = { from: 0x12, to: 0x40 };
const HEADER = 0x128000, BOOT = 0x12800C, MAP_COUNT = 127;
const READERS = [{ at: 0x0CCE64, add: 0 }, { at: 0x0CCE6A, add: 2 }, { at: 0x0CD3B6, add: 0 }, { at: 0x0CD3BC, add: 2 }];
/** The operand an opcode names another script with, as the last bytes of its line. */
const REF: Record<number, { size: number; form: 'u24' | 'cb' | 'c16' }> = {
    0x07: { size: 3, form: 'u24' }, 0x29: { size: 3, form: 'u24' }, 0xAF: { size: 3, form: 'u24' }, 0xB4: { size: 3, form: 'u24' },
    0xA5: { size: 1, form: 'cb' }, 0xB2: { size: 1, form: 'cb' }, 0xA6: { size: 2, form: 'c16' }, 0xB3: { size: 2, form: 'c16' },
};
/** A line for bytes no command reaches (between commands or after a script's last one): the script skips them. */
const SKIP = 'skip';

const u16 = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);
const u24 = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16);
/** The packed pointer of a file offset in the window, and back. */
export const packedOf = (at: number): number => (((0x80 | (at >> 16)) - 0x92) << 15) | (at & 0x7FFF);
export const fileOfPacked = (p: number): number => ((0x12 + (p >> 15)) << 16) | 0x8000 | (p & 0x7FFF);
const hex2 = (b: number) => b.toString(16).padStart(2, '0');
/** `base` + `suffix`, `base` cut so the whole stays a name (80 characters). */
const fit = (base: string, suffix: string) => base.slice(0, 80 - suffix.length) + suffix;

/** The pointer table (file offset), from the first reader's operand and the header word it adds. */
function tableOf(rom: Uint8Array): number {
    const ops = READERS.map(r => maps.romFileOffset(rom, u24(rom, r.at) - r.add));
    if (READERS.some(r => rom[r.at - 1] !== 0xBF) || ops.some(o => o !== ops[0])) throw new Error('scripts: the pointer table readers are not the ones this codec knows ($8C:CE63, $8C:D3B5); another release?');
    return maps.romFileOffset(rom, (u24(rom, READERS[0].at) + u16(rom, HEADER)) & 0xFFFFFF);
}

interface Script { name: string; at: number; end: number; ins: Map<number, any>; home?: string }
interface Layout { scripts: Script[]; byAt: Map<number, Script>; table: number; ids: number[]; boot: number; groups: Script[][] }

/** Every script and its name: the table's in id order, the maps' enter scripts, the boot script, then what they
 *  call (named after the root that first reaches it). Cached per ROM and naming. */
const cache = new WeakMap<Uint8Array, Map<string, Layout>>();
export function scriptLayout(rom: Uint8Array, name: (kind: string, id: number) => string, count: (kind: string) => number | undefined, nameAt: (kind: string, at: number) => string | undefined): Layout {
    const key = `${count(KIND)}/${count('maps')}/${name(KIND, 0)}/${name('maps', 0)}`;
    const hit = cache.get(rom)?.get(key);
    if (hit) return hit;
    const R = new V.ScriptRom(rom);
    const table = tableOf(rom);
    const roundTrip = count(KIND) !== undefined;
    const n = count(KIND) ?? R.tableOffsets().length;
    const ids = Array.from({ length: n }, (_, i) => fileOfPacked(u24(rom, table + 3 * i)));
    const globalsFrom = u16(rom, HEADER + 8) / 3;

    // Names of table entries on a fresh explode: the room trigger that uses it, a global's name, else its id.
    const fresh = new Map<number, string>();
    if (!roundTrip) {
        roomBlobs(rom, count('maps')).forEach((at, room) => {
            const m = maps.modelFromRom(rom, room, at);
            for (const [kind, list] of [['step', m.stepOn], ['b', m.bTrigger]] as const) {
                list.forEach((t: { scriptId: number }, k: number) => { const id = t.scriptId / 3; if (!fresh.has(id)) fresh.set(id, fit(name('maps', room), `_${kind}_${k + 1}`)); });
            }
        });
        for (let g = 0; g < 256 && globalsFrom + g < n; g++) {
            const own = String(globalScriptName(g) ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            if (!fresh.has(globalsFrom + g)) fresh.set(globalsFrom + g, NAME_RE.test(own) ? 'global_' + own : `global_${hex2(g)}`);
        }
    }
    const scripts: Script[] = [], byAt = new Map<number, Script>(), used = new Set<string>();
    const unique = (s: string) => { let out = s, k = 2; while (used.has(out)) out = fit(s, `_${k++}`); used.add(out); return out; };
    const roots: [number, string][] = ids.map((at, i) => [at, roundTrip ? name(KIND, i) : fresh.get(i) ?? `script_${i.toString(16).padStart(4, '0')}`]);
    // Which rooms start each root: a trigger's table entry, an enter script; -1 for every other start.
    const rooms = count('maps') ?? MAP_COUNT, startedBy: [number, number][] = [];
    const usedBy = new Map<number, number[]>();
    roomBlobs(rom, rooms).forEach((at, room) => {
        const m = maps.modelFromRom(rom, room, at);
        for (const t of [...m.stepOn, ...m.bTrigger] as { scriptId: number }[]) { const id = t.scriptId / 3; if (!usedBy.has(id)) usedBy.set(id, []); usedBy.get(id)!.push(room); }
    });
    ids.forEach((at, i) => { for (const room of usedBy.get(i) ?? [-1]) startedBy.push([at, room]); });
    const { enter } = locateMaps(rom);
    for (let room = 0; room < rooms; room++) {
        const p = u24(rom, enter + 5 * room);
        if (p) { roots.push([fileOfPacked(p), nameAt(KIND, fileOfPacked(p)) ?? fit(name('maps', room), '_enter')]); startedBy.push([fileOfPacked(p), room]); }
    }
    const boot = fileOfPacked(u24(rom, BOOT));
    roots.push([boot, nameAt(KIND, boot) ?? 'boot']);
    startedBy.push([boot, -1]);
    const queue: [number, string, string][] = roots.map(([at, n]) => [at, n, n]);
    const subs = new Map<string, number>();
    while (queue.length) {
        const [at, wanted, root] = queue.shift()!;
        if (byAt.has(at)) continue;
        const ins: Map<number, any> = V.walk(R, [0x800000 | at], false).instructions;
        let end = at;
        for (const i of ins.values()) end = Math.max(end, windowFile(WINDOW, windowPos(WINDOW, i.address & 0x3FFFFF) + i.size - 1) + 1);
        const s: Script = { name: unique(wanted), at, end, ins: new Map([...ins].map(([bus, i]) => [bus & 0x3FFFFF, i])) };
        scripts.push(s); byAt.set(at, s);
        for (const i of [...s.ins.values()].sort((a, b) => a.address - b.address)) {
            const last = i.operands[i.operands.length - 1];
            if (!REF[i.opcode] || !last || last.target === undefined) continue;
            const target = last.target & 0x3FFFFF;
            if (byAt.has(target) || queue.some(q => q[0] === target)) continue;
            const k = (subs.get(root) ?? 0) + 1;
            subs.set(root, k);
            queue.push([target, nameAt(KIND, target) ?? fit(root, `_sub_${k}`), root]);
        }
    }
    // Homes: the first room that reaches a script, unless anything but a room does; a round trip keeps the tree's.
    const reach = new Map<Script, Set<number>>();
    for (const [at, room] of startedBy) {
        const todo = [byAt.get(at)!];
        while (todo.length) {
            const s = todo.pop()!;
            let set = reach.get(s);
            if (!set) reach.set(s, set = new Set());
            if (set.has(room)) continue;
            set.add(room);
            for (const i of s.ins.values()) if (REF[i.opcode]) { const t = byAt.get(i.operands[i.operands.length - 1].target & 0x3FFFFF); if (t) todo.push(t); }
        }
    }
    const mapNames = new Set(Array.from({ length: rooms }, (_, r) => name('maps', r)));
    for (const s of scripts) {
        const kept = nameAt(HOME, s.at);
        if (kept !== undefined) { const home = kept.slice(0, kept.indexOf('/')); if (kept.endsWith('/' + s.name) && (home === '' || mapNames.has(home))) { s.home = home || undefined; continue; } }
        const set = [...(reach.get(s) ?? [])];
        if (set.length && !set.includes(-1)) s.home = name('maps', Math.min(...set));
    }
    // Groups: scripts tied by relative calls, in byte order (what lies between them is a hole: not theirs).
    const pos = (at: number) => windowPos(WINDOW, at);
    const parent = new Map(scripts.map(s => [s, s]));
    const find = (s: Script): Script => parent.get(s) === s ? s : find(parent.get(s)!);
    for (const s of scripts) for (const i of s.ins.values()) {
        const r = REF[i.opcode];
        if (r && r.form !== 'u24') { const a = find(byAt.get(i.operands[i.operands.length - 1].target & 0x3FFFFF)!), b = find(s); if (a !== b) parent.set(a, b); }
    }
    const byRoot = new Map<Script, Script[]>();
    for (const s of [...scripts].sort((a, b) => pos(a.at) - pos(b.at))) { const r = find(s); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r)!.push(s); }
    const groups = [...byRoot.values()].sort((a, b) => pos(a[0].at) - pos(b[0].at));
    const out = { scripts, byAt, table, ids, boot, groups };
    if (!cache.has(rom)) cache.set(rom, new Map());
    cache.get(rom)!.set(key, out);
    return out;
}

/** A group's bytes, its members' offsets in it and the u24 operands (offset, target), as the ROM holds them. */
function groupBytes(rom: Uint8Array, group: Script[], next: (s: Script, i: number) => number) {
    const start = windowPos(WINDOW, group[0].at), end = windowPos(WINDOW, next(group[group.length - 1], group.length - 1));
    const bytes = new Uint8Array(end - start);
    for (let p = 0; p < bytes.length; p++) bytes[p] = rom[windowFile(WINDOW, start + p)];
    return { start, bytes };
}

/** One script's file: its commands, a line each, and `skip <n>` for bytes no command reaches; its holes (positions). */
function scriptText(rom: Uint8Array, s: Script, until: number, nameOf: (at: number) => string, opName: (op: number) => string): { text: string; holes: Span[] } {
    const lines: string[] = [], holes: Span[] = [];
    let skip = 0;
    const flush = (p: number) => { if (skip) { lines.push(`${SKIP} ${skip}`); holes.push({ start: p - skip, end: p }); skip = 0; } };
    for (let p = windowPos(WINDOW, s.at); p < until;) {
        const at = windowFile(WINDOW, p), i = s.ins.get(at);
        if (!i) { skip++; p++; continue; }
        flush(p);
        const bytes = Array.from({ length: i.size }, (_, k) => rom[windowFile(WINDOW, p + k)]);
        const r = REF[i.opcode], body = bytes.slice(1, r ? i.size - r.size : i.size).map(hex2);
        lines.push([opName(bytes[0]), ...body, ...(r ? ['@' + nameOf(i.operands[i.operands.length - 1].target & 0x3FFFFF)] : [])].join(' '));
        p += i.size;
    }
    flush(until);
    return { text: lines.join('\n') + '\n', holes };
}

/** `start`: where the command begins (relative calls count from there); `offset`: where its operand is. */
interface Parsed { bytes: number[]; holes: Span[]; refs: { start: number; offset: number; size: number; form: 'u24' | 'cb' | 'c16'; target: string; line: number }[] }

/** A script file → its bytes and its references; problems are findings at the line. */
function parse(path: string, raw: string, ctx: ImplodeContext): Parsed | null {
    const out: Parsed = { bytes: [], holes: [], refs: [] };
    let ok = true;
    raw.split('\n').forEach((line, n) => {
        const tokens = line.trim().split(/\s+/).filter(Boolean);
        if (!tokens.length || tokens[0].startsWith('#')) return;
        if (tokens[0] === SKIP) {
            const k = Number(tokens[1]);
            if (tokens.length !== 2 || !Number.isInteger(k) || k < 1) { ctx.findings.error('invalid-value', path, `/${n + 1}`, '`skip <n>`: n bytes that are not this script\'s'); ok = false; return; }
            out.holes.push({ start: out.bytes.length, end: out.bytes.length + k });
            out.bytes.push(...new Array(k).fill(0));
            return;
        }
        const body = tokens;
        const ref = body[body.length - 1]?.startsWith('@') ? body.pop()!.slice(1) : null;
        // The opcode by its name in opcodes/ (or as a hex byte), then its operands in hex.
        const op = /^[0-9a-fA-F]{2}$/.test(body[0] ?? '') ? parseInt(body[0], 16) : ctx.ids.get(OPCODES)?.get(body[0]);
        if (op === undefined) { ctx.findings.error('unknown-reference', path, `/${n + 1}`, `"${body[0]}" is no opcode in ${OPCODES}/`); ok = false; return; }
        if (!body.slice(1).every(t => /^[0-9a-fA-F]{2}$/.test(t))) { ctx.findings.error('invalid-value', path, `/${n + 1}`, 'a line is one command: its opcode, then its operand bytes in hex (`call @name` names a script), or `skip <n>`'); ok = false; return; }
        const bytes = [op, ...body.slice(1).map(t => parseInt(t, 16))];
        if (ref !== null) {
            const r = REF[bytes[0]];
            if (!r) { ctx.findings.error('invalid-value', path, `/${n + 1}`, `opcode $${hex2(bytes[0] ?? 0)} names no script; @${ref} needs opcode 07, 29, af, b4 (absolute) or a5, a6, b2, b3 (relative)`); ok = false; return; }
            out.refs.push({ start: out.bytes.length, offset: out.bytes.length + bytes.length, size: r.size, form: r.form, target: ref, line: n + 1 });
            bytes.push(...new Array(r.size).fill(0));
        }
        out.bytes.push(...bytes);
    });
    return ok ? out : null;
}

interface Group { key: string; members: { name: string; offset: number }[]; patches: { offset: number; target: string; file: string; line: number }[] }
const encoded = new WeakMap<ImplodeContext, { groups: Group[]; boot: string | null }>();
/** Each script's file, from `names` (a script may live in a map's folder). */
const paths = new WeakMap<ImplodeContext, Map<string, string>>();

export const scriptsCodec: Codec = {
    kind: KIND, version: VERSION, path: DIR, listedIdsOnly: true,

    defaultName: id => `script_${id.toString(16).padStart(4, '0')}`,

    canonical(path, bytes) {
        // The order of the groups is where explode found them, not part of what they say.
        if (path === `${DIR}/${META}`) { const v = JSON.parse(readText(bytes)); v.groups = (v.groups ?? []).slice().sort((a: string[], b: string[]) => a[0] < b[0] ? -1 : 1); return [path, json(v)]; }
        if (!scriptOf(path)) return [path, bytes];
        // An opcode may be written by its name or as a hex byte: both compare as the byte (default names).
        const op = (t: string) => DEFAULT_OPCODE.has(t) ? DEFAULT_OPCODE.get(t)!.toString(16).padStart(2, '0') : t.toLowerCase();
        const lines = readText(bytes).split('\n').map(l => l.trim().split(/\s+/).filter(Boolean)).filter(t => t.length && !t[0].startsWith('#'));
        return [path, text(lines.map(t => t.map((x, k) => x.startsWith('@') ? x : k === 0 && t[0] !== SKIP ? op(x) : x.toLowerCase()).join(' ')).join('\n') + '\n')];
    },

    explode(rom, name, _options, count, nameAt) {
        const L = scriptLayout(rom, name, count, nameAt);
        const files: Tree = new Map(), pool: Span[] = [], homes = [];
        const nameOf = (at: number) => L.byAt.get(at)!.name, opName = (op: number) => name(OPCODES, op);
        for (const group of L.groups) {
            const next = (s: Script, i: number) => i + 1 < group.length ? group[i + 1].at : s.end;
            const { start, bytes } = groupBytes(rom, group, next);
            const holes: Span[] = [];
            group.forEach((s, i) => {
                const t = scriptText(rom, s, windowPos(WINDOW, next(s, i)), nameOf, opName);
                files.set(scriptPath(s.name, s.home), text(t.text));
                holes.push(...t.holes.map(h => ({ start: h.start - start, end: h.end - start })));
            });
            // The home's sha1 is over the bytes as encode gives them: holes and absolute references as 0.
            for (const h of holes) bytes.fill(0, h.start, h.end);
            for (const s of group) for (const i of s.ins.values()) if (REF[i.opcode]?.form === 'u24') bytes.fill(0, windowPos(WINDOW, i.address & 0x3FFFFF) + i.size - 3 - start, windowPos(WINDOW, i.address & 0x3FFFFF) + i.size - start);
            pool.push(...piecesOf({ bytes, rule: { window: WINDOW }, holes }, group[0].at));
            homes.push({ key: `${DIR}/${group[0].name}`, at: group[0].at, length: bytes.length, sha1: sha1(bytes) });
        }
        const names = L.ids.map(at => nameOf(at));
        const limit = Math.floor((0x10000 - u16(rom, HEADER)) / 3);
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit, names, why: `the pointer table: trigger ids are byte offsets 3·id, added to header word +0 ($${u16(rom, HEADER).toString(16)}) in 16 bits; globals (one-byte ids) start at id ${u16(rom, HEADER + 8) / 3}` }));
        files.set(`${DIR}/${META}`, json({
            format: FORMAT, version: VERSION,
            boot: nameOf(L.boot),
            why: 'groups: scripts that call each other backwards by a relative offset, placed together in this order (`skip` lines keep the room between them, which other resources may use); every other script is placed on its own',
            groups: L.groups.filter(g => g.length > 1).map(g => g.map(s => s.name)),
        }));
        const length = L.ids.length * 3;
        pool.push({ start: L.table, end: L.table + length });
        homes.push({ key: TABLE, at: L.table, length, sha1: sha1(rom.subarray(L.table, L.table + length)) });
        return { files, pool, tables: [...READERS.map(r => ({ start: r.at, end: r.at + 3 })), { start: BOOT, end: BOOT + 3 }], homes };
    },

    names(ctx) {
        const { tree, findings } = ctx;
        const names = new Set<string>(), where = new Map<string, string>();
        for (const path of tree.keys()) {
            const s = scriptOf(path);
            if (s) {
                if (where.has(s[0])) findings.error('duplicate-name', path, '', `"${s[0]}" is also ${where.get(s[0])}: a script name is unique across scripts/ and the map folders`);
                else { where.set(s[0], path); names.add(s[0]); }
                continue;
            }
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}` || path === `${DIR}/${META}`) continue;
            findings.warning('unknown-file', path, '', 'a script is one <name>.txt; ignored');
        }
        paths.set(ctx, where);
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const metaPath = `${DIR}/${META}`;
        let meta: { boot?: string; groups?: string[][] } = {};
        try { meta = JSON.parse(readText(tree.get(metaPath) ?? text('{}'))); } catch (e) { findings.error('parse-error', metaPath, '', (e as Error).message); }
        const inGroup = new Set<string>(), lists: string[][] = [];
        (meta.groups ?? []).forEach((g, k) => {
            const ok = g.filter((n, j) => {
                if (!names.has(n)) { findings.error('unknown-reference', metaPath, `/groups/${k}/${j}`, `"${n}" is no script in ${DIR}/`); return false; }
                if (inGroup.has(n)) { findings.error('duplicate-name', metaPath, `/groups/${k}/${j}`, `"${n}" is in two groups`); return false; }
                inGroup.add(n); return true;
            });
            if (ok.length) lists.push(ok);
        });
        for (const n of [...names].sort()) if (!inGroup.has(n)) lists.push([n]);
        if (meta.boot === undefined || !names.has(meta.boot)) findings.error('unknown-reference', metaPath, '/boot', `the boot script "${meta.boot}" is no script in ${DIR}/`);

        // What the game can reach: the table's scripts, the maps' enter scripts (marked by the maps kind), the boot
        // script, and every script those name. The rest is left out of the build (nothing would ever run it).
        const where = paths.get(ctx)!, fileOf = (n: string) => where.get(n)!;
        const refsOf = new Map<string, string[]>();
        for (const n of names) refsOf.set(n, [...readText(tree.get(fileOf(n))!).matchAll(/@([a-z0-9_]+)/g)].map(m => m[1]));
        const reached = new Set<string>(), todo = [...(ctx.ids.get(KIND)?.keys() ?? []), ...(meta.boot ? [meta.boot] : []), ...[...names].filter(n => ctx.marks.get(`${DIR}/${n}`)?.has('used'))];
        while (todo.length) { const n = todo.pop()!; if (reached.has(n) || !names.has(n)) continue; reached.add(n); todo.push(...refsOf.get(n)!); }
        for (const n of names) if (!reached.has(n)) findings.warning('left-out', fileOf(n), '', 'no table, map or reached script names this script: it is left out of the ROM');

        const items: Item[] = [], groups: Group[] = [];
        for (const full of lists) {
            const list = full.filter(n => reached.has(n));
            if (!list.length) continue;
            const bytes: number[] = [], members: Group['members'] = [], patches: Group['patches'] = [], holes: Span[] = [];
            const relative: { at: number; ref: Parsed['refs'][number]; file: string }[] = [];
            for (const n of list) {
                const file = fileOf(n);
                if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
                const p = parse(file, readText(tree.get(file)!), ctx);
                if (!p) continue;
                members.push({ name: n, offset: bytes.length });
                for (const r of p.refs) {
                    if (!names.has(r.target)) { findings.error('unknown-reference', file, `/${r.line}`, `@${r.target} is no script in ${DIR}/`); continue; }
                    if (r.form === 'u24') patches.push({ offset: bytes.length + r.offset, target: r.target, file, line: r.line });
                    else relative.push({ at: bytes.length, ref: r, file });
                }
                holes.push(...p.holes.map(h => ({ start: h.start + bytes.length, end: h.end + bytes.length })));
                bytes.push(...p.bytes);
            }
            if (!members.length) continue;
            // Relative calls: the target comes before the call, in this group, within the operand's reach.
            for (const { at, ref, file } of relative) {
                const target = members.find(m => m.name === ref.target);
                const back = target ? at + ref.start - target.offset : -1;
                const reach = ref.form === 'cb' ? 0x100 : 0x10000;
                if (!target || back < 1 || back > reach) {
                    findings.error('out-of-range', file, `/${ref.line}`, `@${ref.target} is a relative call backwards: it must come before this line in the same group (${META} groups), at most ${reach} bytes back`);
                    continue;
                }
                const v = reach - back;
                bytes[at + ref.offset] = v & 0xFF;
                if (ref.size === 2) bytes[at + ref.offset + 1] = v >> 8;
            }
            const group: Group = { key: `${DIR}/${members[0].name}`, members, patches };
            groups.push(group);
            items.push({ key: group.key, file: fileOf(members[0].name), bytes: Uint8Array.from(bytes), rule: { window: WINDOW }, patched: patches.length > 0, holes });
        }
        encoded.set(ctx, { groups, boot: meta.boot ?? null });
        const ids = ctx.ids.get(KIND);
        const count = ids && ids.size ? Math.max(...ids.values()) + 1 : 0;
        items.push({ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(count * 3), rule: { noCrossBank: true }, generated: true });
        return items;
    },

    symbols(ctx, placed) {
        const out = new Map<string, number>();
        for (const g of encoded.get(ctx)?.groups ?? []) {
            const at = placed.get(g.key);
            if (at === undefined) continue;
            for (const m of g.members) {
                const file = windowFile(WINDOW, windowPos(WINDOW, at) + m.offset);
                out.set(`${DIR}/${m.name}`, file);
                out.set(`${HOME}/${scriptOf(paths.get(ctx)!.get(m.name)!)?.[1] ?? ''}/${m.name}`, file);
            }
        }
        return out;
    },

    tables(ctx, placed) {
        const state = encoded.get(ctx), ids = ctx.ids.get(KIND), tableAt = placed.get(TABLE);
        if (!state || !ids || tableAt === undefined) return [];
        const packed = (n: string) => packedOf(ctx.symbols.get(`${DIR}/${n}`)!);
        const writes: Write[] = [];
        const bytes3 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF];
        for (const g of state.groups) {
            const at = placed.get(g.key);
            if (at === undefined) continue;
            for (const p of g.patches) bytes3(packed(p.target)).forEach((b, k) =>
                writes.push({ at: windowFile(WINDOW, windowPos(WINDOW, at) + p.offset + k), bytes: Uint8Array.of(b), file: p.file }));
        }
        const count = Math.max(0, ...ids.values()) + 1;
        const table = new Uint8Array(count * 3);
        const byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no script has id ${id}; the pointer table cannot skip one yet`); continue; }
            table.set(bytes3(packed(n)), id * 3);
        }
        writes.push({ at: tableAt, bytes: table, file: `${DIR}/${ENUM}` });
        const word0 = u16(ctx.base.image, HEADER);
        for (const r of READERS) writes.push({ at: r.at, bytes: Uint8Array.from(bytes3((ctx.pointer(tableAt) - word0 + r.add) & 0xFFFFFF)), file: `${DIR}/${ENUM}` });
        if (state.boot && ctx.symbols.has(`${DIR}/${state.boot}`)) writes.push({ at: BOOT, bytes: Uint8Array.from(bytes3(packed(state.boot))), file: `${DIR}/${META}` });
        return writes;
    },
};
