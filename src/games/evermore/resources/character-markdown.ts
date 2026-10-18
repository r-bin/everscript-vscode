// Ownership: Markdown builders for soe://rom/assets/characters/ and animations/. Pure.

import { hexId } from './resource-uri';

/** What these pages read of a character (sprites/character-model.js) and its animations. */
interface AnimOption { key?: string; label?: string; purpose?: string | null; offset?: number }
interface CharacterInfo {
    id: number; name: string; disposition: { label: string }; paletteAddrHex: string; anims: AnimOption[];
    stats: { hp: number; attack: number; defense: number; aggro_range: number };
    hitbox: { width: number; height: number; radius: number };
}
interface AnimationInfo {
    scriptHex: string; totalTicks: number; width: number; height: number;
    frames: { ticks: number; spriteHex: string }[];
}
interface BlockUse { blockHex: string; size: number; count: number }

function characterMarkdown(c: CharacterInfo): string {
    return `# Character ${hexId(c.id, 2)}: ${c.name}

| Property | Value |
|---|---|
| Disposition | **${c.disposition.label}** |
| HP | ${c.stats.hp} |
| Attack / Defence | ${c.stats.attack} / ${c.stats.defense} |
| Hitbox | ${c.hitbox.width}×${c.hitbox.height} px (radius ${c.hitbox.radius}) |
| Aggro range | ${c.stats.aggro_range} |
| Palette | \`${c.paletteAddrHex}\` |
| Animations | ${c.anims.length} entries ([animations/](animations/index.md)) |

![Idle Sprite](sprite.png)

## Animations
${c.anims.map((a) => `- [${a.label || a.key}](animations/${a.key || hexId(a.offset ?? 0, 2)}/index.md)${a.purpose ? ` *(purpose: ${a.purpose})*` : ''}`).join('\n')}
`;
}

function charactersIndexMarkdown(chars: CharacterInfo[]): string {
    return `# soe://rom/assets/characters/

${chars.length} characters in the engine table at \`$8EB678\`.

| ID | Name | Type | HP | Atk / Def | Radius | Preview |
|---|---|---|---|---|---|---|
${chars.map((c) => `| [${hexId(c.id, 2)}](${hexId(c.id, 2)}/info.md) | ${c.name} | ${c.disposition.label} | ${c.stats.hp} | ${c.stats.attack}/${c.stats.defense} | ${c.hitbox.radius} | [sprite](${hexId(c.id, 2)}/sprite.png) |`).join('\n')}
`;
}

function animationMarkdown(charId: number, animOpt: AnimOption, anim: AnimationInfo): string {
    return `# Animation: ${animOpt.label || animOpt.key}

| Property | Value |
|---|---|
| Purpose | **${animOpt.purpose || 'unspecified'}** |
| Script address | \`${anim.scriptHex}\` |
| Frames | ${anim.frames.length} ([frames/](frames/index.md)) |
| Total duration | ${anim.totalTicks} ticks (~${(anim.totalTicks / 60).toFixed(2)}s) |
| Size | ${anim.width}×${anim.height} px |
| Tiles used | [tiles/](tiles/index.md) |

![Animation](animation.gif)

[script.txt](script.txt) | [info.json](info.json)
`;
}

function characterAnimationsIndexMarkdown(charData: Pick<CharacterInfo, 'name' | 'anims'>): string {
    return [
        `# Animations: ${charData.name}`, '',
        `${charData.anims.length} animations available. Each has \`animation.gif\`, \`script.txt\`, \`frames/\`, and \`tiles/\`.`, '',
        ...charData.anims.map((a) => {
            const k = a.key || hexId(a.offset || 0, 2);
            return `- [${a.label || k}](${k}/index.md)${a.purpose ? ` *(purpose: ${a.purpose})*` : ''}`;
        }),
    ].join('\n');
}

function framesIndexMarkdown(anim: Pick<AnimationInfo, 'frames' | 'totalTicks'>): string {
    return [
        '# Frames', '',
        `${anim.frames.length} frames (${anim.totalTicks} ticks total).`, '',
        ...anim.frames.map((f, i) => `### Frame ${hexId(i, 2)} (${f.ticks} ticks, sprite ${f.spriteHex})\n![Frame ${hexId(i, 2)}](${hexId(i, 2)}.png)\n`),
    ].join('\n');
}

function tilesIndexMarkdown(blocks: BlockUse[]): string {
    return [
        '# Animation Tiles (Sprite Blocks)', '',
        `${blocks.length} unique sprite blocks used in this animation.`, '',
        '| Block | Size | Used | |', '|---|---|---|---|',
        ...blocks.map((b) => `| \`0x${b.blockHex}\` | ${b.size}×${b.size} | ${b.count}× | ![Block ${b.blockHex}](${b.blockHex}.png) |`),
    ].join('\n') + '\n';
}

export type { CharacterInfo, AnimationInfo, AnimOption, BlockUse };
export { characterMarkdown, charactersIndexMarkdown, animationMarkdown, characterAnimationsIndexMarkdown, framesIndexMarkdown, tilesIndexMarkdown };


