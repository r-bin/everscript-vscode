'use strict';
// Ownership: `soe://rom/assets/` — decoded ROM content, one directory per
// kind. Ids are hex; items are named by their LOOT_REWARD / alchemy name
// (`ingredients/wax`, `alchemy/acid_rain`), and their hex reward id works too.

const {
    renderItemIcon, lootIconId, alchemyIconId, iconEntry, ALCHEMY_FORMULAS, ICON_ID_LAST,
    encodePng, decodeRoom, renderRoomComposite, MAX_ROOMS,
} = require('../maps');
const { lootRewardName, ramBitToStr } = require('../script');
const { decodeRomString, getMapName, getMapArea } = require('../localizations');
const { slugify, hexId } = require('../shared/resource-uri');
const { dir, file, json, text } = require('./nodes');

/** Reward categories with ring-menu icons (as in rooms/data/item-icons.js). */
const CATEGORIES = { ingredients: 0x0200, armor: 0x0400, consumables: 0x0800 };
/** Each alchemy formula's "known" flag is one bit from here, alphabetical. */
const ALCHEMY_KNOWN = 0x2258;
const STRING_COUNT = 3002;

function resolveAssets(segments, rom) {
    const [kind, id, leaf, ...extra] = segments;
    if (extra.length) return null;
    if (kind === undefined) {
        return dir(['icons', ...Object.keys(CATEGORIES), 'alchemy', 'strings', 'maps'].map(n => [n, 'dir']));
    }
    if (kind === 'icons') return icons(rom, id, leaf);
    if (kind in CATEGORIES) return items(rom, kind, id, leaf);
    if (kind === 'alchemy') return alchemy(rom, id, leaf);
    if (kind === 'strings') return strings(rom, id, leaf);
    if (kind === 'maps') return maps(rom, id, leaf);
    return null;
}

// ── icons ────────────────────────────────────────────────────────────────

function iconPng(rom, iconId) {
    if (iconId === null || iconId < 0 || iconId > ICON_ID_LAST || iconId % 2) return null;
    return file(() => {
        const px = renderItemIcon(rom, iconId);
        if (!px) throw new Error(`icon ${hexId(iconId, 4)} has no frame`);
        return encodePng(px);
    });
}

function icons(rom, name, leaf) {
    if (name === undefined) {
        const entries = [];
        for (let i = 0; i <= ICON_ID_LAST; i += 2) entries.push([hexId(i, 4) + '.png', 'file']);
        return dir(entries);
    }
    const m = /^([0-9a-f]{1,4})\.png$/i.exec(name);
    return m && leaf === undefined ? iconPng(rom, parseInt(m[1], 16)) : null;
}

/** `{ slug, id }` for each named entry, and a lookup by slug or hex id. */
function itemDir(entries, name, leaf, describe) {
    if (name === undefined) return dir(entries.map(e => [e.slug, 'dir']));
    const e = entries.find(x => x.slug === name || hexId(x.id, 4) === name);
    if (!e) return null;
    if (leaf === undefined) return dir([['icon.png', 'file'], ['info.json', 'file']]);
    if (leaf === 'icon.png') return iconPng(e.rom, e.iconId);
    if (leaf === 'info.json') return json(() => describe(e));
    return null;
}

function items(rom, kind, name, leaf) {
    const base = CATEGORIES[kind];
    const entries = [];
    for (let i = 0; i < 0x100; i++) {
        const label = lootRewardName(base + i);
        if (label) entries.push({ rom, id: base + i, slug: slugify(label), label, iconId: lootIconId(rom, base + i) });
    }
    return itemDir(entries, name, leaf, e => ({
        name: e.label,
        category: kind,
        rewardId: '$' + hexId(e.id, 4),
        iconId: e.iconId === null ? null : hexId(e.iconId, 4),
        icon: e.iconId === null ? null : iconInfo(rom, e.iconId),
    }));
}

