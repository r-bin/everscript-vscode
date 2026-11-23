// The `sprite_palettes` kind (docs/open-evermore/resources.md §sprite_palettes): the 269 16-colour sprite and icon
// palettes in bank $90 (and its $D0 mirror), $90:A7EB-$C98A (32 bytes each). Shared across characters, weapons,
// Dog forms, projectiles, HUD portraits, ring menu icons, and animation script 0x4B commands.
//
// Facts used (docs/entities/palettes.md, docs/enemies-and-palettes.md §2, knowledge routines/load_sprite_palette.md):
//   table      269 entries of 32 bytes at $90:A7EB-$C98A (file 0x10A7EB..0x10C98B); word 0 is skipped by $90:CF3A on
//              SNES OBJ slots (index 0 is transparent), preserved here losslessly
//   readers    $90:CF3A (phb/phk/plb → bank $90) and $90:CFD2 (`lda #$0090` DMA source), plus ring menu $8E:AEBC
//              (bank $D0, same HiROM bank 0x10); pinned in place until bank-$90 palette readers are hooked
import { createRequire } from 'node:module';
import type { Codec, CountOf, Item, NameAt, NameOf } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { Findings } from '../../findings.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { CHARACTERS, STRIDE as CHAR_STRIDE, characterNames, recordsAt } from './characters.mts';
import { nameRingItems } from './menus.mts';
import { PALETTE_ENTRY, PALETTE_FORMAT, PALETTE_VERSION, fromPng, hexColour, paletteStripePng, readPaletteBytes } from './palettes.mts';
import { PROJECTILE_COUNT } from './projectiles.mts';

const require = createRequire(import.meta.url);
const { animationGroups } = require('../../../../dist/games/evermore/maps/animation-table');
const { disassembleScript } = require('../../../../dist/games/evermore/maps/animation-opcodes');
const { readDogForms } = require('../../../../dist/games/evermore/sprites/dog-forms');

export const SPRITE_PALETTES = 'sprite_palettes';
export const SPRITE_PALETTE_BASE = 0xA7EB;
export const SPRITE_PALETTE_STRIDE = PALETTE_ENTRY;
export const SPRITE_PALETTE_COUNT = 269;

const DIR = SPRITE_PALETTES;
const FILE_BANK = 0x10;
const BASE_FILE = (FILE_BANK << 16) | SPRITE_PALETTE_BASE;
const ARRAY = `${DIR}/array`;
const WEAPON_RECORDS = 0x0438E6, AMMO_RECORDS = 0x043A96, WEAPON_STRIDE = 36, WEAPON_COUNT = 12, AMMO_COUNT = 3;
const PROJ_TABLE = 0x10D986, RING_POINTERS = 0x0E8000, RING_COUNT = 162, HUD_BOY_PORTRAIT = 0xAD6B;
const DOG_SLUGS = ['dog_act1', 'dog_act1_stick', 'dog_act2', 'dog_act3', 'dog_act0', 'dog_act4'];

const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

/** 16-bit bank-$90/$D0 palette address → slot index 0..268, or null if outside/misaligned. */
export function spritePaletteId(addr16: number): number | null {
    const off = addr16 - SPRITE_PALETTE_BASE;
    if (off < 0 || off % SPRITE_PALETTE_STRIDE !== 0) return null;
    const id = off / SPRITE_PALETTE_STRIDE;
    return id < SPRITE_PALETTE_COUNT ? id : null;
}

/** Slot index 0..268 → 16-bit bank-$90/$D0 palette address. */
export const spritePaletteAddr = (id: number): number => SPRITE_PALETTE_BASE + SPRITE_PALETTE_STRIDE * id;

interface SlotUsage {
    chars: string[];
    chars2: string[];
    weapons: string[];
    ammo: string[];
    dog: string[];
    projs: string[];
    rings: string[];
    hud: boolean;
    script4b: boolean;
}

interface PaletteAnalysis {
    names: string[];
    usedBy: string[][];
}

const analysisCache = new WeakMap<Uint8Array, PaletteAnalysis>();
let lastDefaultNames: string[] = [];

