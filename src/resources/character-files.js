'use strict';
// Ownership: `soe://rom/assets/characters/` and `soe://rom/assets/animations/` —
// characters, character animations, animated GIFs, frames, sprite tiles, and bytecode listings. Pure.

const { hexId, slugify } = require('../shared/resource-uri');
const { encodePng } = require('../maps/dist/png');
const { renderCharacterSprite } = require('../maps/dist/characters');
const { characterPalette, paletteAt } = require('../maps/dist/character-record');
const { decodeSpriteBlock } = require('../maps/dist/sprites');
const { readCharacter, readAllCharacters, CHARACTER_COUNT } = require('../sprites/character-model');
const { renderAnimation } = require('../sprites/animation-decoder');
const { encodeGif } = require('./gif');
const { dir, file, json, text } = require('./nodes');
const {
    characterMarkdown,
    charactersIndexMarkdown,
    animationMarkdown,
    characterAnimationsIndexMarkdown,
    framesIndexMarkdown,
    tilesIndexMarkdown,
} = require('./character-markdown');

// WeakMap cache: rom -> Map(key -> renderedAnim)
const _animCache = new WeakMap();

function getRenderedAnim(rom, charId, animOpt) {
    let map = _animCache.get(rom);
    if (!map) {
        map = new Map();
        _animCache.set(rom, map);
    }
    const key = `${charId}:${typeof animOpt === 'object' ? animOpt.key || animOpt.offset || animOpt.scriptAddr : animOpt}`;
    if (map.has(key)) return map.get(key);
    const res = renderAnimation(rom, charId, animOpt);
    map.set(key, res);
    return res;
}

// ── characters ─────────────────────────────────────────────────────────────

function resolveCharacters(segments, rom) {
    const [charIdent, sub, leaf, extra, ...rest] = segments;

    // Root list of all 142 characters
    if (charIdent === undefined) {
        const chars = readAllCharacters(rom);
        const entries = [
            ['index.json', 'file'],
            ...chars.map((c) => [hexId(c.id, 2), 'dir']),
        ];
        return dir(entries, () => charactersIndexMarkdown(chars));
    }

    if (charIdent === 'index.json') {
        const chars = readAllCharacters(rom);
        return json(() => chars.map((c) => ({
            id: hexId(c.id, 2),
            num: c.id,
            slug: slugify(c.name),
            name: c.name,
            hostile: c.disposition.hostile,
            disposition: c.disposition.label,
            hp: c.stats.hp,
            attack: c.stats.attack,
            defense: c.stats.defense,
            radius: c.hitbox.radius,
        })));
    }

    const charId = parseCharId(charIdent, rom);
    if (charId === null) return null;

    const charData = readCharacter(rom, charId);

    // Root of one character: soe://rom/assets/characters/<id>/
    if (sub === undefined) {
        const entries = [
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['sprite.png', 'file'],
            ['palette.json', 'file'],
            ['animations', 'dir'],
        ];
        return dir(entries, () => characterMarkdown(charData));
    }

    if (sub === 'info.json') return json(() => charData);
    if (sub === 'info.md') return text(() => characterMarkdown(charData));
    if (sub === 'palette.json') return json(() => ({
        address: charData.paletteAddrHex,
        colors: charData.paletteColors,
    }));
    if (sub === 'sprite.png') {
        const s = renderCharacterSprite(rom, charId);
        return s ? file(() => encodePng(s)) : null;
    }

    // Direct <anim>.gif shortcut on character root (for backwards compatibility)
    if (sub.endsWith('.gif')) {
        const animKey = sub.slice(0, -4);
        const animOpt = findAnimOption(charData, animKey);
        if (animOpt) return animationGifFile(rom, charId, animOpt);
        return null;
    }

    // Character animations folder: soe://rom/assets/characters/<id>/animations/...
    if (sub === 'animations') {
        if (rest.length > 1) return null;
        return resolveCharacterAnimations(charData, leaf, extra, rest[0], rom);
    }

    return null;
}

