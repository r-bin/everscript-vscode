// Ownership: `soe://rom/assets/sprites/` — all sprites referenced in the ROM. Pure.

import { spriteAddresses, readSpriteInfo } from '../maps/sprites';
import { readAllCharacters } from '../sprites/character-model';
import { buildAnimationCatalog } from '../sprites/animation-catalog';
import { dir, json, text } from './nodes';
import type { Entry, VfsNode } from './nodes';

type Rom = Uint8Array;

interface SpriteModel {
    address: number;
    addrHex: string;
    index: number;
    widthPx: number;
    heightPx: number;
    chunkCount: number;
    animations: { record: number; label: string; scriptHex: string }[];
}

const spriteModelCache = new WeakMap<Rom, Map<number, SpriteModel>>();

function buildSpriteModels(rom: Rom): Map<number, SpriteModel> {
    let cached = spriteModelCache.get(rom);
    if (cached) return cached;

    const allAddrs = spriteAddresses(rom);
    const chars = readAllCharacters(rom);
    const catalog = buildAnimationCatalog(rom, chars);

    const map = new Map<number, SpriteModel>();

    for (let idx = 0; idx < allAddrs.length; idx++) {
        const addr = allAddrs[idx];
        const hexStr = addr.toString(16).padStart(6, '0');

        let widthPx = 0, heightPx = 0, chunkCount = 0;
        try {
            const info = readSpriteInfo(rom, addr);
            chunkCount = info.chunks.length;
            let minX = 0, minY = 0, maxX = 1, maxY = 1;
            for (const c of info.chunks) {
                const sz = c.large ? 16 : 8;
                if (c.x < minX) minX = c.x;
                if (c.y < minY) minY = c.y;
                if (c.x + sz > maxX) maxX = c.x + sz;
                if (c.y + sz > maxY) maxY = c.y + sz;
            }
            widthPx = maxX - minX;
            heightPx = maxY - minY;
        } catch (_) {}

        map.set(addr, {
            address: addr,
            addrHex: '$' + hexStr,
            index: idx,
            widthPx,
            heightPx,
            chunkCount,
            animations: [],
        });
    }

    // Connect animations that reference this sprite
    for (const entry of catalog) {
        // Search entry script
        // catalog entries don't list all individual sprites, but we can associate them if known
    }

    spriteModelCache.set(rom, map);
    return map;
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

    if (model.animations.length) {
        lines.push('## Animations referencing this sprite');
        for (const anim of model.animations) {
            lines.push(`- **${anim.label}** (record \`$${anim.record.toString(16).padStart(4, '0')}\`, script \`${anim.scriptHex}\`)`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

export function resolveSprites(segments: string[], rom: Rom): VfsNode | null {
    const [sprHex, leaf] = segments;
    const models = buildSpriteModels(rom);

    // Root directory: soe://rom/assets/sprites/
    if (!sprHex) {
        const entries: Entry[] = [...models.values()].map((m) => [m.address.toString(16).padStart(6, '0'), 'dir']);
        return dir(entries, () => {
            const list = [...models.values()]
                .map((m) => `- [#${m.index}: ${m.addrHex}](soe://rom/assets/sprites/${m.address.toString(16).padStart(6, '0')}/) — ~${m.widthPx}×${m.heightPx} px, ${m.chunkCount} chunks`)
                .join('\n');
            return `# soe://rom/assets/sprites/\n\n${models.size} unique sprites referenced in ROM:\n\n${list}\n`;
        });
    }

    const addr = parseInt(sprHex, 16);
    const model = models.get(addr);
    if (!model) return null;

    // Sprite directory: soe://rom/assets/sprites/<6hex>/
    if (!leaf) {
        const entries: Entry[] = [
            ['info.md', 'file'],
            ['sprite.json', 'file'],
        ];
        return dir(entries, () => spriteMarkdown(model));
    }

    if (leaf === 'info.md') {
        return text(() => spriteMarkdown(model));
    }

    if (leaf === 'sprite.json') {
        return json(() => ({
            address: model.address,
            addrHex: model.addrHex,
            index: model.index,
            widthPx: model.widthPx,
            heightPx: model.heightPx,
            chunkCount: model.chunkCount,
            animations: model.animations,
        }));
    }

    return null;
}