function analyzeSpritePalettes(
    rom: Uint8Array,
    name: NameOf,
    countOf: CountOf,
    nameAt: NameAt,
): PaletteAnalysis {
    const isRoundTrip = countOf(DIR) !== undefined;
    if (!isRoundTrip) {
        const hit = analysisCache.get(rom);
        if (hit) return hit;
    }

    const uses: SlotUsage[] = Array.from({ length: SPRITE_PALETTE_COUNT }, () => ({
        chars: [], chars2: [], weapons: [], ammo: [], dog: [], projs: [], rings: [], hud: false, script4b: false,
    }));
    const slot = (addr16: number) => spritePaletteId(addr16);

    const { records: charRecords } = characterNames(rom, name, countOf, nameAt);
    const charBase = recordsAt(rom);
    for (let c = 0; c < charRecords.length; c++) {
        const off = charBase + CHAR_STRIDE * c;
        if (off + CHAR_STRIDE > rom.length) break;
        const p1 = slot(word(rom, off + 0x09)), p2 = slot(word(rom, off + 0x0B));
        if (p1 !== null) uses[p1].chars.push(charRecords[c]);
        if (p2 !== null) uses[p2].chars2.push(charRecords[c]);
    }

    const ringItems = nameRingItems(rom);
    const ringSlug = (id: number, prefix: string) =>
        (countOf('ring_items') !== undefined ? name('ring_items', id) : ringItems[id])
            .replace(new RegExp(`^${prefix}_`), '');

    for (let k = 0; k < WEAPON_COUNT; k++) {
        const rec = WEAPON_RECORDS + WEAPON_STRIDE * k;
        const wName = ringSlug(word(rom, rec + 0x1E) / 2, 'weapon');
        const s = slot(word(rom, rec + 0x04));
        if (s !== null) uses[s].weapons.push(wName);
    }
    for (let k = 0; k < AMMO_COUNT; k++) {
        const rec = AMMO_RECORDS + WEAPON_STRIDE * k;
        const aName = ringSlug(word(rom, rec + 0x1E) / 2, 'ammo');
        const s = slot(word(rom, rec + 0x04));
        if (s !== null) uses[s].ammo.push(aName);
    }

    for (const df of readDogForms(rom) as { id: number; paletteAddr: number }[]) {
        const s = slot(df.paletteAddr);
        if (s !== null) uses[s].dog.push(DOG_SLUGS[df.id] ?? `dog_form_${df.id}`);
    }

    for (let id = 0; id < PROJECTILE_COUNT; id++) {
        const pAt = (FILE_BANK << 16) | word(rom, PROJ_TABLE + 2 * id);
        const s = slot(word(rom, pAt + 2));
        if (s !== null) {
            const pName = countOf('projectiles') !== undefined ? name('projectiles', id) : `projectile_${String(id).padStart(2, '0')}`;
            uses[s].projs.push(pName);
        }
    }

    for (let id = 0; id < RING_COUNT; id++) {
        const eAt = 0x0E0000 | word(rom, RING_POINTERS + 2 * id);
        const s = slot(word(rom, eAt + 4));
        if (s !== null) uses[s].rings.push(countOf('ring_items') !== undefined ? name('ring_items', id) : ringItems[id]);
    }

    const hudSlot = slot(HUD_BOY_PORTRAIT);
    if (hudSlot !== null) uses[hudSlot].hud = true;

    const seenScripts = new Set<number>();
    for (const g of animationGroups(rom) as { scripts: number[] }[]) {
        for (const sc of g.scripts) {
            if (!sc || seenScripts.has(sc)) continue;
            seenScripts.add(sc);
            for (const l of disassembleScript(rom, sc) as { known: boolean; bytes: number[] }[]) {
                if (l.known && (l.bytes[0] & 0x7F) === 0x4B) {
                    const s = slot(l.bytes[1] | (l.bytes[2] << 8));
                    if (s !== null) uses[s].script4b = true;
                }
            }
        }
    }

    const usedNames = new Set<string>();
    const claim = (raw: string): string => {
        const base = (NAME_RE.test(raw) ? raw : `palette_${raw.replace(/[^a-z0-9_]/g, '_')}`).slice(0, 80);
        let out = base, k = 2;
        while (usedNames.has(out)) out = `${base.slice(0, 76)}_${k++}`;
        usedNames.add(out);
        return out;
    };

    const names = uses.map((u, id) => {
        if (isRoundTrip) return name(DIR, id);
        if (u.weapons.length) return claim(`boy_${u.weapons[0]}`);
        if (u.ammo.length) return claim('boy_bazooka');
        if (u.dog.length) return claim(u.dog[0]);
        if (u.chars.length) return claim(u.chars[0] === 'boy' ? 'boy_unarmed' : u.chars[0]);
        if (u.chars2.length) return claim(`${u.chars2[0]}_alt`);
        if (u.rings.length) return claim(`ring_icon_${id.toString(16).padStart(3, '0')}`);
        if (u.projs.length) return claim(u.projs[0]);
        if (u.script4b) return claim(`effect_${id.toString(16).padStart(3, '0')}`);
        return claim(`palette_${id.toString(16).padStart(3, '0')}`);
    });

    const usedBy = uses.map(u => {
        const list: string[] = [];
        for (const c of u.chars) list.push(`character:${c}`);
        for (const c of u.chars2) list.push(`character:${c}.palette2`);
        for (const w of u.weapons) list.push(`weapon:${w}`);
        for (const a of u.ammo) list.push(`ammo:${a}`);
        for (const d of u.dog) list.push(`dog:${d}`);
        for (const p of u.projs) list.push(`projectile:${p}`);
        for (const r of u.rings) list.push(`ring_item:${r}`);
        if (u.hud) list.push('hud:boy_portrait');
        if (u.script4b) list.push('script:0x4b');
        return list;
    });

    const out = { names, usedBy };
    if (!isRoundTrip) analysisCache.set(rom, out);
    return out;
}

