// Ownership: `soe://rom/assets/` — decoded ROM content, one directory per
// kind. Ids are hex. Icons live once, in `icons/<id>.png`; items are named by
// their LOOT_REWARD / alchemy name (`ingredients/wax`, `alchemy/acid_rain`,
// the hex reward id works too) and their `icon.png` is a link to that file.

import { renderItemIcon, lootIconId, alchemyIconId, iconEntry, ALCHEMY_FORMULAS, ICON_ID_LAST, encodePng, decodeRoom, renderRoomComposite, MAX_ROOMS } from '../maps';
import { lootRewardName, flagName } from '../script-model';
import { alchemyModel } from '../scripts-tab/model/alchemy';
import compiler from '../language/data/index.json';
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

const WEAPON_ICON_NAMES: Record<number, string> = {
    0x0028: 'Bone Crusher',
    0x002a: 'Gladiator Sword',
    0x002c: 'Crusader Sword',
    0x002e: 'Neutron Blade',
    0x0030: "Spider's Claw",
    0x0032: 'Bronze Axe',
    0x0034: 'Knight Basher',
    0x0036: 'Atom Smasher',
    0x0038: 'Horn Spear',
    0x003a: 'Bronze Spear',
    0x003c: 'Lance',
    0x003e: 'Laser Lance',
    0x0040: 'Bazooka',
    0x0042: 'Bazooka (Thunder Ball)',
    0x0044: 'Bazooka (Particle Bomb)',
    0x0046: 'Bazooka',
};

const PORTRAIT_ICON_NAMES: Record<number, string> = {
    0x00f0: 'Fire Eyes Portrait',
    0x00f2: 'Horace Highwater Portrait',
    0x00f4: 'Queen Bluegarden Portrait',
    0x00f6: 'Professor Ruffleberg Portrait',
};

function iconCategory(id: number): string {
    if (id <= 0x0026) return 'ui';
    if (id <= 0x0046) return 'weapon';
    if (id <= 0x008c) return 'alchemy';
    if (id <= 0x009c) return 'consumable';
    if (id === 0x009e) return 'system';
    if (id <= 0x00ee) return 'armor';
    if (id <= 0x00f6) return 'portrait';
    if (id <= 0x0116) return 'alchemy_unused';
    if (id <= 0x0142) return 'ingredient';
    return 'unknown';
}

function iconLabel(rom: Rom, id: number, entry: ReturnType<typeof iconEntry>): { label: string; uses: string[] } {
    if (WEAPON_ICON_NAMES[id]) {
        return { label: WEAPON_ICON_NAMES[id], uses: [WEAPON_ICON_NAMES[id]] };
    }
    if (PORTRAIT_ICON_NAMES[id]) {
        return { label: PORTRAIT_ICON_NAMES[id], uses: [PORTRAIT_ICON_NAMES[id]] };
    }
    if (id === 0x009e) {
        return { label: 'Pouch / Money Bag', uses: ['Pouch'] };
    }
    if (id >= 0x0118 && id <= 0x0142) {
        for (let i = 0; i < 0x20; i++) {
            if (lootIconId(rom, 0x0200 + i) === id) {
                const name = lootRewardName(0x0200 + i);
                if (name) return { label: name, uses: [name] };
            }
        }
        const name = lootRewardName(0x0200 + entry.index);
        if (name) return { label: name, uses: [name] };
    }
    if (id >= 0x008e && id <= 0x009c) {
        for (let i = 0; i < 0x20; i++) {
            if (lootIconId(rom, 0x0800 + i) === id) {
                const name = lootRewardName(0x0800 + i);
                if (name) return { label: name, uses: [name] };
            }
        }
        const name = lootRewardName(0x0800 + entry.index);
        if (name) return { label: name, uses: [name] };
    }
    if (id >= 0x00a0 && id <= 0x00ee) {
        for (let i = 0; i < 0x40; i++) {
            if (lootIconId(rom, 0x0400 + i) === id) {
                const name = lootRewardName(0x0400 + i);
                if (name) return { label: name, uses: [name] };
            }
        }
        const name = lootRewardName(0x0400 + Math.floor(entry.index / 2));
        if (name) return { label: name, uses: [name] };
    }
    if (id >= 0x0048 && id <= 0x008c) {
        const formulaIdx = Math.floor(entry.index / 2);
        const name = flagName(ALCHEMY_KNOWN + (formulaIdx >> 3), formulaIdx & 7);
        if (name) return { label: name, uses: [name] };
    }
    if (id >= 0x00f8 && id <= 0x0116) {
        const formulaIdx = Math.floor(entry.index / 2);
        const name = flagName(ALCHEMY_KNOWN + (formulaIdx >> 3), formulaIdx & 7);
        if (name) return { label: name, uses: [name] };
    }
    const enums = (compiler.enums as unknown as Record<string, { name: string; value: string }[]>).RING_MENU_ICON || [];
    const hexVal = '0x' + hexId(id, 4);
    const hit = enums.find((e) => e.value.toLowerCase() === hexVal.toLowerCase());
    const enumLabel = hit ? hit.name.replace(/_/g, ' ') : `Icon 0x${hexId(id, 4)}`;
    return { label: enumLabel, uses: hit ? [hit.name] : [] };
}

