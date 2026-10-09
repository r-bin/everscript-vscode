'use strict';
// Ownership: Markdown builders for soe://rom/assets/characters/ and animations/. Pure.

const { hexId } = require('../shared/resource-uri');

function characterMarkdown(c) {
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
${c.anims.map((a) => `- [${a.label || a.key}](animations/${a.key || hexId(a.offset, 2)}/index.md)`).join('\n')}
`;
}

function charactersIndexMarkdown(chars) {
    return `# soe://rom/assets/characters/

${chars.length} characters in the engine table at \`$8EB678\`.

| ID | Name | Type | HP | Atk / Def | Radius | Preview |
|---|---|---|---|---|---|---|
${chars.map((c) => `| [${hexId(c.id, 2)}](${hexId(c.id, 2)}/info.md) | ${c.name} | ${c.disposition.label} | ${c.stats.hp} | ${c.stats.attack}/${c.stats.defense} | ${c.hitbox.radius} | [sprite](${hexId(c.id, 2)}/sprite.png) |`).join('\n')}
`;
}

function animationMarkdown(charId, animOpt, anim) {
    return `# Animation: ${animOpt.label || animOpt.key}

| Property | Value |
|---|---|
| Script address | \`${anim.scriptHex}\` |
| Frames | ${anim.frames.length} ([frames/](frames/index.md)) |
| Total duration | ${anim.totalTicks} ticks (~${(anim.totalTicks / 60).toFixed(2)}s) |
| Size | ${anim.width}×${anim.height} px |
| Tiles used | [tiles/](tiles/index.md) |

![Animation](animation.gif)

[script.txt](script.txt) | [info.json](info.json)
`;
}

function characterAnimationsIndexMarkdown(charData) {
    return [
        `# Animations: ${charData.name}`, '',
        `${charData.anims.length} animations available. Each has \`animation.gif\`, \`script.txt\`, \`frames/\`, and \`tiles/\`.`, '',
        ...charData.anims.map((a) => {
            const k = a.key || hexId(a.offset || 0, 2);
            return `- [${a.label || k}](${k}/index.md)`;
        }),
    ].join('\n');
}

function framesIndexMarkdown(anim) {
    return [
        '# Frames', '',
        `${anim.frames.length} frames (${anim.totalTicks} ticks total).`, '',
        ...anim.frames.map((f, i) => `### Frame ${hexId(i, 2)} (${f.ticks} ticks, sprite ${f.spriteHex})\n![Frame ${hexId(i, 2)}](${hexId(i, 2)}.png)\n`),
    ].join('\n');
}

function tilesIndexMarkdown(blocks) {
    return [
        '# Animation Tiles (Sprite Blocks)', '',
        `${blocks.length} unique sprite blocks used in this animation.`, '',
        '| Block | Size | Used | |', '|---|---|---|---|',
        ...blocks.map((b) => `| \`0x${b.blockHex}\` | ${b.size}×${b.size} | ${b.count}× | ![Block ${b.blockHex}](${b.blockHex}.png) |`),
    ].join('\n') + '\n';
}

function animationsCatalogIndexMarkdown(catalog) {
    return [
        '# soe://rom/assets/animations/', '',
        `${catalog.length} animation groups in ROM ($C4).`, '',
        '| ID / Record | Label | Frames | Ticks |', '|---|---|---|---|',
        ...catalog.slice(0, 100).map((c) => `| [${c.idHex || hexId(c.record, 4)}](${c.idHex || hexId(c.record, 4)}/index.md) | ${c.label || ''} | ${c.frameCount || ''} | ${c.totalTicks || ''} |`),
    ].join('\n') + '\n';
}

module.exports = {
    characterMarkdown,
    charactersIndexMarkdown,
    animationMarkdown,
    characterAnimationsIndexMarkdown,
    framesIndexMarkdown,
    tilesIndexMarkdown,
    animationsCatalogIndexMarkdown,
};

