// Ownership: what the emulator's map view knows about a room besides its picture (collision, the
// animated tiles, objects, the foreground), read once per room and kept; and the 2x pixel helpers its
// pictures share. room-map.js draws the room; host.js hands both to the panel.

import * as maps from '../maps';
import { buildItemIcons } from '../rooms/data/item-icons';
import { buildRoomScriptModel } from '../script-model';
import type { PixelBuffer } from '../maps/render';

const roomMetaCache = new Map<number, RoomMeta>();

type RoomMeta = NonNullable<ReturnType<typeof readRoomMeta>>;

function scale2x(pb: PixelBuffer): PixelBuffer {
    if (!pb || !pb.data) return pb;
    const w = pb.width;
    const h = pb.height;
    const src = pb.data;
    const dst = new Uint8Array(w * 2 * h * 2 * 4);
    const dstStride = w * 2 * 4;
    for (let y = 0; y < h; y++) {
        const srcRow = y * w * 4;
        const dstRow0 = (y * 2) * dstStride;
        const dstRow1 = (y * 2 + 1) * dstStride;
        for (let x = 0; x < w; x++) {
            const si = srcRow + x * 4;
            const r = src[si];
            const g = src[si + 1];
            const b = src[si + 2];
            const a = src[si + 3];

            const di0 = dstRow0 + (x * 2) * 4;
            dst[di0] = r; dst[di0 + 1] = g; dst[di0 + 2] = b; dst[di0 + 3] = a;
            dst[di0 + 4] = r; dst[di0 + 5] = g; dst[di0 + 6] = b; dst[di0 + 7] = a;

            const di1 = dstRow1 + (x * 2) * 4;
            dst[di1] = r; dst[di1 + 1] = g; dst[di1 + 2] = b; dst[di1 + 3] = a;
            dst[di1 + 4] = r; dst[di1 + 5] = g; dst[di1 + 6] = b; dst[di1 + 7] = a;
        }
    }
    return { width: w * 2, height: h * 2, data: dst };
}

function alignPixelsToSnes(pb: PixelBuffer): PixelBuffer {
    if (!pb || !pb.data) return pb;
    const d = pb.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i]     &= 0xf8;
        d[i + 1] &= 0xfc;
        d[i + 2] &= 0xf8;
    }
    return pb;
}

function hasOpaquePixel(pb: PixelBuffer): boolean {
    const d = pb.data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
    return false;
}

function roomMeta(rom: Uint8Array, mapId: number): RoomMeta | null {
    const hit = roomMetaCache.get(mapId);
    if (hit) return hit;
    const meta = readRoomMeta(rom, mapId);
    if (meta) roomMetaCache.set(mapId, meta);   // a room that does not decode is tried again next time
    return meta;
}

