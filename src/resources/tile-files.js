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

const {
    tilePlane,
    isPlaneTransparent,
    isAlwaysWalkable,
    spriteDrawsInFront,
    spriteHiddenOn,
    holdsPlane,
    driftVector,
    entityGate,
} = require('../maps/dist/collision');

// ── Room metatiles resolution helper ───────────────────────────────────────

const _atlasCache = new WeakMap();

function getRoomAtlas(rom, room, layer = 'composite') {
    let map = _atlasCache.get(rom);
    if (!map) {
        map = new Map();
        _atlasCache.set(rom, map);
    }
    const rId = room.roomId ?? room.id ?? 0;
    const key = `${rId}:${layer}`;
    if (map.has(key)) return map.get(key);
    const { renderMetatileAtlas } = require('../maps/dist/metatiles');
    const atlas = renderMetatileAtlas(rom, room, { layer });
    map.set(key, atlas);
    return atlas;
}

function renderSingleMetatile(rom, room, idx, layer = 'composite') {
    const atlas = getRoomAtlas(rom, room, layer);
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
}

function decodeTilemapWord(word) {
    const chrIndex = word & 0x03ff;
    const slot = Math.floor(chrIndex / 0x20) * 8 + Math.floor((chrIndex % 0x20) / 2);
    const palette = (word >> 10) & 7;
    const priority = (word & 0x2000) !== 0;
    const flipX = (word & 0x4000) !== 0;
    const flipY = (word & 0x8000) !== 0;
    return {
        word: '$' + hexId(word, 4),
        wordValue: word,
        chrIndex,
        slot,
        palette,
        priority,
        flipX,
        flipY,
    };
}

function decodeCollisionWord(cw) {
    const geom = cw & 0x000f;
    return {
        word: '$' + hexId(cw, 4),
        wordValue: cw,
        geometry: geom,
        geometryHex: '$' + geom.toString(16),
        solid: geom === 0x0f,
        open: geom === 0x00,
        plane: tilePlane(cw),
        planeTransparent: isPlaneTransparent(cw),
        alwaysWalkable: isAlwaysWalkable(cw),
        spriteDrawsInFront: spriteDrawsInFront(cw),
        spriteHidden: spriteHiddenOn(cw),
        holdsPlane: holdsPlane(cw),
        drift: driftVector(cw),
        entityGate: entityGate(cw),
    };
}

function metatileComposition(room, m) {
    const rId = room.roomId ?? room.id ?? 0;
    return {
        roomId: rId,
        roomHex: hexId(rId, 2),
        index: m.index,
        indexHex: hexId(m.index, 3),
        id: m.id,
        idHex: '$' + hexId(m.id, 4),
        uses: m.uses,
        layer1: decodeTilemapWord(m.layer1),
        layer2: decodeTilemapWord(m.layer2),
        collision: decodeCollisionWord(m.collision),
    };
}

function metatileMarkdown(room, m) {
    const c = metatileComposition(room, m);
    const geomLabel = c.collision.solid ? 'Solid' : c.collision.open ? 'Open' : `Code ${c.collision.geometryHex}`;
    return `# Room ${c.roomHex} — Metatile ${c.indexHex} (${c.idHex})

**Usage**: ${c.uses} cell${c.uses === 1 ? '' : 's'} in room ${c.roomHex}
**Collision**: \`${c.collision.word}\` (${geomLabel})

| Composite | Layer 1 (Canopy) | Layer 2 (Terrain) |
|:---:|:---:|:---:|
| ![Composite](render.png) | ![Layer 1](layer1.png) | ![Layer 2](layer2.png) |

## Tilemap Layers

| Layer | Word | Chr Index | Palette Slot | Priority | Flip H | Flip V |
|---|---|---|---|---|---|---|
| **Layer 1** | \`${c.layer1.word}\` | ${c.layer1.chrIndex} (slot ${c.layer1.slot}) | ${c.layer1.palette} | ${c.layer1.priority} | ${c.layer1.flipX} | ${c.layer1.flipY} |
| **Layer 2** | \`${c.layer2.word}\` | ${c.layer2.chrIndex} (slot ${c.layer2.slot}) | ${c.layer2.palette} | ${c.layer2.priority} | ${c.layer2.flipX} | ${c.layer2.flipY} |

## Collision Attributes

- **Geometry**: \`${c.collision.geometryHex}\` (${geomLabel})
- **Elevation Plane**: ${c.collision.plane}
- **Plane Transparent**: ${c.collision.planeTransparent ? 'Yes' : 'No'}
- **Always Walkable**: ${c.collision.alwaysWalkable ? 'Yes' : 'No'}
- **Sprite In Front**: ${c.collision.spriteDrawsInFront ? 'Yes' : 'No'}
- **Sprite Hidden**: ${c.collision.spriteHidden ? 'Yes' : 'No'}
- **Holds Plane**: ${c.collision.holdsPlane ? 'Yes' : 'No'}
- **Drift Vector**: ${c.collision.drift.name || 'None'}
- **Entity Gate**: ${c.collision.entityGate >= 0 ? c.collision.entityGate : 'None'}

[info.json](info.json) | [render.png](render.png)
`;
}

