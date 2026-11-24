// The `animations` kind (docs/open-evermore/animations.md): unifies all 783+ animation definitions in
// `animations/<owner>/<name>.json` (with inline pointer-free symbolic scripts) and `animations/animate.json` (the
// parameter table read by `animate(entity, animation, mode)` via `$C4:3C92`).
//
// Facts used (src/games/evermore/maps/animation-table.ts, docs/entities/animation_script.md):
//   records   4 bytes per facing [script_lo, script_mid, script_bank, flags] in bank $C4 ($C4:3E3A–$5999)
//   table     animate() IDs in `$C4:3C92` (212 vanilla words; limit 2,048), read by `lda.l $C43C92,x` at $8C:E13C
//   scripts   1,595 unique scripts across banks $C7–$C9; relocate freely on implode with no fixed ROM pointers
import { createRequire } from 'node:module';
import type { Codec, CountOf, ImplodeContext, Item, NameAt, NameOf, Rule, Span, Write } from '../../codec.mts';
import { Findings } from '../../findings.mts';
import { json, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import {
    ANIMATIONS, ANIMATION_NAME_RE, ANIMATE_LIMIT, ANIMATE_READERS, C4_BASE, C4_END,
    FACING_KEYS, RECORD_SIZE, analyzeAnimations, animationInitialOffset, animationPlacedOffset,
    animationRef, defaultAnimationName, facingOffset, flagsForFacingMode,
} from './animation-analysis.mts';
import type { FacingMode } from './animation-analysis.mts';
import {
    assembleAnimationScript, canonicalScriptLines, disassembleAnimationScript,
    discoverAnimationScripts, homeScriptSha1, makeScriptDisasmResolvers,
} from './animation-scripts.mts';
import type { AsmResolvers, DiscoveredScript, ScriptPatch } from './animation-scripts.mts';
import { FORMULAS } from './menus.mts';
import { metaspriteNameMap } from './metasprites.mts';
import { SOUND_COUNT, defaultSoundName } from './music.mts';
import { KIND as PROJECTILES, projectileInitialOffset, projectileNameAt } from './projectiles.mts';
import { readerSpans, readerWrites, tableAt } from './readers.mts';
import { SPRITE_PALETTES, spritePaletteAddr, spritePaletteName } from './sprite-palettes.mts';

const require = createRequire(import.meta.url);
const { romFileOffset } = require('../../../../dist/games/evermore/maps/rom');

export {
    ANIMATIONS, ANIMATION_NAME_RE, FACING_KEYS, animationInitialOffset,
    animationPlacedOffset, animationRef, facingOffset,
};
export const KIND = ANIMATIONS;

const DIR = ANIMATIONS, TABLE = `${DIR}/_table`, ANIMATE_FILE = `${DIR}/animate.json`;
const ANIM_FORMAT = 'open-evermore/animation', ANIMATE_FORMAT = 'open-evermore/animate-table';
const SCRIPT_KIND = 'animations.script', SCRIPT_PREFIX = `${SCRIPT_KIND}/`, SCRIPT_END_PREFIX = 'animations.script_end/';
const ALL_PROJECTILE_RECORDS = 21, FIRST_PROJECTILE = 0xD9A6, PROJECTILE_STRIDE = 24;

interface AnimationDoc { format: string; version: number; facing_mode: FacingMode; facings: Record<string, string[] | { same_as: string }> }
interface EncodedScript {
    ownerKey: string; ownerAnim: string; itemKey: string; file: string;
    bytes: Uint8Array; patches: ScriptPatch[]; links: Set<string>;
}
interface EncodedState {
    scripts: EncodedScript[];
    animRecords: { name: string; file: string; flags: number; facingKeys: readonly string[]; facingOwnerKeys: string[] }[];
    animateEntries: [string, string | null][];
}

const animateEntriesCache = new WeakMap<ImplodeContext, [string, string | null][]>();
const encodedStateCache = new WeakMap<ImplodeContext, EncodedState>();

const hiromHomePtr = (at: number): number =>
    at >= 0x400000 ? (((0x40 + ((at - 0x400000) >> 16)) << 16) | (at & 0xFFFF))
        : (at & 0xFFFF) >= 0x8000 ? 0x800000 | at : 0xC00000 | at;

const facingKeysOf = (v: unknown): FacingMode | null =>
    v === 'any' || v === '4_way' || v === '8_way' ? v : null;

function parseAnimMode(ctx: ImplodeContext, anim: string): FacingMode | null {
    const raw = ctx.tree.get(`${DIR}/${anim}.json`);
    if (!raw) return null;
    try { return facingKeysOf(JSON.parse(readText(raw)).facing_mode); } catch { return null; }
}

/** The parameter names exposed to event scripts' `animate()` (`scripts.mts`). */
export function animationNames(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): string[] {
    if (countOf(KIND) !== undefined) return Array.from({ length: countOf(KIND)! }, (_, i) => name(KIND, i));
    return analyzeAnimations(rom, name, countOf, nameAt).animateEntries.map(e => e.key);
}

/** Verify disassembled script lines re-assemble byte-for-byte back to the ROM's script bytes. */
function verifyScriptLossless(
    rom: Uint8Array,
    ownerKey: string,
    lines: string[],
    info: DiscoveredScript,
    name: NameOf,
    countOf: CountOf,
    nameAt: NameAt,
    metaNames: Map<number, string>,
    resolveExt: (ref: string) => number | null,
): void {
    const metaByName = new Map([...metaNames].map(([a, n]) => [n, a]));
    const palByName = new Map<string, number>();
    for (let id = 0; id < 269; id++) {
        const a = spritePaletteAddr(id), pn = spritePaletteName(rom, a, name, countOf, nameAt);
        if (pn) palByName.set(pn, a);
    }
    const soundByName = new Map<string, number>();
    for (let id = 0; id < SOUND_COUNT; id++) soundByName.set(countOf('sounds') !== undefined ? name('sounds', id) : defaultSoundName(id), id);
    const projByName = new Map<string, number>();
    for (let k = 0; k < ALL_PROJECTILE_RECORDS; k++) {
        const a16 = FIRST_PROJECTILE + PROJECTILE_STRIDE * k, pn = projectileNameAt(rom, a16, name, countOf, nameAt);
        if (pn) projByName.set(pn, a16);
    }
    const formulaByName = new Map<string, number>();
    FORMULAS.forEach((n, id) => formulaByName.set(countOf('formulas') !== undefined ? name('formulas', id) : n, id));

    const f = new Findings();
    const res = assembleAnimationScript(lines, {
        hasMetasprite: n => metaByName.has(n), metasprite: n => metaByName.get(n) ?? null,
        palette: n => palByName.get(n) ?? null,
        sound: n => soundByName.get(n) ?? null,
        hasProjectile: n => projByName.has(n), projectile: n => projByName.get(n) ?? null,
        formula: n => formulaByName.get(n) ?? null,
        hasExtTarget: ref => resolveExt(ref) !== null, extTarget: ref => resolveExt(ref),
    }, f, ownerKey, '');
    if (!res.ok || f.failed) throw new Error(`animation script ${ownerKey}: lossless re-assembly failed (${f.list[0]?.message ?? 'error'})`);
    for (const p of res.patches) {
        if (p.kind !== 'label') continue;
        const abs = (info.startBus + p.labelByteOffset) & 0xFFFF;
        res.bytes[p.offset] = abs & 0xFF; res.bytes[p.offset + 1] = (abs >> 8) & 0xFF;
    }
    const want = rom.subarray(info.fileStart, info.fileEnd);
    if (res.bytes.length !== want.length || res.bytes.some((b, i) => b !== want[i])) {
        const idx = res.bytes.findIndex((b, i) => b !== want[i]);
        throw new Error(`animation script ${ownerKey} at $${info.startBus.toString(16)}: lossless mismatch (${res.bytes.length} vs ${want.length} B, first diff at +${idx})`);
    }
}

export const animationsCodec: Codec = {
    kind: KIND,
    version: 5,
    path: DIR,
    nameRe: ANIMATION_NAME_RE,

    defaultName: defaultAnimationName,

    canonical(path, bytes) {
        const v = JSON.parse(readText(bytes));
        if (path === ANIMATE_FILE) return [path, json({ entries: v.entries })];
        const facings: Record<string, unknown> = {};
        if (v.facings && typeof v.facings === 'object') {
            for (const [k, val] of Object.entries(v.facings)) {
                if (Array.isArray(val)) facings[k] = canonicalScriptLines(val as string[]);
                else if (val && typeof val === 'object' && typeof (val as { same_as?: unknown }).same_as === 'string') {
                    facings[k] = { same_as: ((val as { same_as: string }).same_as).replace(/#any$/, '') };
                } else facings[k] = val;
            }
        }
        return [path, json({ format: v.format, version: v.version, facing_mode: v.facing_mode, facings })];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const { groups, animateEntries } = analyzeAnimations(rom, name, countOf, nameAt);
        const allStarts: number[] = [];
        for (const g of groups) for (const sc of g.scripts) if (sc) allStarts.push(sc);
        const discovered = discoverAnimationScripts(rom, allStarts, nameAt);

        // Canonical owner for each unique script file offset (round-trip preserves custom same_as ownership).
        interface Owner { anim: string; facing: string; mode: FacingMode; ownerKey: string; info: DiscoveredScript }
        const ownerByFile = new Map<number, Owner>();
        if (countOf(KIND) !== undefined) {
            for (const g of groups) {
                const keys = FACING_KEYS[g.mode];
                g.scripts.forEach((sc, i) => {
                    if (!sc) return;
                    const sf = romFileOffset(rom, sc), fKey = keys[i], candidate = `${g.full}#${fKey}`;
                    if (!ownerByFile.has(sf) && nameAt(SCRIPT_KIND, sf) === candidate) {
                        ownerByFile.set(sf, { anim: g.full, facing: fKey, mode: g.mode, ownerKey: candidate, info: discovered.get(sc)! });
                    }
                });
            }
        }
        for (const g of groups) {
            const keys = FACING_KEYS[g.mode];
            g.scripts.forEach((sc, i) => {
                if (!sc) return;
                const sf = romFileOffset(rom, sc), fKey = keys[i];
                if (!ownerByFile.has(sf)) {
                    ownerByFile.set(sf, { anim: g.full, facing: fKey, mode: g.mode, ownerKey: `${g.full}#${fKey}`, info: discovered.get(sc)! });
                }
            });
        }

        const ownerByAnimFacing = new Map<string, Owner>();
        const groupByName = new Map(groups.map(g => [g.full, g]));
        for (const g of groups) {
            FACING_KEYS[g.mode].forEach((fk, i) => {
                const sc = g.scripts[i];
                if (sc) ownerByAnimFacing.set(`${g.full}#${fk}`, ownerByFile.get(romFileOffset(rom, sc))!);
            });
        }
        const resolveExtOffset = (ref: string): number | null => {
            const h = ref.indexOf('#');
            const key = h >= 0 ? ref : (groupByName.get(ref)?.mode === 'any' ? `${ref}#any` : null);
            const owner = key ? ownerByAnimFacing.get(key) : undefined;
            return owner ? (owner.info.startBus & 0xFFFF) : null;
        };

        const metaNames = metaspriteNameMap(rom, name, countOf, nameAt);
        const extTarget = (busAddr: number): string | null => {
            const o = ownerByFile.get(romFileOffset(rom, busAddr));
            return !o ? null : o.mode === 'any' ? o.anim : `${o.anim}#${o.facing}`;
        };
        const disasmR = makeScriptDisasmResolvers(rom, name, countOf, nameAt, metaNames, a => projectileNameAt(rom, a, name, countOf, nameAt), extTarget);
        const linesByOwner = new Map<string, string[]>();
        const pool: Span[] = [], homes: { key: string; at: number; length: number; sha1: string }[] = [];

        for (const [sf, owner] of ownerByFile) {
            const { info } = owner, lines = disassembleAnimationScript(rom, info, disasmR);
            if (countOf(KIND) === undefined) verifyScriptLossless(rom, owner.ownerKey, lines, info, name, countOf, nameAt, metaNames, resolveExtOffset);
            linesByOwner.set(owner.ownerKey, lines);
            const length = info.fileEnd - sf;
            pool.push({ start: sf, end: info.fileEnd });
            homes.push({ key: `${SCRIPT_PREFIX}${owner.ownerKey}`, at: sf, length, sha1: homeScriptSha1(rom.subarray(sf, info.fileEnd), info) });
        }

        const files: Tree = new Map();
        for (const g of groups) {
            const keys = FACING_KEYS[g.mode], facings: Record<string, string[] | { same_as: string }> = {};
            keys.forEach((k, i) => {
                const sc = g.scripts[i], myKey = `${g.full}#${k}`;
                if (!sc) { facings[k] = ['nop', 'loop']; return; }
                const owner = ownerByFile.get(romFileOffset(rom, sc))!;
                if (owner.ownerKey === myKey) facings[k] = linesByOwner.get(owner.ownerKey)!;
                else facings[k] = { same_as: owner.anim === g.full ? owner.facing : (owner.mode === 'any' ? owner.anim : `${owner.anim}#${owner.facing}`) };
            });
            const doc: Record<string, unknown> = { format: ANIM_FORMAT, version: 1, facing_mode: g.mode, facings };
            if (g.palettes.length) doc.palettes = g.palettes;
            if (g.usedBy.length) doc.used_by = g.usedBy;
            files.set(`${DIR}/${g.full}.json`, json(doc));
            const at = C4_BASE | g.record, len = keys.length * RECORD_SIZE;
            pool.push({ start: at, end: at + len });
            homes.push({ key: `${DIR}/${g.full}`, at, length: len, sha1: sha1(rom.subarray(at, at + len)) });
        }

        const entries: Record<string, string | null> = {};
        for (const e of animateEntries) entries[e.key] = e.target === null ? null : (e.facing ? `${e.target}#${e.facing}` : e.target);
        files.set(ANIMATE_FILE, json({
            format: ANIMATE_FORMAT, version: 1, limit: ANIMATE_LIMIT,
            why: 'the animate() parameter table at $C4:3C92 (lda.l $C43C92,x at $8C:E13C): key = name scripts pass to animate(), value = animation in animations/ (or <animation>#<facing>, or null). Order = id; add entries at the end to expose more animations to animate().',
            entries,
        }));

        const animateAt = (() => { try { return tableAt(rom, ANIMATE_READERS, KIND); } catch { return 0x043C92; } })();
        const tableLen = 2 * animateEntries.length;
        pool.push({ start: animateAt, end: animateAt + tableLen });
        homes.push({ key: TABLE, at: animateAt, length: tableLen, sha1: sha1(rom.subarray(animateAt, animateAt + tableLen)) });
        return { files, pool, tables: readerSpans(ANIMATE_READERS), homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === ANIMATE_FILE) continue;
            const m = /^animations\/((?:[^/_][^/]*\/)?[^/_][^/]*)\.json$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'an animation is animations/<owner>/<name>.json (or animate.json); ignored'); continue; }
            const n = m[1];
            if (n === 'animate' || n === 'modes' || n.startsWith('modes/')) { findings.error('bad-name', path, '', `"${n}" is a reserved animations path`); continue; }
            names.add(n);
        }
        return names;
    },

    resolveIds(ctx, names) {
        const raw = ctx.tree.get(ANIMATE_FILE);
        if (!raw) { ctx.findings.error('missing-file', ANIMATE_FILE, '', 'animate.json parameter table is missing'); return null; }
        let doc: { format?: unknown; version?: unknown; entries?: unknown };
        try { doc = JSON.parse(readText(raw)); } catch (e) { ctx.findings.error('parse-error', ANIMATE_FILE, '', (e as Error).message); return null; }
        if (doc.format !== ANIMATE_FORMAT || doc.version !== 1) ctx.findings.error('schema', ANIMATE_FILE, '/format', `"${ANIMATE_FORMAT}", version 1`);
        if (!doc.entries || typeof doc.entries !== 'object' || Array.isArray(doc.entries)) {
            ctx.findings.error('schema', ANIMATE_FILE, '/entries', 'an object mapping parameter names to animation targets (or null)');
            return null;
        }
        const pairs = Object.entries(doc.entries as Record<string, unknown>);
        if (pairs.length > ANIMATE_LIMIT) ctx.findings.error('id-over-limit', ANIMATE_FILE, '/entries', `${pairs.length} ids; the limit is ${ANIMATE_LIMIT}`);
        const ids = new Map<string, number>(), saved: [string, string | null][] = [];
        pairs.forEach(([k, val], id) => {
            if (!ANIMATION_NAME_RE.test(k)) ctx.findings.error('bad-name', ANIMATE_FILE, `/entries/${k}`, `"${k}": snake_case (or <owner>/<name>), at most 80 characters each`);
            else ids.set(k, id);
            if (val === null) { saved.push([k, null]); return; }
            if (typeof val !== 'string') { ctx.findings.error('invalid-value', ANIMATE_FILE, `/entries/${k}`, 'an animation name (optionally #<facing>), or null'); return; }
            const h = val.indexOf('#'), anim = h < 0 ? val : val.slice(0, h), facing = h < 0 ? undefined : val.slice(h + 1);
            if (!names.has(anim)) ctx.findings.error('unknown-reference', ANIMATE_FILE, `/entries/${k}`, `"${anim}" is no animation in animations/`);
            else if (facing !== undefined) {
                const mode = parseAnimMode(ctx, anim);
                if (mode && facingOffset(mode, facing) === null) {
                    ctx.findings.error('invalid-value', ANIMATE_FILE, `/entries/${k}`, `a valid facing for "${anim}" (${FACING_KEYS[mode].join(', ')})`);
                }
            }
            saved.push([k, val]);
        });
        animateEntriesCache.set(ctx, saved);
        return ids;
    },

    encode(ctx, names) {
        const docs = new Map<string, AnimationDoc>(), rawScripts = new Map<string, string[]>();
        const slotRefs = new Map<string, { ref: string; file: string; ptr: string }>();

        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            if (!ANIMATION_NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case (or <owner>/<name>), at most 80 characters each`); continue; }
            let v: any;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (v.format !== ANIM_FORMAT || v.version !== 1) { ctx.findings.error('schema', path, '/format', `"${ANIM_FORMAT}", version 1`); continue; }
            const mode = facingKeysOf(v.facing_mode);
            if (!mode) { ctx.findings.error('invalid-value', path, '/facing_mode', '"any", "4_way" or "8_way"'); continue; }
            const keys = FACING_KEYS[mode];
            if (!v.facings || typeof v.facings !== 'object' || Array.isArray(v.facings)) { ctx.findings.error('invalid-value', path, '/facings', `an object mapping ${keys.join(', ')}`); continue; }
            const actual = Object.keys(v.facings);
            if (actual.length !== keys.length || keys.some(k => !actual.includes(k))) { ctx.findings.error('invalid-value', path, '/facings', `exactly the facings ${keys.join(', ')}`); continue; }
            let docOk = true;
            for (const k of keys) {
                const fv = v.facings[k], slotKey = `${n}#${k}`;
                if (Array.isArray(fv) && fv.every(x => typeof x === 'string')) rawScripts.set(slotKey, fv);
                else if (fv && typeof fv === 'object' && !Array.isArray(fv) && typeof fv.same_as === 'string') slotRefs.set(slotKey, { ref: fv.same_as, file: path, ptr: `/facings/${k}/same_as` });
                else { ctx.findings.error('invalid-value', path, `/facings/${k}`, 'an array of script command lines or { "same_as": "<target>" }'); docOk = false; }
            }
            if (docOk) docs.set(n, v);
        }

        const resolveTarget = (ref: string, curAnim?: string, curMode?: FacingMode): { slotKey: string } | { rule: 'unknown-reference' | 'invalid-value'; msg: string } => {
            if (curAnim && curMode && !ref.includes('/') && !ref.includes('#') && facingOffset(curMode, ref) !== null) return { slotKey: `${curAnim}#${ref}` };
            const h = ref.indexOf('#'), anim = h < 0 ? ref : ref.slice(0, h), facing = h < 0 ? undefined : ref.slice(h + 1);
            const doc = docs.get(anim);
            if (!doc) return { rule: 'unknown-reference', msg: `"${anim}" is no valid animation in animations/` };
            if (facing !== undefined) {
                if (facingOffset(doc.facing_mode, facing) === null) return { rule: 'invalid-value', msg: `a valid facing for "${anim}" (${FACING_KEYS[doc.facing_mode].join(', ')})` };
                return { slotKey: `${anim}#${facing}` };
            }
            if (doc.facing_mode !== 'any') return { rule: 'invalid-value', msg: `"${anim}" has ${doc.facing_mode} facings: specify "${anim}#<facing>"` };
            return { slotKey: `${anim}#any` };
        };

        const facingOwnerKey = new Map<string, string>();
        for (const k of rawScripts.keys()) facingOwnerKey.set(k, k);
        const resolveOwner = (slotKey: string, seen: Set<string>): string | null => {
            if (facingOwnerKey.has(slotKey)) return facingOwnerKey.get(slotKey)!;
            const info = slotRefs.get(slotKey);
            if (!info) return null;
            if (seen.has(slotKey)) { ctx.findings.error('invalid-value', info.file, info.ptr, `circular same_as reference involving "${slotKey}"`); return null; }
            const [curAnim] = slotKey.split('#'), tgt = resolveTarget(info.ref, curAnim, docs.get(curAnim)?.facing_mode);
            if ('rule' in tgt) { ctx.findings.error(tgt.rule, info.file, info.ptr, tgt.msg); return null; }
            seen.add(slotKey);
            const resolved = resolveOwner(tgt.slotKey, seen);
            if (resolved) facingOwnerKey.set(slotKey, resolved);
            return resolved;
        };
        for (const slotKey of slotRefs.keys()) resolveOwner(slotKey, new Set());

        const metaNames = ctx.names.get('metasprites'), palIds = ctx.ids.get(SPRITE_PALETTES);
        const soundIds = ctx.ids.get('sounds') ?? new Map(Array.from({ length: SOUND_COUNT }, (_, id) => [defaultSoundName(id), id]));
        const formulaIds = ctx.ids.get('formulas') ?? new Map(FORMULAS.map((n, id) => [n, id]));
        const projNames = ctx.names.get(PROJECTILES);
        if (!metaNames || !palIds) {
            ctx.findings.error('missing-file', ANIMATE_FILE, '', `explode animations together with ${[!metaNames && 'metasprites', !palIds && 'sprite_palettes'].filter(Boolean).join(' and ')}`);
            return [];
        }

        const resolvers: AsmResolvers = {
            hasMetasprite: n => metaNames.has(n),
            metasprite: n => { const h = ctx.base.homes.get(`metasprites/${n}`); return h ? ((0xC00000 | h.at) >>> 0) : 0xCA0000; },
            palette: n => { const id = palIds.get(n); return id !== undefined ? spritePaletteAddr(id) : null; },
            sound: n => soundIds.get(n) ?? null,
            hasProjectile: n => projNames ? projNames.has(n) : projectileInitialOffset(ctx, n) !== null,
            projectile: n => projectileInitialOffset(ctx, n),
            formula: n => formulaIds.get(n) ?? null,
            hasExtTarget: ref => { const t = resolveTarget(ref); return !('rule' in t) && facingOwnerKey.has(t.slotKey); },
            extTarget: ref => {
                const t = resolveTarget(ref);
                if ('rule' in t) return null;
                const ok = facingOwnerKey.get(t.slotKey);
                const h = ok ? ctx.base.homes.get(SCRIPT_PREFIX + ok) : undefined;
                return h ? (h.at & 0xFFFF) : 0;
            },
        };

        const items: Item[] = [];
        const encodedScripts = new Map<string, EncodedScript>();
        for (const [ownerKey, lines] of rawScripts) {
            const hIdx = ownerKey.indexOf('#'), anim = ownerKey.slice(0, hIdx), fk = ownerKey.slice(hIdx + 1);
            const file = `${DIR}/${anim}.json`, res = assembleAnimationScript(lines, resolvers, ctx.findings, file, `/facings/${fk}`);
            const links = new Set<string>();
            for (const p of res.patches) {
                if (p.kind !== 'ext_jump') continue;
                const t = resolveTarget(p.target);
                if (!('rule' in t)) {
                    const targetOwner = facingOwnerKey.get(t.slotKey);
                    if (targetOwner) { p.target = targetOwner; links.add(targetOwner); }
                }
            }
            encodedScripts.set(ownerKey, { ownerKey, ownerAnim: anim, itemKey: SCRIPT_PREFIX + ownerKey, file, bytes: res.bytes, patches: res.patches, links });
        }
        // Build undirected adjacency for same-bank placement of @target cross-script jumps.
        const adj = new Map<string, Set<string>>();
        for (const [ok, es] of encodedScripts) {
            if (!adj.has(ok)) adj.set(ok, new Set());
            for (const t of es.links) {
                if (!adj.has(t)) adj.set(t, new Set());
                adj.get(ok)!.add(t); adj.get(t)!.add(ok);
            }
        }
        const compBank = new Map<string, number>();
        for (const ok of encodedScripts.keys()) {
            if (compBank.has(ok)) continue;
            const q = [ok], comp: string[] = [];
            while (q.length) {
                const x = q.pop()!;
                if (compBank.has(x)) continue;
                compBank.set(x, -1); comp.push(x);
                for (const nxt of adj.get(x) ?? []) if (!compBank.has(nxt)) q.push(nxt);
            }
            if (comp.length > 1) {
                const homeAt = comp.map(k => ctx.base.homes.get(SCRIPT_PREFIX + k)?.at).find(a => a !== undefined);
                const bank = homeAt !== undefined ? (homeAt & ~0xFFFF) : 0x070000;
                for (const k of comp) compBank.set(k, bank);
            }
        }
        for (const es of encodedScripts.values()) {
            const bank = compBank.get(es.ownerKey) ?? -1;
            const rule: Rule = bank >= 0 ? { above: bank, below: bank + 0x10000, noCrossBank: true, noBankEnd: true } : { noCrossBank: true, noBankEnd: true };
            if (ctx.strict) {
                const home = ctx.base.homes.get(es.itemKey);
                if (home && home.length === es.bytes.length) {
                    if ((home.at >> 8) === ((home.at + home.length) >> 8)) rule.noPageCross = true;
                    else rule.pageOffset = home.at & 0xFF;
                }
            }
            items.push({ key: es.itemKey, file: es.file, bytes: es.bytes, rule, patched: es.patches.length > 0 });
        }

        const animRecords: EncodedState['animRecords'] = [];
        let vacateC4 = false;
        for (const [n, doc] of docs) {
            const path = `${DIR}/${n}.json`, key = `${DIR}/${n}`, flags = flagsForFacingMode(doc.facing_mode), keys = FACING_KEYS[doc.facing_mode];
            const facingOwnerKeys = keys.map(k => facingOwnerKey.get(`${n}#${k}`) ?? `${n}#${k}`);
            const bytes = new Uint8Array(keys.length * RECORD_SIZE);
            keys.forEach((_, i) => {
                const homeSc = ctx.base.homes.get(SCRIPT_PREFIX + facingOwnerKeys[i]), ptr = homeSc ? hiromHomePtr(homeSc.at) : 0;
                bytes[4 * i] = ptr & 0xFF; bytes[4 * i + 1] = (ptr >> 8) & 0xFF; bytes[4 * i + 2] = (ptr >> 16) & 0xFF;
                bytes[4 * i + 3] = i === 0 ? flags : 0;
            });
            const home = ctx.base.homes.get(key);
            if (home) {
                if (bytes.length !== home.length) ctx.findings.error('no-room', path, '/facing_mode', `${bytes.length} bytes (vanilla record is ${home.length} bytes at $${home.at.toString(16)})`);
                else items.push({ key, file: path, bytes, rule: { above: home.at, below: home.at + home.length, bankOffset: home.at & 0xFFFF }, patched: true });
            } else {
                vacateC4 = true;
                items.push({ key, file: path, bytes, rule: { above: C4_BASE, below: C4_END, noCrossBank: true }, patched: true });
            }
            animRecords.push({ name: n, file: path, flags, facingKeys: keys, facingOwnerKeys });
        }

        const animateEntries = animateEntriesCache.get(ctx) ?? [];
        const count = Math.max(-1, ...(ctx.ids.get(KIND)?.values() ?? [])) + 1;
        encodedStateCache.set(ctx, { scripts: [...encodedScripts.values()], animRecords, animateEntries });
        items.push({ key: TABLE, file: ANIMATE_FILE, bytes: new Uint8Array(2 * count), rule: vacateC4 ? { above: 0x050000, noCrossBank: true } : { noCrossBank: true }, generated: true });
        return items;
    },

    symbols(ctx, placed) {
        const st = encodedStateCache.get(ctx), out = new Map<string, number>();
        if (!st) return out;
        for (const es of st.scripts) {
            const at = placed.get(es.itemKey);
            if (at !== undefined) out.set(`${SCRIPT_END_PREFIX}${es.ownerKey}`, at + es.bytes.length);
        }
        return out;
    },

    tables(ctx, placed) {
        const st = encodedStateCache.get(ctx);
        if (!st) return [];
        const writes: Write[] = [];
        for (const es of st.scripts) {
            if (!es.patches.length) continue;
            const at = placed.get(es.itemKey);
            if (at === undefined) continue;
            const b = es.bytes.slice();
            for (const p of es.patches) {
                if (p.kind === 'label') {
                    const abs = (at + p.labelByteOffset) & 0xFFFF;
                    b[p.offset] = abs & 0xFF; b[p.offset + 1] = abs >> 8;
                } else if (p.kind === 'ext_jump') {
                    const tgt = placed.get(SCRIPT_PREFIX + p.target);
                    if (tgt === undefined) continue;
                    if ((tgt >> 16) !== (at >> 16)) { ctx.findings.error('out-of-range', es.file, '', `external jump to "${p.target}" crossed out of bank $${(at >> 16).toString(16)}`); continue; }
                    b[p.offset] = tgt & 0xFF; b[p.offset + 1] = (tgt >> 8) & 0xFF;
                } else if (p.kind === 'sprite_short') {
                    const ma = placed.get(`metasprites/${p.metasprite}`);
                    if (ma === undefined) continue;
                    const bank = 0xC0 | (ma >> 16);
                    if (bank < 0xCA || bank > 0xD3) { ctx.findings.error('out-of-range', es.file, '', `metasprite "${p.metasprite}" lies outside $CA–$D3`); continue; }
                    b[p.offset] = ((bank - 0xA8) & 0x7F) | (p.endFrame ? 0x80 : 0);
                    b[p.offset + 1] = ma & 0xFF; b[p.offset + 2] = (ma >> 8) & 0xFF;
                } else if (p.kind === 'sprite_24') {
                    const ma = placed.get(`metasprites/${p.metasprite}`);
                    if (ma === undefined) continue;
                    const bus24 = 0xC00000 | ma;
                    b[p.offset] = bus24 & 0xFF; b[p.offset + 1] = (bus24 >> 8) & 0xFF; b[p.offset + 2] = (bus24 >> 16) & 0xFF;
                } else if (p.kind === 'projectile') {
                    const pa = placed.get(`projectiles/${p.projectile}`) ?? projectileInitialOffset(ctx, p.projectile);
                    if (pa === null || pa === undefined) continue;
                    b[p.offset] = pa & 0xFF; b[p.offset + 1] = (pa >> 8) & 0xFF;
                }
            }
            writes.push({ at, bytes: b, file: es.file });
        }
        for (const rec of st.animRecords) {
            const recAt = placed.get(`${DIR}/${rec.name}`);
            if (recAt === undefined) continue;
            const bytes = new Uint8Array(rec.facingKeys.length * RECORD_SIZE);
            rec.facingOwnerKeys.forEach((ok, i) => {
                const scAt = placed.get(SCRIPT_PREFIX + ok);
                const ptr = scAt !== undefined ? ctx.pointer(scAt) : 0;
                bytes[4 * i] = ptr & 0xFF; bytes[4 * i + 1] = (ptr >> 8) & 0xFF; bytes[4 * i + 2] = (ptr >> 16) & 0xFF;
                bytes[4 * i + 3] = i === 0 ? rec.flags : 0;
            });
            writes.push({ at: recAt, bytes, file: rec.file });
        }
        const tableAt = placed.get(TABLE);
        if (tableAt !== undefined) {
            const tableBytes = new Uint8Array(2 * st.animateEntries.length);
            st.animateEntries.forEach(([, target], id) => {
                if (target === null) return;
                const h = target.indexOf('#'), anim = h < 0 ? target : target.slice(0, h), facing = h < 0 ? undefined : target.slice(h + 1);
                const r = animationPlacedOffset(ctx, placed, anim, facing) ?? 0;
                tableBytes.set([r & 0xFF, r >> 8], 2 * id);
            });
            writes.push({ at: tableAt, bytes: tableBytes, file: ANIMATE_FILE }, ...readerWrites(ctx, ANIMATE_READERS, tableAt, ANIMATE_FILE));
        }
        return writes;
    },
};
