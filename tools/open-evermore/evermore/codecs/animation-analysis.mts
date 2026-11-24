// Shared analysis for animations: discovers all $C4 record groups (1, 4, or 8 facings), attributes owner names,
// computes programmatic sprite palettes and cross-references, and maps the $C4:3C92 animate() id table to targets.
import { createRequire } from 'node:module';
import type { CountOf, ImplodeContext, NameAt, NameOf } from '../../codec.mts';
import { NAME_RE, readText } from '../../tree.mts';
import { ANIMATION_SLOTS, CHARACTERS, STRIDE as CHAR_STRIDE, characterNames, recordsAt } from './characters.mts';
import { nameRingItems } from './menus.mts';
import { hexText, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';
import { KIND as SCRIPTS, scriptLayout } from './scripts.mts';
import { SPRITE_PALETTES, spritePaletteName } from './sprite-palettes.mts';

const require = createRequire(import.meta.url);
const ENUMS: Record<string, { name: string; value: string }[]> = require('../../../../src/games/evermore/language/data/index.json').enums;
const { animationGroups } = require('../../../../dist/games/evermore/maps/animation-table');
const { disassembleScript } = require('../../../../dist/games/evermore/maps/animation-opcodes');
const { runAnimation } = require('../../../../dist/games/evermore/maps/animation-vm');
const { facingScript } = require('../../../../dist/games/evermore/maps/animation-table');
const { readSpriteInfo, scriptSprites } = require('../../../../dist/games/evermore/maps/sprites');
const { readDogForms } = require('../../../../dist/games/evermore/sprites/dog-forms');
const { alchemyModel } = require('../../../../dist/games/evermore/scripts-tab/model/alchemy');

export const ANIMATIONS = 'animations';
export const ANIMATION_NAME_RE = /^(?:[a-z][a-z0-9_]{0,79}\/)?[a-z][a-z0-9_]{0,79}$/;
export const ANIMATE_LIMIT = 2048;
export const ANIMATE_READERS: Reader[] = [{ at: 0x0CE13D, add: 0 }];
export const C4_BASE = 0x040000, C4_END = 0x050000, RECORD_SIZE = 4;

export type FacingMode = 'any' | '4_way' | '8_way';
export const FACING_KEYS = {
    any: ['any'],
    '4_way': ['north', 'east', 'south', 'west'],
    '8_way': ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
} as const;

const WEAPON_RECORDS = 0x0438E6, AMMO_RECORDS = 0x043A96, WEAPON_STRIDE = 36, WEAPON_COUNT = 12, AMMO_COUNT = 3;
const WEAPON_SCHOOLS_TABLE = 0x0459DC, SCHOOL_NAMES = ['sword', 'axe', 'spear', 'bazooka'];
const WEAPON_SLOTS = ['stand', 'walk', 'run', 'attack_0', 'attack_1', 'attack_2', 'attack_3', 'dodge', 'knockback'];
const DOG_SLUGS = ['act1', 'act1_stick', 'act2', 'act3', 'act0', 'act4'];
const PROJ_TABLE = 0x10D986, PROJ_SCRIPT_COUNT = 16, PROJ_ALL_COUNT = 21, PROJ_FIRST = 0xD9A6, PROJ_STRIDE = 24;
const RING_POINTERS = 0x0E8000, RING_COUNT = 162;
const WRITE_AREA: Record<number, 'save' | 'temp' | 'local'> = { 0x18: 'save', 0x1C: 'save', 0x19: 'temp', 0x1D: 'temp', 0x1A: 'local', 0x1E: 'local' };

const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const slug = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const push = <T,>(m: Map<number, T[]>, k: number, v: T) => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(v); };

export const facingModeForFlags = (flags: number): FacingMode => (flags & 0x80) ? '8_way' : (flags & 0x40) ? '4_way' : 'any';
export const flagsForFacingMode = (mode: FacingMode): number => mode === '8_way' ? 0x80 : mode === '4_way' ? 0x40 : 0x00;
export const facingOffset = (mode: FacingMode, facing: string): number | null => {
    const idx = (FACING_KEYS[mode] as readonly string[]).indexOf(facing);
    return idx < 0 ? null : idx * RECORD_SIZE;
};

export type EnumGroup = 'boy' | 'dog' | 'enemy' | 'all' | 'placeholder';
export const ENUM_BY_ID = new Map<number, { group: EnumGroup; name: string }>();
for (const [list, group] of [['ANIMATION_BOY', 'boy'], ['ANIMATION_DOG', 'dog'], ['ANIMATION_ENEMY', 'enemy'], ['ANIMATION_ALL', 'all'], ['ANIMATION_PLACEHOLDER', 'placeholder']] as const) {
    for (const e of ENUMS[list] ?? []) {
        const raw = String(e.value ?? '');
        if (!raw.startsWith('0x')) continue;
        const v = parseInt(raw, 16), n = e.name.toLowerCase();
        if (v < 0x8000 && !(v & 1) && NAME_RE.test(n) && !ENUM_BY_ID.has(v / 2)) ENUM_BY_ID.set(v / 2, { group, name: n });
    }
}

