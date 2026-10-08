'use strict';
// Ownership: `soe://rom/assets/` — decoded ROM content, one directory per
// kind. Ids are hex. Icons live once, in `icons/<id>.png`; items are named by
// their LOOT_REWARD / alchemy name (`ingredients/wax`, `alchemy/acid_rain`,
// the hex reward id works too) and their `icon.png` is a link to that file.

const {
    renderItemIcon, lootIconId, alchemyIconId, iconEntry, ALCHEMY_FORMULAS, ICON_ID_LAST,
    encodePng, decodeRoom, renderRoomComposite, MAX_ROOMS,
} = require('../maps');
const { lootRewardName, ramBitToStr } = require('../script');
const { decodeRomString, getMapName, getMapArea } = require('../localizations');
const { slugify, hexId } = require('../shared/resource-uri');
const { gallery, href } = require('./autoindex');
const { dir, file, link, json, text } = require('./nodes');

/** Reward categories with ring-menu icons (as in rooms/data/item-icons.js). */
const CATEGORIES = { ingredients: 0x0200, armor: 0x0400, consumables: 0x0800 };
/** Each alchemy formula's "known" flag is one bit from here, alphabetical. */
const ALCHEMY_KNOWN = 0x2258;
const STRING_COUNT = 3002;
const ICONS = 'soe://rom/assets/icons/';

function resolveAssets(segments, rom) {
    const [kind, id, leaf, ...extra] = segments;
    if (kind === undefined) {
        return dir(['icons', ...Object.keys(CATEGORIES), 'alchemy', 'strings', 'maps', 'scripts'].map(n => [n, 'dir']));
    }
    if (kind === 'scripts') {
        const { resolveScripts } = require('./script-files');
        return resolveScripts(segments.slice(1), rom);
    }
    if (kind === 'maps' && (leaf === 'scripts' || extra.includes('scripts'))) {
        const { resolveScripts } = require('./script-files');
        const sIdx = segments.indexOf('scripts');
        return resolveScripts(['rooms', id, ...segments.slice(sIdx + 1)], rom);
    }
    if (extra.length) return null;
    if (kind === 'icons') return icons(rom, id, leaf);
    if (kind in CATEGORIES) return items(rom, kind, id, leaf);
    if (kind === 'alchemy') return alchemy(rom, id, leaf);
    if (kind === 'strings') return strings(rom, id, leaf);
    if (kind === 'maps') return maps(rom, id, leaf);
    return null;
}

// ── icons ────────────────────────────────────────────────────────────────

// Which icon ids have a frame to draw, per ROM buffer (all 162 decoded once).
const _drawable = new WeakMap();
function drawableIcons(rom) {
    let ids = _drawable.get(rom);
    if (!ids) {
        ids = [];
        for (let i = 0; i <= ICON_ID_LAST; i += 2) {
            try { if (renderItemIcon(rom, i)) ids.push(i); } catch (_) { /* no frame */ }
        }
        _drawable.set(rom, ids);
    }
    return ids;
}

const iconName = id => hexId(id, 4) + '.png';

function iconPng(rom, iconId) {
    if (iconId === null || !drawableIcons(rom).includes(iconId)) return null;
    return file(() => encodePng(renderItemIcon(rom, iconId)));
}

function icons(rom, name, leaf) {
    if (name === undefined) return dir(drawableIcons(rom).map(i => [iconName(i), 'file']));
    const m = /^([0-9a-f]{1,4})\.png$/i.exec(name);
    return m && leaf === undefined ? iconPng(rom, parseInt(m[1], 16)) : null;
}

// ── items and alchemy: one directory per named entry ─────────────────────

/** Entries `{ id, slug, label, iconId }`; a directory per entry, found by slug or hex id. */
function itemDir(rom, title, entries, name, leaf, describe) {
    const hasIcon = e => e.iconId !== null && drawableIcons(rom).includes(e.iconId);
    if (name === undefined) {
        return dir(entries.map(e => [e.slug, 'dir']), () => [
            `# ${title}`, '', `${entries.length} entries. Each has \`info.json\`; \`icon.png\` links to [icons/](../icons/index.md).`, '',
            ...gallery(entries.filter(hasIcon).map(e => ({ image: `${e.slug}/icon.png`, label: e.slug, target: `${e.slug}/info.json` }))),
            ...(entries.some(e => !hasIcon(e)) ? ['Without an icon: ' + entries.filter(e => !hasIcon(e)).map(e => `[${e.slug}](${href(e.slug)}/info.json)`).join(', '), ''] : []),
        ].join('\n'));
    }
    const e = entries.find(x => x.slug === name || hexId(x.id, 4) === name);
    if (!e) return null;
    if (leaf === undefined) return dir([...(hasIcon(e) ? [['icon.png', 'link']] : []), ['info.json', 'file']]);
    if (leaf === 'icon.png') return link(iconPng(rom, e.iconId), ICONS + iconName(e.iconId));
    if (leaf === 'info.json') return json(() => describe(e));
    return null;
}

