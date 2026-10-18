'use strict';
// Ownership: the Evermore half of the emulator panel's host side — what the panel asks the game for:
// the room under the running game as pictures (map view), standing sprites of entities not yet
// active, the alchemy and loot icons, script trace formatting, and its part of the page (webview()). The panel (src/core/emulator/panel.js)
// gets this module through configureEmulator({ game }); the SNES CDL Recorder passes none.

const maps = require('../maps');
const { buildItemIcons } = require('../rooms/data/item-icons');
const { buildRoomScriptModel } = require('../script-model');
const { processScriptTraceBatch } = require('./script-trace');
const { describeCustomMapRom } = require('./custom-map-rom');

const _roomMapCache = new Map();
const _roomMetaCache = new Map();

/** Drops the cached pictures (the panel calls it when the ROM changes). */
function clearCaches() {
    _roomMapCache.clear();
    _roomMetaCache.clear();
}

/** What the page's gameRomData hook gets with each ROM: the ALCHEMY panel's icons (or null). */
function romData(romBuffer) {
    try {
        const icons = romBuffer ? buildItemIcons(romBuffer) : null;
        return icons ? { alchemyIcons: icons.alchemy } : null;
    } catch (_) {
        return null;
    }
}

function _applyCutGrass(room, cutTiles) {
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
    function resolve(metaId) {
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

function _scale2x(pb) {
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

function _alignPixelsToSnes(pb) {
    if (!pb || !pb.data) return pb;
    const d = pb.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i]     &= 0xf8;
        d[i + 1] &= 0xfc;
        d[i + 2] &= 0xf8;
    }
    return pb;
}

function _hasOpaquePixel(pb) {
    const d = pb.data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
    return false;
}

function _getRoomMeta(rom, mapId) {
    if (_roomMetaCache.has(mapId)) {
        return _roomMetaCache.get(mapId);
    }
    const room = maps.decodeRoom(rom, mapId);
    if (!room) return null;

    let collisionUri = null;
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
        if (collImg && _hasOpaquePixel(collImg)) {
            _alignPixelsToSnes(collImg);
            const coll2x = _scale2x(collImg);
            collisionUri = maps.encodePngDataUri(coll2x);
        }
    } catch (_) {}

    let animGroups = [];
    try {
        const encodeFrame = f => {
            _alignPixelsToSnes(f);
            return maps.encodePngDataUri(_scale2x(f));
        };
        const rawGroups = maps.buildAnimationGroups(rom, room);
        const fgGroups = maps.buildAnimationGroups(rom, room, { layer: 'foreground' });
        const fgAligned = fgGroups.length === rawGroups.length;
        animGroups = rawGroups.map((g, i) => {
            const fg = fgAligned ? fgGroups[i] : null;
            const fgUsed = fg && fg.frames.some(f => _hasOpaquePixel(f));
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

    let bgPalette = null;
    try {
        bgPalette = [];
        for (const pal of maps.buildRoomCgramPalettes(rom, room.tileFamilies)) {
            for (const c of pal) bgPalette.push((c[0] >> 3) | ((c[1] >> 3) << 5) | ((c[2] >> 3) << 10));
        }
    } catch (_) { bgPalette = null; }

    const roomObjects = [];
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
                    const stamp = st ? maps.parseObjectStamp(rom, room.objectArea, st.metatileId) : { valid: false };
                    let preview = null;
                    try {
                        const img = maps.renderObjectState(rom, room, i, s);
                        if (img) preview = maps.encodePngDataUri(img);
                    } catch (_) {}
                    states.push({
                        state: s,
                        hold: st ? st.hold : 0,
                        x: st ? st.tileX * 16 : box.x * 16,
                        y: st ? st.tileY * 16 : box.y * 16,
                        w: (stamp.valid ? stamp.tw : (st ? st.targetWidth : box.w)) * 16,
                        h: (stamp.valid ? stamp.th : (st ? st.targetHeight : box.h)) * 16,
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

    const animTileClusters = [];
    try {
        if (room.animation && room.animation.length) {
            const wTiles = room.header.widthTiles;
            const hTiles = room.header.heightTiles;
            const cellMap = new Map();
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
                const clusterKeys = [];
                const queue = [key];
                unvisited.delete(key);
                while (queue.length > 0) {
                    const cur = queue.pop();
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
                const letter = String.fromCharCode(65 + (chan % 26));

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

    let itemIcons = null;
    try {
        const icons = buildItemIcons(rom);
        itemIcons = (icons && icons.loot) ? icons.loot : null;
    } catch (_) {}

    const roomLootables = [];
    try {
        const scriptModel = buildRoomScriptModel(rom, mapId);
        const allTrigs = [...(scriptModel.bTrigger || []), ...(scriptModel.stepOn || [])];
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
                    triggerIndex: trig.index,
                    scriptAddressSnes: trig.scriptAddressSnes,
                });
            }
        }
    } catch (_) {}

    const meta = {
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
    _roomMetaCache.set(mapId, meta);
    return meta;
}

// `layered`: the webview has seen BG1 scroll apart from the camera in this
// room (parallax), so it also needs each layer on its own - see renderRoomLayers.
/**
 * The room under the running game as pictures for the emulator's map view: composite, foreground,
 * collision, optional BG layers, objects, animated tiles, lootables. Cached per ROM; null when the
 * room cannot be drawn.
 */
function roomMap(romBuffer, mapId, objectStates, cutGrassTiles, layered, log) {
    if (!romBuffer || typeof mapId !== 'number') return null;
    const objKey = objectStates ? JSON.stringify(objectStates) : '';
    const grassKey = cutGrassTiles && cutGrassTiles.length ? JSON.stringify(cutGrassTiles) : '';
    const cacheKey = mapId + ':' + objKey + ':' + grassKey + (layered ? ':layered' : '');

    if (_roomMapCache.has(cacheKey)) return _roomMapCache.get(cacheKey);
    try {
        const rom = (romBuffer.length % 1024 === 512) ? romBuffer.subarray(512) : romBuffer;
        const meta = _getRoomMeta(rom, mapId);
        if (!meta) return null;

        let staged = meta.room;
        if (objectStates && typeof maps.applyObjectStates === 'function') {
            staged = maps.applyObjectStates(rom, staged, objectStates);
        }
        if (cutGrassTiles && cutGrassTiles.length) {
            staged = _applyCutGrass(staged, cutGrassTiles);
        }

        const composite = maps.renderRoomComposite(rom, staged);
        if (!composite) return null;
        _alignPixelsToSnes(composite);
        const comp2x = _scale2x(composite);
        const imageUri = maps.encodePngDataUri(comp2x);

        let foregroundUri = null;
        try {
            let fg = maps.renderRoomForeground(rom, staged);
            if (fg) {
                if (meta.room.animation && meta.room.animation.length) {
                    fg = maps.clearAnimatedCells(fg, staged);
                }
                _alignPixelsToSnes(fg);
                const fg2x = _scale2x(fg);
                foregroundUri = maps.encodePngDataUri(fg2x);
            }
        } catch (_) {}

        let layers = null;
        if (layered) {
            try {
                const encodeLayer = img => {
                    if (!_hasOpaquePixel(img)) return null;
                    _alignPixelsToSnes(img);
                    return maps.encodePngDataUri(_scale2x(img));
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
        _roomMapCache.set(cacheKey, data);
        return data;
    } catch (err) {
        if (log) log('Room map render unavailable for map ' + mapId + ': ' + (err.message || err));
        return null;
    }
}

// An entity the engine has spawned but not activated yet (it waits in the
// inactive list, $3DE1, until the camera comes near) has no sprite: its
// animation has never run. The webview asks for its standing sprite instead,
// keyed "type:facing" (type = entity +0x60, the character record address).
const CHARACTER_TABLE = 0x8eb678;
const CHARACTER_STRIDE = 74;
function idleSprites(romBuffer, keys) {
    if (!romBuffer || !Array.isArray(keys)) return null;
    const rom = (romBuffer.length % 1024 === 512) ? romBuffer.subarray(512) : romBuffer;
    const sprites = {};
    for (const key of keys.slice(0, 64)) {
        const [type, facing] = String(key).split(':').map(Number);
        const offset = (0x8e0000 | type) - CHARACTER_TABLE;
        let entry = null;
        if (offset >= 0 && offset % CHARACTER_STRIDE === 0) {
            const character = offset / CHARACTER_STRIDE;
            try {
                const sprite = maps.resolveCharacterSprite(rom, character, facing & 0x0e) || maps.resolveCharacterSprite(rom, character);
                if (sprite) entry = { sprite, palette: maps.characterPaletteAddress(rom, character) };
            } catch (_) { entry = null; }
        }
        sprites[key] = entry;
    }
    return sprites;
}

/** Script trace batch -> formatted entries (names from the ROM and the active custom draft). */
function traceScripts(items, romBuffer, wsRoot, draft) {
    return processScriptTraceBatch(items, romBuffer, wsRoot, draft);
}

/** Evermore's part of the emulator page: the screen overlays, the script VM (STACK, TRACE, the VS Code script debugger's hook, who sent each sound), the ENTITIES, ALCHEMY and PALETTES panels, the cheats, and pause-menu tabs 1-4. */
function webview() {
    const v = require('./bottom-bar-views');
    const t = require('./menu-tabs');
    const o = require('./overlays-view');
    const st = require('./stack-view');
    const sd = require('./script-debug-view');
    const snd = require('./sound-source-view');
    return {
        stackScript: st.getStackScript(), traceScript: st.getTraceScript(), scriptDebugScript: sd.getScriptDebugClientScript(),
        soundSourceScript: snd.getSoundSourceClientScript(), soundChipHtml: snd.getSoundChipHtml(),
        overlaysScript: o.getOverlaysScript(), overlayTogglesScript: o.getOverlayTogglesScript(), screenChipsHtml: o.getScreenChipsHtml(),
        css: v.getBottomBarCss(), tabButtonsHtml: v.getBottomBarTabButtonsHtml(), viewsHtml: v.getBottomBarViewsHtml(),
        clientScript: v.getBottomBarClientScript() + t.getMenuTabsClientScript(),
        menuCss: t.getMenuTabsCss(), menuTabButtonsHtml: t.getMenuTabButtonsHtml(), menuPanelsHtml: t.getMenuPanelsHtml(),
    };
}

/** Evermore's page files, loaded before the page's own script: its ROM detector (gameDetectRom). */
function webviewFiles() {
    return [require('path').join(__dirname, 'webview', 'rom-game.js')];
}

module.exports = { webviewFiles, webview, clearCaches, romData, roomMap, idleSprites, traceScripts, describeRom: describeCustomMapRom };
