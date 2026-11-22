// The `collisions` kind (docs/open-evermore/resources.md §collisions): every collision word the rooms use, one file per
// word, collisions/<name>.json, its fields spelled out. A metatile names its collision (metatiles.json `collision`);
// the maps kind reads the word from the file of that name, else from the name itself, which spells the fields
// (`solid_plane1_in_front`, maps/tree-map-text.ts). So an edited file changes every metatile that names it, and a new
// combination needs no file. No bytes of its own: the words live in each room's Block 3. On a round trip each word
// keeps the tree's name for it (`symbols`); the files themselves are a vocabulary, so the round trip compares what
// the metatiles mean (maps canonical), not them.
//
// Facts used (docs/map-format/room-reference.md §9, map_collision_mechanics.md; maps/collision.ts reads them):
//   word       bits 3-0 geometry (or, with bit 13, the drift), 5-4 plane, 6 see-through, 7 never set, 11-8 the entity
//              gate, 12 drawn in front, 13 always walkable, 14 step-on cell, 15 B-trigger cell
//   where      Block 3's third slice, one word per metatile; 516 distinct words in the 127 vanilla rooms
import { createRequire } from 'node:module';
import type { Codec } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { collisionLookup, roomBlobs } from './maps.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');
const { collisionFields, collisionOfFields, collisionText, collisionWhat } = require('../../../../dist/games/evermore/maps/tree-map-text');

export const KIND = 'collisions';
const DIR = KIND, FORMAT = 'open-evermore/collision', VERSION = 1;
/** The pseudo kind whose symbols tell a round trip each word's name in the tree (`nameAt(WORD, word)`). */
export const WORD = 'collisions.word';

/** Every room's collision words (Block 3's third slice). */
function roomCollisions(rom: Uint8Array, blobs: number[]): number[][] {
    return blobs.map((at, id) => {
        const raw: Uint8Array = maps.unpackBlock(maps.modelFromRom(rom, id, at).block3), n = raw.length / 6;
        return Array.from({ length: n }, (_, k) => raw[(2 * n + k) * 2] | (raw[(2 * n + k) * 2 + 1] << 8));
    });
}

export const collisionsCodec: Codec = {
    kind: KIND, version: VERSION, path: DIR, folder: `maps/${DIR}`,

    defaultName: id => collisionText(id),
    canonical: () => null,

    explode(rom, name, _options, countOf, nameAt) {
        const blobs = roomBlobs(rom, countOf('maps'));
        const uses = new Map<number, { metatiles: number; maps: Set<string> }>();
        roomCollisions(rom, blobs).forEach((words, id) => {
            for (const w of words) {
                let u = uses.get(w);
                if (!u) uses.set(w, u = { metatiles: 0, maps: new Set() });
                u.metatiles++;
                u.maps.add(name('maps', id));
            }
        });
        // The most used first: the order means nothing to the game.
        const words = [...uses.keys()].sort((a, b) => uses.get(b)!.metatiles - uses.get(a)!.metatiles || a - b);
        const files: Tree = new Map(), named = (w: number) => nameAt(WORD, w) ?? collisionText(w);
        for (const w of words) {
            const back = collisionOfFields(collisionFields(w));
            if (back !== w) throw new Error(`collisions: word 0x${w.toString(16)} does not read back from its fields; explode would lose it`);
            files.set(`${DIR}/${named(w)}.json`, json({
                format: FORMAT, version: VERSION, ...collisionFields(w),
                what: collisionWhat(w), metatiles: uses.get(w)!.metatiles, maps: [...uses.get(w)!.maps].sort(),
            }));
        }
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: 0x10000, names: words.map(named), why: 'one name per 16-bit collision word; the order means nothing to the game' }));
        return { files, pool: [], tables: [], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^collisions\/([^/]+)\.json$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'a collision is one <name>.json; ignored'); continue; }
            names.add(m[1]);
        }
        return names;
    },

    // Checks the files; the maps kind writes their words into the rooms that name them.
    encode({ tree, findings }, names) {
        for (const n of names) {
            const file = `${DIR}/${n}.json`;
            if (!NAME_RE.test(n)) { findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: any;
            try { v = JSON.parse(readText(tree.get(file)!)); }
            catch (e) { findings.error('parse-error', file, '', (e as Error).message); continue; }
            if (v?.format !== FORMAT || v?.version !== VERSION) { findings.error('schema', file, '/format', `"${FORMAT}", version ${VERSION}`); continue; }
            const c = collisionOfFields(v);
            if (typeof c !== 'number') findings.error('invalid-value', file, c.field ? '/' + c.field : '', c.message);
        }
        return [];
    },

    // Each word's name in the tree; of several names for one word the one that spells it, else the first.
    symbols({ tree, names }) {
        const word = collisionLookup(tree), out = new Map<string, number>();
        const list = [...(names.get(KIND) ?? [])].map(n => [n, word(n)] as [string, number | undefined]).filter((e): e is [string, number] => e[1] !== undefined)
            .sort(([a, x], [b, y]) => +(a === collisionText(x)) - +(b === collisionText(y)) || (a < b ? 1 : -1));   // the chosen one last: it is set last
        for (const [n, w] of list) out.set(`${WORD}/${n}`, w);
        return out;
    },

    tables: () => [],
};