function resolveRoomTiles(room, rom, subSegments) {
    const { metatileTable } = require('../maps/dist/metatiles');
    const segments = Array.isArray(subSegments) ? subSegments : (subSegments !== undefined ? [subSegments] : []);
    const [name, leaf, ...extra] = segments;

    const table = metatileTable(room);
    const rId = room.roomId ?? room.id ?? 0;

    // Root of room metatiles: soe://rom/assets/maps/<id>/metatiles/
    if (name === undefined) {
        const entries = [
            ['index.json', 'file'],
            ['atlas.png', 'file'],
            ...table.map((m) => [hexId(m.index, 3), 'dir']),
        ];
        return dir(entries, () => [
            `# Room ${hexId(rId, 2)} Metatiles`, '',
            `${room.metatileCount} metatiles in dictionary. Base metatile \`$${hexId(room.baseMetatile, 4)}\`.`, '',
            '![Atlas](atlas.png)', '',
            '| Index | ID | Uses | Layer 1 | Layer 2 | Collision | Folder |', '|---|---|---|---|---|---|---|',
            ...table.slice(0, 100).map((m) => `| \`${hexId(m.index, 3)}\` | \`$${hexId(m.id, 4)}\` | ${m.uses} | \`$${hexId(m.layer1, 4)}\` | \`$${hexId(m.layer2, 4)}\` | \`$${hexId(m.collision, 4)}\` | [${hexId(m.index, 3)}/](${hexId(m.index, 3)}/info.md) |`),
            ...(table.length > 100 ? ['', `*(showing first 100 of ${table.length} metatiles)*`] : []),
        ].join('\n') + '\n');
    }

    if (name === 'index.json') {
        return json(() => table);
    }

    if (name === 'atlas.png') {
        return file(() => encodePng(getRoomAtlas(rom, room, 'composite').image));
    }

    // Direct metatile image request: 000.png (for backwards compatibility)
    const directMatch = /^([0-9a-f]+)\.png$/i.exec(name);
    if (directMatch) {
        const idx = parseInt(directMatch[1], 16);
        if (idx < 0 || idx >= room.metatileCount) return null;
        return file(() => renderSingleMetatile(rom, room, idx, 'composite'));
    }

    // Metatile folder: 000/
    const folderMatch = /^([0-9a-f]+)$/i.exec(name);
    if (!folderMatch) return null;
    const idx = parseInt(folderMatch[1], 16);
    if (idx < 0 || idx >= room.metatileCount) return null;

    if (extra.length > 0) return null;

    const m = table[idx];

    // Inside metatile folder: 000/
    if (leaf === undefined) {
        const entries = [
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['render.png', 'file'],
            ['layer1.png', 'file'],
            ['layer2.png', 'file'],
        ];
        return dir(entries, () => metatileMarkdown(room, m));
    }

    if (leaf === 'info.json') return json(() => metatileComposition(room, m));
    if (leaf === 'info.md') return text(() => metatileMarkdown(room, m));
    if (leaf === 'render.png') return file(() => renderSingleMetatile(rom, room, idx, 'composite'));
    if (leaf === 'layer1.png') return file(() => renderSingleMetatile(rom, room, idx, 'layer1'));
    if (leaf === 'layer2.png') return file(() => renderSingleMetatile(rom, room, idx, 'layer2'));

    return null;
}

module.exports = { resolveTiles, resolveRoomTiles };
