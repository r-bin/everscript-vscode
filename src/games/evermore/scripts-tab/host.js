'use strict';
// Ownership: the Scripts tab's host side: answers the webview's requests.
// No VS Code dependency. extension.js injects the ROM loader, `post`, and the
// two capabilities that belong to other tabs: the animation catalogue and
// renderer (sprites) and the silent music player (music), so this domain never
// imports another feature.
//
// State owned: `_rooms` (room scripts + picture per room id, for the loaded ROM).
//
//   page -> scriptsInit                 host -> scriptsIndex { rooms, animations, formulas, music } | { error }
//   page -> scriptsRoom { id }          host -> scriptsRoom { id, room, picture }
//   page -> scriptsAnim { key, record, facing }   host -> scriptsAnim { key, anim } | { key, error }
//   page -> scriptsMusic { id, seconds }          host -> scriptsMusic { id, sequence, timeline } | { id, error }
//   page -> scriptsSim { room, key }    host -> scriptsSim { room, key, everscript, clusters } | { error }

const { roomList, roomScripts, roomPicture } = require('./model/rooms');
const { alchemyModel } = require('../../../../dist/games/evermore/scripts-tab/model/alchemy');
const { simulateScript, roomClusters } = require('../../../../dist/games/evermore/scripts-tab/model/simulation');
const { missingRomText } = require('../../../../dist/platform/roms/library');

const FACING_SOUTH = 8;

let _rooms = { rom: null, byId: new Map() };

const handlesScriptsMessage = (command) => typeof command === 'string' && command.startsWith('scripts');

function loadRom(deps) {
    const buf = deps.loadRom();
    if (!buf) return null;
    return buf.length % 0x8000 === 0x200 ? buf.subarray(0x200) : buf;
}

function roomEntry(rom, id) {
    if (_rooms.rom !== rom) _rooms = { rom, byId: new Map() };
    if (!_rooms.byId.has(id)) _rooms.byId.set(id, { room: roomScripts(rom, id), picture: roomPicture(rom, id) });
    return _rooms.byId.get(id);
}

/** A rendered animation, without the buffers the page does not draw. */
function slimAnimation(a) {
    if (!a) return null;
    return {
        width: a.width, height: a.height, originX: a.originX, originY: a.originY,
        complete: a.complete, scriptHex: a.scriptHex, totalTicks: a.totalTicks, loopFrom: a.loopFrom,
        stoppedAtHex: a.stoppedAtHex, facing: a.facing, paletteColors: a.paletteColors,
        script: a.script,
        frames: a.frames.map((f) => ({ png: f.png, ticks: f.ticks, lines: f.lines, shadow: f.shadowPng || null })),
        shadow: a.shadow,
    };
}

function index(rom, deps) {
    const animations = deps.animations(rom).map((e) => ({
        record: e.record, recHex: e.recHex, label: e.label, facings: e.facingCount, scriptHex: e.scriptHex,
    }));
    const alchemy = alchemyModel(rom);
    const effects = new Set(alchemy.effects);
    // A record no character owns but a formula's block names: call it after the formulas.
    const named = new Map();
    alchemy.formulas.forEach((f) => f.records.forEach((r) => named.set(r.record, (named.get(r.record) || []).concat(f.name))));
    animations.forEach((a) => {
        if (effects.has(a.record)) a.effect = true;
        if (named.has(a.record) && a.label === 'no known owner') a.label = 'alchemy · ' + [...new Set(named.get(a.record))].join(', ');
    });
    return {
        rooms: roomList(),
        animations,
        formulas: alchemy.formulas,
        music: deps.music.list(rom),
    };
}

/**
 * @param msg  webview message
 * @param deps {post, loadRom: () => Buffer|null,
 *              animations(rom): catalogue entries (sprites/animation-catalog.js),
 *              renderAnimation(rom, characterId, animOpt, facing) (sprites/animation-decoder.js),
 *              music: {list(rom), sequence(rom, id), timeline(rom, id, seconds): Promise} (music/)}
 */
function failed(msg, deps, error) {
    deps.post({ command: msg.command === 'scriptsInit' ? 'scriptsIndex' : msg.command, key: msg.key, id: msg.id, room: msg.room, error });
}

function handleScriptsMessage(msg, deps) {
    const rom = loadRom(deps);
    if (!rom) { failed(msg, deps, missingRomText('evermore')); return; }
    try {
        switch (msg.command) {
            case 'scriptsInit':
                deps.post({ command: 'scriptsIndex', ...index(rom, deps) });
                return;
            case 'scriptsRoom': {
                const id = Number(msg.id);
                const { room, picture } = roomEntry(rom, id);
                deps.post({ command: 'scriptsRoom', id, room, picture });
                return;
            }
            case 'scriptsAnim': {
                const entry = deps.animations(rom).find((e) => e.record === Number(msg.record));
                if (!entry) { deps.post({ command: 'scriptsAnim', key: msg.key, error: 'No animation record ' + msg.record }); return; }
                const opt = { key: 'record', category: 'external', animRec: entry.record, paletteAddr: entry.paletteAddr || 0 };
                const facing = Number.isInteger(Number(msg.facing)) ? Number(msg.facing) : FACING_SOUTH;
                const anim = deps.renderAnimation(rom, entry.paletteCharacter, opt, facing);
                deps.post({ command: 'scriptsAnim', key: msg.key, anim: slimAnimation(anim) });
                return;
            }
            case 'scriptsMusic': {
                const id = Number(msg.id);
                const sequence = deps.music.sequence(rom, id);
                deps.music.timeline(rom, id, Number(msg.seconds) || 60)
                    .then((timeline) => deps.post({ command: 'scriptsMusic', id, sequence, timeline }))
                    .catch((err) => deps.post({ command: 'scriptsMusic', id, sequence, error: String(err && err.message || err) }));
                return;
            }
            case 'scriptsSim': {
                const id = Number(msg.room);
                const { room } = roomEntry(rom, id);
                const s = room.scripts && room.scripts.find((x) => x.key === msg.key);
                deps.post({
                    command: 'scriptsSim', room: id, key: msg.key,
                    everscript: s ? simulateScript(rom, s.address, s.key) : null,
                    clusters: roomClusters(rom, id),
                });
                return;
            }
        }
    } catch (err) {
        failed(msg, deps, String(err && err.message || err));
    }
}

module.exports = { handlesScriptsMessage, handleScriptsMessage };