function parseCharId(ident, rom) {
    if (/^[0-9a-f]{1,2}$/i.test(ident)) {
        const n = parseInt(ident, 16);
        if (n >= 0 && n < CHARACTER_COUNT) return n;
    }
    const slug = slugify(ident);
    for (let i = 0; i < CHARACTER_COUNT; i++) {
        const c = readCharacter(rom, i);
        if (slugify(c.name) === slug) return i;
    }
    return null;
}

// ── animations subfolder ───────────────────────────────────────────────────

function findAnimOption(charData, key) {
    return charData.anims.find((a) => a.key === key || hexId(a.offset || 0, 2) === key) ||
           charData.anims.find((a) => slugify(a.label || '') === slugify(key)) || null;
}

function resolveCharacterAnimations(charData, animKey, leaf, extra, rom) {
    const charId = charData.id;

    // Animations index
    if (animKey === undefined) {
        const entries = [
            ['index.json', 'file'],
            ...charData.anims.map((a) => [a.key || hexId(a.offset || 0, 2), 'dir']),
        ];
        return dir(entries, () => characterAnimationsIndexMarkdown(charData));
    }

    if (animKey === 'index.json') {
        return json(() => charData.anims.map((a) => ({
            key: a.key,
            label: a.label,
            offset: a.offset,
            animRec: a.animRec,
            scriptAddr: a.scriptAddr,
            category: a.category,
        })));
    }

    const animOpt = findAnimOption(charData, animKey);
    if (!animOpt) return null;

    return resolveAnimationDetails(rom, charId, animOpt, leaf, extra);
}

function resolveAnimationDetails(rom, charId, animOpt, leaf, extra) {
    const anim = getRenderedAnim(rom, charId, animOpt);
    if (!anim) return null;

    // Animation folder root: soe://rom/assets/characters/<id>/animations/<name>/
    if (leaf === undefined) {
        const entries = [
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['animation.gif', 'file'],
            ['script.txt', 'file'],
            ['script.json', 'file'],
            ['frames', 'dir'],
            ['tiles', 'dir'],
        ];
        return dir(entries, () => animationMarkdown(charId, animOpt, anim));
    }

    if (leaf === 'info.json') {
        return json(() => ({
            characterId: charId,
            key: animOpt.key,
            label: animOpt.label,
            scriptAddrHex: anim.scriptHex,
            totalTicks: anim.totalTicks,
            frameCount: anim.frames.length,
            width: anim.width,
            height: anim.height,
            originX: anim.originX,
            originY: anim.originY,
            complete: anim.complete,
            strikeBoxes: anim.strikeBoxes,
        }));
    }

    if (leaf === 'info.md') return text(() => animationMarkdown(charId, animOpt, anim));
    if (leaf === 'animation.gif' || leaf === `${animOpt.key}.gif`) return animationGifFile(rom, charId, animOpt);
    if (leaf === 'script.txt') return text(() => (anim.script ? formatScriptDisassembly(anim.script) : ''));
    if (leaf === 'script.json') return json(() => anim.script || []);

    // Frames folder
    if (leaf === 'frames') {
        return resolveFrames(anim, extra);
    }

    // Tiles folder
    if (leaf === 'tiles') {
        return resolveAnimationTiles(rom, charId, anim, extra);
    }

    return null;
}

function formatScriptDisassembly(scriptLines) {
    if (!Array.isArray(scriptLines) || scriptLines.length === 0) return '';
    return scriptLines.map((l) => {
        const addr = `$${(l.addrHex || '').toUpperCase()}:`;
        const bytes = (l.bytesHex || '').padEnd(14);
        const text = l.text || '';
        const end = l.endFrame ? ' ; [frame-end]' : '';
        return `${addr}  ${bytes}  ${text}${end}`;
    }).join('\n') + '\n';
}

function animationGifFile(rom, charId, animOpt) {
    return file(() => {
        const anim = getRenderedAnim(rom, charId, animOpt);
        if (!anim || !anim.frames.length) return Buffer.alloc(0);
        const frames = anim.frames.map((f) => ({
            data: f.rgba || new Uint8Array(anim.width * anim.height * 4),
            ticks: f.ticks || 4,
        }));
        return encodeGif(anim.width, anim.height, frames);
    });
}

