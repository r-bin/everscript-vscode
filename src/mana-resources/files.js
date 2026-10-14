'use strict';
// Ownership: what each `som://rom/...` path holds. Pure: ROM bytes in, nodes out
// (no `vscode`), so tests can call it directly.
//
//   index.md, info.json             the ROM: title, map and area counts
//   maps/index.md, maps/index.json  every map: id, size, area
//   maps/<id>.png                   the map drawn as the game shows it (frame 0 of animations)
//   maps/<id>.json                  header bytes, sizes, pieces, display mode
//   areas/index.md, areas/index.json  the areas, their map ids (+ "other") and which
//                                   ids share one picture (same sets and pieces)
//   areas/<slug>.md                 an area's maps as images
// Ids in paths are hex without `$`, like soe://.

const mana = require('../mana');
const { encodePng } = require('./png');

/** @typedef {{ kind: 'dir', entries: Array<[string, 'file' | 'dir']> } | { kind: 'file', read: () => Buffer }} SomNode */

const hex = (/** @type {number} */ n) => n.toString(16);
const slug = (/** @type {string} */ name) => name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const buf = (/** @type {string} */ s) => Buffer.from(s, 'utf8');
const json = (/** @type {unknown} */ v) => buf(JSON.stringify(v, null, 2) + '\n');
/** @param {() => Buffer} read @returns {SomNode} */
const file = read => ({ kind: 'file', read });

/** @type {WeakMap<Uint8Array, ReturnType<typeof catalog>>} */
const catalogs = new WeakMap();

/** @param {Uint8Array} rom */
function catalog(rom) {
    const maps = [];
    for (let id = 0; id < mana.MAP_COUNT; id++) {
        const size = mana.mapSize(rom, id);
        if (!size) continue;
        const area = mana.areaOf(id);
        maps.push({ id, hex: hex(id), w: size.w, h: size.h, area: area ? area.name : null });
    }
    const ids = maps.map(m => m.id);
    const key = (/** @type {number} */ id) => mana.pictureKey(rom, id, mana.readHeader(rom, id).bytes);
    /** Ids grouped by the picture they draw, first appearance first. */
    const pictures = (/** @type {number[]} */ list) => {
        /** @type {Map<string, number[]>} */
        const groups = new Map();
        for (const id of list) { const k = key(id); groups.set(k, [...(groups.get(k) || []), id]); }
        return [...groups.values()];
    };
    const area = (/** @type {string} */ name, /** @type {string} */ s, /** @type {number[]} */ list) => ({ name, slug: s, maps: list, pictures: pictures(list) });
    const areas = mana.AREAS.map(a => area(a.name, slug(a.name), a.maps.filter(id => ids.includes(id))));
    areas.push(area('Other maps', 'other', mana.mapsWithoutArea(ids)));
    return { title: mana.romTitle(rom), maps, areas };
}

/** @param {Uint8Array} rom */
function getCatalog(rom) {
    let c = catalogs.get(rom);
    if (!c) { c = catalog(rom); catalogs.set(rom, c); }
    return c;
}

/** @param {Uint8Array} rom @param {number} id */
function mapJson(rom, id) {
    const m = mana.loadMap(rom, id);
    if (!m) return null;
    return {
        id, w: m.w, h: m.h, sizeB: m.sizeB,
        header: m.header.bytes,
        charSet: m.header.charSet, paletteSet: m.header.paletteSet,
        metatileSet: m.header.metatileSet, halves: [m.header.halfA, m.header.halfB],
        display: m.display,
        placed: m.placed, skipped: m.skipped,
    };
}

/**
 * @param {string[]} segments path below som://rom/
 * @param {Uint8Array} rom
 * @returns {SomNode | null}
 */
function resolveSom(segments, rom) {
    const c = getCatalog(rom);
    const [top, name, ...rest] = segments;
    if (top === undefined) return { kind: 'dir', entries: [['index.md', 'file'], ['info.json', 'file'], ['maps', 'dir'], ['areas', 'dir']] };
    if (rest.length) return null;
    if (top === 'index.md' && name === undefined) return file(() => buf(romIndex(c)));
    if (top === 'info.json' && name === undefined) return file(() => json({ title: c.title, maps: c.maps.length, areas: c.areas.length }));
    if (top === 'maps') {
        if (name === undefined) return { kind: 'dir', entries: [['index.md', 'file'], ['index.json', 'file'],
            ...c.maps.flatMap(m => /** @type {Array<[string, 'file']>} */ ([[m.hex + '.png', 'file'], [m.hex + '.json', 'file']]))] };
        if (name === 'index.json') return file(() => json(c.maps));
        if (name === 'index.md') return file(() => buf(mapsIndex(c)));
        const hit = /^([0-9a-f]+)\.(png|json)$/.exec(name);
        const m = hit && c.maps.find(x => x.hex === hit[1]);
        if (!hit || !m) return null;
        if (hit[2] === 'json') return file(() => json(mapJson(rom, m.id)));
        return file(() => {
            const map = mana.loadMap(rom, m.id);
            if (!map) throw new Error(`map ${m.hex} has no pieces`);
            return encodePng(mana.renderMap(map));
        });
    }
    if (top === 'areas') {
        if (name === undefined) return { kind: 'dir', entries: [['index.md', 'file'], ['index.json', 'file'], ...c.areas.map(a => /** @type {[string, 'file']} */ ([a.slug + '.md', 'file']))] };
        if (name === 'index.json') return file(() => json(c.areas));
        if (name === 'index.md') return file(() => buf(areasIndex(c)));
        const a = c.areas.find(x => x.slug + '.md' === name);
        return a ? file(() => buf(areaPage(c, a))) : null;
    }
    return null;
}

/** @param {ReturnType<typeof catalog>} c */
function romIndex(c) {
    return `# ${c.title}\n\n${c.maps.length} maps in ${c.areas.length - 1} areas.\n\n- [maps/](maps/index.md)\n- [areas/](areas/index.md)\n`;
}

/** @param {ReturnType<typeof catalog>} c */
function mapsIndex(c) {
    const rows = c.maps.map(m => `| [${m.hex}](${m.hex}.png) | ${m.id} | ${m.w}×${m.h} | ${m.area || ''} |`);
    return `# Maps\n\n| id | dec | cells | area |\n|---|---|---|---|\n${rows.join('\n')}\n`;
}

/** @param {ReturnType<typeof catalog>} c */
function areasIndex(c) {
    const rows = c.areas.map(a => `- [${a.name}](${a.slug}.md) — ${a.maps.length} maps`);
    return `# Areas\n\n${rows.join('\n')}\n`;
}

/** @param {ReturnType<typeof catalog>} c @param {{ name: string, pictures: number[][] }} a */
function areaPage(c, a) {
    const parts = a.pictures.map(([id, ...same]) => {
        const m = c.maps.find(x => x.id === id);
        const also = same.length ? ` (same picture: ${same.map(hex).join(', ')})` : '';
        return m ? `## ${m.hex} (${m.id}) — ${m.w}×${m.h}${also}\n\n![map ${m.hex}](../maps/${m.hex}.png)\n` : '';
    });
    return `# ${a.name}\n\n${parts.join('\n')}`;
}

module.exports = { resolveSom, getCatalog, slug };
