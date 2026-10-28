// Ownership: `soe://rom/assets/` — decoded ROM content, one directory per
// kind. Ids are hex. Icons live once, in `icons/<id>.png`; items are named by
// their LOOT_REWARD / alchemy name (`ingredients/wax`, `alchemy/acid_rain`,
// the hex reward id works too) and their `icon.png` is a link to that file.

import { renderItemIcon, lootIconId, alchemyIconId, iconEntry, ALCHEMY_FORMULAS, ICON_ID_LAST, encodePng, decodeRoom, renderRoomComposite, MAX_ROOMS } from '../maps';
import { lootRewardName, flagName } from '../script-model';
import { stringText } from '../localizations';
import { slugify, hexId } from './resource-uri';
import { gallery, href } from './autoindex';
import { dir, file, link, json, text } from './nodes';
import type { Entry, VfsNode } from './nodes';
import { resolveAudio } from './audio-files';
import { resolveCharacters } from './character-files';
import { resolvePalettes } from './palette-files';
import { resolveSprites } from './sprite-files';
import { resolveRoomObjects, resolveRoomWidgets } from './map-objects';
import { resolveScripts } from './script-files';
import { resolveTables } from './table-files';
import { resolveRoomTiles, resolveTiles } from './tile-files';
import type { MapsDeps } from './map-files';

type Rom = Uint8Array;
/** One named entry of an item or alchemy directory. */
interface ItemEntry { id: number; slug: string; label: string; iconId: number | null; flag?: string }
import { maps, cell } from './map-files';

/** Reward categories with ring-menu icons (as in rooms/data/item-icons.ts). */
const CATEGORIES: Record<string, number> = { ingredients: 0x0200, armor: 0x0400, consumables: 0x0800 };
/** Each alchemy formula's "known" flag is one bit from here, alphabetical. */
const ALCHEMY_KNOWN = 0x2258;
const STRING_COUNT = 3002;
const ICONS = 'soe://rom/assets/icons/';

function resolveAssets(segments: string[], rom: Rom, deps?: MapsDeps): VfsNode | null {
    const [kind, id, leaf, ...extra] = segments;
    if (kind === undefined) {
        return dir(['icons', ...Object.keys(CATEGORIES), 'alchemy', 'strings', 'maps', 'scripts', 'characters', 'palettes', 'sprites', 'tiles', 'audio', 'tables'].map((n): Entry => [n, 'dir']));
    }
    if (kind === 'scripts') {
        return resolveScripts(segments.slice(1), rom);
    }
    if (kind === 'characters') {
        return resolveCharacters(segments.slice(1), rom);
    }
    if (kind === 'palettes') {
        return resolvePalettes(segments.slice(1), rom);
    }
    if (kind === 'sprites') {
        return resolveSprites(segments.slice(1), rom);
    }
    if (kind === 'tiles') {
        return resolveTiles(segments.slice(1), rom);
    }
    if (kind === 'audio') {
        return resolveAudio(segments.slice(1), rom);
    }
    if (kind === 'tables') {
        return resolveTables(segments.slice(1), rom);
    }
    if (kind === 'maps' && (leaf === 'scripts' || extra.includes('scripts'))) {
        const sIdx = segments.indexOf('scripts');
        return resolveScripts(['rooms', id, ...segments.slice(sIdx + 1)], rom);
    }
    if (kind === 'maps' && id === 'custom') {
        const customName = leaf;
        const subLeaf = extra[0];
        if (customName === undefined) {
            return dir([['index.json', 'file']]);
        }
        const renderPngNode = file(() => {
            if (!rom) throw new Error('ROM required for custom map render');
            const clean = (rom.length % 1024 === 512) ? rom.subarray(512) : rom;
            const rId = 0x15;
            const d = decodeRoom(clean, rId);
            if (!d) throw new Error('Custom room ' + hexId(rId, 2) + ' not found in ROM');
            return encodePng(renderRoomComposite(clean, d));
        });
        if (subLeaf === undefined || subLeaf === 'render.png') {
            return renderPngNode;
        }
        if (subLeaf === 'info.md') {
            return text(() => '# Custom Map: ' + customName + '\n\nCompiled into Room 0x15.\n');
        }
        return null;
    }
    if (kind === 'maps' && (leaf === 'objects' || extra.includes('objects'))) {
        const oIdx = segments.indexOf('objects');
        const subSegments = segments.slice(oIdx + 1);
        const rId = parseInt(id as string, 16);
        if (Number.isInteger(rId) && rId >= 0 && rId < MAX_ROOMS) {
            return resolveRoomObjects(decodeRoom(rom, rId), rom, subSegments, rId);
        }
        return null;
    }
    if (kind === 'maps' && (leaf === 'widgets' || extra.includes('widgets'))) {
        const wIdx = segments.indexOf('widgets');
        const subSegments = segments.slice(wIdx + 1);
        const rId = parseInt(id as string, 16);
        if (Number.isInteger(rId) && rId >= 0 && rId < MAX_ROOMS) {
            return resolveRoomWidgets(decodeRoom(rom, rId), rom, subSegments, rId);
        }
        return null;
    }
    if (kind === 'maps' && (leaf === 'tiles' || leaf === 'metatiles' || extra.includes('tiles') || extra.includes('metatiles'))) {
        const tileIdx = segments.indexOf('tiles') !== -1 ? segments.indexOf('tiles') : segments.indexOf('metatiles');
        const subSegments = segments.slice(tileIdx + 1);
        const rId = parseInt(id as string, 16);
        if (Number.isInteger(rId) && rId >= 0 && rId < MAX_ROOMS) {
            return resolveRoomTiles(decodeRoom(rom, rId), rom, subSegments);
        }
        return null;
    }
    if (extra.length) return null;
    if (kind === 'icons') return icons(rom, id, leaf);
    if (kind in CATEGORIES) return items(rom, kind, id, leaf);
    if (kind === 'alchemy') return alchemy(rom, id, leaf);
    if (kind === 'strings') return strings(rom, id, leaf);
    if (kind === 'maps') return maps(rom, id, leaf, deps);
    return null;
}

