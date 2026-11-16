// Ownership: `soe://rom/assets/sprites/` — all sprites referenced in the ROM. Pure.

import { dir, json, text } from './nodes';
import type { Entry, VfsNode } from './nodes';
import { assetRelations, SpriteRelation } from '../sprites/asset-relations';

type Rom = Uint8Array;
export type SpriteModel = SpriteRelation;

function buildSpriteModels(rom: Rom): Map<number, SpriteModel> {
    return assetRelations(rom).sprites;
}

function spriteMarkdown(model: SpriteModel): string {
    const lines: string[] = [
        `# Sprite ${model.addrHex} (#${model.index})`,
        '',
        `Address: \`${model.addrHex}\` · Index: **#${model.index}** in ROM list`,
        '',
        `Dimensions: ~${model.widthPx}×${model.heightPx} px (${model.chunkCount} chunks)`,
        '',
    ];

    if (model.tags && model.tags.length) {
        lines.push('## Tags', ...model.tags.map((t) => `- \`${t}\``), '');
    }

    lines.push('## Characters using this sprite');
    if (model.characters && model.characters.length) {
        for (const ch of model.characters) {
            lines.push(`- [${ch.name} (id #${ch.id})](soe://rom/assets/characters/${ch.id}/)`);
        }
    } else {
        lines.push('*No character records directly point to this sprite.*');
    }
    lines.push('');

    lines.push('## Palettes used with this sprite');
    if (model.palettes && model.palettes.length) {
        for (const p of model.palettes) {
            lines.push(`- [Palette #${p.index} (${p.addrHex})](soe://rom/assets/palettes/${p.index}/)`);
        }
    } else {
        lines.push('*No known palettes associated with this sprite.*');
    }
    lines.push('');

    lines.push('## Animations referencing this sprite');
    if (model.animations && model.animations.length) {
        for (const anim of model.animations) {
            lines.push(`- **${anim.label}** (record \`$${anim.record.toString(16).padStart(4, '0')}\`, script \`${anim.scriptHex}\`)`);
        }
    } else {
        lines.push('*No catalog animations directly reference this sprite.*');
    }
    lines.push('');

    return lines.join('\n');
}

export function resolveSprites(segments: string[], rom: Rom): VfsNode | null {
    const [sprHex, leaf] = segments;
    const models = buildSpriteModels(rom);

    // Root directory: soe://rom/assets/sprites/
    const indexMd = () => {
        const list = [...models.values()]
            .map((m) => `- [#${m.index}: ${m.addrHex}](soe://rom/assets/sprites/${m.address.toString(16).padStart(6, '0')}/) — ~${m.widthPx}×${m.heightPx} px, ${m.chunkCount} chunks`)
            .join('\n');
        return `# soe://rom/assets/sprites/\n\n${models.size} unique sprites referenced in ROM:\n\n${list}\n`;
    };

    if (!sprHex) {
        const entries: Entry[] = [
            ['index.json', 'file'],
            ['index.md', 'file'],
            ...[...models.values()].map((m): Entry => [m.address.toString(16).padStart(6, '0'), 'dir']),
        ];
        return dir(entries, indexMd);
    }

    if (sprHex === 'index.json') {
        return json(() => [...models.values()].map((m) => ({
            address: m.address,
            addrHex: m.addrHex,
            index: m.index,
            widthPx: m.widthPx,
            heightPx: m.heightPx,
            chunkCount: m.chunkCount,
            tags: m.tags,
            characters: m.characters,
            palettes: m.palettes,
            animations: m.animations,
        })));
    }
    if (sprHex === 'index.md') {
        return text(indexMd);
    }

    const m = /^([0-9a-f]{1,6})(?:\.(json|md))?$/i.exec(sprHex);
    const rawHex = m ? m[1] : sprHex;
    const ext = m ? m[2] : undefined;

    const addr = parseInt(rawHex, 16);
    const model = models.get(addr);
    if (!model) return null;

    const serializeSprite = () => ({
        address: model.address,
        addrHex: model.addrHex,
        index: model.index,
        widthPx: model.widthPx,
        heightPx: model.heightPx,
        chunkCount: model.chunkCount,
        tags: model.tags,
        characters: model.characters,
        palettes: model.palettes,
        animations: model.animations,
    });

    if (ext === 'json') return leaf === undefined ? json(serializeSprite) : null;
    if (ext === 'md') return leaf === undefined ? text(() => spriteMarkdown(model)) : null;

    // Sprite directory: soe://rom/assets/sprites/<6hex>/
    if (!leaf) {
        const entries: Entry[] = [
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['sprite.json', 'file'],
        ];
        return dir(entries, () => spriteMarkdown(model));
    }

    if (leaf === 'info.md' || leaf === 'index.md') {
        return text(() => spriteMarkdown(model));
    }

    if (leaf === 'sprite.json' || leaf === 'info.json') {
        return json(serializeSprite);
    }

    return null;
}

