// The `scripts` kind (docs/open-evermore/resources.md §scripts): every event script as a <name>.txt, one line per
// command (the opcode by its name in opcodes/, then its operand bytes in hex), a reference to another script written
// `@<name>` in place of its operand. One file is one entry of the Scripts tab (a room's enter script, a step-on or B
// trigger, a global) or a script those call. A room's scripts (its enter script, its triggers', what they call
// first) live in maps/<map>/scripts/<local>.txt and are named `<map>/<local>` (owner, 2026-11-20); the rest in
// scripts/<name>.txt. In a file, `@local` names a script of the same room, `@name` one in scripts/ (`@/name` when a
// local one shares it), `@<map>/<local>` another room's. Reached only through what implode generates: the pointer table, the enter-script table (maps), the boot
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
//                bytes) or a word (0xA6, 0xB3, up to 64 KiB); by id: a global's index from header word +8 (0xA3, 0xB0,
//                a byte) or a table offset 3·id (0xA4, 0xB1, a word). Scripts tied by relative calls form a group in
//                vanilla (_scripts.json `groups`); no vanilla script shares an instruction with another or lies inside
//                another's range. 0xA5/0xA6 do what 0x29 does and 0xB2/0xB3 what 0xAF does, with the target counted
//                back from the opcode (knowledge opcodes/a5.md, b2.md): so implode may write a relative call as the
//                absolute one, which frees the group (below)
//   jumps        stay inside a script: a signed word from the end of the operand (0x04, 0x08-0x0B, 0x8E, 0x8F) or
//                one byte back from the opcode (0x05, 1-256 bytes, the same as 0x04 otherwise: opcodes/05.md). Written
//                as labels, so a command may change length
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
import { assemble, BY_ID, FASTEST, LABEL_RE, LONGER, META, parse, REF, SCRIPTS, scriptText, SKIP, WINDOW } from './script-lines.mts';
import type { Member, Patch, Script } from './script-lines.mts';

export { WINDOW };

const require = createRequire(import.meta.url);
const V = require('../../../../dist/games/evermore/script-vm');
const maps = require('../../../../dist/games/evermore/maps');
const { globalScriptName } = require('../../../../dist/games/evermore/script-model/names');

export const KIND = SCRIPTS;
const DIR = KIND, TABLE = `${DIR}/_table`;
const MAP_DIR = 'maps', IN_MAP = 'scripts';
/** A script's name: `<local>` in scripts/, or `<map>/<local>` in that map's scripts/ folder. */
export const SCRIPT_NAME_RE = /^(?:[a-z][a-z0-9_]{0,79}\/)?[a-z][a-z0-9_]{0,79}$/;
/** Its file. */
export const scriptPath = (name: string): string => name.includes('/') ? `${MAP_DIR}/${name.replace('/', `/${IN_MAP}/`)}.txt` : `${DIR}/${name}.txt`;
/** `@name` as written in a file of `from`'s folder: local names stay local, a top-level one bare, others qualified. */
export function relativeName(name: string, from: string, exists: (n: string) => boolean): string {
    const home = (n: string) => n.includes('/') ? n.slice(0, n.indexOf('/')) : '';
    if (home(name) && home(name) === home(from)) return name.slice(name.indexOf('/') + 1);
    // A top-level name a local one would shadow is written `/name`.
    return !home(name) && home(from) && exists(`${home(from)}/${name}`) ? '/' + name : name;
}
/** `@ref` written in `from`'s file → the script's name, given the names that exist. */
export function resolveName(ref: string, from: string, exists: (n: string) => boolean): string {
    if (ref.startsWith('/')) return ref.slice(1);
    if (ref.includes('/')) return ref;
    const home = from.includes('/') ? from.slice(0, from.indexOf('/')) : '';
    return home && exists(`${home}/${ref}`) ? `${home}/${ref}` : ref;
}
/** `base` + `suffix` with the local part cut so it stays a name (80 characters). */
const withSuffix = (base: string, suffix: string) => { const i = base.indexOf('/') + 1; return base.slice(0, i) + base.slice(i).slice(0, 80 - suffix.length) + suffix; };
const PATH_RE = new RegExp(`^(?:${DIR}/([^/]+)|${MAP_DIR}/([^/]+)/${IN_MAP}/([^/]+))\\.txt$`);
/** A tree path → the script's name when it is a script file. */
export function scriptOf(path: string): string | null {
    const m = PATH_RE.exec(path);
    return m ? (m[1] !== undefined ? m[1] : `${m[2]}/${m[3]}`) : null;
}
const FORMAT = 'open-evermore/scripts', VERSION = 1;
const HEADER = 0x128000, BOOT = 0x12800C, MAP_COUNT = 127;
const READERS = [{ at: 0x0CCE64, add: 0 }, { at: 0x0CCE6A, add: 2 }, { at: 0x0CD3B6, add: 0 }, { at: 0x0CD3BC, add: 2 }];
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

