// The `animation_groups` kind (docs/open-evermore/animations.md): all 783 animation record groups in bank $C4
// ($C4:3E3A-$5999, 1,752 four-byte records total). Each group defines a facing mode (`any` = 1, `4_way` = 4, `8_way` = 8)
// and maps each compass direction to its animation script address in banks $C7-$C9, plus derived `palettes` and `used_by`.
//
// Facts used (src/games/evermore/maps/animation-table.ts, docs/open-evermore/animations.md):
//   records   4 bytes per record [script_lo, script_mid, script_bank, flags]; head flags are $00 (1 facing),
//             $40 (4 facings: north, east, south, west via $90:815B), or $80 (8 facings: N..NW); non-head flags = $00
//   place     vanilla groups stay at their $C4 home (61 code immediates name group offsets); brand-new groups mark
//             `animations/_table` `vacate_c4` so $C4:3C92-$3E39 opens as a 424-byte pool (26 four-facing groups)
import { createRequire } from 'node:module';
import type { Codec, CountOf, ImplodeContext, Item, NameAt, NameOf } from '../../codec.mts';
import { mark } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { ANIMATION_SLOTS, CHARACTERS, STRIDE as CHAR_STRIDE, characterNames, recordsAt } from './characters.mts';
import { nameRingItems } from './menus.mts';
import { PROJECTILE_COUNT } from './projectiles.mts';
import { hexText, parseHex, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';
import { KIND as SCRIPTS, scriptLayout } from './scripts.mts';
import { SPRITE_PALETTES, spritePaletteName } from './sprite-palettes.mts';

const require = createRequire(import.meta.url);
const ENUMS: Record<string, { name: string; value: string }[]> = require('../../../../src/games/evermore/language/data/index.json').enums;
const { animationGroups } = require('../../../../dist/games/evermore/maps/animation-table');
const { disassembleScript } = require('../../../../dist/games/evermore/maps/animation-opcodes');
const { readSpriteInfo, scriptSprites } = require('../../../../dist/games/evermore/maps/sprites');
const { readDogForms } = require('../../../../dist/games/evermore/sprites/dog-forms');
const { alchemyModel } = require('../../../../dist/games/evermore/scripts-tab/model/alchemy');

export const ANIMATION_GROUPS = 'animation_groups';
export const ANIMATION_GROUP_NAME_RE = /^(?:[a-z][a-z0-9_]{0,79}\/)?[a-z][a-z0-9_]{0,79}$/;

export type FacingMode = 'any' | '4_way' | '8_way';
export const FACING_KEYS = {
    any: ['any'],
    '4_way': ['north', 'east', 'south', 'west'],
    '8_way': ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
} as const;

const DIR = ANIMATION_GROUPS;
const FORMAT = 'open-evermore/animation-group';
const C4_BASE = 0x040000, C4_END = 0x050000, RECORD_BANK = 0xC4, RECORD_SIZE = 4, LIMIT = 2048;
const WEAPON_RECORDS = 0x0438E6, AMMO_RECORDS = 0x043A96, WEAPON_STRIDE = 36, WEAPON_COUNT = 12, AMMO_COUNT = 3;
const WEAPON_SCHOOLS_TABLE = 0x0459DC, SCHOOL_NAMES = ['sword', 'axe', 'spear', 'bazooka'];
const WEAPON_SLOTS = ['stand', 'walk', 'run', 'attack_0', 'attack_1', 'attack_2', 'attack_3', 'dodge', 'knockback'];
const DOG_SLUGS = ['act1', 'act1_stick', 'act2', 'act3', 'act0', 'act4'];
const PROJ_TABLE = 0x10D986, RING_POINTERS = 0x0E8000, RING_COUNT = 162;
const ANIMATE_READERS: Reader[] = [{ at: 0x0CE13D, add: 0 }];
const WRITE_AREA: Record<number, 'save' | 'temp' | 'local'> = { 0x18: 'save', 0x1C: 'save', 0x19: 'temp', 0x1D: 'temp', 0x1A: 'local', 0x1E: 'local' };

const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const slug = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function facingModeForFlags(flags: number): FacingMode {
    if (flags & 0x80) return '8_way';
    if (flags & 0x40) return '4_way';
    return 'any';
}

export function flagsForFacingMode(mode: FacingMode): number {
    return mode === '8_way' ? 0x80 : mode === '4_way' ? 0x40 : 0x00;
}

/** Byte offset inside a group record for `facing` under `mode`, or null if invalid. */
export function facingOffset(mode: FacingMode, facing: string): number | null {
    const idx = (FACING_KEYS[mode] as readonly string[]).indexOf(facing);
    return idx < 0 ? null : idx * RECORD_SIZE;
}

/** Parse a 24-bit script address `"$BB:xxxx"` (bank $80-$FF, offset $0000-$FFFF). */
function parseScriptAddr24(v: unknown): number | null {
    if (typeof v !== 'string') return null;
    const m = /^\$([0-9a-f]{2}):([0-9a-f]{4})$/i.exec(v.trim());
    if (!m) return null;
    const bank = parseInt(m[1], 16), off = parseInt(m[2], 16);
    return bank >= 0x80 ? ((bank << 16) | off) >>> 0 : null;
}

function formatScriptAddr24(addr: number): string {
    return `$${((addr >>> 16) & 0xFF).toString(16).toUpperCase().padStart(2, '0')}:${(addr & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`;
}

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

export function stripCharPrefix(char: string, rawName: string): string {
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

export interface PaletteEntry { palette: string; source: string }
export interface GroupAnalysisEntry {
    id: number;
    record: number;
    flags: number;
    mode: FacingMode;
    scripts: number[];
    full: string;
    palettes: PaletteEntry[];
    usedBy: string[];
}
export interface AnimateIdUsage {
    scripts: string[];
    playedOn: string[];
    enumInfo?: { group: EnumGroup; name: string };
}
export interface GroupsAnalysis {
    groups: GroupAnalysisEntry[];
    byRecord16: Map<number, { group: string; facing?: string }>;
    animateUsage: Map<number, AnimateIdUsage>;
    palettesMap: Map<number, PaletteEntry[]>;
}

const analysisCache = new WeakMap<Uint8Array, Map<string, GroupsAnalysis>>();
let lastDefaultNames: string[] = [];

/** Analyze all animation groups in bank $C4, their facings, owners, event-script animate() calls, and palettes. */
export function analyzeAnimationGroups(
    rom: Uint8Array,
    name: NameOf,
    countOf: CountOf,
    nameAt: NameAt,
): GroupsAnalysis {
    const isRoundTrip = countOf(DIR) !== undefined;
    const key = `${countOf(DIR)}/${countOf(SPRITE_PALETTES)}/${countOf(CHARACTERS)}/${countOf(SCRIPTS)}/${isRoundTrip ? name(DIR, 0) : ''}`;
    let byKey = analysisCache.get(rom);
    const hit = byKey?.get(key);
    if (hit) return hit;

    const palName = (addr16: number): string | null => {
        if (!addr16) return null;
        try { return spritePaletteName(rom, addr16, name, countOf, nameAt); }
        catch { return hexText(addr16, 4); }
    };

    const { records: charRecords, enemies: charEnemies } = characterNames(rom, name, countOf, nameAt);
    const charIndexByName = new Map(charRecords.map((n, i) => [n, i]));
    const recBase = recordsAt(rom);

    // Discover placed groups: on fresh ROM walk $C4:3E3A-$5999; on round trip scan bank $C4 via nameAt().
    let rawGroups: { id: number; record: number; flags: number; scripts: number[]; roundTripName?: string }[];
    if (isRoundTrip) {
        const count = countOf(DIR)!;
        const atByName = new Map<string, number>();
        for (let off = C4_BASE; off < C4_END; off++) {
            const n = nameAt(DIR, off);
            if (n !== undefined) atByName.set(n, off);
        }
        rawGroups = [];
        for (let id = 0; id < count; id++) {
            const n = name(DIR, id);
            const at = atByName.get(n);
            if (at === undefined) throw new Error(`${DIR}: "${n}" (id ${id}) was not found in bank $C4`);
            const flags = rom[at + 3];
            const mode = facingModeForFlags(flags);
            const fCount = FACING_KEYS[mode].length;
            const scripts = Array.from({ length: fCount }, (_, i) => {
                const o = at + i * RECORD_SIZE;
                return (rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16)) >>> 0;
            });
            rawGroups.push({ id, record: at & 0xFFFF, flags, scripts, roundTripName: n });
        }
    } else {
        rawGroups = (animationGroups(rom) as { record: number; flags: number; scripts: number[] }[]).map((g, id) => ({ id, ...g }));
    }

    const headRecords = new Set(rawGroups.map(g => g.record));
    const groupByRec = new Map(rawGroups.map(g => [g.record, g]));
    const interiorMap = new Map<number, { head: typeof rawGroups[number]; facing: string }>();
    for (const g of rawGroups) {
        const keys = FACING_KEYS[facingModeForFlags(g.flags)];
        for (let i = 1; i < keys.length; i++) interiorMap.set(g.record + i * RECORD_SIZE, { head: g, facing: keys[i] });
    }
    const resolveHead = (rec16: number) => groupByRec.get(rec16) ?? interiorMap.get(rec16)?.head;

    // 1. Scan event scripts for `animate()` usage (to attribute animate_id-only groups & report script usage).
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
    } catch { /* minimal test ROMs without scripts still explode */ }

    const animateAt = (() => {
        try { return tableAt(rom, ANIMATE_READERS, 'animations'); } catch { return 0x043C92; }
    })();
    const animateCount = countOf('animations') ?? 212;
    const animateUsage = new Map<number, AnimateIdUsage>();
    const animateByHead = new Map<number, { id: number; ei?: { group: EnumGroup; name: string }; chars: string[] }[]>();
    for (let id = 0; id < animateCount; id++) {
        const rec16 = word(rom, animateAt + 2 * id);
        const ei = ENUM_BY_ID.get(id);
        const sc = [...(scriptChars.get(id) ?? [])].sort();
        const scripts = [...(scriptUses.get(id) ?? [])].sort();
        animateUsage.set(id, { scripts, playedOn: sc, enumInfo: ei });
        const head = rec16 ? resolveHead(rec16) : undefined;
        if (head) {
            let list = animateByHead.get(head.record);
            if (!list) animateByHead.set(head.record, list = []);
            list.push({ id, ei, chars: sc });
        }
    }

    // 2. Collect ALL direct ROM table owners for every group head.
    interface CharSlotUse { char: string; slot: string; pal1: number; pal2: number }
    interface WeaponUse { name: string; school: string; slot: string; pal: number; kind: 'weapon' | 'ammo' }
    interface DogUse { form: string; slot: string; pal: number }
    interface RingUse { name: string; pal: number }
    interface ProjUse { name: string; pal: number; throwers: number[] }
    interface AlchemyUse { name: string }

    const charUses = new Map<number, CharSlotUse[]>();
    const weaponUses = new Map<number, WeaponUse[]>();
    const dogUses = new Map<number, DogUse[]>();
    const ringUses = new Map<number, RingUse[]>();
    const projUses = new Map<number, ProjUse[]>();
    const alchUses = new Map<number, AlchemyUse[]>();
    const push = <T,>(m: Map<number, T[]>, k: number, v: T) => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(v); };

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
    const ringSlug = (id: number, prefix: string) =>
        (countOf('ring_items') !== undefined ? name('ring_items', id) : ringItems[id])
            .replace(new RegExp(`^${prefix}_`), '');

    for (let k = 0; k < WEAPON_COUNT; k++) {
        const rec = WEAPON_RECORDS + WEAPON_STRIDE * k;
        const wSlug = ringSlug(word(rom, rec + 0x1E) / 2, 'weapon');
        const schoolId = word(rom, WEAPON_SCHOOLS_TABLE + 2 * (k + 1)) / 2;
        const school = SCHOOL_NAMES[schoolId] ?? `school_${schoolId}`;
        const pal = word(rom, rec + 0x04);
        WEAPON_SLOTS.forEach((slot, s) => {
            const rec16 = word(rom, rec + 0x08 + 2 * s);
            if (rec16) push(weaponUses, rec16, { name: wSlug, school, slot, pal, kind: 'weapon' });
        });
        for (const [slot, off] of [['unknown_1a', 0x1A], ['unknown_1c', 0x1C]] as const) {
            const rec16 = word(rom, rec + off);
            if (rec16) push(weaponUses, rec16, { name: wSlug, school, slot, pal, kind: 'weapon' });
        }
    }
    for (let k = 0; k < AMMO_COUNT; k++) {
        const rec = AMMO_RECORDS + WEAPON_STRIDE * k;
        const aSlug = ringSlug(word(rom, rec + 0x1E) / 2, 'ammo');
        const pal = word(rom, rec + 0x04);
        WEAPON_SLOTS.forEach((slot, s) => {
            const rec16 = word(rom, rec + 0x08 + 2 * s);
            if (rec16) push(weaponUses, rec16, { name: aSlug, school: 'bazooka', slot, pal, kind: 'ammo' });
        });
    }

    for (const df of readDogForms(rom) as { id: number; paletteAddr: number; anims: { animRec: number; purpose: string | null; label: string }[] }[]) {
        const form = DOG_SLUGS[df.id] ?? `form_${df.id}`;
        for (const a of df.anims) {
            if (!a.animRec) continue;
            const slot = a.purpose || slug(a.label);
            push(dogUses, a.animRec, { form, slot, pal: df.paletteAddr });
        }
    }

    for (let id = 0; id < RING_COUNT; id++) {
        const eAt = 0x0E0000 | word(rom, RING_POINTERS + 2 * id);
        const rec16 = word(rom, eAt + 2), pal = word(rom, eAt + 4);
        if (rec16) push(ringUses, rec16, { name: countOf('ring_items') !== undefined ? name('ring_items', id) : ringItems[id], pal });
    }

    // Track projectiles and who throws them (0x4C)
    const projThrowers = new Map<number, number[]>();
    for (const g of rawGroups) {
        for (const sc of g.scripts) {
            for (const l of disassembleScript(rom, sc) as { known: boolean; bytes: number[] }[]) {
                if (l.known && (l.bytes[0] & 0x7F) === 0x4C) {
                    const pid = l.bytes[1] | (l.bytes[2] << 8);
                    push(projThrowers, pid, g.record);
                }
            }
        }
    }
    for (let id = 0; id < PROJECTILE_COUNT; id++) {
        const pAt = 0x100000 | word(rom, PROJ_TABLE + 2 * id);
        const rec16 = word(rom, pAt), pal = word(rom, pAt + 2);
        if (rec16) {
            const pName = countOf('projectiles') !== undefined ? name('projectiles', id) : `projectile_${String(id).padStart(2, '0')}`;
            push(projUses, rec16, { name: pName, pal, throwers: projThrowers.get(2 * id) ?? [] });
        }
    }

    try {
        const alch = alchemyModel(rom) as { formulas: { name: string; records: { record: number }[] }[] };
        for (const f of alch.formulas) for (const r of f.records) push(alchUses, r.record, { name: slug(f.name) });
    } catch { /* optional */ }

    // Disassemble each group once for: script 0x4B palettes, used metasprite addresses, and secondary OAM palette bits.
    const groupScript4B = new Map<number, number[]>();
    const groupSprites = new Map<number, Set<number>>();
    const groupUsesPal2 = new Map<number, boolean>();
    const spriteToOwnedPalettes = new Map<number, Map<number, number>>();

    for (const g of rawGroups) {
        const pals4b = new Set<number>(), sprs = new Set<number>();
        let usesPal2 = false;
        for (const sc of g.scripts) {
            if (!sc) continue;
            for (const l of disassembleScript(rom, sc) as { known: boolean; bytes: number[] }[]) {
                if (l.known && (l.bytes[0] & 0x7F) === 0x4B) {
                    const p = l.bytes[1] | (l.bytes[2] << 8);
                    if (p) pals4b.add(p);
                }
            }
            for (const sp of scriptSprites(rom, sc) as number[]) {
                sprs.add(sp);
                try {
                    const info = readSpriteInfo(rom, sp) as { chunks: { palette: number }[] };
                    if (info.chunks.some(c => c.palette === 1)) usesPal2 = true;
                } catch { /* ignore */ }
            }
        }
        groupScript4B.set(g.record, [...pals4b]);
        groupSprites.set(g.record, sprs);
        groupUsesPal2.set(g.record, usesPal2);
    }

    // Track metasprite -> character/palette votes from direct owners for fallback inference.
    const spriteCharVotes = new Map<number, Map<string, number>>();
    for (const g of rawGroups) {
        const cu = charUses.get(g.record) ?? [], wu = weaponUses.get(g.record) ?? [], du = dogUses.get(g.record) ?? [];
        const votePals: number[] = [];
        const voteChars: string[] = [];
        for (const w of wu) { votePals.push(w.pal); voteChars.push('boy'); }
        for (const d of du) { votePals.push(d.pal); voteChars.push('dog'); }
        if (!wu.length && !du.length) {
            for (const c of cu) {
                if (c.pal1) votePals.push(c.pal1);
                if (cu.length <= 3) voteChars.push(c.char);
            }
        }
        for (const sp of groupSprites.get(g.record) ?? []) {
            if (votePals.length) {
                let pm = spriteToOwnedPalettes.get(sp);
                if (!pm) spriteToOwnedPalettes.set(sp, pm = new Map());
                for (const p of votePals) pm.set(p, (pm.get(p) ?? 0) + 1);
            }
            if (voteChars.length) {
                let cm = spriteCharVotes.get(sp);
                if (!cm) spriteCharVotes.set(sp, cm = new Map());
                for (const ch of voteChars) cm.set(ch, (cm.get(ch) ?? 0) + 1);
            }
        }
    }

    // Precompute which (school, slot) pairs have only one animation group across all weapons of that school.
    const schoolSlotGroups = new Map<string, Set<number>>();
    for (const [rec, wu] of weaponUses) {
        for (const w of wu) {
            const k = `${w.school}:${w.slot}`;
            let set = schoolSlotGroups.get(k);
            if (!set) schoolSlotGroups.set(k, set = new Set());
            set.add(rec);
        }
    }

    const charsByLen = [...new Set(charRecords)].filter(n => n.length >= 3).sort((a, b) => b.length - a.length);
    const matchPrefix = (ename?: string): string | null => ename ? charsByLen.find(ch => ename === ch || ename.startsWith(ch + '_')) ?? null : null;

    const inferOwnerBySprites = (rec: number): { char?: string; pal?: number; palSource?: string } => {
        const sps = groupSprites.get(rec) ?? new Set<number>();
        const charVotes = new Map<string, number>(), palVotes = new Map<number, number>();
        for (const sp of sps) {
            for (const [ch, n] of spriteCharVotes.get(sp) ?? []) charVotes.set(ch, (charVotes.get(ch) ?? 0) + n);
            for (const [p, n] of spriteToOwnedPalettes.get(sp) ?? []) palVotes.set(p, (palVotes.get(p) ?? 0) + n);
        }
        const bestChar = charVotes.size ? [...charVotes.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
        if (palVotes.size) {
            const bestPal = [...palVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
            return { char: bestChar, pal: bestPal, palSource: 'inferred:shared_sprites' };
        }
        let bestProx: { d: number; pal: number; ch?: string } | null = null;
        for (const sp of sps) {
            for (const [ownedSp, pm] of spriteToOwnedPalettes) {
                if ((ownedSp >> 16) !== (sp >> 16)) continue;
                const d = Math.abs(ownedSp - sp);
                if (d < 0x1000 && (!bestProx || d < bestProx.d)) {
                    const topPal = [...pm.entries()].sort((a, b) => b[1] - a[1])[0][0];
                    const cm = spriteCharVotes.get(ownedSp);
                    const topCh = cm?.size ? [...cm.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
                    bestProx = { d, pal: topPal, ch: topCh };
                }
            }
        }
        if (bestProx) return { char: bestChar ?? bestProx.ch, pal: bestProx.pal, palSource: 'inferred:sprite_bank_proximity' };
        return { char: bestChar };
    };

    const usedFull = new Set<string>();
    const entries: GroupAnalysisEntry[] = [];
    const palettesMap = new Map<number, PaletteEntry[]>();

    for (const g of rawGroups) {
        const cu = charUses.get(g.record) ?? [];
        const wu = weaponUses.get(g.record) ?? [];
        const du = dogUses.get(g.record) ?? [];
        const ru = ringUses.get(g.record) ?? [];
        const pu = projUses.get(g.record) ?? [];
        const au = alchUses.get(g.record) ?? [];
        const anims = animateByHead.get(g.record) ?? [];
        const pals4b = groupScript4B.get(g.record) ?? [];
        const usesPal2 = groupUsesPal2.get(g.record) ?? false;

        // Naming: deterministic, descriptive, collision-free <owner>/<local>
        let full: string;
        if (g.roundTripName !== undefined) {
            full = g.roundTripName;
        } else {
            let folder = 'misc', local = `anim_${hexText(g.record, 4).slice(1).toLowerCase()}`;
            const boyOwn = cu.find(c => c.char === 'boy');
            const dogOwn = cu.find(c => c.char === 'dog');
            const uniqueEnemyChars = [...new Set(cu.filter(c => c.char !== 'boy' && c.char !== 'dog' && c.char !== 'boy_black').map(c => c.char))];

            if (boyOwn) {
                folder = 'boy';
                local = boyOwn.slot;
            } else if (wu.length) {
                folder = 'boy';
                const schools = [...new Set(wu.map(w => w.school))];
                const w0 = wu[0];
                if (schools.length === 1 && (schoolSlotGroups.get(`${schools[0]}:${w0.slot}`)?.size ?? 99) === 1) {
                    local = `${schools[0]}_${w0.slot}`;
                } else {
                    local = `${w0.name}_${w0.slot}`;
                }
            } else if (dogOwn) {
                folder = 'dog';
                local = dogOwn.slot;
            } else if (du.length) {
                folder = 'dog';
                local = du[0].form === 'act1' ? du[0].slot : `${du[0].form}_${du[0].slot}`;
            } else if (uniqueEnemyChars.length >= 1 && uniqueEnemyChars.length <= 3) {
                folder = uniqueEnemyChars[0];
                local = cu.find(c => c.char === folder)!.slot;
            } else if (uniqueEnemyChars.length > 3) {
                folder = 'shared';
                local = cu[0].slot;
            } else if (anims.length) {
                const a0 = anims[0];
                const ei = a0.ei, sc = a0.chars;
                if (ei?.group === 'boy') folder = 'boy';
                else if (ei?.group === 'dog') folder = 'dog';
                else if (ei?.group === 'all' && sc.length > 2) folder = 'shared';
                else if (sc.length === 1) folder = sc[0];
                else if (sc.length > 1) folder = matchPrefix(ei?.name) ?? (sc.length <= 3 ? sc[0] : 'shared');
                else if (ei?.group === 'placeholder') folder = 'placeholder';
                else folder = matchPrefix(ei?.name) ?? (pals4b.length ? 'placeholder' : inferOwnerBySprites(g.record).char ?? 'placeholder');
                if (ei?.name) local = stripCharPrefix(folder, ei.name);
            } else if (ru.length) {
                folder = 'icon';
                local = ru[0].name;
            } else if (pu.length) {
                folder = 'projectile';
                local = pu[0].name;
            } else if (au.length) {
                folder = 'alchemy';
                local = au[0].name;
            } else if (cu.length) {
                // e.g. boy_black-only slot
                folder = cu[0].char;
                local = cu[0].slot;
            } else {
                const inf = inferOwnerBySprites(g.record);
                if (pals4b.length) folder = 'effect';
                else if (inf.char) folder = inf.char;
            }

            if (!NAME_RE.test(folder)) folder = 'misc';
            if (!NAME_RE.test(local)) local = `anim_${hexText(g.record, 4).slice(1).toLowerCase()}`;
            full = `${folder}/${local}`;
            let suffix = 2;
            while (usedFull.has(full)) full = `${folder}/${local.slice(0, 75)}_${suffix++}`;
            usedFull.add(full);
        }

        // Programmatic Palette Attribution (zero hardcoded exceptions)
        const palettes: PaletteEntry[] = [];
        const seenPal = new Set<string>();
        const addPal = (addr16: number, source: string) => {
            const pn = palName(addr16);
            if (!pn) return;
            const k = `${pn}@${source}`;
            if (seenPal.has(k)) return;
            seenPal.add(k);
            palettes.push({ palette: pn, source });
        };

        for (const p of pals4b) addPal(p, 'script_opcode_0x4b');
        for (const w of wu) addPal(w.pal, `${w.kind}:${w.name}`);
        for (const d of du) addPal(d.pal, `dog_form:${d.form}`);
        for (const c of cu) {
            if (c.char === 'boy' && wu.length) continue; // equipped weapon palette overrides Boy's placeholder +$09
            if (c.pal1) addPal(c.pal1, `character:${c.char}`);
            if (c.pal2 && usesPal2) addPal(c.pal2, `character:${c.char}.palette2`);
        }
        for (const r of ru) addPal(r.pal, `ring_item:${r.name}`);
        for (const p of pu) {
            if (p.pal) addPal(p.pal, `projectile:${p.name}`);
            else {
                for (const thr of p.throwers) {
                    for (const tw of weaponUses.get(thr) ?? []) addPal(tw.pal, `projectile_thrower:weapon:${tw.name}`);
                    for (const td of dogUses.get(thr) ?? []) addPal(td.pal, `projectile_thrower:dog:${td.form}`);
                    for (const tc of charUses.get(thr) ?? []) if (tc.pal1 && !(tc.char === 'boy' && (weaponUses.get(thr)?.length ?? 0))) addPal(tc.pal1, `projectile_thrower:${tc.char}`);
                }
            }
        }
        if (palettes.length === 0 && anims.length) {
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
                    else if (off + CHAR_STRIDE <= rom.length) {
                        const p1 = word(rom, off + 0x09);
                        if (p1) addPal(p1, `script_target:${ch}`);
                    }
                }
            }
        }
        if (palettes.length === 0) {
            const inf = inferOwnerBySprites(g.record);
            if (inf.pal) addPal(inf.pal, inf.palSource!);
        }
        if (palettes.length === 0) {
            let near: number | null = null;
            for (const [r] of charUses) if (near === null || Math.abs(r - g.record) < Math.abs(near - g.record)) near = r;
            if (near !== null) {
                const nc = charUses.get(near)![0];
                if (nc?.pal1) addPal(nc.pal1, `inferred:nearest_record_${hexText(near, 4)}`);
            }
        }

        // Build clean used_by list
        const usedBySet = new Set<string>();
        for (const c of cu) usedBySet.add(`character:${c.char}.${c.slot}`);
        for (const w of wu) usedBySet.add(`${w.kind}:${w.name}.${w.slot}`);
        for (const d of du) usedBySet.add(`dog_form:${d.form}.${d.slot}`);
        for (const a of anims) usedBySet.add(`animate_id:${a.ei ? a.ei.name : a.id}`);
        for (const r of ru) usedBySet.add(`ring_item:${r.name}`);
        for (const p of pu) usedBySet.add(`projectile:${p.name}`);
        for (const a of au) usedBySet.add(`alchemy:${a.name}`);

        const entry: GroupAnalysisEntry = {
            id: g.id,
            record: g.record,
            flags: g.flags,
            mode: facingModeForFlags(g.flags),
            scripts: g.scripts,
            full,
            palettes,
            usedBy: [...usedBySet],
        };
        entries.push(entry);
        palettesMap.set(g.record, palettes);
    }

    const byRecord16 = new Map<number, { group: string; facing?: string }>();
    for (const e of entries) {
        byRecord16.set(e.record, { group: e.full });
        const keys = FACING_KEYS[e.mode];
        for (let i = 1; i < keys.length; i++) byRecord16.set(e.record + i * RECORD_SIZE, { group: e.full, facing: keys[i] });
    }
    if (!isRoundTrip) lastDefaultNames = entries.map(e => e.full);

    const out: GroupsAnalysis = { groups: entries, byRecord16, animateUsage, palettesMap };
    if (!byKey) analysisCache.set(rom, byKey = new Map());
    byKey.set(key, out);
    return out;
}