function readRoomMeta(rom: Uint8Array, mapId: number) {
    const room = maps.decodeRoom(rom, mapId);
    if (!room) return null;

    let collisionUri: string | null = null;
    try {
        const wTiles = room.header.widthTiles;
        const hTiles = room.header.heightTiles;
        const collImg = maps.overlayLayer(wTiles * 16, hTiles * 16, img => {
            maps.drawCollisionOverlay(img, room, {
                contours: true,
                tiles: false,
                drift: false,
                transparent: false,
                elevation: false,
                gates: false,
                grass: false,
                objects: false,
                triggers: false,
                labels: false,
            });
        });
        if (collImg && hasOpaquePixel(collImg)) {
            alignPixelsToSnes(collImg);
            const coll2x = scale2x(collImg);
            collisionUri = maps.encodePngDataUri(coll2x);
        }
    } catch (_) {}

    let animGroups: AnimGroupView[] = [];
    try {
        const encodeFrame = (f: PixelBuffer): string => {
            alignPixelsToSnes(f);
            return maps.encodePngDataUri(scale2x(f));
        };
        const rawGroups = maps.buildAnimationGroups(rom, room);
        const fgGroups = maps.buildAnimationGroups(rom, room, { layer: 'foreground' });
        const fgAligned = fgGroups.length === rawGroups.length;
        animGroups = rawGroups.map((g, i) => {
            const fg = fgAligned ? fgGroups[i] : null;
            const fgUsed = fg && fg.frames.some(f => hasOpaquePixel(f));
            return {
                x: g.x * 16,
                y: g.y * 16,
                w: g.w * 16,
                h: g.h * 16,
                delays: g.delaysMs,
                channels: g.channels,
                chanLens: g.channels.map(c => room.animation[c].frames.length),
                frames: g.frames.map(encodeFrame),
                fgFrames: fgUsed ? fg.frames.map(encodeFrame) : null,
            };
        });
    } catch (_) {}

    let bgPalette: number[] | null = null;
    try {
        bgPalette = [];
        for (const pal of maps.buildRoomCgramPalettes(rom, room.tileFamilies)) {
            for (const c of pal) bgPalette.push((c[0] >> 3) | ((c[1] >> 3) << 5) | ((c[2] >> 3) << 10));
        }
    } catch (_) { bgPalette = null; }

    const roomObjects: RoomObjectView[] = [];
    const hexId = mapId.toString(16).padStart(2, '0');
    try {
        if (room.objects && room.objects.length) {
            for (let i = 0; i < room.objects.length; i++) {
                const obj = room.objects[i];
                let box = maps.objectBounds(rom, room, obj);
                if (!box || box.w <= 0 || box.h <= 0) {
                    const firstSt = (obj.states && obj.states[0]) ? obj.states[0] : null;
                    box = {
                        x: firstSt ? firstSt.tileX : 0,
                        y: firstSt ? firstSt.tileY : 0,
                        w: firstSt ? (firstSt.targetWidth || 1) : 1,
                        h: firstSt ? (firstSt.targetHeight || 1) : 1,
                    };
                }
                const count = (typeof maps.objectStateCount === 'function') ? maps.objectStateCount(obj) : (obj.states.length + 1);
                const states = [];
                for (let s = 0; s < count; s++) {
                    const st = s > 0 ? obj.states[s - 1] : obj.states[0];
                    const stamp = st ? maps.parseObjectStamp(rom, room.objectArea, st.metatileId) : null;
                    let preview: string | null = null;
                    try {
                        const img = maps.renderObjectState(rom, room, i, s);
                        if (img) preview = maps.encodePngDataUri(img);
                    } catch (_) {}
                    states.push({
                        state: s,
                        hold: st ? st.hold : 0,
                        x: st ? st.tileX * 16 : box.x * 16,
                        y: st ? st.tileY * 16 : box.y * 16,
                        w: (stamp && stamp.valid ? stamp.tw : (st ? st.targetWidth : box.w)) * 16,
                        h: (stamp && stamp.valid ? stamp.th : (st ? st.targetHeight : box.h)) * 16,
                        preview: preview,
                        vfsUri: 'soe://rom/assets/maps/' + hexId + '/objects/' + i + '/state_' + s + '.png',
                    });
                }
                const objPreview = (states[0] && states[0].preview) ? states[0].preview : null;
                roomObjects.push({
                    index: obj.objectIndex !== undefined ? obj.objectIndex : i,
                    x: box.x * 16,
                    y: box.y * 16,
                    w: box.w * 16,
                    h: box.h * 16,
                    preview: objPreview,
                    states: states,
                    vfsUri: 'soe://rom/assets/maps/' + hexId + '/objects/' + i + '/',
                    vfsPreview: 'soe://rom/assets/maps/' + hexId + '/objects/' + i + '/preview.png',
                    vfsGif: 'soe://rom/assets/maps/' + hexId + '/objects/' + i + '/preview.gif',
                });
            }
        }
    } catch (_) {}

    const animTileClusters: unknown[] = [];
    try {
        if (room.animation && room.animation.length) {
            const wTiles = room.header.widthTiles;
            const hTiles = room.header.heightTiles;
            const cellMap = new Map<string, number>();
            for (let y = 0; y < hTiles; y++) {
                for (let x = 0; x < wTiles; x++) {
                    const chans = maps.cellChannels(room, x, y, 'composite');
                    if (chans && chans.length) {
                        cellMap.set(x + ',' + y, chans[0]);
                    }
                }
            }
            const unvisited = new Set(cellMap.keys());
            for (const key of cellMap.keys()) {
                if (!unvisited.has(key)) continue;
                const chan = cellMap.get(key);
                const clusterKeys: string[] = [];
                const queue = [key];
                unvisited.delete(key);
                while (queue.length > 0) {
                    const cur = queue.pop() as string;
                    clusterKeys.push(cur);
                    const [cx, cy] = cur.split(',').map(Number);
                    const neighbors = [
                        cx + ',' + (cy - 1),
                        cx + ',' + (cy + 1),
                        (cx - 1) + ',' + cy,
                        (cx + 1) + ',' + cy,
                    ];
                    for (const n of neighbors) {
                        if (unvisited.has(n) && cellMap.get(n) === chan) {
                            unvisited.delete(n);
                            queue.push(n);
                        }
                    }
                }
                const parsedCells = clusterKeys.map(k => {
                    const [cx, cy] = k.split(',').map(Number);
                    return { x: cx, y: cy };
                });
                parsedCells.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const c of parsedCells) {
                    if (c.x < minX) minX = c.x;
                    if (c.x > maxX) maxX = c.x;
                    if (c.y < minY) minY = c.y;
                    if (c.y > maxY) maxY = c.y;
                }
                const isRect = parsedCells.length === (maxX - minX + 1) * (maxY - minY + 1);
                const letter = String.fromCharCode(65 + ((chan ?? 0) % 26));

                animTileClusters.push({
                    channel: chan,
                    letter: letter,
                    cells: parsedCells.map(c => ({ x: c.x * 16, y: c.y * 16 })),
                    cellCoords: parsedCells,
                    bbox: {
                        x: minX * 16,
                        y: minY * 16,
                        w: (maxX - minX + 1) * 16,
                        h: (maxY - minY + 1) * 16,
                    },
                    isRect: isRect,
                    first: { x: parsedCells[0].x * 16, y: parsedCells[0].y * 16 },
                });
            }
        }
    } catch (_) {}

    let itemIcons: Record<string, string> | null = null;
    try {
        const icons = buildItemIcons(rom);
        itemIcons = (icons && icons.loot) ? icons.loot : null;
    } catch (_) {}

    const roomLootables: unknown[] = [];
    try {
        const scriptModel = buildRoomScriptModel(rom, mapId);
        // Each trigger with its index in its own table (b-trigger or step-on), as the page names triggers.
        const allTrigs = [
            ...(scriptModel.bTrigger || []).map((t, index) => ({ ...t, kind: 'bTrigger', index })),
            ...(scriptModel.stepOn || []).map((t, index) => ({ ...t, kind: 'stepOn', index })),
        ];
        let lootIdx = 0;
        for (const trig of allTrigs) {
            if (!trig.loot || !trig.loot.length) continue;
            for (const fact of trig.loot) {
                const trigBox = {
                    x: (trig.x1 - room.header.originX) * 16,
                    y: (trig.y1 - room.header.originY) * 16,
                    w: Math.max(1, (trig.x2 - trig.x1) * 16),
                    h: Math.max(1, (trig.y2 - trig.y1) * 16),
                };
                const objForLoot = (fact.objectId !== null) ? roomObjects.find(function(o) { return o.index === fact.objectId; }) : null;
                let lootPreview = (objForLoot && objForLoot.preview) ? objForLoot.preview : null;
                if (!lootPreview && itemIcons && fact.itemName && itemIcons[fact.itemName]) {
                    lootPreview = itemIcons[fact.itemName];
                }
                roomLootables.push({
                    index: lootIdx++,
                    kind: fact.kind || 'gourd',
                    item: fact.item ? fact.item.value : null,
                    itemName: fact.itemName || (fact.item ? ('0x' + fact.item.value.toString(16).toUpperCase()) : 'Unknown'),
                    amount: fact.amount || 1,
                    objectId: fact.objectId,
                    preview: lootPreview,
                    checkFlag: fact.checkFlag,
                    setFlag: fact.setFlag,
                    x: trigBox.x,
                    y: trigBox.y,
                    w: trigBox.w,
                    h: trigBox.h,
                    triggerKind: trig.kind,
                    triggerIndex: trig.index,
                    scriptAddressSnes: trig.scriptAddressSnes,
                });
            }
        }
    } catch (_) {}

    return {
        room: room,
        collisionUri: collisionUri,
        animGroups: animGroups,
        bgPalette: bgPalette,
        roomObjects: roomObjects,
        animTileClusters: animTileClusters,
        roomLootables: roomLootables,
        itemIcons: itemIcons,
        offX: room.header.originX,
        offY: room.header.originY,
    };
}

/** An animated area of the room: its box in pixels, the channels it runs and its frames (2x PNG data URIs). */
interface AnimGroupView {
    x: number; y: number; w: number; h: number; delays: number[]; channels: number[]; chanLens: number[];
    frames: string[]; fgFrames: string[] | null;
}
interface RoomObjectView {
    index: number; x: number; y: number; w: number; h: number; preview: string | null; states: unknown[];
    vfsUri: string; vfsPreview: string; vfsGif: string;
}

export { roomMeta, roomMetaCache, scale2x, alignPixelsToSnes, hasOpaquePixel };
