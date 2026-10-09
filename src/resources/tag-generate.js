'use strict';
// Ownership: the generated half of `soe://tags/` — one tag per room, area,
// enemy, song, sound, flag, named RAM address, engine table and item, built
// from data the plugin already ships. Pure: no ROM, no emulator, no .evs files.
// Returns definitions in the same shape as tags/tags.json (tag-model.js merges
// both). docs/soe-tags-spec.md §5.3.

const { VANILLA_MAPS } = require('../localizations/maps');
const { MUSIC, SOUNDS } = require('../localizations/sounds');
const { TABLES } = require('../localizations/tables');
const { lootRewardName } = require('../script');
const NAMES = require('../script/names.json');
const { slugify, hexId } = require('../shared/resource-uri');

const ROM = 'soe://rom/assets/';
const ITEM_CATEGORIES = { ingredient: ['ingredients', 0x0200], armor: ['armor', 0x0400], consumable: ['consumables', 0x0800] };

/** names.json labels end in their own address: `PRIZE ($2391)` → `PRIZE`. */
const label = s => String(s).replace(/\s*\(\$[0-9a-f]+\)\s*$/i, '');

/**
 * `{ sub, aliases }` for one family: each entry gets the slug of its name;
 * entries whose slug repeats get `_<suffix>` instead, so ids stay unique.
 * `alias` (optional) is a second name that links to the entry, e.g. a hex id.
 */
function family(entries, { name, suffix, alias, def }) {
    const count = new Map();
    for (const e of entries) {
        const s = slugify(name(e));
        if (s) count.set(s, (count.get(s) || 0) + 1);
    }
    const sub = {}, aliases = {};
    for (const e of entries) {
        let s = slugify(name(e));
        if (!s) continue;
        if (count.get(s) > 1) s = `${s}_${suffix(e)}`;
        if (/^[0-9]/.test(s)) s = '_' + s;
        sub[s] = def(e);
        if (alias) aliases[alias(e)] = s;
    }
    return { sub, aliases };
}

function maps() {
    const areas = {};
    const fam = family(VANILLA_MAPS, {
        name: m => m.name,
        suffix: m => hexId(m.id, 2),
        alias: m => hexId(m.id, 2),
        def: m => {
            const id = hexId(m.id, 2);
            const area = m.area ? 'area.' + slugify(m.area) : null;
            return {
                title: m.fullName || m.name,
                links: [
                    { uri: `${ROM}maps/${id}/info.md`, role: 'room summary' },
                    { uri: `${ROM}maps/${id}/render.png`, role: 'render' },
                    { uri: `${ROM}maps/${id}/header.json`, role: 'room header' },
                    { uri: `${ROM}scripts/rooms/${id}/index.md`, role: 'room scripts' },
                ],
                see: area ? [area] : [],
            };
        },
    });
    for (const m of VANILLA_MAPS) if (m.area) areas[slugify(m.area)] = m.area;
    const area = {};
    for (const [s, title] of Object.entries(areas)) area[s] = { title };
    return {
        map: { title: 'Rooms (one tag per vanilla room; hex room ids are aliases)', sub: fam.sub, aliases: fam.aliases },
        area: { title: 'World areas', sub: area },
    };
}

function enemies() {
    const list = Object.entries(NAMES.enemies).map(([i, e]) => ({ index: Number(i), ...e }))
        .filter(e => e.name !== 'BOY' && e.name !== 'DOG');
    const fam = family(list, {
        name: e => e.name,
        suffix: e => hexId(e.index, 2),
        def: e => ({
            title: e.romName && !/^</.test(e.romName) ? `${e.name} (${e.romName})` : e.name,
            links: e.character === null || e.character === undefined ? [] : [
                { uri: `${ROM}characters/${hexId(e.character, 2)}/info.md`, role: 'character record (sprite, animations, stats)' },
            ],
            source: `names.json enemies[${e.index}]`,
        }),
    });
    return { enemy: { sub: fam.sub } };
}