function iconModel(rom: Rom, id: number) {
    const e = iconEntry(rom, id);
    const cat = iconCategory(id);
    const { label, uses } = iconLabel(rom, id, e);
    const enums = (compiler.enums as unknown as Record<string, { name: string; value: string }[]>).RING_MENU_ICON || [];
    const hexVal = '0x' + hexId(id, 4);
    const enumEntry = enums.find((x) => x.value.toLowerCase() === hexVal.toLowerCase());
    return {
        id,
        hex: hexId(id, 4),
        file: ICONS + iconName(id),
        label,
        category: cat,
        enumName: enumEntry ? enumEntry.name : null,
        entry: '$' + hexId(e.entry, 6),
        record: '$' + hexId(e.record, 4),
        palette: '$' + hexId(e.palette, 4),
        index: e.index,
        uses,
    };
}

function singleIconMarkdown(rom: Rom, id: number) {
    const m = iconModel(rom, id);
    const lines = [
        `# Icon 0x${m.hex}: ${m.label}`,
        '',
        '| Property | Value |',
        '|---|---|',
        `| ID | \`0x${m.hex}\` (#${m.id}) |`,
        `| Name | ${m.label} |`,
        `| Category | \`${m.category}\` |`,
        `| Enum | \`${m.enumName ? 'RING_MENU_ICON.' + m.enumName : '—'}\` |`,
        `| Entry Address | \`${m.entry}\` |`,
        `| Animation Record | \`${m.record}\` |`,
        `| Palette | \`${m.palette}\` |`,
        `| Category Index | ${m.index} |`,
        '',
        `![Icon 0x${m.hex}](${iconName(id)})`,
        '',
        '## Uses',
        '',
    ];
    if (m.uses.length) {
        for (const u of m.uses) lines.push(`- **${u}**`);
    } else {
        lines.push('*No specific item or formula associations known.*');
    }
    lines.push('');
    return lines.join('\n');
}

function iconsIndexMarkdown(rom: Rom) {
    const ids = drawableIcons(rom);
    const models = ids.map((id) => iconModel(rom, id));
    const lines = [
        '# soe://rom/assets/icons/',
        '',
        `${models.length} ring menu icons in the ROM table at \`$CE8000\`.`,
        '',
        '| Icon | ID | Name | Category | Record | Palette | Uses |',
        '|---|---|---|---|---|---|---|',
        ...models.map((m) => `| [![${m.hex}.png](${m.hex}.png)](${m.hex}.png) | [${m.hex}](${m.hex}/info.md) | ${m.label} | \`${m.category}\` | \`${m.record}\` | \`${m.palette}\` | ${m.uses.join(', ')} |`),
        '',
    ];
    return lines.join('\n');
}

