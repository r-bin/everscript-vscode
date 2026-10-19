// Ownership: `soe://rom/assets/maps/` — every room: its index, decoded header and grids, renders
// (composite, layers, overlays, object states) and its info page. Pure. rom-assets.ts routes here.

import { encodePng, decodeRoom, renderRoomComposite, renderStandaloneOverlay, applyObjectStates, MAX_ROOMS } from '../maps';
import { getMapName, getMapArea } from '../localizations';
import { hexId } from './resource-uri';
import { dir, file, json, text } from './nodes';
import type { Entry } from './nodes';
import type { RoomData, ObjectStateMap, StandaloneOverlayOptions } from '../maps';
import { isCollisionAnimated, isLayerAnimated, isRoomAnimated, renderRoomAnimationGif } from './map-animation';
import { renderRoomCollision, renderRoomCollisionGif, renderRoomLayer, renderRoomLayerGif } from './map-layers';
import { resolveRoomObjects, resolveRoomWidgets } from './map-objects';
import { resolveScripts } from './script-files';
import { resolveRoomTiles } from './tile-files';

type Rom = Uint8Array;
/** What the provider hands in when an emulator may be running (live.png, overlay.png). */
interface Deps { query?: string; emulatorStatus?(): Promise<{ emulator?: string } | null | undefined>; readMemory?(bus: number, len: number): Promise<Uint8Array | null | undefined> }

