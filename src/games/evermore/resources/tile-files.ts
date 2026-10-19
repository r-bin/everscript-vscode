// Ownership: `soe://rom/assets/tiles/` and room metatile palettes.
// The 6,688 master 16x16 CHR tile graphics in the $EE0000 table. Pure.

import { decompressTile16x16, decodeTilePixels } from '../maps/chr';
import { extractTileFamilyPalette } from '../maps/palette';
import { encodePng } from '../maps/png';
import { hexId } from './resource-uri';
import { dir, file, json, text } from './nodes';
import type { Entry } from './nodes';
import { renderMetatileAtlas, metatileTable } from '../maps/metatiles';
import type { MetatileInfo } from '../maps/metatiles';
import type { RoomData } from '../maps/room';
import { isMetatileAnimated, isRoomAnimated, isLayerAnimated, renderMetatileAnimationGif, renderMetatileAtlasAnimationGif } from './map-animation';
import { renderMetatileAtlasCollision } from './map-layers';

type Rom = Uint8Array;
type Atlas = ReturnType<typeof renderMetatileAtlas>;

const GFX_COUNT = 6688;

function resolveTiles(segments: string[], rom: Uint8Array) {
    const [name, leaf] = segments;

    if (leaf !== undefined) return null;

    if (name === undefined) {
        const ids = Array.from({ length: GFX_COUNT }, (_, i) => hexId(i, 4));
        const entries: Entry[] = [
            ['index.json', 'file'],
            ...ids.map((id): Entry => [id + '.png', 'file']),
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

function renderTilePng(rom: Uint8Array, tileId: number, familyId = 0) {
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

import { tilePlane, isPlaneTransparent, isAlwaysWalkable, spriteDrawsInFront, spriteHiddenOn, holdsPlane, driftVector, entityGate } from '../maps/collision';

// ── Room metatiles resolution helper ───────────────────────────────────────

const _atlasCache = new WeakMap<Rom, Map<string, Atlas>>();

function getRoomAtlas(rom: Rom, room: RoomData, layer: 'composite' | 'layer1' | 'layer2' = 'composite'): Atlas {
    let map = _atlasCache.get(rom);
    if (!map) {
        map = new Map<string, Atlas>();
        _atlasCache.set(rom, map);
    }
    const rId = room.roomId;
    const key = `${rId}:${layer}`;
    if (map.has(key)) return map.get(key)!;
    const atlas = renderMetatileAtlas(rom, room, { layer });
    map.set(key, atlas);
    return atlas;
}

function renderSingleMetatile(rom: Rom, room: RoomData, idx: number, layer: 'composite' | 'layer1' | 'layer2' = 'composite') {
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

function decodeTilemapWord(word: number) {
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

function decodeCollisionWord(cw: number) {
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

function metatileComposition(room: RoomData, m: MetatileInfo) {
    const rId = room.roomId;
    const animInfo = isMetatileAnimated(room, m);
    return {
        roomId: rId,
        roomHex: hexId(rId, 2),
        index: m.index,
        indexHex: hexId(m.index, 3),
        id: m.id,
        idHex: '$' + hexId(m.id, 4),
        uses: m.uses,
        animated: animInfo.animated,
        animationChannels: animInfo.channels,
        layer1: decodeTilemapWord(m.layer1),
        layer2: decodeTilemapWord(m.layer2),
        collision: decodeCollisionWord(m.collision),
    };
}

function metatileMarkdown(room: RoomData, m: MetatileInfo): string {
    const c = metatileComposition(room, m);
    const geomLabel = c.collision.solid ? 'Solid' : c.collision.open ? 'Open' : `Code ${c.collision.geometryHex}`;
    const animHeader = c.animated ? ' | Animated' : '';
    const animAlign = c.animated ? '|:---:' : '';
    const animCell = c.animated ? ' | ![Animation](animation.gif)' : '';
    const animNote = c.animated ? `- **Animated**: Yes (Channel${c.animationChannels.length > 1 ? 's' : ''} ${c.animationChannels.join(', ')})\n` : '';

    return `# Room ${c.roomHex} — Metatile ${c.indexHex} (${c.idHex})

**Usage**: ${c.uses} cell${c.uses === 1 ? '' : 's'} in room ${c.roomHex}
**Collision**: \`${c.collision.word}\` (${geomLabel})

| Composite | Layer 1 (Canopy) | Layer 2 (Terrain) | Collision${animHeader} |
|:---:|:---:|:---:|:---:${animAlign}|
| ![Composite](render.png) | ![Layer 1](layer1.png) | ![Layer 2](layer2.png) | ![Collision](collision.png)${animCell} |

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
${animNote}- **Drift Vector**: ${c.collision.drift.name || 'None'}
- **Entity Gate**: ${c.collision.entityGate >= 0 ? c.collision.entityGate : 'None'}

[info.json](info.json) | [render.png](render.png) | [layer1.png](layer1.png) | [layer2.png](layer2.png) | [collision.png](collision.png)${c.animated ? ' | [animation.gif](animation.gif)' : ''}
`;
}

function resolveRoomTiles(room: RoomData, rom: Rom, subSegments?: string | string[]) {
    const segments = Array.isArray(subSegments) ? subSegments : (subSegments !== undefined ? [subSegments] : []);
    const [name, leaf, ...extra] = segments;

    const table = metatileTable(room);
    const rId = room.roomId;
    const hasAnim = isRoomAnimated(room);
    const hasL1Anim = isLayerAnimated(room, 'layer1');
    const hasL2Anim = isLayerAnimated(room, 'layer2');

    // Root of room metatiles: soe://rom/assets/maps/<id>/metatiles/
    if (name === undefined) {
        const entries: Entry[] = [
            ['index.json', 'file'],
            ['atlas.png', 'file'],
            ...(hasAnim ? [['atlas.gif', 'file'] as Entry] : []),
            ['atlas_layer1.png', 'file'],
            ...(hasL1Anim ? [['atlas_layer1.gif', 'file'] as Entry] : []),
            ['atlas_layer2.png', 'file'],
            ...(hasL2Anim ? [['atlas_layer2.gif', 'file'] as Entry] : []),
            ['atlas_collision.png', 'file'],
            ...table.map((m): Entry => [hexId(m.index, 3), 'dir']),
        ];
        return dir(entries, () => [
            `# Room ${hexId(rId, 2)} Metatiles`, '',
            `${room.metatileCount} metatiles in dictionary. Base metatile \`$${hexId(room.baseMetatile, 4)}\`.`, '',
            hasAnim ? '![Atlas (Animated)](atlas.gif)\n\n*(Static atlas: [atlas.png](atlas.png))*' : '![Atlas](atlas.png)', '',
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

    if (name === 'atlas.gif') {
        if (!hasAnim) return null;
        return file(() => renderMetatileAtlasAnimationGif(rom, room));
    }

    if (name === 'atlas_layer1.png' || name === 'layer1.png') {
        return file(() => encodePng(getRoomAtlas(rom, room, 'layer1').image));
    }

    if (name === 'atlas_layer2.png' || name === 'layer2.png') {
        return file(() => encodePng(getRoomAtlas(rom, room, 'layer2').image));
    }

    if (name === 'atlas_collision.png' || name === 'collision.png') {
        return file(() => encodePng(renderMetatileAtlasCollision(room).image));
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
    const animInfo = isMetatileAnimated(room, m);

    // Inside metatile folder: 000/
    if (leaf === undefined) {
        const entries: Entry[] = [
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['render.png', 'file'],
            ...(animInfo.animated ? [['animation.gif', 'file'] as Entry] : []),
            ['layer1.png', 'file'],
            ['layer2.png', 'file'],
            ['collision.png', 'file'],
        ];
        return dir(entries, () => metatileMarkdown(room, m));
    }

    if (leaf === 'info.json') return json(() => metatileComposition(room, m));
    if (leaf === 'info.md') return text(() => metatileMarkdown(room, m));
    if (leaf === 'render.png') return file(() => renderSingleMetatile(rom, room, idx, 'composite'));
    if (leaf === 'animation.gif') {
        if (!animInfo.animated) return null;
        return file(() => renderMetatileAnimationGif(rom, room, idx));
    }
    if (leaf === 'layer1.png') return file(() => renderSingleMetatile(rom, room, idx, 'layer1'));
    if (leaf === 'layer2.png') return file(() => renderSingleMetatile(rom, room, idx, 'layer2'));
    if (leaf === 'collision.png') {
        const { renderMetatileCollision } = require('./map-layers');
        return file(() => encodePng(renderMetatileCollision(room, idx)));
    }

    return null;
}

export { resolveTiles, resolveRoomTiles };