interface Layout { scripts: Script[]; byAt: Map<number, Script>; table: number; ids: number[]; globalsFrom: number; boot: number; groups: Script[][] }

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

    // Names of table entries on a fresh explode: the room trigger that uses it first (`<map>/step_1`, `<map>/b_1`),
    // a global's name, else its id. A script's name says its folder: `<map>/<local>` lives in that map's scripts/.
    const fresh = new Map<number, string>();
    if (!roundTrip) {
        roomBlobs(rom, count('maps')).forEach((at, room) => {
            const m = maps.modelFromRom(rom, room, at);
            for (const [kind, list] of [['step', m.stepOn], ['b', m.bTrigger]] as const) {
                list.forEach((t: { scriptId: number }, k: number) => { const id = t.scriptId / 3; if (!fresh.has(id)) fresh.set(id, `${name('maps', room)}/${kind}_${k + 1}`); });
            }
        });
        for (let g = 0; g < 256 && globalsFrom + g < n; g++) {
            const own = String(globalScriptName(g) ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            if (!fresh.has(globalsFrom + g)) fresh.set(globalsFrom + g, NAME_RE.test(own) ? 'global_' + own : `global_${hex2(g)}`);
        }
    }
    const scripts: Script[] = [], byAt = new Map<number, Script>(), used = new Set<string>();
    const unique = (s: string) => { let out = s, k = 2; while (used.has(out)) out = withSuffix(s, `_${k++}`); used.add(out); return out; };
    const roots: [number, string][] = ids.map((at, i) => [at, roundTrip ? name(KIND, i) : fresh.get(i) ?? `script_${i.toString(16).padStart(4, '0')}`]);
    const { enter } = locateMaps(rom);
    for (let room = 0; room < (count('maps') ?? MAP_COUNT); room++) {
        const p = u24(rom, enter + 5 * room);
        if (p) roots.push([fileOfPacked(p), nameAt(KIND, fileOfPacked(p)) ?? `${name('maps', room)}/enter`]);
    }
    const boot = fileOfPacked(u24(rom, BOOT));
    roots.push([boot, nameAt(KIND, boot) ?? 'boot']);
    // A called script is named after the root that first reaches it, in that root's folder.
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
            queue.push([target, nameAt(KIND, target) ?? withSuffix(root, `_sub_${k}`), root]);
        }
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
    const out = { scripts, byAt, table, ids, globalsFrom, boot, groups };
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

interface Group { key: string; members: { name: string; offset: number }[]; patches: Patch[] }
const encoded = new WeakMap<ImplodeContext, { groups: Group[]; boot: string | null }>();
/** Each script's file, from `names` (a script may live in a map's folder). */
const paths = new WeakMap<ImplodeContext, Map<string, string>>();