function alchemy(rom, name, leaf) {
    const entries = [];
    for (let n = 0; n < ALCHEMY_FORMULAS; n++) {
        const flag = ALCHEMY_KNOWN + (n >> 3), bit = n & 7;
        const m = /^\((.*)\) $/.exec(ramBitToStr(flag, bit));
        if (m) entries.push({ rom, id: n, slug: slugify(m[1]), label: m[1], flag: `${hexId(flag, 4)}.${bit}`, iconId: alchemyIconId(rom, n) });
    }
    return itemDir(entries, name, leaf, e => ({
        name: e.label,
        formula: e.id,
        knownFlag: e.flag,
        iconId: e.iconId === null ? null : hexId(e.iconId, 4),
        icon: e.iconId === null ? null : iconInfo(rom, e.iconId),
    }));
}

function iconInfo(rom, iconId) {
    const e = iconEntry(rom, iconId);
    return { entry: '$' + hexId(e.entry, 6), record: '$' + hexId(e.record, 4), palette: '$' + hexId(e.palette, 4), index: e.index };
}

// ── strings ──────────────────────────────────────────────────────────────

function strings(rom, name, leaf) {
    if (leaf !== undefined) return null;
    if (name === undefined) {
        return dir(Array.from({ length: STRING_COUNT }, (_, i) => [hexId(i, 4) + '.txt', 'file']));
    }
    const m = /^([0-9a-f]{1,4})(\.txt)?$/i.exec(name);
    const index = m ? parseInt(m[1], 16) : -1;
    if (index < 0 || index >= STRING_COUNT) return null;
    return text(() => {
        const s = decodeRomString(rom, index);
        if (s === null) throw new Error(`string ${hexId(index, 4)} does not decode`);
        return s + '\n';
    });
}

// ── maps ─────────────────────────────────────────────────────────────────

function maps(rom, name, leaf) {
    if (name === undefined) {
        const ids = Array.from({ length: MAX_ROOMS }, (_, i) => [hexId(i, 2), 'dir']);
        return dir([['index.json', 'file'], ...ids]);
    }
    if (name === 'index.json') {
        return leaf === undefined ? json(() => Array.from({ length: MAX_ROOMS }, (_, id) => ({
            id: hexId(id, 2), name: getMapName(id), area: getMapArea(id),
        }))) : null;
    }
    if (!/^[0-9a-f]{1,2}$/i.test(name)) return null;
    const id = parseInt(name, 16);
    if (id >= MAX_ROOMS) return null;
    if (leaf === undefined) return dir([['info.md', 'file'], ['header.json', 'file'], ['render.png', 'file']]);
    if (leaf === 'header.json') return json(() => plain(decodeRoom(rom, id).header));
    if (leaf === 'render.png') return file(() => encodePng(renderRoomComposite(rom, decodeRoom(rom, id))));
    if (leaf === 'info.md') return text(() => roomMarkdown(rom, id));
    return null;
}

function roomMarkdown(rom, id) {
    const d = decodeRoom(rom, id);
    const h = d.header;
    return `# Room ${hexId(id, 2)}: ${getMapName(id, { full: true })}

| | |
|---|---|
| Area | ${getMapArea(id) || '?'} |
| Size | ${h.widthTiles}×${h.heightTiles} cells |
| Blob | file offset \`$${hexId(d.romPointerFile, 6)}\`, bus \`$${hexId(d.romPointerSnes, 6)}\` |
| Metatiles | ${d.metatileCount} |
| Tile families | ${d.tileFamilies.join(', ')} |
| Objects | ${d.objects.length} |
| Triggers | ${d.triggers.stepOn.length} step-on, ${d.triggers.bTrigger.length} B-button |

[header.json](header.json)

![Room ${hexId(id, 2)}](render.png)
`;
}

/** Typed arrays → plain arrays, so a decoded struct prints as JSON. */
function plain(value) {
    return JSON.parse(JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v));
}

module.exports = { resolveAssets };
