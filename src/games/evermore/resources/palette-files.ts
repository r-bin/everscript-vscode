// Ownership: `soe://rom/assets/palettes/` — all palettes referenced in the ROM. Pure.

import { paletteAt, paletteAddresses } from '../maps/character-record';
import { readAllCharacters } from '../sprites/character-model';
import { buildAnimationCatalog } from '../sprites/animation-catalog';
import { dir, json, text } from './nodes';
import type { Entry, VfsNode } from './nodes';

type Rom = Uint8Array;

const colourHex = ([r, g, b]: [number, number, number]): string =>
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

interface PaletteModel {
    address: number;
    addrHex: string;
    index: number;
    colors: string[];
    tags: string[];
    characters: { id: number; name: string; role: string }[];
    animations: { record: number; label: string; scriptHex: string }[];
}

const modelCache = new WeakMap<Rom, Map<number, PaletteModel>>();

function buildPaletteModels(rom: Rom): Map<number, PaletteModel> {
    let cached = modelCache.get(rom);
    if (cached) return cached;

    const allAddresses = paletteAddresses(rom);
    const chars = readAllCharacters(rom);
    const catalog = buildAnimationCatalog(rom, chars);

    const map = new Map<number, PaletteModel>();

    for (let idx = 0; idx < allAddresses.length; idx++) {
        const addr = allAddresses[idx];
        const hexStr = addr.toString(16).padStart(4, '0');
        const colors = paletteAt(rom, addr).map(colourHex);

        const characters: PaletteModel['characters'] = [];
        const tags = new Set<string>();

        for (const c of chars) {
            if ((c.stats.palette & 0xffff) === addr) {
                characters.push({ id: c.id, name: c.name, role: 'primary palette (+0x09)' });
                if (c.id === 0) tags.add('BOY');
                if (c.id === 1) tags.add('DOG');
            }
            if ((c.stats.palette2 & 0xffff) === addr) {
                characters.push({ id: c.id, name: c.name, role: 'secondary palette (+0x0B)' });
            }
            for (const w of c.weapons || []) {
                if (((w.paletteAddr || 0) & 0xffff) === addr) {
                    characters.push({ id: c.id, name: c.name, role: (c.id === 1 ? 'Dog Form: ' : 'Weapon: ') + w.name });
                    if (c.id === 0) tags.add('BOY');
                    if (c.id === 1) tags.add('DOG');
                }
            }
        }

        const animations: PaletteModel['animations'] = [];
        for (const entry of catalog) {
            if ((entry.paletteAddr & 0xffff) === addr) {
                animations.push({ record: entry.record, label: entry.label, scriptHex: entry.scriptHex });
            }
        }

        map.set(addr, {
            address: addr,
            addrHex: '$' + hexStr,
            index: idx,
            colors,
            tags: [...tags],
            characters,
            animations,
        });
    }

    modelCache.set(rom, map);
    return map;
}

function paletteMarkdown(model: PaletteModel): string {
    const lines: string[] = [
        `# Palette ${model.addrHex} (#${model.index})`,
        '',
        `Address: \`$90${model.address.toString(16).padStart(4, '0')}\` · Index: **#${model.index}** in ROM list`,
        '',
    ];

    if (model.tags.length) {
        lines.push('## Tags', ...model.tags.map((t) => `- \`${t}\``), '');
    }

    lines.push('## Colors');
    lines.push(model.colors.map((c, i) => `${i}: \`${c}\``).join(' · '));
    lines.push('');

    lines.push('## Characters using this palette');
    if (model.characters.length) {
        for (const ch of model.characters) {
            lines.push(`- [${ch.name} (id #${ch.id})](soe://rom/assets/characters/${ch.id}/) — ${ch.role}`);
        }
    } else {
        lines.push('*No character records directly point to this palette.*');
    }
    lines.push('');

    lines.push('## Animations referencing this palette');
    if (model.animations.length) {
        for (const anim of model.animations) {
            lines.push(`- **${anim.label}** (record \`$${anim.record.toString(16).padStart(4, '0')}\`, script \`${anim.scriptHex}\`)`);
        }
    } else {
        lines.push('*No catalog animations directly reference this palette.*');
    }
    lines.push('');

    return lines.join('\n');
}

export function resolvePalettes(segments: string[], rom: Rom): VfsNode | null {
    const [palHex, leaf] = segments;
    const models = buildPaletteModels(rom);

    // Root directory: soe://rom/assets/palettes/
    if (!palHex) {
        const entries: Entry[] = [...models.values()].map((m) => [m.address.toString(16).padStart(4, '0'), 'dir']);
        return dir(entries, () => {
            const list = [...models.values()]
                .map((m) => `- [#${m.index}: ${m.addrHex}](soe://rom/assets/palettes/${m.address.toString(16).padStart(4, '0')}/) — ${m.characters.map((c) => c.name).join(', ') || m.tags.join(', ') || 'unowned'}`)
                .join('\n');
            return `# soe://rom/assets/palettes/\n\n${models.size} unique palettes referenced in ROM:\n\n${list}\n`;
        });
    }

    const addr = parseInt(palHex, 16);
    const model = models.get(addr);
    if (!model) return null;

    // Palette directory: soe://rom/assets/palettes/<4hex>/
    if (!leaf) {
        const entries: Entry[] = [
            ['info.md', 'file'],
            ['palette.json', 'file'],
        ];
        return dir(entries, () => paletteMarkdown(model));
    }

    if (leaf === 'info.md') {
        return text(() => paletteMarkdown(model));
    }

    if (leaf === 'palette.json') {
        return json(() => ({
            address: model.address,
            addrHex: model.addrHex,
            index: model.index,
            colors: model.colors,
            tags: model.tags,
            characters: model.characters,
            animations: model.animations,
        }));
    }

    return null;
}