export function stripCharPrefix(char: string, rawName: string): string {
    const prefixes = [`${char}_`], split = char.split('_');
    if (split.length === 2) prefixes.push(`${split[1]}_${split[0]}_`);
    for (const p of prefixes) {
        if (rawName.startsWith(p)) {
            const rest = rawName.slice(p.length);
            if (NAME_RE.test(rest)) return rest;
        }
    }
    return rawName;
}

export interface PaletteEntry { palette: string; source: string }
export interface AnimationAnalysisEntry {
    id: number; record: number; flags: number; mode: FacingMode; scripts: number[];
    full: string; palettes: PaletteEntry[]; usedBy: string[];
}
export interface AnimateTableEntry {
    id: number; key: string; record: number; target: string | null; facing?: string;
}
export interface AnimationAnalysis {
    groups: AnimationAnalysisEntry[];
    animateEntries: AnimateTableEntry[];
    byRecord16: Map<number, { animation: string; facing?: string }>;
}

const analysisCache = new WeakMap<Uint8Array, Map<string, AnimationAnalysis>>();
let lastDefaultNames: string[] = [];
export const defaultAnimationName = (id: number): string => lastDefaultNames[id] ?? `animation_${id.toString(16).padStart(3, '0')}`;

function entityTerm(op: any): { kind: 'char'; name: string } | { kind: 'last_entity' } | { kind: 'var'; key: string } | null {
    const t = op?.expr?.terms?.length === 1 ? op.expr.terms[0] : null;
    if (!t) return null;
    if (t.subOp === 0x50) return { kind: 'char', name: 'boy' };
    if (t.subOp === 0x51) return { kind: 'char', name: 'dog' };
    if (t.subOp === 0x2D) return { kind: 'last_entity' };
    return t.spec?.kind === 'read' && t.spec.area ? { kind: 'var', key: `${t.spec.area}:${t.value}` } : null;
}

function collectScriptUses(rom: Uint8Array, charEnemies: (string | null)[], name: NameOf, countOf: CountOf, nameAt: NameAt) {
    const scriptChars = new Map<number, Set<string>>(), scriptUses = new Map<number, Set<string>>();
    try {
        const L = scriptLayout(rom, name, countOf, nameAt);
        const scopeOf = (s: string) => s.includes('/') ? s.slice(0, s.indexOf('/')) : s;
        const roomVars = new Map<string, Map<string, Set<string>>>();
        const spawned = (i: any) => {
            const v = i.operands[0]?.value;
            if (i.opcode === 0xBA || i.opcode === 0xC2) return charEnemies[v] ?? null;
            return (i.opcode === 0x3C || i.opcode === 0xA2) && v !== undefined && !(v & 1) ? charEnemies[v / 2] ?? null : null;
        };
        for (const s of L.scripts) {
            const rmap = roomVars.get(scopeOf(s.name)) ?? roomVars.set(scopeOf(s.name), new Map()).get(scopeOf(s.name))!;
            let lastSpawn: string | null = null;
            for (const i of [...s.ins.values()].sort((a: any, b: any) => a.address - b.address)) {
                lastSpawn = spawned(i) ?? lastSpawn;
                const area = WRITE_AREA[i.opcode];
                if (area && area !== 'local' && lastSpawn && entityTerm(i.operands[1])?.kind === 'last_entity') {
                    const k = `${area}:${i.operands[0].value}`;
                    rmap.set(k, (rmap.get(k) ?? new Set()).add(lastSpawn));
                }
            }
        }
        for (const s of L.scripts) {
            const rmap = roomVars.get(scopeOf(s.name)), localVar = new Map<string, string>();
            let lastSpawn: string | null = null;
            for (const i of [...s.ins.values()].sort((a: any, b: any) => a.address - b.address)) {
                lastSpawn = spawned(i) ?? lastSpawn;
                const area = WRITE_AREA[i.opcode];
                if (area && lastSpawn && entityTerm(i.operands[1])?.kind === 'last_entity') localVar.set(`${area}:${i.operands[0].value}`, lastSpawn);
                if (i.opcode !== 0x78 && i.opcode !== 0x79) continue;
                const v = i.operands[1]?.value;
                if (v === undefined || v >= 0x8000 || (v & 1)) continue;
                const id = v / 2, et = entityTerm(i.operands[0]);
                (scriptUses.get(id) ?? scriptUses.set(id, new Set()).get(id)!).add(s.name);
                const sc = scriptChars.get(id) ?? scriptChars.set(id, new Set()).get(id)!;
                if (et?.kind === 'char') sc.add(et.name);
                else if (et?.kind === 'last_entity' && lastSpawn) sc.add(lastSpawn);
                else if (et?.kind === 'var') {
                    if (localVar.has(et.key)) sc.add(localVar.get(et.key)!);
                    else for (const x of rmap?.get(et.key) ?? []) sc.add(x);
                }
            }
        }
    } catch { /* minimal test ROMs without scripts still explode */ }
    return { scriptChars, scriptUses };
}