/** Resolve a 16-bit bank-$C4 record offset to its animation group name (and optional interior facing). */
export function animationGroupRef(
    rom: Uint8Array,
    rec16: number,
    name: NameOf,
    countOf: CountOf,
    nameAt: NameAt,
): { group: string; facing?: string } | null {
    if (!rec16) return null;
    if (countOf(DIR) !== undefined) {
        const direct = nameAt(DIR, C4_BASE | rec16);
        if (direct !== undefined) return { group: direct };
        for (let i = 1; i < 8; i++) {
            const headOff = C4_BASE | (rec16 - i * RECORD_SIZE);
            const headName = nameAt(DIR, headOff);
            if (headName !== undefined) {
                const mode = facingModeForFlags(rom[headOff + 3]);
                const keys = FACING_KEYS[mode];
                if (i < keys.length) return { group: headName, facing: keys[i] };
            }
        }
        return null;
    }
    return analyzeAnimationGroups(rom, name, countOf, nameAt).byRecord16.get(rec16) ?? null;
}

/** Initial (vanilla home) 16-bit offset in bank $C4 for `groupName`, or null for brand-new groups. */
export function animationGroupInitialOffset(ctx: ImplodeContext, groupName: string): number | null {
    const own = ctx.base.homes.get(`${DIR}/${groupName}`);
    if (own) return own.at & 0xFFFF;
    const id = ctx.ids.get(DIR)?.get(groupName);
    if (id === undefined) return null;
    const vanillaHomes = [...ctx.base.homes].filter(([k]) => k.startsWith(`${DIR}/`)).sort((a, b) => a[1].at - b[1].at);
    const home = vanillaHomes[id]?.[1];
    return home && !ctx.names.get(DIR)?.has(vanillaHomes[id][0].slice(DIR.length + 1)) ? (home.at & 0xFFFF) : null;
}