export const scriptsCodec: Codec = {
    kind: KIND, version: VERSION, path: DIR, folder: `${DIR}/global`, listedIdsOnly: true, nameRe: SCRIPT_NAME_RE,

    defaultName: id => `script_${id.toString(16).padStart(4, '0')}`,

    canonical(path, bytes, ctx) {
        // Vanilla's groups are packing: a random build places each script alone (G0 checks the stable packing).
        if (path === `${DIR}/${META}`) { const v = JSON.parse(readText(bytes)); delete v.groups; delete v.why; return [path, json(v)]; }
        if (!scriptOf(path)) return [path, bytes];
        // An opcode may be written by its name or as a hex byte, and a command in a longer or faster form (a relative or
        // id call written as the absolute one): all compare as that form's byte (default names). A script is named by
        // its full name, a call by id with the script the enum gives it. The room a script keeps after it (`skip` at its
        // end) belongs to its group, not to it.
        const self = scriptOf(path)!, names = ctx?.names.get(KIND), ids = ctx?.ids.get(KIND);
        const byId = new Map([...(ids ?? [])].map(([n, id]) => [id, n])), globalsFrom = ctx ? u16(ctx.base.image, HEADER + 8) / 3 : 0;
        const lines = readText(bytes).split('\n').map(l => l.trim().split(/\s+/).filter(Boolean)).filter(t => t.length && !t[0].startsWith('#'));
        while (lines.length && lines[lines.length - 1][0] === SKIP) lines.pop();
        return [path, text(lines.map(t => {
            if (t[0] === SKIP || LABEL_RE.test(t[0])) return t.join(' ');
            const b = DEFAULT_OPCODE.get(t[0]) ?? (/^[0-9a-fA-F]{2}$/.test(t[0]) ? parseInt(t[0], 16) : NaN);
            const id = BY_ID[b], rest = t.slice(1);
            if (id && ctx && rest.length >= id.size && rest.slice(-id.size).every(x => /^[0-9a-fA-F]{2}$/.test(x))) {
                const v = rest.slice(-id.size).reduce((n, x, k) => n | (parseInt(x, 16) << (8 * k)), 0), n = byId.get(id.form === 'global' ? globalsFrom + v : v / 3);
                if (n !== undefined) rest.splice(-id.size, id.size, '@/' + n);
            }
            const last = rest[rest.length - 1];
            if (last?.startsWith('@') && names) rest[rest.length - 1] = '@' + resolveName(last.slice(1), self, x => names.has(x));
            const op = Number.isNaN(b) ? t[0].toLowerCase() : hex2(FASTEST[b] ?? LONGER[b] ?? b);
            return [op, ...rest.map(x => x.startsWith('@') ? x : x.toLowerCase())].join(' ');
        }).join('\n') + '\n')];
    },

    explode(rom, name, _options, count, nameAt) {
        const L = scriptLayout(rom, name, count, nameAt);
        const files: Tree = new Map(), pool: Span[] = [], homes = [];
        const nameOf = (at: number) => L.byAt.get(at)!.name, opName = (op: number) => name(OPCODES, op);
        const byId = (form: 'global' | 'trigger', v: number) => form === 'global' ? L.ids[L.globalsFrom + v] : v % 3 === 0 ? L.ids[v / 3] : undefined;
        const all = new Set(L.scripts.map(s => s.name)), exists = (n: string) => all.has(n);
        for (const group of L.groups) {
            const next = (s: Script, i: number) => i + 1 < group.length ? group[i + 1].at : s.end;
            const { start, bytes } = groupBytes(rom, group, next);
            const holes: Span[] = [];
            group.forEach((s, i) => {
                const t = scriptText(rom, s, windowPos(WINDOW, next(s, i)), at => '@' + relativeName(nameOf(at), s.name, exists), opName, byId);
                files.set(scriptPath(s.name), text(t.text));
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
            why: 'groups: vanilla\'s scripts that call each other backwards by a relative offset, kept together in this order by a stable build and by --strict (`skip` lines keep the room between them, which other resources may use); a random build places each script alone, its relative calls written as absolute ones',
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
            if (s) { where.set(s, path); names.add(s); continue; }
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
        for (const n of names) refsOf.set(n, [...readText(tree.get(fileOf(n))!).matchAll(/@(\/?[a-z0-9_/]+)/g)].map(m => resolveName(m[1], n, x => names.has(x))));
        const reached = new Set<string>(), todo = [...(ctx.ids.get(KIND)?.keys() ?? []), ...(meta.boot ? [meta.boot] : []), ...[...names].filter(n => ctx.marks.get(`${DIR}/${n}`)?.has('used'))];
        while (todo.length) { const n = todo.pop()!; if (reached.has(n) || !names.has(n)) continue; reached.add(n); todo.push(...refsOf.get(n)!); }
        for (const n of names) if (!reached.has(n)) findings.warning('left-out', fileOf(n), '', 'no table, map or reached script names this script: it is left out of the ROM');

        const items: Item[] = [], groups: Group[] = [];
        // Without --strict every relative call between scripts takes the absolute form and every script is placed on its
        // own; with --strict vanilla's forms and groups stay (the proof maps the re-encoded commands: segments).
        const free = !ctx.strict, globalsFrom = u16(ctx.base.image, HEADER + 8) / 3;
        for (const full of lists) {
            const members: Member[] = [];
            for (const n of full.filter(x => reached.has(x))) {
                const file = fileOf(n);
                if (!SCRIPT_NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
                const entries = parse(file, readText(tree.get(file)!), ctx);
                if (!entries) continue;
                for (const e of entries) if (e.kind === 'cmd' && e.ref !== undefined) {
                    const written = e.ref;
                    e.ref = resolveName(e.ref, n, x => names.has(x));
                    if (!names.has(e.ref)) findings.error('unknown-reference', file, `/${e.line}`, `@${written} is no script (this room's scripts/, scripts/, or <map>/<name>)`);
                }
                members.push({ name: n, file, entries });
            }
            if (!members.length) continue;
            const key = `${DIR}/${members[0].name}`;
            // As written, the group is the resource explode found: unchanged when its bytes are.
            const written = assemble(members, ctx, { strict: true, free: false }, globalsFrom);
            const same = sha1(written.bytes) === ctx.base.homeSha1.get(key);
            const parts = free ? members.map(m => [m]) : [members];
            for (const part of parts) {
                const a = free ? assemble(part, ctx, { strict: false, free: true }, globalsFrom) : assemble(part, ctx, { strict: ctx.strict, free: false }, globalsFrom);
                for (const [rule, file, at, message] of a.problems) findings.error(rule, file, at, message);
                // A script on its own does not keep the room after it (the bytes up to the next one of its group).
                const holes = part.length === 1 ? a.holes.filter(h => h.end < a.bytes.length) : a.holes;
                const length = part.length === 1 && a.holes.length && a.holes[a.holes.length - 1].end === a.bytes.length ? a.holes[a.holes.length - 1].start : a.bytes.length;
                const group: Group = { key: `${DIR}/${part[0].name}`, members: a.offsets, patches: a.patches };
                groups.push(group);
                items.push({
                    key: group.key, file: part[0].file, bytes: a.bytes.slice(0, length), rule: { window: WINDOW }, patched: a.patches.length > 0, holes,
                    segments: a.segments.map(g => ({ ...g, length: Math.min(g.length, length - g.dst) })).filter(g => g.length > 0), ...(same ? { same: true } : {}),
                });
            }
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
            for (const m of g.members) out.set(`${DIR}/${m.name}`, windowFile(WINDOW, windowPos(WINDOW, at) + m.offset));
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
