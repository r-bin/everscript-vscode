// Ownership: the room under the running game as pictures for the emulator's map view: composite,
// foreground and layers at 2x, with the objects' states and cut grass applied, cached per state.
// Facts about the room are room-meta.ts.

import * as maps from '../maps';
import { roomMeta, roomMetaCache, scale2x, alignPixelsToSnes, hasOpaquePixel } from './room-meta';
import type { RoomData } from '../maps/room';
import type { PixelBuffer } from '../maps/render';

/** A cut grass cell as the page sends it: "x,y", [x, y] or {x, y}. */
type CutTile = string | [number, number] | { x: number; y: number };

const roomMapCache = new Map<string, ReturnType<typeof drawRoomMap>>();

/** Drops the cached pictures (the panel calls it when the ROM changes). */
function clearCaches() {
    roomMapCache.clear();
    roomMetaCache.clear();
}

function applyCutGrass(room: RoomData, cutTiles: CutTile[] | null | undefined): RoomData {
    if (!room || !room.cuttableGrass || !room.cuttableGrass.table || !room.cuttableGrass.table.swaps) return room;
    const swaps = room.cuttableGrass.table.swaps;
    if (!swaps.size || !cutTiles || !cutTiles.length) return room;

    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    const meta = room.layer1MetatileIds.map(r => r.slice());
    let touched = false;

    for (let i = 0; i < cutTiles.length; i++) {
        const t = cutTiles[i];
        let tx = 0, ty = 0;
        if (typeof t === 'string') {
            const parts = t.split(',');
            tx = parseInt(parts[0], 10);
            ty = parseInt(parts[1], 10);
        } else if (Array.isArray(t)) {
            tx = t[0];
            ty = t[1];
        } else if (t && typeof t.x === 'number') {
            tx = t.x;
            ty = t.y;
        }
        if (isNaN(tx) || isNaN(ty) || tx < 0 || tx >= wTiles || ty < 0 || ty >= hTiles) continue;
        const curMeta = meta[ty][tx];
        const newMeta = swaps.get(curMeta);
        if (newMeta !== undefined && newMeta !== curMeta) {
            meta[ty][tx] = newMeta;
            touched = true;
        }
    }
    if (!touched) return room;

    const s = room.metatileSlices;
    function resolve(metaId: number) {
        const idx = Math.floor((metaId - room.baseMetatile) / 8);
        if (idx < 0 || idx >= room.metatileCount) return { l1: 0, l2: 0, coll: 0 };
        return { l1: s.layer1[idx] != null ? s.layer1[idx] : 0, l2: s.layer2[idx] != null ? s.layer2[idx] : 0, coll: s.collision[idx] != null ? s.collision[idx] : 0 };
    }

    const l1 = room.layer1VramWords.map(r => r.slice());
    const l2 = room.layer2VramWords.map(r => r.slice());
    const coll = room.collisionWords.map(r => r.slice());
    for (let y = 0; y < hTiles; y++) {
        for (let x = 0; x < wTiles; x++) {
            if (meta[y][x] === room.layer1MetatileIds[y][x]) continue;
            const r = resolve(meta[y][x]);
            l1[y][x] = r.l1;
            l2[y][x] = r.l2;
            coll[y][x] = r.coll;
        }
    }

    return Object.assign({}, room, {
        layer1MetatileIds: meta,
        layer1VramWords: l1,
        layer2VramWords: l2,
        collisionWords: coll,
    });
}

// `layered`: the webview has seen BG1 scroll apart from the camera in this
// room (parallax), so it also needs each layer on its own - see renderRoomLayers.
/**
 * The room under the running game as pictures for the emulator's map view: composite, foreground,
 * collision, optional BG layers, objects, animated tiles, lootables. Cached per ROM; null when the
 * room cannot be drawn.
 */