// ── icons ────────────────────────────────────────────────────────────────

// Which icon ids have a frame to draw, per ROM buffer (all 162 decoded once).
const _drawable = new WeakMap<Rom, number[]>();
function drawableIcons(rom: Rom) {
    let ids = _drawable.get(rom);
    if (!ids) {
        ids = [] as number[];
        for (let i = 0; i <= ICON_ID_LAST; i += 2) {
            try { if (renderItemIcon(rom, i)) ids.push(i); } catch (_) { /* no frame */ }
        }
        _drawable.set(rom, ids);
    }
    return ids;
}

const iconName = (id: number) => hexId(id, 4) + '.png';

function iconPng(rom: Rom, iconId: number | null) {
    if (iconId === null || !drawableIcons(rom).includes(iconId)) return null;
    return file(() => encodePng(renderItemIcon(rom, iconId)!));
}

function icons(rom: Rom, name?: string, leaf?: string) {
    if (name === undefined) return dir(drawableIcons(rom).map((i): Entry => [iconName(i), 'file']));
    const m = /^([0-9a-f]{1,4})\.png$/i.exec(name);
    return m && leaf === undefined ? iconPng(rom, parseInt(m[1], 16)) : null;
}

// ── items and alchemy: one directory per named entry ─────────────────────

/** Entries `{ id, slug, label, iconId }`; a directory per entry, found by slug or hex id. */
function itemDir(rom: Rom, title: string, entries: ItemEntry[], name: string | undefined, leaf: string | undefined, describe: (e: ItemEntry) => unknown) {
    const hasIcon = (e: ItemEntry) => e.iconId !== null && drawableIcons(rom).includes(e.iconId);
    if (name === undefined) {
        return dir(entries.map((e): Entry => [e.slug, 'dir']), () => [
            `# ${title}`, '', `${entries.length} entries. Each has \`info.json\`; \`icon.png\` links to [icons/](../icons/index.md).`, '',
            ...gallery(entries.filter(hasIcon).map(e => ({ image: `${e.slug}/icon.png`, label: e.slug, target: `${e.slug}/info.json` }))),
            ...(entries.some(e => !hasIcon(e)) ? ['Without an icon: ' + entries.filter(e => !hasIcon(e)).map(e => `[${e.slug}](${href(e.slug)}/info.json)`).join(', '), ''] : []),
        ].join('\n'));
    }
    const e = entries.find(x => x.slug === name || hexId(x.id, 4) === name);
    if (!e) return null;
    if (leaf === undefined) return dir([...(hasIcon(e) ? [['icon.png', 'link'] as Entry] : []), ['info.json', 'file'] as Entry]);
    if (leaf === 'icon.png') return link(iconPng(rom, e.iconId), ICONS + iconName(e.iconId!));
    if (leaf === 'info.json') return json(() => describe(e));
    return null;
}

function items(rom: Rom, kind: string, name?: string, leaf?: string) {
    const base = CATEGORIES[kind];
    const entries: ItemEntry[] = [];
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

function alchemy(rom: Rom, name?: string, leaf?: string) {
    const entries: ItemEntry[] = [];
    for (let n = 0; n < ALCHEMY_FORMULAS; n++) {
        const flag = ALCHEMY_KNOWN + (n >> 3), bit = n & 7;
        const label = flagName(flag, bit);
        if (label) entries.push({ id: n, slug: slugify(label), label, flag: `${hexId(flag, 4)}.${bit}`, iconId: alchemyIconId(rom, n) });
    }
    return itemDir(rom, 'soe://rom/assets/alchemy/', entries, name, leaf, e => ({
        name: e.label,
        formula: e.id,
        knownFlag: e.flag,
        icon: iconInfo(rom, e.iconId),
    }));
}

function iconInfo(rom: Rom, iconId: number | null) {
    if (iconId === null) return null;
    const e = iconEntry(rom, iconId);
    return {
        id: hexId(iconId, 4), file: ICONS + iconName(iconId),
        entry: '$' + hexId(e.entry, 6), record: '$' + hexId(e.record, 4), palette: '$' + hexId(e.palette, 4), index: e.index,
    };
}

// ── strings ──────────────────────────────────────────────────────────────

function strings(rom: Rom, name?: string, leaf?: string) {
    if (leaf !== undefined) return null;
    if (name === undefined) {
        const names = Array.from({ length: STRING_COUNT }, (_, i) => hexId(i, 4) + '.txt');
        return dir(names.map((n): Entry => [n, 'file']), () => [
            '# soe://rom/assets/strings/', '', `${STRING_COUNT} in-game strings, table at \`$11D000\`.`, '',
            '| Index | Text |', '|---|---|',
            ...names.map((n, i) => `| [${n.slice(0, 4)}](${n}) | ${cell(stringText(rom, i))} |`),
        ].join('\n') + '\n');
    }
    const m = /^([0-9a-f]{1,4})(\.txt)?$/i.exec(name);
    const index = m ? parseInt(m[1], 16) : -1;
    if (index < 0 || index >= STRING_COUNT) return null;
    return text(() => {
        const s = stringText(rom, index);
        if (s === null) throw new Error(`string ${hexId(index, 4)} does not decode`);
        return s + '\n';
    });
}

export { resolveAssets };
