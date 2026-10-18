'use strict';
// Ownership: the Scripts tab's room scripts — every room's enter script,
// step-on and B-triggers (the decoder in ../../script), each trigger's box in
// the room picture's pixels, and the picture itself. Pure apart from the ROM
// buffer it is handed.
//
// A trigger box is in 16 px tiles, offset by the room header's origin:
// pixel = (x - originX) * 16, x2/y2 exclusive (maps/collision-overlay.ts draws
// them the same way).

const { buildRoomScriptModel } = require('../../../../../dist/games/evermore/script-model');
const maps = require('../../../../../dist/games/evermore/maps');
const { getMapName, getMapArea } = require('../../localizations');
const { hex } = require('../../../../../dist/platform');

/** Every room with a name: [{ id, idHex, name, area }]. */
function roomList() {
    const out = [];
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        out.push({ id, idHex: hex(id, 2), name: getMapName(id) || 'Room $' + hex(id, 2), area: getMapArea(id) || '' });
    }
    return out;
}

function scriptView(s, kind, index, origin) {
    const view = {
        key: kind + (index === null ? '' : ':' + index),
        kind,
        index,
        address: s.scriptAddressSnes,
        addrHex: '$' + hex(s.scriptAddressSnes, 6),
        label: s.label,
        stop: s.stopReason,
        rows: s.instructions.map((r) => ({
            a: '$' + hex(r.addressSnes, 6), op: r.opcodeHex, b: r.bytesHex, s: r.summary,
            d: r.depth, t: r.terminal, u: r.unsupported || r.untraced,
        })),
        loot: s.everscript,
        to: s.transitions.map((t) => t.summary || t.text || '').filter(Boolean),
    };
    if (kind !== 'enter') {
        view.scriptId = s.scriptId;
        view.box = {
            x: (s.x1 - origin.x) * 16, y: (s.y1 - origin.y) * 16,
            w: Math.max(1, s.x2 - s.x1) * 16, h: Math.max(1, s.y2 - s.y1) * 16,
        };
    }
    return view;
}

/** One room's scripts: { id, name, scripts: [view] } or { id, error }. */
function roomScripts(rom, id) {
    let model;
    let room;
    try {
        model = buildRoomScriptModel(rom, id);
        room = maps.decodeRoom(rom, id);
    } catch (err) {
        return { id, error: String(err && err.message || err) };
    }
    const origin = { x: room.header.originX, y: room.header.originY };
    const scripts = [scriptView(model.enter, 'enter', null, origin)];
    model.stepOn.forEach((t, i) => scripts.push(scriptView(t, 'step', i, origin)));
    model.bTrigger.forEach((t, i) => scripts.push(scriptView(t, 'b', i, origin)));
    return { id, idHex: hex(id, 2), name: getMapName(id) || '', scripts };
}

/** The room as the game draws it, as a PNG data URI: { uri, width, height } or { error }. */
function roomPicture(rom, id) {
    try {
        const img = maps.renderRoomComposite(rom, maps.decodeRoom(rom, id));
        return { uri: maps.encodePngDataUri(img), width: img.width, height: img.height };
    } catch (err) {
        return { error: String(err && err.message || err) };
    }
}

module.exports = { roomList, roomScripts, roomPicture };
