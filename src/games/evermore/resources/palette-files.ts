// Ownership: `soe://rom/assets/palettes/` — all palettes referenced in the ROM. Pure.

import { dir, json, text } from './nodes';
import type { Entry, VfsNode } from './nodes';
import { assetRelations, PaletteRelation } from '../sprites/asset-relations';

type Rom = Uint8Array;
export type PaletteModel = PaletteRelation;

export function roughColorName(hex: string, index?: number): string {
    if (index === 0) return 'Transparent';
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!m) return 'Unknown';
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / (2 * 255);

    if (max < 25) return 'Black';
    if (min > 230) return 'White';
    if (d < 18) {
        if (l < 0.25) return 'Dark Gray';
        if (l < 0.65) return 'Gray';
        return 'Light Gray';
    }

    let h = 0;
    if (max === r) {
        h = ((g - b) / d) % 6;
    } else if (max === g) {
        h = (b - r) / d + 2;
    } else {
        h = (r - g) / d + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = d / (1 - Math.abs(2 * l - 1)) / 255;

    // Special low-saturation or dark warm tones: Brown / Tan / Olive
    if (h >= 15 && h <= 50 && l < 0.45) return l < 0.22 ? 'Dark Brown' : 'Brown';
    if (h >= 20 && h <= 60 && l >= 0.45 && l <= 0.75 && s < 0.55) return 'Tan';
    if (h >= 50 && h <= 90 && l < 0.4) return 'Olive';

    if (h < 15 || h >= 345) {
        if (l < 0.3) return 'Dark Red';
        if (l > 0.7) return 'Pink';
        return 'Red';
    }
    if (h < 45) {
        if (l < 0.3) return 'Dark Brown';
        if (l > 0.7) return 'Peach';
        return 'Orange';
    }
    if (h < 70) {
        if (l < 0.35) return 'Dark Gold';
        if (l > 0.75) return 'Light Yellow';
        return 'Yellow';
    }
    if (h < 165) {
        if (h < 95) return l > 0.6 ? 'Lime Green' : 'Yellow-Green';
        if (l < 0.3) return 'Dark Green';
        if (l > 0.7) return 'Light Green';
        return 'Green';
    }
    if (h < 195) {
        if (l < 0.3) return 'Dark Teal';
        if (l > 0.7) return 'Light Cyan';
        return 'Cyan';
    }
    if (h < 260) {
        if (l < 0.3) return 'Dark Blue';
        if (l > 0.7) return 'Light Blue';
        return 'Blue';
    }
    if (h < 295) {
        if (l < 0.3) return 'Dark Purple';
        if (l > 0.7) return 'Lavender';
        return 'Purple';
    }
    if (l < 0.3) return 'Dark Magenta';
    if (l > 0.7) return 'Pink';
    return 'Magenta';
}

function buildPaletteModels(rom: Rom): Map<number, PaletteModel> {
    return assetRelations(rom).palettes;
}

function paletteMarkdown(model: PaletteModel): string {
    const lines: string[] = [
        `# Palette #${model.index} (${model.addrHex})`,
        '',
        `Index: **#${model.index}** in ROM list · Address: \`$90${model.address.toString(16).padStart(4, '0')}\``,
        '',
    ];

    if (model.tags.length) {
        lines.push('## Tags', ...model.tags.map((t) => `- \`${t}\``), '');
    }

    lines.push('## Colors');
    lines.push('');
    lines.push('| Index | Hex | Color Name |');
    lines.push('|:---|:---|:---|');
    for (let i = 0; i < model.colors.length; i++) {
        const hexVal = model.colors[i];
        lines.push(`| ${i} | \`${hexVal}\` | ${roughColorName(hexVal, i)} |`);
    }
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
            const title = anim.uri ? `[${anim.label}](${anim.uri})` : `**${anim.label}**`;
            lines.push(`- ${title} (record \`$${anim.record.toString(16).padStart(4, '0')}\`, script \`${anim.scriptHex}\`)`);
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
    const [palKey, leaf] = segments;
    const models = buildPaletteModels(rom);
    const modelsList = [...models.values()].sort((a, b) => a.index - b.index);

    // Root directory: soe://rom/assets/palettes/
    if (!palKey) {
        const entries: Entry[] = modelsList.map((m) => [String(m.index), 'dir']);
        return dir(entries, () => {
            const rows = modelsList.map((m) => {
                const chars = m.characters.map((c) => `[${c.name}](soe://rom/assets/characters/${c.id}/)`).join(', ');
                const who = chars || (m.tags.length ? m.tags.map((t) => `\`${t}\``).join(', ') : '*unowned*');
                return `| [#${m.index}](soe://rom/assets/palettes/${m.index}/) | \`${m.addrHex}\` | ${who} |`;
            }).join('\n');
            return `# soe://rom/assets/palettes/\n\n${models.size} unique palettes referenced in ROM:\n\n| Index | Address | Characters |\n|:---|:---|:---|\n${rows}\n`;
        });
    }

    let model: PaletteModel | undefined;
    if (/^\d+$/.test(palKey)) {
        const idx = parseInt(palKey, 10);
        model = modelsList.find((m) => m.index === idx);
    }
    if (!model) {
        const addr = parseInt(palKey, 16);
        model = models.get(addr);
    }
    if (!model) return null;

    // Palette directory: soe://rom/assets/palettes/<index>/
    if (!leaf) {
        const entries: Entry[] = [
            ['palette.json', 'file'],
        ];
        return dir(entries, () => paletteMarkdown(model));
    }

    if (leaf === 'info.md' || leaf === 'index.md') {
        return text(() => paletteMarkdown(model));
    }

    if (leaf === 'palette.json') {
        return json(() => ({
            index: model.index,
            address: model.address,
            addrHex: model.addrHex,
            colors: model.colors,
            tags: model.tags,
            characters: model.characters,
            animations: model.animations,
        }));
    }

    return null;
}
