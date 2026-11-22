// The `collisions` kind (docs/open-evermore/resources.md §collisions): the 16 collision forms, which part of a cell is
// solid, one file per form, named as the Rooms editor's Collision tab names them. A metatile names its form
// (metatiles.json `collision`, beside its level and flags); `_enum.json` gives each name its code, so renaming a form
// renames it in every room. The files hold only what the reader wants (the shape, what it does, where it is used): the
// forms are the engine's ($909DE8), their codes live in each room's Block 3, and implode writes those.
//
// Facts used (docs/map-format/map_collision_mechanics.md §5, maps/collision.ts geometryMask; the twins' tables
// $8FA3F8 / $8FA418, rooms/webview/map-editor-collision-tab.js):
//   form       bits 3-0 of a collision word while bit 13 is clear (with it they are the drift, not a form)
//   codes      16; 0x4 and 0xB are placed in no vanilla room
import { createRequire } from 'node:module';
import type { Codec } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, withoutKeys } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { roomBlobs } from './maps.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const { COLLISION_FORMS, collisionFormWhat } = require('../../../../dist/games/evermore/maps/tree-map-text');

export const KIND = 'collisions';
const DIR = KIND, FORMAT = 'open-evermore/collision', VERSION = 1, COUNT = 16;
/** What explode writes for the reader; implode reads none of it. */
const DERIVED = ['what', 'shape', 'metatiles', 'maps'];

/** Every room's collision words (Block 3's third slice). */
function roomCollisions(rom: Uint8Array, blobs: number[]): number[][] {
    return blobs.map((at, id) => {
        const raw: Uint8Array = maps.unpackBlock(maps.modelFromRom(rom, id, at).block3), n = raw.length / 6;
        return Array.from({ length: n }, (_, k) => raw[(2 * n + k) * 2] | (raw[(2 * n + k) * 2 + 1] << 8));
    });
}

/** A form's 16×16 solid pixels as rows, `#` solid. */
const shape = (code: number): string[] => {
    const mask: Uint8Array = maps.geometryMask(code);
    return Array.from({ length: 16 }, (_, y) => Array.from(mask.subarray(y * 16, y * 16 + 16), v => v ? '#' : '.').join(''));
};

export const collisionsCodec: Codec = {
    kind: KIND, version: VERSION, path: DIR, folder: `maps/${DIR}`,

    defaultName: code => COLLISION_FORMS[code] ?? `form_${code.toString(16)}`,
    canonical: (path, bytes) => [path, withoutKeys(path, bytes, DERIVED)],

    explode(rom, name, _options, countOf) {
        const uses = Array.from({ length: COUNT }, () => ({ metatiles: 0, maps: new Set<string>() }));
        roomCollisions(rom, roomBlobs(rom, countOf('maps'))).forEach((words, id) => {
            for (const w of words) if (!(w & 0x2000)) { uses[w & 15].metatiles++; uses[w & 15].maps.add(name('maps', id)); }
        });
        const files: Tree = new Map(), names = Array.from({ length: COUNT }, (_, code) => name(KIND, code));
        names.forEach((n, code) => files.set(`${DIR}/${n}.json`, json({
            format: FORMAT, version: VERSION, what: collisionFormWhat(code), shape: shape(code),
            metatiles: uses[code].metatiles, maps: [...uses[code].maps].sort(),
        })));
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: COUNT, names, why: 'a form is bits 3-0 of a collision word: 16 codes, each the engine\'s' }));
        return { files, pool: [], tables: [], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^collisions\/([^/]+)\.json$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'a collision form is one <name>.json; ignored'); continue; }
            names.add(m[1]);
        }
        return names;
    },

    // Checks the files; the maps kind writes each form's code into the rooms that name it.
    encode({ tree, findings }, names) {
        for (const n of names) {
            const file = `${DIR}/${n}.json`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: any;
            try { v = JSON.parse(readText(tree.get(file)!)); }
            catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
            if (v?.format !== FORMAT || v?.version !== VERSION) findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}`);
        }
        return [];
    },

    tables: () => [],
};