function icons(rom: Rom, name?: string, leaf?: string) {
    if (name === undefined) {
        const ids = drawableIcons(rom);
        const entries: Entry[] = [
            ['index.json', 'file'],
            ['index.md', 'file'],
            ...ids.map((i): Entry => [iconName(i), 'file']),
            ...ids.map((i): Entry => [hexId(i, 4), 'dir']),
        ];
        return dir(entries, () => iconsIndexMarkdown(rom));
    }
    if (name === 'index.json') {
        return json(() => drawableIcons(rom).map((i) => iconModel(rom, i)));
    }
    if (name === 'index.md') {
        return text(() => iconsIndexMarkdown(rom));
    }

    const m = /^([0-9a-f]{1,4})(?:\.(png|json|md))?$/i.exec(name);
    if (!m) return null;
    const id = parseInt(m[1], 16);
    if (!drawableIcons(rom).includes(id)) return null;
    const ext = m[2];

    if (ext === 'png') {
        return leaf === undefined ? iconPng(rom, id) : null;
    }
    if (ext === 'json') {
        return leaf === undefined ? json(() => iconModel(rom, id)) : null;
    }
    if (ext === 'md') {
        return leaf === undefined ? text(() => singleIconMarkdown(rom, id)) : null;
    }

    if (leaf === undefined) {
        const entries: Entry[] = [
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['icon.png', 'file'],
        ];
        return dir(entries, () => singleIconMarkdown(rom, id));
    }
    if (leaf === 'info.json') return json(() => iconModel(rom, id));
    if (leaf === 'info.md') return text(() => singleIconMarkdown(rom, id));
    if (leaf === 'icon.png' || leaf === `${hexId(id, 4)}.png`) return iconPng(rom, id);

    return null;
}

// ── items and alchemy: one directory per named entry ─────────────────────

interface ItemModel {
    name: string;
    category: string;
    rewardId?: string;
    formula?: number;
    knownFlag?: string;
    block?: string;
    records?: { record: number; recHex: string; effect: boolean }[];
    icon: ReturnType<typeof iconInfo>;
}

function singleItemMarkdown(kind: string, entry: ItemEntry, model: ItemModel): string {
    const lines = [
        `# ${entry.label} (${kind})`,
        '',
        '| Property | Value |',
        '|---|---|',
        `| Name | ${entry.label} |`,
        `| Category | \`${kind}\` |`,
        `| Reward ID | \`${model.rewardId}\` |`,
    ];
    if (model.icon) {
        lines.push(
            `| Icon ID | \`0x${model.icon.id}\` |`,
            `| Icon Entry | \`${model.icon.entry}\` |`,
            `| Animation Record | \`${model.icon.record}\` |`,
            `| Palette | \`${model.icon.palette}\` |`,
            '',
            `![${entry.label}](icon.png)`,
            '',
            `See [Icon 0x${model.icon.id}](../icons/${model.icon.id}/info.md).`,
        );
    } else {
        lines.push('| Icon | *None* |');
    }
    lines.push('');
    return lines.join('\n');
}

function singleAlchemyMarkdown(entry: ItemEntry, model: ItemModel): string {
    const lines = [
        `# Alchemy Formula: ${entry.label}`,
        '',
        '| Property | Value |',
        '|---|---|',
        `| Name | ${entry.label} |`,
        `| Formula Index | ${model.formula} |`,
        `| Known Flag | \`$${model.knownFlag}\` |`,
        `| Logic Block | \`${model.block || '—'}\` |`,
    ];
    if (model.icon) {
        lines.push(
            `| Icon ID | \`0x${model.icon.id}\` |`,
            `| Animation Record | \`${model.icon.record}\` |`,
            `| Palette | \`${model.icon.palette}\` |`,
            '',
            `![${entry.label}](icon.png)`,
            '',
            `See [Icon 0x${model.icon.id}](../icons/${model.icon.id}/info.md).`,
        );
    } else {
        lines.push('| Icon | *None* |');
    }
    lines.push('');
    lines.push('## Animation Records', '');
    if (model.records && model.records.length) {
        lines.push(
            'Animation records dispatched by this formula when cast:',
            '',
            '| Record | Hex | Effect Signal | Sprite Asset |',
            '|---|---|---|---|',
            ...model.records.map((r) =>
                `| ${r.record} | \`${r.recHex}\` | ${r.effect ? '`effect_done` ($5D)' : '—'} | [Record ${r.recHex}](../sprites/${r.recHex.slice(1).padStart(6, '0')}/info.md) |`
            ),
            '',
        );
    } else {
        lines.push('*No animation records decoded for this formula block.*', '');
    }
    return lines.join('\n');
}

