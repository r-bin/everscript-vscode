'use strict';
// Ownership: `soe://rom/assets/tiles/` and room metatile palettes.
// The 6,688 master 16x16 CHR tile graphics in the $EE0000 table. Pure.

const { decompressTile16x16, decodeTilePixels } = require('../maps/dist/chr');
const { extractTileFamilyPalette } = require('../maps/dist/palette');
const { encodePng } = require('../maps/dist/png');
const { hexId } = require('../shared/resource-uri');
const { dir, file, json, text } = require('./nodes');

const GFX_COUNT = 6688;

function resolveTiles(segments, rom) {
    const [name, leaf] = segments;

    if (leaf !== undefined) return null;

    if (name === undefined) {
        const ids = Array.from({ length: GFX_COUNT }, (_, i) => hexId(i, 4));
        const entries = [
            ['index.json', 'file'],
            ...ids.map((id) => [id + '.png', 'file']),
        ];
        return dir(entries, () => [
            '# soe://rom/assets/tiles/', '',
            `${GFX_COUNT} 16×16 CHR tile graphics in the master table at \`$EE0000\`.`, '',
            '| ID | Image | Raw |', '|---|---|---|',
            ...ids.slice(0, 100).map((id) => `| \`0x${id}\` | ![Tile ${id}](${id}.png) | [${id}.bin](${id}.bin) |`),
            '', '*(showing first 100 of 6,688 tiles)*',
        ].join('\n') + '\n');
    }

    if (name === 'index.json') {
        return json(() => Array.from({ length: GFX_COUNT }, (_, i) => ({
            id: i,
            hex: hexId(i, 4),
            file: `${hexId(i, 4)}.png`,
        })));
    }

    const m = /^([0-9a-f]{1,4})\.(png|bin|json)$/i.exec(name);
    if (!m) return null;
    const tileId = parseInt(m[1], 16);
    if (tileId < 0 || tileId >= GFX_COUNT) return null;

    const ext = m[2];

    if (ext === 'bin') {
        return file(() => Buffer.from(decompressTile16x16(rom, tileId)));
    }

    if (ext === 'json') {
        return json(() => {
            const tileBytes = decompressTile16x16(rom, tileId);
            const pixels = decodeTilePixels(tileBytes);
            return {
                id: tileId,
                hex: hexId(tileId, 4),
                size: tileBytes.length,
                pixels: Array.from(pixels),
            };
        });
    }

    if (ext === 'png') {
        return file(() => renderTilePng(rom, tileId, 0));
    }

    return null;
}

function renderTilePng(rom, tileId, familyId = 0) {
    const tileBytes = decompressTile16x16(rom, tileId);
    const pixels = decodeTilePixels(tileBytes);
    const pal = extractTileFamilyPalette(rom, familyId);

    const data = new Uint8Array(16 * 16 * 4);
    for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];
        const [r, g, b, a] = pal[p] || [0, 0, 0, 0];
        const o = i * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = a;
    }
    return encodePng({ width: 16, height: 16, data });
}

// ── Room metatiles resolution helper ───────────────────────────────────────

function resolveRoomTiles(room, rom, leaf) {
    const { metatileTable, renderMetatileAtlas } = require('../maps/dist/metatiles');

    if (leaf === undefined) {
        const table = metatileTable(room);
        const entries = [
            ['index.json', 'file'],
            ['atlas.png', 'file'],
            ...table.map((m) => [hexId(m.index, 3) + '.png', 'file']),
        ];
        return dir(entries, () => [
            `# Room ${hexId(room.id, 2)} Metatiles`, '',
            `${room.metatileCount} metatiles in dictionary. Base metatile \`$${hexId(room.baseMetatile, 4)}\`.`, '',
            '![Atlas](atlas.png)', '',
            '| Index | ID | Uses | Layer 1 | Layer 2 | Collision |', '|---|---|---|---|---|---|',
            ...table.slice(0, 100).map((m) => `| [${hexId(m.index, 3)}](${hexId(m.index, 3)}.png) | \`$${hexId(m.id, 4)}\` | ${m.uses} | \`$${hexId(m.layer1, 4)}\` | \`$${hexId(m.layer2, 4)}\` | \`$${hexId(m.collision, 4)}\` |`),
            ...(table.length > 100 ? ['', `*(showing first 100 of ${table.length} metatiles)*`] : []),
        ].join('\n') + '\n');
    }

    if (leaf === 'index.json') {
        return json(() => metatileTable(room));
    }

    if (leaf === 'atlas.png') {
        return file(() => {
            const atlas = renderMetatileAtlas(rom, room);
            return encodePng(atlas.image);
        });
    }

    const m = /^([0-9a-f]+)\.png$/i.exec(leaf);
    if (!m) return null;
    const idx = parseInt(m[1], 16);
    if (idx < 0 || idx >= room.metatileCount) return null;

    // Render single 16x16 metatile from atlas
    return file(() => {
        const atlas = renderMetatileAtlas(rom, room);
        const col = idx % atlas.columns;
        const row = Math.floor(idx / atlas.columns);
        const cell = atlas.cell;
        const data = new Uint8Array(cell * cell * 4);
        for (let y = 0; y < cell; y++) {
            const srcY = row * cell + y;
            for (let x = 0; x < cell; x++) {
                const srcX = col * cell + x;
                const srcO = (srcY * atlas.image.width + srcX) * 4;
                const dstO = (y * cell + x) * 4;
                data[dstO] = atlas.image.data[srcO];
                data[dstO + 1] = atlas.image.data[srcO + 1];
                data[dstO + 2] = atlas.image.data[srcO + 2];
                data[dstO + 3] = atlas.image.data[srcO + 3];
            }
        }
        return encodePng({ width: cell, height: cell, data });
    });
}

module.exports = { resolveTiles, resolveRoomTiles };