function audio() {
    const music = family(MUSIC, {
        name: m => m.name,
        suffix: m => hexId(m.id, 2),
        alias: m => hexId(m.id, 2),
        def: m => ({
            title: `${m.name} (music $${hexId(m.id, 2)})`,
            links: [
                { uri: `${ROM}audio/music/${hexId(m.id, 2)}/info.md`, role: 'track' },
                { uri: `${ROM}audio/music/${hexId(m.id, 2)}/song.spc`, role: 'playable SPC' },
            ],
        }),
    });
    const sound = family(SOUNDS, {
        name: s => s.name,
        suffix: s => hexId(s.id, 2),
        alias: s => hexId(s.id, 2),
        def: s => ({
            title: `${s.name} (sound $${hexId(s.id, 2)})`,
            links: [{ uri: `${ROM}audio/sounds/${hexId(s.id, 2)}/info.json`, role: 'sound effect' }],
        }),
    });
    return {
        music: { title: 'Music tracks', sub: music.sub, aliases: music.aliases },
        sound: { title: 'Sound effects', sub: sound.sub, aliases: sound.aliases },
    };
}

function flags() {
    const list = Object.entries(NAMES.flags).map(([k, name]) => {
        const [addr, bit] = k.split(':').map(Number);
        return { addr, bit, name };
    });
    const fam = family(list, {
        name: f => f.name,
        suffix: f => `${hexId(f.addr, 4)}_${f.bit}`,
        alias: f => `${hexId(f.addr, 4)}_${f.bit}`,
        def: f => ({
            title: f.name,
            links: [{ uri: `soe://ram/${hexId(f.addr, 4)}.${f.bit}.json`, role: `flag $${hexId(f.addr, 4)} bit ${f.bit}` }],
            source: 'names.json flags',
        }),
    });
    return { flag: { title: 'Named story and progress flags (aliases: <addr>_<bit>)', sub: fam.sub, aliases: fam.aliases } };
}

function ram() {
    const list = Object.entries(NAMES.ram).map(([a, name]) => ({ addr: Number(a), name: label(name) }));
    const fam = family(list, {
        name: r => r.name,
        suffix: r => hexId(r.addr, 4),
        alias: r => hexId(r.addr, 4),
        def: r => ({
            title: r.name,
            links: [{ uri: `soe://ram/${hexId(r.addr, 4)}.json`, role: 'WRAM word' }],
            source: 'names.json ram',
        }),
    });
    return { ram: { title: 'Named WRAM addresses (aliases: hex address)', sub: fam.sub, aliases: fam.aliases } };
}

function tables() {
    const fam = family(TABLES, {
        name: t => t.name,
        suffix: t => hexId(t.address, 6),
        def: t => ({
            title: `${t.name} ($${hexId(t.address, 6)})`,
            links: [{ uri: `${ROM}tables/${slugify(t.name)}/info.md`, role: 'table' }],
            source: t.notes || undefined,
        }),
    });
    return { table: { title: 'Engine lookup and pointer tables', sub: fam.sub } };
}

function items() {
    const out = {};
    for (const [tag, [dir, base]] of Object.entries(ITEM_CATEGORIES)) {
        const list = [];
        for (let i = 0; i < 0x100; i++) {
            const name = lootRewardName(base + i);
            if (name) list.push({ id: base + i, name });
        }
        const fam = family(list, {
            name: e => e.name,
            suffix: e => hexId(e.id, 4),
            alias: e => hexId(e.id, 4),
            def: e => ({
                title: `${e.name} (reward $${hexId(e.id, 4)})`,
                links: [
                    { uri: `${ROM}${dir}/${slugify(e.name)}/info.json`, role: 'item' },
                    { uri: `${ROM}${dir}/${slugify(e.name)}/icon.png`, role: 'icon' },
                ],
            }),
        });
        out[tag] = { title: `${dir[0].toUpperCase()}${dir.slice(1)}`, sub: fam.sub, aliases: fam.aliases };
    }
    return out;
}

/** Every generated tag family, keyed by root id. */
function generatedTags() {
    return { ...maps(), ...enemies(), ...audio(), ...flags(), ...ram(), ...tables(), ...items() };
}

module.exports = { generatedTags };
