// The `animations` kind (docs/open-evermore/resources.md §animations): the 212 global IDs event scripts play via
// `animate(entity, mode, id)` (opcodes 0x78/0x79, operand = 2·id), under `animations/animate_ids/<character>/<name>.json`.
// Each entry references an animation group in `animation_groups/` by name (plus optional `facing` when targeting an
// interior facing record). Implode writes the ID table wherever it lands and patches the `lda.l` at $8C:E13C; when
// `animation_groups` adds a new group, it vacates $C4:3C92-$3E39 so new records fit inside bank $C4.
//
// Facts used (docs/open-evermore/animations.md §1, tools/table-hack/tables.js `animate_ids`, proven moved there):
//   table     212 words at $C4:3C92, read only by `lda.l $C43C92,x` at $8C:E13C
//   limit     2,048 ids (ids >= $8000 mean the character's own field, so X stays below)
import { createRequire } from 'node:module';
import type { Codec, CountOf, Item, NameAt, NameOf } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import {
    ANIMATION_GROUPS, ENUM_BY_ID, FACING_KEYS, analyzeAnimationGroups,
    animationGroupPlacedOffset, animationGroupRef, facingOffset, stripCharPrefix,
} from './animation-groups.mts';
import type { FacingMode } from './animation-groups.mts';
import { CHARACTERS, characterNames } from './characters.mts';
import { hexText, parseHex, readerSpans, readerWrites, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';

const require = createRequire(import.meta.url);
const { runAnimation } = require('../../../../dist/games/evermore/maps/animation-vm');
const { facingScript, animationGroups } = require('../../../../dist/games/evermore/maps/animation-table');
const { scriptSprites } = require('../../../../dist/games/evermore/maps/sprites');

export const KIND = 'animations';
export const ANIMATION_NAME_RE = /^(?:[a-z][a-z0-9_]{0,79}\/)?[a-z][a-z0-9_]{0,79}$/;

const DIR = KIND, TABLE = `${DIR}/_table`, FORMAT = 'open-evermore/animate-id', VANILLA = 212, LIMIT = 2048, RECORD_BANK = 0xC4;
const READERS: Reader[] = [{ at: 0x0CE13D, add: 0 }];

function defaultEnumName(id: number): string {
    const e = ENUM_BY_ID.get(id);
    if (!e) return `animation_${id.toString(16).padStart(3, '0')}`;
    if (e.group === 'boy' && !e.name.startsWith('boy_')) return `boy_${e.name}`;
    if (e.group === 'dog' && !e.name.startsWith('dog_')) return `dog_${e.name}`;
    return e.name;
}

interface AnimateEntry {
    id: number;
    record: number;
    full: string;
    group: string | null;
    facing?: string;
    scripts: string[];
    playedOn: string[];
}

const animateCache = new WeakMap<Uint8Array, Map<string, { at: number; entries: AnimateEntry[] }>>();

function analyzeAnimateIds(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): { at: number; entries: AnimateEntry[] } {
    const isRoundTrip = countOf(KIND) !== undefined;
    const key = `${countOf(KIND)}/${countOf(ANIMATION_GROUPS)}/${countOf(CHARACTERS)}/${isRoundTrip ? name(KIND, 0) : ''}`;
    let byKey = animateCache.get(rom);
    const hit = byKey?.get(key);
    if (hit) return hit;

    const at = tableAt(rom, READERS, KIND), count = countOf(KIND) ?? VANILLA;
    const analysis = analyzeAnimationGroups(rom, name, countOf, nameAt);
    const { records: charRecords } = characterNames(rom, name, countOf, nameAt);
    const charsByLen = [...new Set(charRecords)].filter(n => n.length >= 3).sort((a, b) => b.length - a.length);
    const matchPrefix = (ename?: string): string | null => ename ? charsByLen.find(ch => ename === ch || ename.startsWith(ch + '_')) ?? null : null;

    const groupUsedBy = new Map(analysis.groups.map(g => [g.record, g.usedBy]));
    const rawGroups = animationGroups(rom) as { record: number; scripts: number[] }[];
    const groupByRec = new Map(rawGroups.map(g => [g.record, g]));
    const spriteChar = new Map<number, Map<string, number>>();
    for (const g of analysis.groups) {
        const charNames = [...new Set(g.usedBy.filter(u => u.startsWith('character:')).map(u => u.slice('character:'.length).split('.')[0]))];
        if (!charNames.length || charNames.length > 3) continue;
        const rg = groupByRec.get(g.record);
        if (!rg) continue;
        for (const sc of rg.scripts) {
            for (const sp of scriptSprites(rom, sc) as number[]) {
                let m = spriteChar.get(sp);
                if (!m) spriteChar.set(sp, m = new Map());
                for (const ch of charNames) m.set(ch, (m.get(ch) ?? 0) + 1);
            }
        }
    }
    const inferChar = (rec: number): string | null => {
        const rg = groupByRec.get(rec);
        if (!rg) return null;
        const sps = new Set<number>();
        for (const sc of rg.scripts) for (const sp of scriptSprites(rom, sc) as number[]) sps.add(sp);
        const votes = new Map<string, number>();
        for (const sp of sps) for (const [ch, n] of spriteChar.get(sp) ?? []) votes.set(ch, (votes.get(ch) ?? 0) + n);
        if (votes.size) return [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
        let best: { d: number; m: Map<string, number> } | null = null;
        for (const sp of sps) {
            for (const [owned, m] of spriteChar) {
                if ((owned >> 16) !== (sp >> 16)) continue;
                const d = Math.abs(owned - sp);
                if (d < 0x1000 && (!best || d < best.d)) best = { d, m };
            }
        }
        return best ? [...best.m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
    };

    const usedFull = new Set<string>();
    const entries: AnimateEntry[] = [];
    for (let id = 0; id < count; id++) {
        const rec = rom[at + 2 * id] | (rom[at + 2 * id + 1] << 8);
        const usage = analysis.animateUsage.get(id);
        const ei = usage?.enumInfo ?? ENUM_BY_ID.get(id);
        const sc = usage?.playedOn ?? [];
        const usedBy = groupUsedBy.get(rec) ?? [];
        const uniqueSlotChars = [...new Set(usedBy.filter(u => u.startsWith('character:') || u.startsWith('weapon:') || u.startsWith('dog_form:'))
            .map(u => u.startsWith('weapon:') ? 'boy' : u.startsWith('dog_form:') ? 'dog' : u.slice('character:'.length).split('.')[0]))];
        let scriptPal = 0;
        if (rec) {
            try { scriptPal = runAnimation(rom, facingScript(rom, rec, 8), 8).palette || 0; } catch { /* ignore */ }
        }

        let char = 'placeholder';
        if (!rec) char = 'shared';
        else if (ei?.group === 'boy') char = 'boy';
        else if (ei?.group === 'dog') char = 'dog';
        else if (ei?.group === 'all' && (sc.length > 2 || uniqueSlotChars.length > 3)) char = 'shared';
        else if (uniqueSlotChars.length >= 10 && sc.length === 0 && ei?.group !== 'placeholder') char = 'shared';
        else if (sc.length === 1) char = sc[0];
        else if (sc.length > 1) {
            const pref = matchPrefix(ei?.name);
            if (pref && sc.includes(pref)) char = pref;
            else if (uniqueSlotChars.length === 1 && sc.includes(uniqueSlotChars[0])) char = uniqueSlotChars[0];
            else if (sc.length <= 3) char = sc[0];
            else char = 'shared';
        } else if (uniqueSlotChars.length >= 1 && uniqueSlotChars.length <= 4 && ei?.group !== 'placeholder') {
            const pref = matchPrefix(ei?.name);
            char = (pref && uniqueSlotChars.includes(pref)) ? pref : uniqueSlotChars[0];
        } else if (ei?.group === 'placeholder') {
            char = uniqueSlotChars.length === 1 ? uniqueSlotChars[0] : 'placeholder';
        } else if (matchPrefix(ei?.name)) {
            char = matchPrefix(ei?.name)!;
        } else if (scriptPal) {
            char = 'placeholder';
        } else {
            char = inferChar(rec) ?? 'placeholder';
        }

        let full: string;
        if (isRoundTrip) {
            full = name(KIND, id);
        } else {
            const local = !rec ? 'none' : stripCharPrefix(char, ei?.name ?? `animation_${id.toString(16).padStart(3, '0')}`);
            full = `${char}/${local}`;
            let suffix = 2;
            while (usedFull.has(full)) full = `${char}/${local}_${suffix++}`;
            usedFull.add(full);
        }

        const ref = rec ? animationGroupRef(rom, rec, name, countOf, nameAt) : null;
        entries.push({
            id,
            record: rec,
            full,
            group: rec === 0 ? null : ref ? ref.group : hexText(rec, 4, RECORD_BANK),
            facing: ref?.facing,
            scripts: usage?.scripts ?? [],
            playedOn: sc,
        });
    }

    const out = { at, entries };
    if (!byKey) animateCache.set(rom, byKey = new Map());
    byKey.set(key, out);
    return out;
}

/** The attributed `<character>/<name>` list for every `animate()` id (`scripts.mts` resolves operands with it). */
export function animationNames(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): string[] {
    if (countOf(KIND) !== undefined) return Array.from({ length: countOf(KIND)! }, (_, i) => name(KIND, i));
    return analyzeAnimateIds(rom, name, countOf, nameAt).entries.map(e => e.full);
}

export const animationsCodec: Codec = {
    kind: KIND,
    version: 4,
    path: DIR,
    folder: 'animations/animate_ids',
    nameRe: ANIMATION_NAME_RE,

    defaultName: defaultEnumName,

    // `used_in_scripts` and `played_on` are derived; only `animation` and optional `facing` are compared.
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        return [path, json({ animation: v.animation ?? null, ...(v.facing ? { facing: v.facing } : {}) })];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const { at, entries } = analyzeAnimateIds(rom, name, countOf, nameAt);
        const files: Tree = new Map(), names: string[] = [];
        for (const e of entries) {
            names.push(e.full);
            const doc: Record<string, unknown> = {
                format: FORMAT,
                version: 1,
                animation: e.group,
            };
            if (e.facing) doc.facing = e.facing;
            if (e.scripts.length) doc.used_in_scripts = e.scripts;
            if (e.playedOn.length) doc.played_on = e.playedOn;
            files.set(`${DIR}/${e.full}.json`, json(doc));
        }
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: KIND,
            limit: LIMIT,
            names,
            why: 'the id table read by `lda.l $C43C92,x` at $8C:E13C: 2,048 words (ids of $8000 and up mean the character\'s own field)',
        }));
        const span = { start: at, end: at + 2 * entries.length };
        return { files, pool: [span], tables: readerSpans(READERS), homes: [{ key: TABLE, at, length: 2 * entries.length, sha1: sha1(rom.subarray(span.start, span.end)) }] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^animations\/((?:[^/_][^/]*\/)?[^/_][^/]*)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'an animate id is <name>.json or <character>/<name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const groups = ctx.names.get(ANIMATION_GROUPS);
        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            if (!ANIMATION_NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case (or <character>/<name>), at most 80 characters each`); continue; }
            let v: { animation?: unknown; facing?: unknown; format?: unknown; version?: unknown };
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (v.format !== FORMAT || v.version !== 1) ctx.findings.error('schema', path, '/format', `"${FORMAT}", version 1`);
            if (v.animation === null) {
                if (v.facing !== undefined) ctx.findings.error('invalid-value', path, '/facing', 'omit facing when animation is null');
                continue;
            }
            if (typeof v.animation !== 'string') {
                ctx.findings.error('invalid-value', path, '/animation', 'an animation_groups name, or null');
                continue;
            }
            if (groups && !v.animation.startsWith('$')) {
                if (!groups.has(v.animation)) {
                    ctx.findings.error('unknown-reference', path, '/animation', `"${v.animation}" is no animation group in animations/groups/`);
                    continue;
                }
                if (v.facing !== undefined) {
                    let gMode: FacingMode | null = null;
                    try { gMode = JSON.parse(readText(ctx.tree.get(`${ANIMATION_GROUPS}/${v.animation}.json`)!)).facing_mode; } catch { /* ignore */ }
                    if (typeof v.facing !== 'string' || !gMode || facingOffset(gMode, v.facing) === null) {
                        const valid = gMode ? FACING_KEYS[gMode].join(', ') : 'north, east, south, west';
                        ctx.findings.error('invalid-value', path, '/facing', `a valid facing for "${v.animation}" (${valid})`);
                    }
                }
            } else if (parseHex(v.animation, 0xFFFF, RECORD_BANK) === null) {
                ctx.findings.error(groups ? 'unknown-reference' : 'invalid-value', path, '/animation', groups ? 'an animation group name or "$C4:xxxx"' : '"$C4:xxxx"');
            }
        }
        const count = Math.max(-1, ...(ctx.ids.get(KIND)?.values() ?? [])) + 1;
        const vacateC4 = ctx.marks.get(TABLE)?.has('vacate_c4') ?? false;
        // Long-indexed reads; moves out of bank $C4 when a new animation group claims space there.
        return [{ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(2 * count), rule: vacateC4 ? { above: 0x050000, noCrossBank: true } : { noCrossBank: true }, generated: true }] satisfies Item[];
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND), at = placed.get(TABLE);
        if (!ids || at === undefined) return [];
        const count = Math.max(-1, ...ids.values()) + 1, bytes = new Uint8Array(2 * count), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no animation has id ${id}; the table cannot skip one yet`); continue; }
            const v = JSON.parse(readText(ctx.tree.get(`${DIR}/${n}.json`)!));
            let r = 0;
            if (typeof v.animation === 'string') {
                if (v.animation.startsWith('$')) r = parseHex(v.animation, 0xFFFF, RECORD_BANK) ?? 0;
                else r = animationGroupPlacedOffset(ctx, placed, v.animation, v.facing) ?? 0;
            }
            bytes.set([r & 0xFF, r >> 8], 2 * id);
        }
        return [{ at, bytes, file: `${DIR}/${ENUM}` }, ...readerWrites(ctx, READERS, at, `${DIR}/${ENUM}`)];
    },
};