function items(rom, kind, name, leaf) {
    const base = CATEGORIES[kind];
    const entries = [];
    for (let i = 0; i < 0x100; i++) {
        const label = lootRewardName(base + i);
        if (label) entries.push({ id: base + i, slug: slugify(label), label, iconId: lootIconId(rom, base + i) });
    }
    return itemDir(rom, `soe://rom/assets/${kind}/`, entries, name, leaf, e => ({
        name: e.label,
        category: kind,
        rewardId: '$' + hexId(e.id, 4),
        icon: iconInfo(rom, e.iconId),
    }));
}

function alchemy(rom, name, leaf) {
    const entries = [];
    for (let n = 0; n < ALCHEMY_FORMULAS; n++) {
        const flag = ALCHEMY_KNOWN + (n >> 3), bit = n & 7;
        const m = /^\((.*)\) $/.exec(ramBitToStr(flag, bit));
        if (m) entries.push({ id: n, slug: slugify(m[1]), label: m[1], flag: `${hexId(flag, 4)}.${bit}`, iconId: alchemyIconId(rom, n) });
    }
    return itemDir(rom, 'soe://rom/assets/alchemy/', entries, name, leaf, e => ({
        name: e.label,
        formula: e.id,
        knownFlag: e.flag,
        icon: iconInfo(rom, e.iconId),
    }));
}

function iconInfo(rom, iconId) {
    if (iconId === null) return null;
    const e = iconEntry(rom, iconId);
    return {
        id: hexId(iconId, 4), file: ICONS + iconName(iconId),
        entry: '$' + hexId(e.entry, 6), record: '$' + hexId(e.record, 4), palette: '$' + hexId(e.palette, 4), index: e.index,
    };
}

// ── strings ──────────────────────────────────────────────────────────────

function strings(rom, name, leaf) {
    if (leaf !== undefined) return null;
    if (name === undefined) {
        const names = Array.from({ length: STRING_COUNT }, (_, i) => hexId(i, 4) + '.txt');
        return dir(names.map(n => [n, 'file']), () => [
            '# soe://rom/assets/strings/', '', `${STRING_COUNT} in-game strings, table at \`$11D000\`.`, '',
            '| Index | Text |', '|---|---|',
            ...names.map((n, i) => `| [${n.slice(0, 4)}](${n}) | ${cell(decodeRomString(rom, i))} |`),
        ].join('\n') + '\n');
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

/** One line of text, safe inside a Markdown table cell. */
function cell(s) {
    if (s === null) return '*(does not decode)*';
    const flat = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim();
    return (flat.length > 100 ? flat.slice(0, 100) + '…' : flat).replace(/[|\\`*_[\]<>]/g, c => '\\' + c);
}

// ── maps ─────────────────────────────────────────────────────────────────

function maps(rom, name, leaf) {
    if (name === undefined) {
        const ids = Array.from({ length: MAX_ROOMS }, (_, i) => i);
        return dir([['index.json', 'file'], ...ids.map(i => [hexId(i, 2), 'dir'])], () => [
            '# soe://rom/assets/maps/', '', `${MAX_ROOMS} rooms. [index.json](index.json)`, '',
            '| Id | Name | Area | |', '|---|---|---|---|',
            ...ids.map(i => `| [${hexId(i, 2)}](${hexId(i, 2)}/info.md) | ${cell(getMapName(i))} | ${cell(getMapArea(i) || '')} | [render](${hexId(i, 2)}/render.png) |`),
        ].join('\n') + '\n');
    }
    if (name === 'index.json') {
        return leaf === undefined ? json(() => Array.from({ length: MAX_ROOMS }, (_, id) => ({
            id: hexId(id, 2), name: getMapName(id), area: getMapArea(id),
        }))) : null;
    }
    if (!/^[0-9a-f]{1,2}$/i.test(name)) return null;
    const id = parseInt(name, 16);
    if (id >= MAX_ROOMS) return null;
    if (leaf === undefined) return dir([['info.md', 'file'], ['header.json', 'file'], ['render.png', 'file'], ['scripts', 'dir']], () => roomMarkdown(rom, id));
    if (leaf === 'header.json') return json(() => plain(decodeRoom(rom, id).header));
    if (leaf === 'render.png') return file(() => encodePng(renderRoomComposite(rom, decodeRoom(rom, id))));
    if (leaf === 'info.md') return text(() => roomMarkdown(rom, id));
    if (leaf === 'scripts') {
        const { resolveScripts } = require('./script-files');
        return resolveScripts(['rooms', hexId(id, 2)], rom);
    }
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

[header.json](header.json) | [scripts/](scripts/index.md)

![Room ${hexId(id, 2)}](render.png)
`;
}

/** Typed arrays → plain arrays, so a decoded struct prints as JSON. */
function plain(value) {
    return JSON.parse(JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v));
}

module.exports = { resolveAssets };