/** Analyze all $C4 animation record groups and the $C4:3C92 animate() id table. */
export function analyzeAnimations(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): AnimationAnalysis {
    const isRoundTrip = countOf(ANIMATIONS) !== undefined;
    const key = `${countOf(ANIMATIONS)}/${countOf(SPRITE_PALETTES)}/${countOf(CHARACTERS)}/${countOf(SCRIPTS)}/${countOf(ANIMATIONS) ? name(ANIMATIONS, 0) : ''}`;
    const hit = analysisCache.get(rom)?.get(key);
    if (hit) return hit;

    // Discover placed groups: on round trip scan bank $C4 via nameAt() and skip $C4 script disassembly.
    if (isRoundTrip) {
        const entries: AnimationAnalysisEntry[] = [];
        const byRecord16 = new Map<number, { animation: string; facing?: string }>();
        for (let off = C4_BASE; off < C4_END; off++) {
            const n = nameAt(ANIMATIONS, off);
            if (n === undefined || n === '_table') continue;
            const flags = rom[off + 3], mode = facingModeForFlags(flags), keys = FACING_KEYS[mode];
            const scripts = Array.from({ length: keys.length }, (_, i) => {
                const o = off + i * RECORD_SIZE;
                return (rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16)) >>> 0;
            });
            const record = off & 0xFFFF;
            entries.push({ id: entries.length, record, flags, mode, scripts, full: n, palettes: [], usedBy: [] });
            byRecord16.set(record, { animation: n });
            for (let i = 1; i < keys.length; i++) byRecord16.set(record + i * RECORD_SIZE, { animation: n, facing: keys[i] });
        }
        const animateAt = (() => { try { return tableAt(rom, ANIMATE_READERS, ANIMATIONS); } catch { return 0x043C92; } })();
        const animateCount = countOf(ANIMATIONS)!;
        const animateEntries: AnimateTableEntry[] = [];
        for (let id = 0; id < animateCount; id++) {
            const rec = word(rom, animateAt + 2 * id), ref = rec ? byRecord16.get(rec) : undefined;
            animateEntries.push({ id, key: name(ANIMATIONS, id), record: rec, target: ref ? ref.animation : null, ...(ref?.facing ? { facing: ref.facing } : {}) });
        }
        const out: AnimationAnalysis = { groups: entries, animateEntries, byRecord16 };
        let byKey = analysisCache.get(rom);
        if (!byKey) analysisCache.set(rom, byKey = new Map());
        byKey.set(key, out);
        return out;
    }

    const palName = (addr16: number): string | null => {
        if (!addr16) return null;
        try { return spritePaletteName(rom, addr16, name, countOf, nameAt); } catch { return hexText(addr16, 4); }
    };
    const { records: charRecords, enemies: charEnemies } = characterNames(rom, name, countOf, nameAt);
    const charIndexByName = new Map(charRecords.map((n, i) => [n, i]));
    const recBase = recordsAt(rom);

    const rawGroups = (animationGroups(rom) as { record: number; flags: number; scripts: number[] }[]).map((g, id) => ({ id, ...g }));

    const groupByRec = new Map(rawGroups.map(g => [g.record, g]));
    const interiorMap = new Map<number, { head: typeof rawGroups[number]; facing: string }>();
    for (const g of rawGroups) {
        const keys = FACING_KEYS[facingModeForFlags(g.flags)];
        for (let i = 1; i < keys.length; i++) interiorMap.set(g.record + i * RECORD_SIZE, { head: g, facing: keys[i] });
    }
    const resolveHead = (rec16: number) => groupByRec.get(rec16) ?? interiorMap.get(rec16)?.head;

    // Collect direct owners for every group head.
    interface CharSlotUse { char: string; slot: string; pal1: number; pal2: number }
    interface WeaponUse { name: string; school: string; slot: string; pal: number; kind: 'weapon' | 'ammo' }
    interface DogUse { form: string; slot: string; pal: number }
    const charUses = new Map<number, CharSlotUse[]>(), weaponUses = new Map<number, WeaponUse[]>(), dogUses = new Map<number, DogUse[]>();
    const ringUses = new Map<number, { name: string; pal: number }[]>(), projUses = new Map<number, { name: string; pal: number; throwers: number[] }[]>(), alchUses = new Map<number, { name: string }[]>();

    for (let c = 0; c < charRecords.length; c++) {
        const off = recBase + CHAR_STRIDE * c;
        if (off + CHAR_STRIDE > rom.length) break;
        const pal1 = word(rom, off + 0x09), pal2 = word(rom, off + 0x0B);
        for (let s = 0; s < ANIMATION_SLOTS.length; s++) {
            const rec16 = word(rom, off + 0x32 + 2 * s);
            if (rec16) push(charUses, rec16, { char: charRecords[c], slot: ANIMATION_SLOTS[s], pal1, pal2 });
        }
    }
    const ringItems = nameRingItems(rom);
    const ringSlug = (id: number, prefix: string) => (countOf('ring_items') !== undefined ? name('ring_items', id) : ringItems[id]).replace(new RegExp(`^${prefix}_`), '');
    for (let k = 0; k < WEAPON_COUNT; k++) {
        const rec = WEAPON_RECORDS + WEAPON_STRIDE * k, wSlug = ringSlug(word(rom, rec + 0x1E) / 2, 'weapon');
        const school = SCHOOL_NAMES[word(rom, WEAPON_SCHOOLS_TABLE + 2 * (k + 1)) / 2] ?? 'sword', pal = word(rom, rec + 0x04);
        WEAPON_SLOTS.forEach((slot, s) => { const r = word(rom, rec + 0x08 + 2 * s); if (r) push(weaponUses, r, { name: wSlug, school, slot, pal, kind: 'weapon' }); });
        for (const [slot, o] of [['unknown_1a', 0x1A], ['unknown_1c', 0x1C]] as const) { const r = word(rom, rec + o); if (r) push(weaponUses, r, { name: wSlug, school, slot, pal, kind: 'weapon' }); }
    }
    for (let k = 0; k < AMMO_COUNT; k++) {
        const rec = AMMO_RECORDS + WEAPON_STRIDE * k, aSlug = ringSlug(word(rom, rec + 0x1E) / 2, 'ammo'), pal = word(rom, rec + 0x04);
        WEAPON_SLOTS.forEach((slot, s) => { const r = word(rom, rec + 0x08 + 2 * s); if (r) push(weaponUses, r, { name: aSlug, school: 'bazooka', slot, pal, kind: 'ammo' }); });
    }
    for (const df of readDogForms(rom) as { id: number; paletteAddr: number; anims: { animRec: number; purpose: string | null; label: string }[] }[]) {
        const form = DOG_SLUGS[df.id] ?? `form_${df.id}`;
        for (const a of df.anims) if (a.animRec) push(dogUses, a.animRec, { form, slot: a.purpose || slug(a.label), pal: df.paletteAddr });
    }
    for (let id = 0; id < RING_COUNT; id++) {
        const eAt = 0x0E0000 | word(rom, RING_POINTERS + 2 * id), r = word(rom, eAt + 2), pal = word(rom, eAt + 4);
        if (r) push(ringUses, r, { name: countOf('ring_items') !== undefined ? name('ring_items', id) : ringItems[id], pal });
    }
    const projThrowers = new Map<number, number[]>();
    const groupScript4B = new Map<number, number[]>(), groupSprites = new Map<number, Set<number>>(), groupUsesPal2 = new Map<number, boolean>();
    for (const g of rawGroups) {
        const pals4b = new Set<number>(), sprs = new Set<number>();
        let usesPal2 = false;
        for (const sc of g.scripts) {
            if (!sc) continue;
            for (const l of disassembleScript(rom, sc) as { known: boolean; bytes: number[] }[]) {
                if (!l.known) continue;
                const op = l.bytes[0] & 0x7F;
                if (op === 0x4B && (l.bytes[1] | (l.bytes[2] << 8))) pals4b.add(l.bytes[1] | (l.bytes[2] << 8));
                if (op === 0x4C) push(projThrowers, l.bytes[1] | (l.bytes[2] << 8), g.record);
            }
            for (const sp of scriptSprites(rom, sc) as number[]) {
                sprs.add(sp);
                try { if ((readSpriteInfo(rom, sp) as { chunks: { palette: number }[] }).chunks.some(c => c.palette === 1)) usesPal2 = true; } catch { /* ignore */ }
            }
        }
        groupScript4B.set(g.record, [...pals4b]); groupSprites.set(g.record, sprs); groupUsesPal2.set(g.record, usesPal2);
    }
    const projTable = Array.from({ length: PROJ_SCRIPT_COUNT }, (_, id) => word(rom, PROJ_TABLE + 2 * id));
    const animProjIdx = Array.from({ length: PROJ_ALL_COUNT }, (_, k) => PROJ_FIRST + PROJ_STRIDE * k).filter(a => !projTable.includes(a));
    for (let k = 0; k < PROJ_ALL_COUNT; k++) {
        const addr16 = PROJ_FIRST + PROJ_STRIDE * k, pAt = 0x100000 | addr16, r = word(rom, pAt), pal = word(rom, pAt + 2);
        if (!r) continue;
        const tid = projTable.indexOf(addr16);
        const rt = countOf('projectiles') !== undefined ? nameAt('projectiles', pAt) : undefined;
        const pName = rt ?? (tid >= 0 ? (countOf('projectiles') !== undefined ? name('projectiles', tid) : `projectile_${String(tid).padStart(2, '0')}`) : `anim_projectile_${String(animProjIdx.indexOf(addr16)).padStart(2, '0')}`);
        push(projUses, r, { name: pName, pal, throwers: projThrowers.get(addr16) ?? [] });
    }
    try { for (const f of (alchemyModel(rom) as { formulas: { name: string; records: { record: number }[] }[] }).formulas) for (const r of f.records) push(alchUses, r.record, { name: slug(f.name) }); } catch { /* optional */ }

    const spriteToOwnedPalettes = new Map<number, Map<number, number>>(), spriteCharVotes = new Map<number, Map<string, number>>();
    for (const g of rawGroups) {
        const cu = charUses.get(g.record) ?? [], wu = weaponUses.get(g.record) ?? [], du = dogUses.get(g.record) ?? [];
        const votePals = [...wu.map(w => w.pal), ...du.map(d => d.pal), ...(!wu.length && !du.length ? cu.filter(c => c.pal1).map(c => c.pal1) : [])];
        const voteChars = wu.length ? wu.map(() => 'boy') : du.length ? du.map(() => 'dog') : cu.length <= 3 ? cu.map(c => c.char) : [];
        for (const sp of groupSprites.get(g.record) ?? []) {
            if (votePals.length) { const pm = spriteToOwnedPalettes.get(sp) ?? spriteToOwnedPalettes.set(sp, new Map()).get(sp)!; for (const p of votePals) pm.set(p, (pm.get(p) ?? 0) + 1); }
            if (voteChars.length) { const cm = spriteCharVotes.get(sp) ?? spriteCharVotes.set(sp, new Map()).get(sp)!; for (const ch of voteChars) cm.set(ch, (cm.get(ch) ?? 0) + 1); }
        }
    }
    const charsByLen = [...new Set(charRecords)].filter(n => n.length >= 3).sort((a, b) => b.length - a.length);
    const matchPrefix = (ename?: string): string | null => ename ? charsByLen.find(ch => ename === ch || ename.startsWith(ch + '_')) ?? null : null;
    const inferOwnerBySprites = (rec: number): { char?: string; pal?: number; palSource?: string } => {
        const charVotes = new Map<string, number>(), palVotes = new Map<number, number>();
        for (const sp of groupSprites.get(rec) ?? []) {
            for (const [ch, n] of spriteCharVotes.get(sp) ?? []) charVotes.set(ch, (charVotes.get(ch) ?? 0) + n);
            for (const [p, n] of spriteToOwnedPalettes.get(sp) ?? []) palVotes.set(p, (palVotes.get(p) ?? 0) + n);
        }
        const bestChar = charVotes.size ? [...charVotes.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
        if (palVotes.size) return { char: bestChar, pal: [...palVotes.entries()].sort((a, b) => b[1] - a[1])[0][0], palSource: 'inferred:shared_sprites' };
        let bestProx: { d: number; pal: number; ch?: string } | null = null;
        for (const sp of groupSprites.get(rec) ?? []) {
            for (const [ownedSp, pm] of spriteToOwnedPalettes) {
                if ((ownedSp >> 16) !== (sp >> 16)) continue;
                const d = Math.abs(ownedSp - sp);
                if (d < 0x1000 && (!bestProx || d < bestProx.d)) {
                    const cm = spriteCharVotes.get(ownedSp);
                    bestProx = { d, pal: [...pm.entries()].sort((a, b) => b[1] - a[1])[0][0], ch: cm?.size ? [...cm.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined };
                }
            }
        }
        return bestProx ? { char: bestChar ?? bestProx.ch, pal: bestProx.pal, palSource: 'inferred:sprite_bank_proximity' } : { char: bestChar };
    };

    // Script animate() usage & animate_id key attribution
    const { scriptChars } = collectScriptUses(rom, charEnemies, name, countOf, nameAt);
    const animateAt = (() => { try { return tableAt(rom, ANIMATE_READERS, ANIMATIONS); } catch { return 0x043C92; } })();
    const animateCount = countOf(ANIMATIONS) ?? 212;
    const rawAnimate: { id: number; rec: number; key: string; ei?: { group: EnumGroup; name: string }; chars: string[] }[] = [];
    const animateByHead = new Map<number, typeof rawAnimate>(), usedAnimKeys = new Set<string>();
    for (let id = 0; id < animateCount; id++) {
        const rec = word(rom, animateAt + 2 * id), ei = ENUM_BY_ID.get(id), sc = [...(scriptChars.get(id) ?? [])].sort();
        const head = rec ? resolveHead(rec) : undefined;
        let animKey: string;
        if (isRoundTrip) {
            animKey = name(ANIMATIONS, id);
        } else {
            const slotChars = head ? [...new Set([
                ...(charUses.get(head.record) ?? []).map(c => c.char),
                ...(weaponUses.get(head.record) ?? []).map(() => 'boy'),
                ...(dogUses.get(head.record) ?? []).map(() => 'dog'),
            ])] : [];
            let scriptPal = 0;
            if (rec) { try { scriptPal = runAnimation(rom, facingScript(rom, rec, 8), 8).palette || 0; } catch { /* ignore */ } }
            const pref = matchPrefix(ei?.name);
            let char = 'placeholder';
            if (!rec) char = 'shared';
            else if (ei?.group === 'boy') char = 'boy';
            else if (ei?.group === 'dog') char = 'dog';
            else if (ei?.group === 'all' && (sc.length > 2 || slotChars.length > 3)) char = 'shared';
            else if (slotChars.length >= 10 && sc.length === 0 && ei?.group !== 'placeholder') char = 'shared';
            else if (sc.length === 1) char = sc[0];
            else if (sc.length > 1) char = (pref && sc.includes(pref)) ? pref : (slotChars.length === 1 && sc.includes(slotChars[0])) ? slotChars[0] : sc.length <= 3 ? sc[0] : 'shared';
            else if (slotChars.length >= 1 && slotChars.length <= 4 && ei?.group !== 'placeholder') char = (pref && slotChars.includes(pref)) ? pref : slotChars[0];
            else if (ei?.group === 'placeholder') char = slotChars.length === 1 ? slotChars[0] : 'placeholder';
            else if (pref) char = pref;
            else if (scriptPal) char = 'placeholder';
            else char = (head ? inferOwnerBySprites(head.record).char : undefined) ?? 'placeholder';
            const local = !rec ? 'none' : stripCharPrefix(char, ei?.name ?? `animation_${id.toString(16).padStart(3, '0')}`);
            animKey = `${char}/${local}`;
            let suffix = 2;
            while (usedAnimKeys.has(animKey)) animKey = `${char}/${local}_${suffix++}`;
            usedAnimKeys.add(animKey);
        }
        const entry = { id, rec, key: animKey, ei, chars: sc };
        rawAnimate.push(entry);
        if (head) push(animateByHead, head.record, entry);
    }

    const schoolSlotGroups = new Map<string, Set<number>>();
    for (const [rec, wu] of weaponUses) for (const w of wu) {
        const k = `${w.school}:${w.slot}`;
        (schoolSlotGroups.get(k) ?? schoolSlotGroups.set(k, new Set()).get(k)!).add(rec);
    }

    const usedFull = new Set<string>(), entries: AnimationAnalysisEntry[] = [];
    for (const g of rawGroups) {
        const cu = charUses.get(g.record) ?? [], wu = weaponUses.get(g.record) ?? [], du = dogUses.get(g.record) ?? [];
        const ru = ringUses.get(g.record) ?? [], pu = projUses.get(g.record) ?? [], au = alchUses.get(g.record) ?? [];
        const anims = animateByHead.get(g.record) ?? [], pals4b = groupScript4B.get(g.record) ?? [], usesPal2 = groupUsesPal2.get(g.record) ?? false;

        let folder = 'misc', local = `anim_${hexText(g.record, 4).slice(1).toLowerCase()}`;
        const boyOwn = cu.find(c => c.char === 'boy'), dogOwn = cu.find(c => c.char === 'dog');
        const enemies = [...new Set(cu.filter(c => c.char !== 'boy' && c.char !== 'dog' && c.char !== 'boy_black').map(c => c.char))];
        if (boyOwn) { folder = 'boy'; local = boyOwn.slot; }
        else if (wu.length) {
            folder = 'boy';
            const schools = new Set(wu.map(w => w.school)), w0 = wu[0];
            local = schools.size === 1 && (schoolSlotGroups.get(`${w0.school}:${w0.slot}`)?.size ?? 99) === 1 ? `${w0.school}_${w0.slot}` : `${w0.name}_${w0.slot}`;
        } else if (dogOwn) { folder = 'dog'; local = dogOwn.slot; }
        else if (du.length) { folder = 'dog'; local = du[0].form === 'act1' ? du[0].slot : `${du[0].form}_${du[0].slot}`; }
        else if (enemies.length >= 1 && enemies.length <= 3) { folder = enemies[0]; local = cu.find(c => c.char === folder)!.slot; }
        else if (enemies.length > 3) { folder = 'shared'; local = cu[0].slot; }
        else if (anims.length) {
            const a0 = anims[0], ei = a0.ei, sc = a0.chars;
            if (ei?.group === 'boy') folder = 'boy';
            else if (ei?.group === 'dog') folder = 'dog';
            else if (ei?.group === 'all' && sc.length > 2) folder = 'shared';
            else if (sc.length === 1) folder = sc[0];
            else if (sc.length > 1) folder = matchPrefix(ei?.name) ?? (sc.length <= 3 ? sc[0] : 'shared');
            else if (ei?.group === 'placeholder') folder = 'placeholder';
            else folder = matchPrefix(ei?.name) ?? (pals4b.length ? 'placeholder' : inferOwnerBySprites(g.record).char ?? 'placeholder');
            if (ei?.name) local = stripCharPrefix(folder, ei.name);
        } else if (ru.length) { folder = 'icon'; local = ru[0].name; }
        else if (pu.length) { folder = 'projectile'; local = pu[0].name; }
        else if (au.length) { folder = 'alchemy'; local = au[0].name; }
        else if (cu.length) { folder = cu[0].char; local = cu[0].slot; }
        else {
            const inf = inferOwnerBySprites(g.record);
            if (pals4b.length) folder = 'effect'; else if (inf.char) folder = inf.char;
        }
        if (!NAME_RE.test(folder) || folder === 'modes') folder = 'misc';
        if (!NAME_RE.test(local)) local = `anim_${hexText(g.record, 4).slice(1).toLowerCase()}`;
        let full = `${folder}/${local}`, suffix = 2;
        while (usedFull.has(full)) full = `${folder}/${local.slice(0, 75)}_${suffix++}`;
        usedFull.add(full);

        const palettes: PaletteEntry[] = [], seenPal = new Set<string>();
        const addPal = (addr16: number, source: string) => {
            const pn = palName(addr16);
            if (pn && !seenPal.has(`${pn}@${source}`)) { seenPal.add(`${pn}@${source}`); palettes.push({ palette: pn, source }); }
        };
        for (const p of pals4b) addPal(p, 'script_opcode_0x4b');
        for (const w of wu) addPal(w.pal, `${w.kind}:${w.name}`);
        for (const d of du) addPal(d.pal, `dog_form:${d.form}`);
        for (const c of cu) {
            if (c.char === 'boy' && wu.length) continue;
            if (c.pal1) addPal(c.pal1, `character:${c.char}`);
            if (c.pal2 && usesPal2) addPal(c.pal2, `character:${c.char}.palette2`);
        }
        for (const r of ru) addPal(r.pal, `ring_item:${r.name}`);
        for (const p of pu) {
            if (p.pal) addPal(p.pal, `projectile:${p.name}`);
            else for (const thr of p.throwers) {
                for (const tw of weaponUses.get(thr) ?? []) addPal(tw.pal, `projectile_thrower:weapon:${tw.name}`);
                for (const td of dogUses.get(thr) ?? []) addPal(td.pal, `projectile_thrower:dog:${td.form}`);
                for (const tc of charUses.get(thr) ?? []) if (tc.pal1 && !(tc.char === 'boy' && (weaponUses.get(thr)?.length ?? 0))) addPal(tc.pal1, `projectile_thrower:${tc.char}`);
            }
        }
        if (!palettes.length && anims.length) {
            for (const a of anims) {
                if (a.ei?.group === 'dog') {
                    const act = /^act(\d)_/.exec(a.ei.name);
                    const df = act ? (readDogForms(rom) as { id: number; paletteAddr: number }[]).find(f => DOG_SLUGS[f.id]?.startsWith(`act${act[1]}`)) : undefined;
                    if (df?.paletteAddr) addPal(df.paletteAddr, `dog_act:${a.ei.name}`);
                }
                for (const ch of a.chars) {
                    const idx = charIndexByName.get(ch);
                    if (idx === undefined) continue;
                    const off = recBase + CHAR_STRIDE * idx;
                    if (idx === 0) addPal(word(rom, WEAPON_RECORDS + 0x04), 'script_target:boy');
                    else if (off + CHAR_STRIDE <= rom.length) { const p1 = word(rom, off + 0x09); if (p1) addPal(p1, `script_target:${ch}`); }
                }
            }
        }
        if (!palettes.length) { const inf = inferOwnerBySprites(g.record); if (inf.pal) addPal(inf.pal, inf.palSource!); }
        if (!palettes.length) {
            let near: number | null = null;
            for (const [r] of charUses) if (near === null || Math.abs(r - g.record) < Math.abs(near - g.record)) near = r;
            const nc = near !== null ? charUses.get(near)![0] : undefined;
            if (nc?.pal1) addPal(nc.pal1, `inferred:nearest_character:${nc.char}`);
        }

        const usedBy = new Set<string>([
            ...cu.map(c => `character:${c.char}.${c.slot}`),
            ...wu.map(w => `${w.kind}:${w.name}.${w.slot}`),
            ...du.map(d => `dog_form:${d.form}.${d.slot}`),
            ...anims.map(a => `animate:${a.key}`),
            ...ru.map(r => `ring_item:${r.name}`),
            ...pu.map(p => `projectile:${p.name}`),
            ...au.map(a => `alchemy:${a.name}`),
        ]);
        entries.push({ id: g.id, record: g.record, flags: g.flags, mode: facingModeForFlags(g.flags), scripts: g.scripts, full, palettes, usedBy: [...usedBy] });
    }

    const byRecord16 = new Map<number, { animation: string; facing?: string }>();
    for (const e of entries) {
        byRecord16.set(e.record, { animation: e.full });
        const keys = FACING_KEYS[e.mode];
        for (let i = 1; i < keys.length; i++) byRecord16.set(e.record + i * RECORD_SIZE, { animation: e.full, facing: keys[i] });
    }
    const animateEntries: AnimateTableEntry[] = rawAnimate.map(a => {
        const ref = a.rec ? byRecord16.get(a.rec) : undefined;
        return { id: a.id, key: a.key, record: a.rec, target: ref ? ref.animation : null, ...(ref?.facing ? { facing: ref.facing } : {}) };
    });
    lastDefaultNames = animateEntries.map(e => e.key);

    const out: AnimationAnalysis = { groups: entries, animateEntries, byRecord16 };
    let byKey = analysisCache.get(rom);
    if (!byKey) analysisCache.set(rom, byKey = new Map());
    byKey.set(key, out);
    return out;
}

/** Resolve a 16-bit bank-$C4 record offset to its animation name (and optional interior facing). */
export function animationRef(rom: Uint8Array, rec16: number, name: NameOf, countOf: CountOf, nameAt: NameAt): { animation: string; facing?: string } | null {
    if (!rec16) return null;
    if (countOf(ANIMATIONS) !== undefined) {
        const direct = nameAt(ANIMATIONS, C4_BASE | rec16);
        if (direct !== undefined && direct !== '_table') return { animation: direct };
        for (let i = 1; i < 8; i++) {
            const off16 = rec16 - i * RECORD_SIZE;
            if (off16 < 0) break;
            const headOff = C4_BASE | off16, headName = nameAt(ANIMATIONS, headOff);
            if (headName !== undefined && headName !== '_table') {
                const keys = FACING_KEYS[facingModeForFlags(rom[headOff + 3])];
                if (i < keys.length) return { animation: headName, facing: keys[i] };
            }
        }
        return null;
    }
    return analyzeAnimations(rom, name, countOf, nameAt).byRecord16.get(rec16) ?? null;
}

/** Initial (vanilla home) 16-bit offset in bank $C4 for `animName`, or null for brand-new animations. */
export function animationInitialOffset(ctx: ImplodeContext, animName: string): number | null {
    const own = ctx.base.homes.get(`${ANIMATIONS}/${animName}`);
    if (own) return own.at & 0xFFFF;
    const vanillaHomes = [...ctx.base.homes].filter(([k]) => k.startsWith(`${ANIMATIONS}/`) && k !== `${ANIMATIONS}/_table`).sort((a, b) => a[1].at - b[1].at);
    const home = vanillaHomes[0]?.[1];
    return home && !ctx.names.get(ANIMATIONS)?.has(vanillaHomes[0][0].slice(ANIMATIONS.length + 1)) ? (home.at & 0xFFFF) : null;
}

/** Resolve an animation name (+ optional interior facing) to a placed 16-bit offset in bank $C4. */
export function animationPlacedOffset(ctx: ImplodeContext, placed: Map<string, number>, animName: string, facing?: string): number | null {
    const at = placed.get(`${ANIMATIONS}/${animName}`);
    if (at === undefined) return null;
    if (!facing) return at & 0xFFFF;
    try {
        const off = facingOffset(JSON.parse(readText(ctx.tree.get(`${ANIMATIONS}/${animName}.json`)!)).facing_mode, facing);
        return off === null ? null : (at & 0xFFFF) + off;
    } catch { return null; }
}