// ── frames folder ──────────────────────────────────────────────────────────

function resolveFrames(anim, frameFile) {
    if (frameFile === undefined) {
        const entries = [
            ['index.json', 'file'],
            ...anim.frames.map((_, i) => [hexId(i, 2) + '.png', 'file']),
            ...anim.frames.map((_, i) => [hexId(i, 2) + '.json', 'file']),
        ];
        return dir(entries, () => framesIndexMarkdown(anim));
    }

    if (frameFile === 'index.json') {
        return json(() => anim.frames.map((f, i) => ({
            frameIndex: i,
            ticks: f.ticks,
            spriteHex: f.spriteHex,
            strikeBox: f.strikeBox,
            chunks: f.chunks,
        })));
    }

    const m = /^([0-9a-f]+)\.(png|json)$/i.exec(frameFile);
    if (!m) return null;
    const idx = parseInt(m[1], 16);
    if (idx < 0 || idx >= anim.frames.length) return null;
    const f = anim.frames[idx];

    if (m[2] === 'png') {
        return file(() => f.pngBuf || (f.png ? Buffer.from(f.png.split(',')[1], 'base64') : Buffer.alloc(0)));
    }
    if (m[2] === 'json') {
        return json(() => ({
            frameIndex: idx,
            ticks: f.ticks,
            spriteHex: f.spriteHex,
            strikeBox: f.strikeBox,
            invulnerable: f.invulnerable,
            contact: f.contact,
            chunks: f.chunks,
        }));
    }
    return null;
}

// ── tiles folder ───────────────────────────────────────────────────────────

function resolveAnimationTiles(rom, charId, anim, tileFile) {
    // Collect unique blocks across all frames
    const blockMap = new Map();
    for (const f of anim.frames) {
        for (const ch of f.chunks || []) {
            const key = `${ch.block}:${ch.large ? 1 : 0}`;
            if (!blockMap.has(key)) {
                blockMap.set(key, {
                    block: ch.block,
                    large: ch.large,
                    size: ch.large ? 16 : 8,
                    blockHex: hexId(ch.block, 4),
                    count: 1,
                });
            } else {
                blockMap.get(key).count++;
            }
        }
    }
    const blocks = [...blockMap.values()];

    if (tileFile === undefined) {
        const entries = [
            ['index.json', 'file'],
            ...blocks.map((b) => [b.blockHex + '.png', 'file']),
            ...blocks.map((b) => [b.blockHex + '.bin', 'file']),
        ];
        return dir(entries, () => tilesIndexMarkdown(blocks));
    }

    if (tileFile === 'index.json') {
        return json(() => blocks);
    }

    const m = /^([0-9a-f]{1,4})\.(png|bin)$/i.exec(tileFile);
    if (!m) return null;
    const blockNum = parseInt(m[1], 16);
    const b = blocks.find((x) => x.block === blockNum);
    if (!b) return null;

    const colours = Number.isInteger(charId) ? characterPalette(rom, charId) : paletteAt(rom, 0x90b00b);

    if (m[2] === 'png') {
        return file(() => {
            const decoded = decodeSpriteBlock(rom, b.block, b.large);
            const size = decoded.size;
            const data = new Uint8Array(size * size * 4);
            for (let i = 0; i < decoded.pixels.length; i++) {
                const v = decoded.pixels[i];
                if (v <= 0) continue;
                const [r, g, bColor] = colours[v] || [0, 0, 0];
                data[i * 4] = r;
                data[i * 4 + 1] = g;
                data[i * 4 + 2] = bColor;
                data[i * 4 + 3] = 255;
            }
            return encodePng({ width: size, height: size, data });
        });
    }

    if (m[2] === 'bin') {
        return file(() => {
            const decoded = decodeSpriteBlock(rom, b.block, b.large);
            return Buffer.from(decoded.pixels);
        });
    }

    return null;
}

module.exports = { resolveCharacters };

