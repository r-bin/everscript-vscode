// Ownership: `soe://rom/assets/palettes/` — all palettes referenced in the ROM. Pure.

import { dir, json, text } from './nodes';
import type { Entry, VfsNode } from './nodes';
import { assetRelations, PaletteRelation } from '../sprites/asset-relations';

type Rom = Uint8Array;
export type PaletteModel = PaletteRelation;

function buildPaletteModels(rom: Rom): Map<number, PaletteModel> {
    return assetRelations(rom).palettes;
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

    if (model.sprites && model.sprites.length) {
        lines.push('## Sprites drawn with this palette');
        for (const s of model.sprites.slice(0, 24)) {
            lines.push(`- [Sprite #${s.index} (${s.addrHex})](soe://rom/assets/sprites/${s.address.toString(16).padStart(6, '0')}/)`);
        }
        if (model.sprites.length > 24) lines.push(`*... and ${model.sprites.length - 24} more sprites*`);
        lines.push('');
    }

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