/** Entries `{ id, slug, label, iconId }`; a directory per entry, found by slug or hex id. */
function itemDir(
    rom: Rom,
    title: string,
    entries: ItemEntry[],
    name: string | undefined,
    leaf: string | undefined,
    describe: (e: ItemEntry) => ItemModel,
    toMarkdown: (e: ItemEntry, m: ItemModel) => string,
) {
    const hasIcon = (e: ItemEntry) => e.iconId !== null && drawableIcons(rom).includes(e.iconId);
    const indexMd = () => [
        `# ${title}`, '', `${entries.length} entries. Each has \`info.json\` and \`info.md\`; \`icon.png\` links to [icons/](../icons/index.md).`, '',
        '| Icon | Name | ID / Flag | Record | Palette |',
        '|---|---|---|---|---|',
        ...entries.map((e) => {
            const m = describe(e);
            const iconCol = hasIcon(e) ? `[![${e.slug}](${e.slug}/icon.png)](${e.slug}/icon.png)` : '—';
            const idCol = m.rewardId || (m.formula !== undefined ? `#${m.formula} (\`$${m.knownFlag}\`)` : '—');
            const recCol = m.icon ? `\`${m.icon.record}\`` : '—';
            const palCol = m.icon ? `\`${m.icon.palette}\`` : '—';
            return `| ${iconCol} | [${e.label}](${e.slug}/info.md) | ${idCol} | ${recCol} | ${palCol} |`;
        }),
        '',
    ].join('\n');

    if (name === undefined) {
        const dirEntries: Entry[] = [
            ['index.json', 'file'],
            ['index.md', 'file'],
            ...entries.map((e): Entry => [e.slug, 'dir']),
        ];
        return dir(dirEntries, indexMd);
    }
    if (name === 'index.json') {
        return json(() => entries.map(describe));
    }
    if (name === 'index.md') {
        return text(indexMd);
    }

    const m = /^(.+?)(?:\.(json|md))?$/i.exec(name);
    const rawName = m ? m[1] : name;
    const ext = m ? m[2] : undefined;

    const e = entries.find(x => x.slug === rawName || hexId(x.id, 4) === rawName);
    if (!e) return null;
    const model = describe(e);

    if (ext === 'json') return leaf === undefined ? json(() => model) : null;
    if (ext === 'md') return leaf === undefined ? text(() => toMarkdown(e, model)) : null;

    if (leaf === undefined) {
        return dir([
            ...(hasIcon(e) ? [['icon.png', 'link'] as Entry] : []),
            ['info.json', 'file'] as Entry,
            ['info.md', 'file'] as Entry,
        ], () => toMarkdown(e, model));
    }
    if (leaf === 'icon.png') return link(iconPng(rom, e.iconId), ICONS + iconName(e.iconId!));
    if (leaf === 'info.json') return json(() => model);
    if (leaf === 'info.md') return text(() => toMarkdown(e, model));
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
    }), (e, m) => singleItemMarkdown(kind, e, m));
}

function alchemy(rom: Rom, name?: string, leaf?: string) {
    const entries: ItemEntry[] = [];
    const alch = alchemyModel(rom);
    for (let n = 0; n < ALCHEMY_FORMULAS; n++) {
        const flag = ALCHEMY_KNOWN + (n >> 3), bit = n & 7;
        const label = flagName(flag, bit);
        if (label) entries.push({ id: n, slug: slugify(label), label, flag: `${hexId(flag, 4)}.${bit}`, iconId: alchemyIconId(rom, n) });
    }
    return itemDir(rom, 'soe://rom/assets/alchemy/', entries, name, leaf, e => {
        const f = alch.formulas[e.id];
        return {
            name: e.label,
            category: 'alchemy',
            formula: e.id,
            knownFlag: e.flag,
            block: f ? f.blockHex : undefined,
            records: f ? f.records.map((r) => ({ record: r.record, recHex: r.recHex, effect: r.effect })) : [],
            icon: iconInfo(rom, e.iconId),
        };
    }, (e, m) => singleAlchemyMarkdown(e, m));
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