/** One line of text, safe inside a Markdown table cell. */
function cell(s: string | null) {
    if (s === null) return '*(does not decode)*';
    const flat = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim();
    return (flat.length > 100 ? flat.slice(0, 100) + '…' : flat).replace(/[|\\`*_[\]<>]/g, (c) => '\\' + c);
}

// ── maps ─────────────────────────────────────────────────────────────────

function maps(rom: Rom, name?: string, leaf?: string, deps?: Deps) {
    if (name === undefined) {
        const ids = Array.from({ length: MAX_ROOMS }, (_, i) => i);
        return dir([['index.json', 'file'], ...ids.map((i): Entry => [hexId(i, 2), 'dir'])], () => [
            '# soe://rom/assets/maps/', '', `${MAX_ROOMS} rooms. [index.json](index.json)`, '',
            '| Id | Name | Area | |', '|---|---|---|---|',
            ...ids.map(i => `| [${hexId(i, 2)}](${hexId(i, 2)}/info.md) | ${cell(getMapName(i))} | ${cell(getMapArea(i) || '')} | [render](${hexId(i, 2)}/render.png) |`),
        ].join('\n') + '\n');
    }
    if (name === 'index.json') {
        return leaf === undefined ? json(() => Array.from({ length: MAX_ROOMS }, (_, id) => ({
            id: hexId(id, 2), name: getMapName(id), area: getMapArea(id),
        }))) : null;
    }
    if (!/^[0-9a-f]{1,2}$/i.test(name)) return null;
    const id = parseInt(name, 16);
    if (id < 0 || id >= MAX_ROOMS) return null;
    let d: RoomData;
    try { d = decodeRoom(rom, id); } catch (_) { return null; }
    if (!d) return null;
    const hasAnim = isRoomAnimated(d);
    const hasL1Anim = isLayerAnimated(d, 'layer1');
    const hasL2Anim = isLayerAnimated(d, 'layer2');
    const hasCollAnim = isCollisionAnimated(d);

    if (leaf === undefined) {
        const entries: Entry[] = [
            ['info.md', 'file'],
            ['header.json', 'file'],
            ['render.png', 'file'],
            ['live.png', 'file'],
            ...(hasAnim ? [['render.gif', 'file'], ['animation.gif', 'file']] as Entry[] : []),
            ['layer1.png', 'file'],
            ...(hasL1Anim ? [['layer1.gif', 'file']] as Entry[] : []),
            ['layer2.png', 'file'],
            ...(hasL2Anim ? [['layer2.gif', 'file']] as Entry[] : []),
            ['collision.png', 'file'],
            ...(hasCollAnim ? [['collision.gif', 'file']] as Entry[] : []),
            ['overlay.png', 'file'],
            ['scripts', 'dir'],
            ['tiles', 'dir'],
            ['metatiles', 'dir'],
            ['objects', 'dir'],
            ['widgets', 'dir'],
        ];
        return dir(entries, () => roomMarkdown(rom, id));
    }
    const [cleanLeaf, leafQuery] = String(leaf || '').split('?');
    if (cleanLeaf === 'header.json') return json(() => plain(d.header));
    if (cleanLeaf === 'render.png') return file(() => encodePng(renderRoomComposite(rom, d)));
    if (cleanLeaf === 'live.png') {
        return file(async () => {
            let staged = d;
            if (deps && typeof deps.emulatorStatus === 'function' && typeof deps.readMemory === 'function') {
                try {
                    const st = await deps.emulatorStatus();
                    if (st && st.emulator === 'running') {
                        const mapBuf = await deps.readMemory(0x7E0B3C, 2);
                        if (mapBuf && mapBuf.length >= 2) {
                            const curMap = mapBuf[0] | (mapBuf[1] << 8);
                            if (curMap === id && d.objects && d.objects.length) {
                                const objStatesBuf = await deps.readMemory(0x7E10CE, d.objects.length);
                                if (objStatesBuf) {
                                    const objStates: ObjectStateMap = {};
                                    for (let i = 0; i < objStatesBuf.length; i++) {
                                        objStates[i] = objStatesBuf[i];
                                    }
                                    staged = applyObjectStates(rom, d, objStates);
                                }
                            }
                        }
                    }
                } catch (_) {}
            }
            return encodePng(renderRoomComposite(rom, staged));
        });
    }
    if (cleanLeaf === 'overlay.png') {
        const queryParams = new URLSearchParams((deps && deps.query ? deps.query + '&' : '') + (leafQuery || ''));
        const parseBool = (val: string | null | undefined, def: boolean) => {
            if (val === undefined || val === null || val === '') return def;
            return val !== '0' && val !== 'false';
        };
        const collisionVal = queryParams.get('collision');
        const overlayOpts: StandaloneOverlayOptions = {
            renderMap: queryParams.get('map') === '1' || queryParams.get('map') === 'true',
            contours: collisionVal !== '0' && collisionVal !== 'false',
            tiles: collisionVal === 'tiles',
            objects: parseBool(queryParams.get('objects'), true),
            triggers: parseBool(queryParams.get('triggers'), true),
            labels: parseBool(queryParams.get('labels'), false),
            drift: parseBool(queryParams.get('drift'), true),
            transparent: parseBool(queryParams.get('transparent'), true),
            elevation: parseBool(queryParams.get('elevation'), true),
            gates: parseBool(queryParams.get('gates'), true),
            grass: parseBool(queryParams.get('grass'), true),
            scale: queryParams.get('scale') === '2' ? 2 : 1,
        };
        const vp = queryParams.get('viewport') || queryParams.get('cutout');
        if (vp) {
            const parts = vp.split(',').map(Number);
            if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
                overlayOpts.cutoutViewport = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
            }
        }
        return file(async () => {
            let staged = d;
            if (deps && typeof deps.emulatorStatus === 'function' && typeof deps.readMemory === 'function') {
                try {
                    const st = await deps.emulatorStatus();
                    if (st && st.emulator === 'running') {
                        const mapBuf = await deps.readMemory(0x7E0B3C, 2);
                        if (mapBuf && mapBuf.length >= 2) {
                            const curMap = mapBuf[0] | (mapBuf[1] << 8);
                            if (curMap === id && d.objects && d.objects.length) {
                                const objStatesBuf = await deps.readMemory(0x7E10CE, d.objects.length);
                                if (objStatesBuf) {
                                    const objStates: ObjectStateMap = {};
                                    for (let i = 0; i < objStatesBuf.length; i++) {
                                        objStates[i] = objStatesBuf[i];
                                    }
                                    staged = applyObjectStates(rom, d, objStates);
                                }
                            }
                        }
                    }
                } catch (_) {}
            }
            return encodePng(renderStandaloneOverlay(rom, staged, overlayOpts));
        });
    }
    if (cleanLeaf === 'animation.gif' || cleanLeaf === 'render.gif') {
        if (!hasAnim) return null;
        return file(() => renderRoomAnimationGif(rom, d));
    }
    if (cleanLeaf === 'layer1.png') {
        return file(() => encodePng(renderRoomLayer(rom, d, 'layer1')));
    }
    if (cleanLeaf === 'layer1.gif') {
        if (!hasL1Anim) return null;
        return file(() => renderRoomLayerGif(rom, d, 'layer1'));
    }
    if (cleanLeaf === 'layer2.png') {
        return file(() => encodePng(renderRoomLayer(rom, d, 'layer2')));
    }
    if (cleanLeaf === 'layer2.gif') {
        if (!hasL2Anim) return null;
        return file(() => renderRoomLayerGif(rom, d, 'layer2'));
    }
    if (cleanLeaf === 'collision.png') {
        return file(() => encodePng(renderRoomCollision(d)));
    }
    if (cleanLeaf === 'collision.gif') {
        if (!hasCollAnim) return null;
        return file(() => renderRoomCollisionGif(d));
    }
    if (cleanLeaf === 'info.md') return text(() => roomMarkdown(rom, id));
    if (cleanLeaf === 'scripts') {
        return resolveScripts(['rooms', hexId(id, 2)], rom);
    }
    if (cleanLeaf === 'tiles' || cleanLeaf === 'metatiles') {
        return resolveRoomTiles(decodeRoom(rom, id), rom, undefined);
    }
    if (cleanLeaf === 'objects') {
        return resolveRoomObjects(decodeRoom(rom, id), rom, [], id);
    }
    if (cleanLeaf === 'widgets') {
        return resolveRoomWidgets(decodeRoom(rom, id), rom, [], id);
    }
    return null;
}

function roomMarkdown(rom: Rom, id: number) {
    const d = decodeRoom(rom, id);
    const h = d.header;
    const hasAnim = isRoomAnimated(d);
    const hasL1Anim = isLayerAnimated(d, 'layer1');
    const hasL2Anim = isLayerAnimated(d, 'layer2');
    const animRow = hasAnim ? `| Animated tiles | ${d.animation.length} channels ([animation.gif](animation.gif)) |\n` : '';
    const visual = hasAnim
        ? `![Room ${hexId(id, 2)} (Animated)](animation.gif)\n\n*(Static view: [render.png](render.png))*`
        : `![Room ${hexId(id, 2)}](render.png)`;

    const animLinksRow = (hasAnim || hasL1Anim || hasL2Anim)
        ? `| ${hasAnim ? '[animation.gif](animation.gif)' : '*(static)*'} | ${hasL1Anim ? '[layer1.gif](layer1.gif)' : '*(static)*'} | ${hasL2Anim ? '[layer2.gif](layer2.gif)' : '*(static)*'} | *(static)* |\n`
        : '';

    return `# Room ${hexId(id, 2)}: ${getMapName(id, { full: true })}

| | |
|---|---|
| Area | ${getMapArea(id) || '?'} |
| Size | ${h.widthTiles}×${h.heightTiles} cells |
| Blob | file offset \`$${hexId(d.romPointerFile, 6)}\`, bus \`$${hexId(d.romPointerSnes, 6)}\` |
| Metatiles | ${d.metatileCount} ([tiles/](tiles/index.md)) |
| Tile families | ${d.tileFamilies.join(', ')} |
${animRow}| Objects | ${d.objects.length} ([objects/](objects/index.md)) |
| Triggers | ${d.triggers.stepOn.length} step-on, ${d.triggers.bTrigger.length} B-button |

[header.json](header.json) | [scripts/](scripts/index.md) | [tiles/](tiles/index.md) | [metatiles/](metatiles/index.md) | [objects/](objects/index.md) | [widgets/](widgets/index.md)

## Layers

| Composite | Layer 1 (Canopy) | Layer 2 (Terrain) | Collision | Overlay |
|:---:|:---:|:---:|:---:|:---:|
| [render.png](render.png) | [layer1.png](layer1.png) | [layer2.png](layer2.png) | [collision.png](collision.png) | [overlay.png](overlay.png) |
${animLinksRow}
${visual}
`;
}

/** Typed arrays → plain arrays, so a decoded struct prints as JSON. */
function plain(value: unknown) {
    return JSON.parse(JSON.stringify(value, (_, v: unknown) => ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v));
}

export type { Deps as MapsDeps };
export { maps, cell };