/** Programmatic (or round-trip enum) names for all 269 sprite palettes in $90:A7EB-$C98A. */
export function spritePaletteNames(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): string[] {
    if (countOf(DIR) !== undefined) return Array.from({ length: countOf(DIR)! }, (_, id) => name(DIR, id));
    const names = analyzeSpritePalettes(rom, name, countOf, nameAt).names;
    lastDefaultNames = names;
    return names;
}

/** 16-bit bank-$90/$D0 palette address → sprite_palettes name, or null when 0. */
export function spritePaletteName(rom: Uint8Array, addr16: number, name: NameOf, countOf: CountOf, nameAt: NameAt): string | null {
    if (!addr16) return null;
    const id = spritePaletteId(addr16);
    if (id === null) throw new Error(`sprite_palettes: $${addr16.toString(16)} lies outside $90:A7EB-$C98A (32-byte aligned)`);
    return spritePaletteNames(rom, name, countOf, nameAt)[id];
}

export const spritePalettesCodec: Codec = {
    kind: DIR,
    version: 1,
    path: DIR,
    folder: 'palettes/sprites',

    defaultName: id => lastDefaultNames[id] ?? `palette_${id.toString(16).padStart(3, '0')}`,

    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const m = /^(.*)\.(png|json)$/.exec(path);
        if (!m) return [path, bytes];
        const colours = m[2] === 'png' ? fromPng(bytes, path, new Findings())?.colours : JSON.parse(readText(bytes)).colours;
        return [m[1] + '.palette', json(colours ?? null)];
    },

    explode(rom, name, options, countOf, nameAt) {
        const format = options.format ?? 'json';
        if (format !== 'json' && format !== 'png') throw new Error(`${DIR}: format "${format}"; json or png`);
        const { names, usedBy } = analyzeSpritePalettes(rom, name, countOf, nameAt);
        lastDefaultNames = names;

        const files: Tree = new Map();
        for (let id = 0; id < names.length; id++) {
            const at = BASE_FILE + id * SPRITE_PALETTE_STRIDE;
            const bgr = Array.from({ length: 16 }, (_, c) => rom[at + c * 2] | (rom[at + c * 2 + 1] << 8));
            const n = names[id];
            if (format === 'png') {
                files.set(`${DIR}/${n}.png`, paletteStripePng(bgr));
            } else {
                const entry: Record<string, unknown> = { format: PALETTE_FORMAT, version: PALETTE_VERSION, colours: bgr.map(hexColour) };
                if (usedBy[id].length) entry.used_by = usedBy[id];
                files.set(`${DIR}/${n}.json`, json(entry));
            }
        }
        const length = names.length * SPRITE_PALETTE_STRIDE;
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: DIR,
            limit: SPRITE_PALETTE_COUNT,
            names,
            why: '269 sprite & icon palettes at $90:A7EB-$C98A (32 bytes each, loaded by $90:CF3A / $90:CFD2 and $8E:AEBC)',
        }));
        return {
            files,
            pool: [{ start: BASE_FILE, end: BASE_FILE + length }],
            tables: [],
            homes: [{ key: ARRAY, at: BASE_FILE, length, sha1: sha1(rom.subarray(BASE_FILE, BASE_FILE + length)) }],
        };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^sprite_palettes\/([^/]+)\.(json|png)$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'a sprite palette is one <name>.json or <name>.png; ignored'); continue; }
            if (names.has(m[1])) findings.error('duplicate-name', path, '', `"${m[1]}" is both a .json and a .png; keep one`);
            names.add(m[1]);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const ids = ctx.ids.get(DIR);
        if (!ids) return [];
        const count = Math.max(0, ...ids.values()) + 1;
        if (count !== SPRITE_PALETTE_COUNT) findings.error('invalid-value', `${DIR}/${ENUM}`, '/names', `all ${SPRITE_PALETTE_COUNT} sprite palettes stay in $90:A7EB-$C98A`);
        const bytes = new Uint8Array(count * SPRITE_PALETTE_STRIDE);
        const ok = new Set<number>();
        for (const n of names) {
            const file = `${DIR}/${n}.${tree.has(`${DIR}/${n}.png`) ? 'png' : 'json'}`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            const bgrBytes = readPaletteBytes(tree, DIR, n, findings);
            if (!bgrBytes) continue;
            const id = ids.get(n);
            if (id === undefined) continue;
            bytes.set(bgrBytes, id * SPRITE_PALETTE_STRIDE);
            ok.add(id);
        }
        for (let id = 0; id < count; id++) {
            if (!ok.has(id) && ![...ids.values()].includes(id)) findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no sprite palette has id ${id}; the array cannot skip one`);
        }
        if (bytes.length > SPRITE_PALETTE_COUNT * SPRITE_PALETTE_STRIDE) return [];
        return [{
            key: ARRAY,
            file: `${DIR}/${ENUM}`,
            bytes,
            rule: { above: BASE_FILE, below: BASE_FILE + bytes.length, bankOffset: SPRITE_PALETTE_BASE },
        }] satisfies Item[];
    },

    tables() {
        return [];
    },
};