/** Resolve a group name (+ optional interior facing) to a placed 16-bit offset in bank $C4. */
export function animationGroupPlacedOffset(ctx: ImplodeContext, placed: Map<string, number>, groupName: string, facing?: string): number | null {
    const at = placed.get(`${DIR}/${groupName}`);
    if (at === undefined) return null;
    if (!facing) return at & 0xFFFF;
    try {
        const v = JSON.parse(readText(ctx.tree.get(`${DIR}/${groupName}.json`)!));
        const off = facingOffset(v.facing_mode, facing);
        return off === null ? null : (at & 0xFFFF) + off;
    } catch {
        return null;
    }
}

export const animationGroupsCodec: Codec = {
    kind: DIR,
    version: 1,
    path: DIR,
    folder: 'animations/groups',
    nameRe: ANIMATION_GROUP_NAME_RE,

    defaultName: id => lastDefaultNames[id] ?? `group_${id.toString(16).padStart(3, '0')}`,

    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        return [path, json({ format: v.format, version: v.version, facing_mode: v.facing_mode, facings: v.facings })];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const { groups } = analyzeAnimationGroups(rom, name, countOf, nameAt);
        const files: Tree = new Map(), pool = [], homes = [];
        const names = groups.map(g => g.full);
        for (const g of groups) {
            const keys = FACING_KEYS[g.mode];
            const facings: Record<string, string> = {};
            keys.forEach((k, i) => { facings[k] = formatScriptAddr24(g.scripts[i]); });
            const doc: Record<string, unknown> = {
                format: FORMAT,
                version: 1,
                facing_mode: g.mode,
                facings,
            };
            if (g.palettes.length) doc.palettes = g.palettes;
            if (g.usedBy.length) doc.used_by = g.usedBy;
            files.set(`${DIR}/${g.full}.json`, json(doc));

            const at = C4_BASE | g.record, length = keys.length * RECORD_SIZE;
            pool.push({ start: at, end: at + length });
            homes.push({ key: `${DIR}/${g.full}`, at, length, sha1: sha1(rom.subarray(at, at + length)) });
        }
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: DIR,
            limit: LIMIT,
            names,
            why: 'animation record groups in bank $C4 ($C4:3E3A-$5999): 1, 4 or 8 four-byte records per group; new groups land in $C4:3C92-$3E39 once animations/_table moves',
        }));
        return { files, pool, tables: [], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^animation_groups\/((?:[^/_][^/]*\/)?[^/_][^/]*)\.json$/.exec(path);
            if (m) names.add(m[1]);
            else findings.warning('unknown-file', path, '', 'an animation group is <name>.json or <character>/<name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [];
        const vanillaHomes = [...ctx.base.homes].filter(([k]) => k.startsWith(`${DIR}/`)).sort((a, b) => a[1].at - b[1].at);
        const homeOf = (n: string) => {
            const own = ctx.base.homes.get(`${DIR}/${n}`);
            if (own) return own;
            const id = ctx.ids.get(DIR)?.get(n);
            if (id === undefined || !vanillaHomes[id]) return undefined;
            return names.has(vanillaHomes[id][0].slice(DIR.length + 1)) ? undefined : vanillaHomes[id][1];
        };

        for (const n of names) {
            const path = `${DIR}/${n}.json`, key = `${DIR}/${n}`;
            if (!ANIMATION_GROUP_NAME_RE.test(n)) {
                ctx.findings.error('bad-name', path, '', `"${n}": snake_case (or <character>/<name>), at most 80 characters each`);
                continue;
            }
            let v: any;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); }
            catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (v?.format !== FORMAT || v?.version !== 1) {
                ctx.findings.error('schema', path, '/format', `"${FORMAT}", version 1`);
                continue;
            }
            const mode = v.facing_mode as FacingMode;
            if (mode !== 'any' && mode !== '4_way' && mode !== '8_way') {
                ctx.findings.error('invalid-value', path, '/facing_mode', '"any", "4_way", or "8_way"');
                continue;
            }
            const keys = FACING_KEYS[mode];
            const bytes = new Uint8Array(keys.length * RECORD_SIZE);
            let ok = true;
            keys.forEach((f, i) => {
                const addr = parseScriptAddr24(v.facings?.[f]);
                if (addr === null) {
                    ctx.findings.error('invalid-value', path, `/facings/${f}`, '"$BB:xxxx": a 24-bit script address (bank $80-$FF)');
                    ok = false;
                    return;
                }
                const off = i * RECORD_SIZE;
                bytes[off] = addr & 0xFF;
                bytes[off + 1] = (addr >> 8) & 0xFF;
                bytes[off + 2] = (addr >> 16) & 0xFF;
                bytes[off + 3] = i === 0 ? flagsForFacingMode(mode) : 0;
            });
            if (!ok) continue;

            const home = homeOf(n);
            if (home) {
                if (bytes.length !== home.length) {
                    ctx.findings.error('invalid-value', path, '/facing_mode', `${bytes.length} bytes; vanilla group stays ${home.length} bytes at its $C4 offset (61 code immediates name record groups) — add a new file for a different facing count`);
                    continue;
                }
                items.push({ key, file: path, bytes, rule: { above: home.at, below: home.at + home.length, bankOffset: home.at & 0xFFFF } });
            } else {
                // Brand-new group: vacate $C4:3C92 (animate_ids table) so it fits inside bank $C4.
                mark(ctx, 'animations/_table', 'vacate_c4');
                items.push({ key, file: path, bytes, rule: { above: C4_BASE, below: C4_END, noCrossBank: true } });
            }
        }
        return items;
    },

    tables() {
        return [];
    },
};
