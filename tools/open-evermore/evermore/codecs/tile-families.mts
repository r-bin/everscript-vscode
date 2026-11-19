// The `tile_families` kind (docs/open-evermore/resources.md §tile_families): the background palettes rooms draw
// with, one file per family, reached only through the array implode writes and the two loader operands that
// point at it. A family is `<name>.json` (its 16 colours, and the maps that use it, derived) or, exploded with
// `--families png`, `<name>.png`: a 128×8 stripe of 16 solid 8×8 cells, colour 0 on the left.
//
// Facts used (docs/map-format/room-reference.md §5, tools/table-hack/tables.js map_palettes, proven moved there):
//   array      family n = 16 BGR555 colours at base + 32·n; vanilla base $9C:C322, 365 families (the highest family
//              any room names, plus one)
//   readers    the family loader $90:D05C: `adc #$C322` (file 0x10D065) and `lda #$9C` (file 0x10D079) are the only
//              ones; implode rewrites both operands with the array's new place
//   placement  upper half (the $80-$BF form), never across a bank: the 16-bit address stays in its bank; at most
//              1024 families (32 KiB from $xx:8000)
import { createRequire } from 'node:module';
import type { Codec, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { Findings } from '../../findings.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const { decodePng, encodePng } = require('../../../../dist/platform/png');
const ROOMS = 127, CELL = 8;

export const KIND = 'tile_families';
const DIR = KIND, ARRAY = `${DIR}/array`;
const ENTRY = 32, LIMIT = 1024;
const FORMAT = 'open-evermore/tile-family', VERSION = 1;
// The loader's two instructions; implode rewrites their operands, so explode reads them (vanilla: $C322, $9C).
const ADC = { at: 0x10D065, opcode: 0x69 }, LDA = { at: 0x10D079, opcode: 0xA9 };

const channels = (c: number) => [c & 31, (c >> 5) & 31, (c >> 10) & 31].map(v => v << 3);
const hexColour = (c: number) => '#' + [c & 31, (c >> 5) & 31, (c >> 10) & 31].map(v => (v << 3).toString(16).padStart(2, '0')).join('');

/** The array's file offset and family count, from the loader operands and the rooms. */
function locate(rom: Uint8Array): { start: number; count: number } {
    for (const s of [ADC, LDA]) {
        if (rom[s.at] !== s.opcode) throw new Error(`tile families: the loader at file 0x${s.at.toString(16)} is not the US 1.0 one; explode would not know the array's readers`);
    }
    let max = 0;
    for (let id = 0; id < maps.MAX_ROOMS; id++) for (const f of maps.decodeRoom(rom, id).tileFamilies) max = Math.max(max, f);
    return { start: maps.romFileOffset(rom, (rom[LDA.at + 1] << 16) | rom[ADC.at + 1] | (rom[ADC.at + 2] << 8)), count: max + 1 };
}

/** Every family's 16 colours as [r, g, b], from the ROM (the tiles kind colours its PNGs with them). */
export function familyColours(rom: Uint8Array): number[][][] {
    const { start, count } = locate(rom);
    return Array.from({ length: count }, (_, id) => Array.from({ length: 16 }, (_, c) => channels(rom[start + id * ENTRY + c * 2] | (rom[start + id * ENTRY + c * 2 + 1] << 8))));
}

/** A 128×8 stripe → `{ colours }` like a JSON family; every 8×8 cell must be one opaque colour. */
function fromPng(bytes: Uint8Array, file: string, findings: import('../../findings.mts').Findings): { colours: string[] } | null {
    let img: { width: number; height: number; rgba: Uint8Array };
    try { img = decodePng(bytes); }
    catch (e) { findings.error('parse-error', file, '', (e as Error).message); return null; }
    if (img.width !== 16 * CELL || img.height !== CELL) { findings.error('invalid-value', file, '', `${img.width}×${img.height}; a family is ${16 * CELL}×${CELL}: 16 cells of ${CELL}×${CELL}`); return null; }
    const colours: string[] = [];
    for (let c = 0; c < 16; c++) {
        const at = (x: number, y: number) => Array.from(img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
        const first = at(c * CELL, 0);
        for (let y = 0; y < CELL; y++) for (let x = c * CELL; x < c * CELL + CELL; x++) {
            if (at(x, y).some((v, i) => v !== first[i])) { findings.error('invalid-value', file, `/colours/${c}`, `cell ${c} is not one colour (pixel ${x},${y})`); return null; }
        }
        if (first[3] !== 255) { findings.error('invalid-value', file, `/colours/${c}`, `cell ${c} is transparent; colours are opaque`); return null; }
        colours.push('#' + first.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''));
    }
    return { colours };
}

export const tileFamiliesCodec: Codec = {
    kind: KIND, version: 1, path: DIR,

    defaultName: id => 'family_' + id.toString(16).padStart(3, '0'),
    canonical: (path, bytes) => {
        const m = /^(.*)\.(png|json)$/.exec(path);
        if (!m) return [path, bytes];
        const colours = m[2] === 'png' ? fromPng(bytes, path, new Findings())?.colours : JSON.parse(readText(bytes)).colours;
        return [m[1] + '.family', json(colours ?? null)];
    },

    explode(rom, name, options) {
        const format = options.format ?? 'json';
        if (format !== 'json' && format !== 'png') throw new Error(`tile families: format "${format}"; json or png`);
        const { start, count } = locate(rom);
        const users: string[][] = Array.from({ length: count }, () => []);
        for (let id = 0; id < ROOMS; id++) for (const f of new Set<number>(maps.decodeRoom(rom, id).tileFamilies)) users[f]?.push(name('maps', id));
        const files: Tree = new Map();
        const names: string[] = [];
        for (let id = 0; id < count; id++) {
            const bgr = Array.from({ length: 16 }, (_, c) => rom[start + id * ENTRY + c * 2] | (rom[start + id * ENTRY + c * 2 + 1] << 8));
            const n = name(KIND, id);
            names.push(n);
            if (format === 'png') {
                const rgba = new Uint8Array(16 * CELL * CELL * 4);
                for (let y = 0; y < CELL; y++) for (let x = 0; x < 16 * CELL; x++) rgba.set([...channels(bgr[x >> 3]), 255], (y * 16 * CELL + x) * 4);
                files.set(`${DIR}/${n}.png`, new Uint8Array(encodePng(16 * CELL, CELL, rgba)));
            } else {
                files.set(`${DIR}/${n}.json`, json({ format: FORMAT, version: VERSION, colours: bgr.map(hexColour), maps: users[id].sort() }));
            }
        }
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: LIMIT, names, why: 'family n is read at base + 32·n with a 16-bit address in one bank half: 32 KiB' }));
        const end = start + count * ENTRY;
        return {
            files,
            pool: [{ start, end }],
            tables: [{ start: ADC.at + 1, end: ADC.at + 3 }, { start: LDA.at + 1, end: LDA.at + 2 }],
            homes: [{ key: ARRAY, at: start, length: end - start, sha1: sha1(rom.subarray(start, end)) }],
        };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^tile_families\/([^/]+)\.(json|png)$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'a family is one <name>.json or <name>.png; ignored'); continue; }
            if (names.has(m[1])) findings.error('duplicate-name', path, '', `"${m[1]}" is both a .json and a .png; keep one`);
            names.add(m[1]);
        }
        return names;
    },

    encode(ctx, names) {
        const { tree, findings } = ctx;
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        const count = Math.max(0, ...ids.values()) + 1;
        const bytes = new Uint8Array(count * ENTRY);
        const ok = new Set<number>();
        for (const n of names) {
            const png = tree.has(`${DIR}/${n}.png`), file = `${DIR}/${n}.${png ? 'png' : 'json'}`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: any;
            if (png) {
                v = fromPng(tree.get(file)!, file, findings);
                if (!v) continue;
            } else {
                try { v = JSON.parse(readText(tree.get(file)!)); }
                catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
                if (v?.format !== FORMAT || v?.version !== VERSION) { findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}`); continue; }
            }
            if (!Array.isArray(v.colours) || v.colours.length !== 16) { findings.error('invalid-value', file, '/colours', 'exactly 16 colours'); continue; }
            const id = ids.get(n);
            if (id === undefined) continue;
            let good = true;
            v.colours.forEach((c: unknown, i: number) => {
                const m = typeof c === 'string' ? /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(c) : null;
                const rgb = m ? m.slice(1).map(x => parseInt(x, 16)) : null;
                if (!rgb || rgb.some(x => x & 7)) { good = false; return findings.error('invalid-value', file, `/colours/${i}`, `"${c}": #rrggbb with each channel a multiple of 8 (the SNES has 5 bits per channel)`); }
                const bgr = (rgb[0] >> 3) | ((rgb[1] >> 3) << 5) | ((rgb[2] >> 3) << 10);
                bytes.set([bgr & 0xFF, bgr >> 8], id * ENTRY + i * 2);
            });
            if (good) ok.add(id);
        }
        for (let id = 0; id < count; id++) {
            if (!ok.has(id) && ![...ids.values()].includes(id)) findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no family has id ${id}; the array cannot skip one`);
        }
        if (bytes.length > LIMIT * ENTRY) return [];
        const item: Item = { key: ARRAY, file: `${DIR}/${ENUM}`, bytes, rule: { upperHalf: true, noCrossBank: true, maxSize: LIMIT * ENTRY } };
        return [item];
    },

    tables(ctx, placed) {
        const at = placed.get(ARRAY);
        if (at === undefined) return [];
        const bus = ctx.pointer(at);
        const file = `${DIR}/${ENUM}`;
        const writes: Write[] = [
            { at: ADC.at + 1, bytes: new Uint8Array([bus & 0xFF, (bus >> 8) & 0xFF]), file },
            { at: LDA.at + 1, bytes: new Uint8Array([bus >> 16]), file },
        ];
        return writes;
    },
};