function roomMap(romBuffer: Uint8Array | null | undefined, mapId: unknown, objectStates?: Record<number, number> | null,
    cutGrassTiles?: CutTile[] | null, layered?: boolean, log?: (line: string) => void) {
    if (!romBuffer || typeof mapId !== 'number') return null;
    const objKey = objectStates ? JSON.stringify(objectStates) : '';
    const grassKey = cutGrassTiles && cutGrassTiles.length ? JSON.stringify(cutGrassTiles) : '';
    const cacheKey = mapId + ':' + objKey + ':' + grassKey + (layered ? ':layered' : '');

    if (roomMapCache.has(cacheKey)) return roomMapCache.get(cacheKey);
    return drawRoomMap(romBuffer, mapId, cacheKey, objectStates, cutGrassTiles, layered, log);
}

function drawRoomMap(romBuffer: Uint8Array, mapId: number, cacheKey: string, objectStates: Record<number, number> | null | undefined,
    cutGrassTiles: CutTile[] | null | undefined, layered: boolean | undefined, log: ((line: string) => void) | undefined) {
    try {
        const rom = (romBuffer.length % 1024 === 512) ? romBuffer.subarray(512) : romBuffer;
        const meta = roomMeta(rom, mapId);
        if (!meta) return null;

        let staged = meta.room;
        if (objectStates && typeof maps.applyObjectStates === 'function') {
            staged = maps.applyObjectStates(rom, staged, objectStates);
        }
        if (cutGrassTiles && cutGrassTiles.length) {
            staged = applyCutGrass(staged, cutGrassTiles);
        }

        const composite = maps.renderRoomComposite(rom, staged);
        if (!composite) return null;
        alignPixelsToSnes(composite);
        const comp2x = scale2x(composite);
        const imageUri = maps.encodePngDataUri(comp2x);

        let foregroundUri: string | null = null;
        try {
            let fg = maps.renderRoomForeground(rom, staged);
            if (fg) {
                if (meta.room.animation && meta.room.animation.length) {
                    fg = maps.clearAnimatedCells(fg, staged);
                }
                alignPixelsToSnes(fg);
                const fg2x = scale2x(fg);
                foregroundUri = maps.encodePngDataUri(fg2x);
            }
        } catch (_) {}

        let layers: Record<string, string | null> | null = null;
        if (layered) {
            try {
                const encodeLayer = (img: PixelBuffer): string | null => {
                    if (!hasOpaquePixel(img)) return null;
                    alignPixelsToSnes(img);
                    return maps.encodePngDataUri(scale2x(img));
                };
                const split = maps.renderRoomLayers(rom, staged);
                layers = {
                    bg1Low: encodeLayer(split.bg1.low),
                    bg1High: encodeLayer(split.bg1.high),
                    bg2Low: encodeLayer(split.bg2.low),
                    bg2High: encodeLayer(split.bg2.high),
                };
            } catch (_) {}
        }

        const hexId = mapId.toString(16).padStart(2, '0');
        const data = {
            mapId: mapId,
            imageUri: imageUri,
            foregroundUri: foregroundUri,
            collisionUri: meta.collisionUri,
            overlayUri: null,
            vfsOverlayUri: 'soe://rom/assets/maps/' + hexId + '/overlay.png?map=0&collision=contours&objects=1&triggers=1&scale=2',
            layers: layers,
            bgPalette: meta.bgPalette,
            animGroups: meta.animGroups,
            width: composite.width,
            height: composite.height,
            offX: meta.offX,
            offY: meta.offY,
            objects: meta.roomObjects,
            animTiles: meta.animTileClusters,
            lootables: meta.roomLootables,
            itemIcons: meta.itemIcons,
            vfsLiveUri: 'soe://rom/assets/maps/' + hexId + '/live.png',
        };
        roomMapCache.set(cacheKey, data);
        return data;
    } catch (err) {
        if (log) log('Room map render unavailable for map ' + mapId + ': ' + (err instanceof Error ? err.message : err));
        return null;
    }
}

export { roomMap, clearCaches };
