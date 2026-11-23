// The `animations` kind (docs/open-evermore/resources.md §characters): the animations event scripts play by id
// (`animate`, opcodes 0x78/0x79, operand = 2·id), organized by character folder as `<character>/<name>.json`: the
// animation record it plays (a 16-bit offset in bank $C4) plus read-only attribution, usage, plain-English summary
// (`what`), and palette-shaded ASCII art previews (`animation-view.mts`). Implode writes the id table wherever it
// lands and the one operand that reads it.
//
// Facts used (docs/open-evermore/animations.md §1, tools/table-hack/tables.js `animate_ids`, proven moved there):
//   table     212 words at $C4:3C92, read only by `lda.l $C43C92,x` at $8C:E13C; moving it frees $C4:3C92-$3E39
//             for new animation records (record ids are offsets into bank $C4, so they must stay there)
//   limit     2,048 ids (the table hack's reading: ids ≥ $8000 mean the character's own field, so X stays below)
//   records   stay in _base/ (61 code immediates name record groups: animations.md); a record is a number here
// Names: attributed per character via event-script `spawn*`→`animate` analysis, character record slots, weapons, Dog
// forms, compiler enums (`ANIMATION_*`), and sprite-bank inference; shared/empty animations live under `shared/`.
import { createRequire } from 'node:module';
import type { Codec, CountOf, Item, NameAt, NameOf } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { describeAnimation } from './animation-view.mts';
import { ANIMATION_SLOTS, CHARACTERS, STRIDE, characterNames, characterPalettes, recordsAt } from './characters.mts';
import { hexText, parseHex, readerSpans, readerWrites, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';
import { KIND as SCRIPTS, scriptLayout } from './scripts.mts';

const require = createRequire(import.meta.url);
const ENUMS: Record<string, { name: string; value: string }[]> = require('../../../../src/games/evermore/language/data/index.json').enums;
const { animationGroups, facingScript } = require('../../../../dist/games/evermore/maps/animation-table');
const { runAnimation } = require('../../../../dist/games/evermore/maps/animation-vm');
const { scriptSprites } = require('../../../../dist/games/evermore/maps/sprites');
const { readWeaponAnimations } = require('../../../../dist/games/evermore/sprites/character-model');
const { readDogForms } = require('../../../../dist/games/evermore/sprites/dog-forms');

export const KIND = 'animations';
export const ANIMATION_NAME_RE = /^(?:[a-z][a-z0-9_]{0,79}\/)?[a-z][a-z0-9_]{0,79}$/;

const DIR = KIND, TABLE = `${DIR}/_table`, FORMAT = 'open-evermore/animation', VANILLA = 212, LIMIT = 2048, RECORD_BANK = 0xC4;
const READERS: Reader[] = [{ at: 0x0CE13D, add: 0 }];
const WRITE_AREA: Record<number, 'save' | 'temp' | 'local'> = { 0x18: 'save', 0x1C: 'save', 0x19: 'temp', 0x1D: 'temp', 0x1A: 'local', 0x1E: 'local' };

type EnumGroup = 'boy' | 'dog' | 'enemy' | 'all' | 'placeholder';
const ENUM_BY_ID = new Map<number, { group: EnumGroup; name: string }>();
for (const [list, group] of [['ANIMATION_BOY', 'boy'], ['ANIMATION_DOG', 'dog'], ['ANIMATION_ENEMY', 'enemy'], ['ANIMATION_ALL', 'all'], ['ANIMATION_PLACEHOLDER', 'placeholder']] as const) {
    for (const e of ENUMS[list] ?? []) {
        const raw = String(e.value ?? '');
        if (!raw.startsWith('0x')) continue;
        const v = parseInt(raw, 16);
        const n = e.name.toLowerCase();
        if (v < 0x8000 && !(v & 1) && NAME_RE.test(n) && !ENUM_BY_ID.has(v / 2)) ENUM_BY_ID.set(v / 2, { group, name: n });
    }
}

function defaultEnumName(id: number): string {
    const e = ENUM_BY_ID.get(id);
    if (!e) return `animation_${id.toString(16).padStart(3, '0')}`;
    if (e.group === 'boy' && !e.name.startsWith('boy_')) return `boy_${e.name}`;
    if (e.group === 'dog' && !e.name.startsWith('dog_')) return `dog_${e.name}`;
    return e.name;
}

function entityTerm(op: any): { kind: 'char'; name: string } | { kind: 'last_entity' } | { kind: 'var'; key: string } | null {
    const ts = op?.expr?.terms;
    if (!ts || ts.length !== 1) return null;
    const t = ts[0];
    if (t.subOp === 0x50) return { kind: 'char', name: 'boy' };
    if (t.subOp === 0x51) return { kind: 'char', name: 'dog' };
    if (t.subOp === 0x2D) return { kind: 'last_entity' };
    if (t.spec?.kind === 'read' && t.spec.area) return { kind: 'var', key: `${t.spec.area}:${t.value}` };
    return null;
}

function spawnedChar(i: any, enemies: (string | null)[]): string | null {
    let enemyId: number | undefined;
    if (i.opcode === 0xBA || i.opcode === 0xC2) enemyId = i.operands[0]?.value;
    else if (i.opcode === 0x3C || i.opcode === 0xA2) {
        const v = i.operands[0]?.value;
        if (v !== undefined && !(v & 1)) enemyId = v / 2;
    }
    return enemyId !== undefined ? enemies[enemyId] ?? null : null;
}

function stripCharPrefix(char: string, rawName: string): string {
    const prefixes = [`${char}_`];
    const split = char.split('_');
    if (split.length === 2) prefixes.push(`${split[1]}_${split[0]}_`);
    for (const p of prefixes) {
        if (rawName.startsWith(p)) {
            const rest = rawName.slice(p.length);
            if (NAME_RE.test(rest)) return rest;
        }
    }
    return rawName;
}

interface AnalyzedEntry {
    id: number;
    record: number;
    char: string;
    full: string;
    attribution: string;
    scripts: string[];
    slotLabels: string[];
    playedOn: string[];
    paletteAddr: number;
    palette2Addr: number;
}

interface Analysis {
    at: number;
    entries: AnalyzedEntry[];
}

const analysisCache = new WeakMap<Uint8Array, Map<string, Analysis>>();

function analyzeAnimations(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): Analysis {
    const isRoundTrip = countOf(KIND) !== undefined;
    const key = `${countOf(KIND)}/${countOf(CHARACTERS)}/${countOf(SCRIPTS)}/${name(CHARACTERS, 0)}/${name(SCRIPTS, 0)}/${isRoundTrip ? name(KIND, 0) : ''}`;
    let byKey = analysisCache.get(rom);
    const hit = byKey?.get(key);
    if (hit) return hit;

    const at = tableAt(rom, READERS, KIND), count = countOf(KIND) ?? VANILLA;
    const { records: charRecords, enemies: charEnemies } = characterNames(rom, name, countOf, nameAt);
    const charRecordIndex = new Map(charRecords.map((n, i) => [n, i]));

    // 1. Scan event scripts for `spawn*` -> `last_entity` / vars -> `animate*` character targets.
    const scriptChars = new Map<number, Set<string>>();
    const scriptUses = new Map<number, Set<string>>();
    try {
        const L = scriptLayout(rom, name, countOf, nameAt);
        const scopeOf = (s: string) => s.includes('/') ? s.slice(0, s.indexOf('/')) : s;
        const roomVars = new Map<string, Map<string, Set<string>>>();
        for (const s of L.scripts) {
            const scope = scopeOf(s.name);
            let rmap = roomVars.get(scope);
            if (!rmap) roomVars.set(scope, rmap = new Map());
            let lastSpawn: string | null = null;
            for (const i of [...s.ins.values()].sort((a: any, b: any) => a.address - b.address)) {
                const sp = spawnedChar(i, charEnemies);
                if (sp) lastSpawn = sp;
                const area = WRITE_AREA[i.opcode];
                if (area && area !== 'local' && lastSpawn && entityTerm(i.operands[1])?.kind === 'last_entity') {
                    const vKey = `${area}:${i.operands[0].value}`;
                    let set = rmap.get(vKey);
                    if (!set) rmap.set(vKey, set = new Set());
                    set.add(lastSpawn);
                }
            }
        }
        for (const s of L.scripts) {
            const rmap = roomVars.get(scopeOf(s.name));
            let lastSpawn: string | null = null;
            const localVar = new Map<string, string>();
            for (const i of [...s.ins.values()].sort((a: any, b: any) => a.address - b.address)) {
                const sp = spawnedChar(i, charEnemies);
                if (sp) lastSpawn = sp;
                const area = WRITE_AREA[i.opcode];
                if (area && lastSpawn && entityTerm(i.operands[1])?.kind === 'last_entity') {
                    localVar.set(`${area}:${i.operands[0].value}`, lastSpawn);
                }
                if (i.opcode === 0x78 || i.opcode === 0x79) {
                    const v = i.operands[1]?.value;
                    if (v === undefined || v >= 0x8000 || (v & 1)) continue;
                    const id = v / 2;
                    let su = scriptUses.get(id);
                    if (!su) scriptUses.set(id, su = new Set());
                    su.add(s.name);
                    const et = entityTerm(i.operands[0]);
                    let sc = scriptChars.get(id);
                    if (!sc) scriptChars.set(id, sc = new Set());
                    if (et?.kind === 'char') sc.add(et.name);
                    else if (et?.kind === 'last_entity' && lastSpawn) sc.add(lastSpawn);
                    else if (et?.kind === 'var') {
                        if (localVar.has(et.key)) sc.add(localVar.get(et.key)!);
                        else if (rmap?.has(et.key)) for (const x of rmap.get(et.key)!) sc.add(x);
                    }
                }
            }
        }
    } catch { /* minimal test ROMs without scripts still explode animations */ }

    // 2. Collect character record slots, Boy weapons, and Dog forms.
    const slotOwners = new Map<number, { char: string; label: string }[]>();
    const addSlot = (rec: number, char: string, label: string) => {
        if (!rec) return;
        let list = slotOwners.get(rec);
        if (!list) slotOwners.set(rec, list = []);
        list.push({ char, label });
    };
    const recBase = recordsAt(rom);
    for (let k = 0; k < charRecords.length; k++) {
        const off = recBase + STRIDE * k;
        if (off + STRIDE > rom.length) break;
        for (let s = 0; s < ANIMATION_SLOTS.length; s++) {
            addSlot(rom[off + 0x32 + 2 * s] | (rom[off + 0x32 + 2 * s + 1] << 8), charRecords[k], ANIMATION_SLOTS[s]);
        }
    }
    for (const w of readWeaponAnimations(rom) as { name: string; anims: { animRec: number; label: string }[] }[]) {
        for (const a of w.anims) addSlot(a.animRec, 'boy', `${w.name}: ${a.label}`);
    }
    const dogForms = readDogForms(rom) as { name: string; paletteAddr: number; anims: { animRec: number; label: string }[] }[];
    for (const f of dogForms) {
        for (const a of f.anims) addSlot(a.animRec, 'dog', `${f.name}: ${a.label}`);
    }

    // 3. Build sprite -> character vote map for fallback inference.
    const groups = animationGroups(rom) as { record: number; scripts: number[] }[];
    const groupByRec = new Map(groups.map(g => [g.record, g]));
    const spriteChar = new Map<number, Map<string, number>>();
    for (const [rec, owners] of slotOwners) {
        const chars = [...new Set(owners.map(o => o.char))];
        if (chars.length > 3) continue;
        const g = groupByRec.get(rec);
        if (!g) continue;
        for (const script of g.scripts) {
            for (const sp of scriptSprites(rom, script) as number[]) {
                let m = spriteChar.get(sp);
                if (!m) spriteChar.set(sp, m = new Map());
                for (const ch of chars) m.set(ch, (m.get(ch) ?? 0) + 1);
            }
        }
    }
    const inferBySprites = (rec: number): { char: string; how: string } | null => {
        const g = groupByRec.get(rec);
        if (!g) return null;
        const sps = new Set<number>();
        for (const script of g.scripts) for (const sp of scriptSprites(rom, script) as number[]) sps.add(sp);
        const votes = new Map<string, number>();
        for (const sp of sps) for (const [ch, n] of spriteChar.get(sp) ?? []) votes.set(ch, (votes.get(ch) ?? 0) + n);
        if (votes.size) return { char: [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0], how: 'shares sprites with character' };
        let best: { d: number; m: Map<string, number> } | null = null;
        for (const sp of sps) {
            for (const [owned, m] of spriteChar) {
                if ((owned >> 16) !== (sp >> 16)) continue;
                const d = Math.abs(owned - sp);
                if (d < 0x1000 && (!best || d < best.d)) best = { d, m };
            }
        }
        return best ? { char: [...best.m.entries()].sort((a, b) => b[1] - a[1])[0][0], how: 'sprite bank proximity' } : null;
    };

    const charsByLen = [...new Set(charRecords)].filter(n => n.length >= 3).sort((a, b) => b.length - a.length);
    const matchPrefix = (ename?: string): string | null => ename ? charsByLen.find(ch => ename === ch || ename.startsWith(ch + '_')) ?? null : null;
    const usedFull = new Set<string>();
    const entries: AnalyzedEntry[] = [];

    for (let id = 0; id < count; id++) {
        const rec = rom[at + 2 * id] | (rom[at + 2 * id + 1] << 8);
        const ei = ENUM_BY_ID.get(id);
        const sc = [...(scriptChars.get(id) ?? [])];
        const owners = slotOwners.get(rec) ?? [];
        const uniqueSlotChars = [...new Set(owners.map(o => o.char))];
        let scriptPal = 0;
        if (rec) {
            try { scriptPal = runAnimation(rom, facingScript(rom, rec, 8), 8).palette || 0; } catch { /* ignore */ }
        }

        let char = 'placeholder', attribution = 'fallback';
        if (!rec) {
            char = 'shared'; attribution = 'empty (record $0000)';
        } else if (ei?.group === 'boy') {
            char = 'boy'; attribution = sc.includes('boy') ? 'played on boy in scripts' : 'boy animation enum';
        } else if (ei?.group === 'dog') {
            char = 'dog'; attribution = sc.includes('dog') ? 'played on dog in scripts' : 'dog animation enum';
        } else if (ei?.group === 'all' && (sc.length > 2 || uniqueSlotChars.length > 3)) {
            char = 'shared'; attribution = `played on ${sc.length} characters in scripts`;
        } else if (uniqueSlotChars.length >= 10 && sc.length === 0 && ei?.group !== 'placeholder') {
            char = 'shared'; attribution = `shared by ${uniqueSlotChars.length} character records`;
        } else if (sc.length === 1) {
            char = sc[0]; attribution = `played on ${sc[0]} in scripts`;
        } else if (sc.length > 1) {
            const pref = matchPrefix(ei?.name);
            if (pref && sc.includes(pref)) { char = pref; attribution = `played on ${sc.join(', ')} in scripts`; }
            else if (uniqueSlotChars.length === 1 && sc.includes(uniqueSlotChars[0])) { char = uniqueSlotChars[0]; attribution = `character record + scripts (${sc.join(', ')})`; }
            else if (sc.length <= 3) { char = sc[0]; attribution = `played on ${sc.join(', ')} in scripts`; }
            else { char = 'shared'; attribution = `played on ${sc.length} characters in scripts`; }
        } else if (uniqueSlotChars.length >= 1 && uniqueSlotChars.length <= 4 && ei?.group !== 'placeholder') {
            const pref = matchPrefix(ei?.name);
            char = (pref && uniqueSlotChars.includes(pref)) ? pref : uniqueSlotChars[0];
            attribution = `character record slot (${char})`;
        } else if (ei?.group === 'placeholder') {
            if (uniqueSlotChars.length === 1) { char = uniqueSlotChars[0]; attribution = `character record slot (${uniqueSlotChars[0]})`; }
            else { char = 'placeholder'; attribution = scriptPal ? 'placeholder (loads own palette)' : 'placeholder animation'; }
        } else if (matchPrefix(ei?.name)) {
            char = matchPrefix(ei?.name)!; attribution = 'name matches character';
        } else if (scriptPal) {
            char = 'placeholder'; attribution = 'loads own palette (0x4B)';
        } else {
            const inf = inferBySprites(rec);
            if (inf) { char = inf.char; attribution = inf.how; }
        }

        let full: string;
        if (isRoundTrip) {
            full = name(KIND, id);
            if (full.includes('/')) char = full.slice(0, full.indexOf('/'));
        } else {
            const local = !rec ? 'none' : stripCharPrefix(char, ei?.name ?? `animation_${id.toString(16).padStart(3, '0')}`);
            full = `${char}/${local}`;
            let suffix = 2;
            while (usedFull.has(full)) full = `${char}/${local}_${suffix++}`;
            usedFull.add(full);
        }

        let paletteAddr = 0, palette2Addr = 0;
        const act = /(?:^|\/)act(\d)_/.exec(full);
        if (char === 'dog' && act) {
            paletteAddr = dogForms.find(f => f.name.startsWith('Act ' + act[1]))?.paletteAddr ?? 0;
        }
        if (!paletteAddr) {
            const palIdx = charRecordIndex.get(char) ?? (char === 'shared' && uniqueSlotChars.length ? charRecordIndex.get(uniqueSlotChars[0]) : undefined);
            if (palIdx !== undefined) {
                const p = characterPalettes(rom, palIdx);
                paletteAddr = p.palette;
                palette2Addr = p.palette2;
            }
        }

        entries.push({
            id, record: rec, char, full, attribution,
            scripts: [...(scriptUses.get(id) ?? [])].sort(),
            slotLabels: [...new Set(owners.map(o => `${o.char}.${o.label}`))],
            playedOn: sc.sort(),
            paletteAddr, palette2Addr,
        });
    }

    const out = { at, entries };
    if (!byKey) analysisCache.set(rom, byKey = new Map());
    byKey.set(key, out);
    return out;
}

/** The attributed `<character>/<name>` list for every `animate()` id (`scripts.mts` resolves operands with it). */
export function animationNames(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): string[] {
    if (countOf(KIND) !== undefined) return Array.from({ length: countOf(KIND)! }, (_, i) => name(KIND, i));
    return analyzeAnimations(rom, name, countOf, nameAt).entries.map(e => e.full);
}

export const animationsCodec: Codec = {
    kind: KIND, version: 3, path: DIR, folder: `characters/${DIR}`, nameRe: ANIMATION_NAME_RE,

    defaultName: defaultEnumName,

    // Only the record is the animation; what it shows is derived for the reader.
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        return [path, json({ record: JSON.parse(readText(bytes)).record })];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const { at, entries } = analyzeAnimations(rom, name, countOf, nameAt);
        const files: Tree = new Map(), names: string[] = [];
        for (const e of entries) {
            names.push(e.full);
            const usedIn: Record<string, unknown> = {};
            if (e.scripts.length) usedIn.scripts = e.scripts;
            if (e.slotLabels.length) usedIn.characters = e.slotLabels;
            if (e.playedOn.length && !(e.playedOn.length === 1 && e.playedOn[0] === e.char)) usedIn.played_on = e.playedOn;

            const desc = describeAnimation(rom, e.record, {
                paletteAddr: e.paletteAddr,
                palette2Addr: e.palette2Addr,
                mode: 'full',
            });
            files.set(`${DIR}/${e.full}.json`, json({
                format: FORMAT,
                version: 1,
                record: hexText(e.record, 4, RECORD_BANK),
                character: e.char,
                attribution: e.attribution,
                ...desc,
                ...(Object.keys(usedIn).length ? { used_in: usedIn } : {}),
            }));
        }
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: LIMIT, names, why: 'the id table read by `lda.l $C43C92,x` at $8C:E13C: 2,048 words (ids of $8000 and up mean the character\'s own field)' }));
        const span = { start: at, end: at + 2 * entries.length };
        return { files, pool: [span], tables: readerSpans(READERS), homes: [{ key: TABLE, at, length: 2 * entries.length, sha1: sha1(rom.subarray(span.start, span.end)) }] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^animations\/((?:[^/_][^/]*\/)?[^/_][^/]*)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'an animation is <name>.json or <character>/<name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            if (!ANIMATION_NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case (or <character>/<name>), at most 80 characters each`); continue; }
            let v: { record?: unknown; format?: unknown; version?: unknown };
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (v.format !== undefined && (v.format !== FORMAT || v.version !== 1)) ctx.findings.error('schema', path, '/format', `"${FORMAT}", version 1`);
            if (parseHex(v.record, 0xFFFF, RECORD_BANK) === null) ctx.findings.error('invalid-value', path, '/record', '"$C4:xxxx": an animation record in bank $C4 (record ids are offsets there)');
        }
        const count = Math.max(-1, ...(ctx.ids.get(KIND)?.values() ?? [])) + 1;
        // Long-indexed reads; kept inside one bank like vanilla's.
        return [{ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(2 * count), rule: { noCrossBank: true }, generated: true }] satisfies Item[];
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND), at = placed.get(TABLE);
        if (!ids || at === undefined) return [];
        const count = Math.max(-1, ...ids.values()) + 1, bytes = new Uint8Array(2 * count), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no animation has id ${id}; the table cannot skip one yet`); continue; }
            const r = parseHex(JSON.parse(readText(ctx.tree.get(`${DIR}/${n}.json`)!)).record, 0xFFFF, RECORD_BANK) ?? 0;
            bytes.set([r & 0xFF, r >> 8], 2 * id);
        }
        return [{ at, bytes, file: `${DIR}/${ENUM}` }, ...readerWrites(ctx, READERS, at, `${DIR}/${ENUM}`)];
    },
};
