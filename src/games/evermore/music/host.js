'use strict';
// Ownership: the Music tab's host side: answers the webview's requests and
// caches the model. No VS Code dependency: extension.js injects the ROM loader,
// `post`, and the emulator's sound-chip stream (`apu`), so this domain never
// imports the emulator.
//
// State owned: `_cache` (the model and the ROM it was built from).
//
//   page -> musicInit                 host -> musicModel { model } | { error }
//   page -> musicPackage { id }       host -> musicPackageData { id, records }
//   page -> musicStream { on }        host -> musicEmulator { open }   (frames: musicFrame, from extension.js)
//   page -> musicSnapshot { id }      host -> musicSnapshotData { id, view, ram, pkg, frame } | { id, error }
//   page -> musicPoint { entity, label }   marks that entity on the emulator screen (0 = none)
//   page -> musicDescribe { key, src }     host -> musicSourceInfo { key, info }   (who sent a sound: names, pictures, links)
//   page -> musicOpen { uri }              opens a soe:// link in the editor
//                                     host -> musicPaused { paused }   (from extension.js: the emulator's pause)

const { buildMusicModel, packageData } = require('../../../../dist/games/evermore/music/model/catalog');
const { missingRomText } = require('../../../../dist/platform/roms/library');

let _cache = null;   // { rom, model }

const handlesMusicMessage = command => typeof command === 'string' && command.startsWith('music');

function loadRom(deps) {
    const buf = deps.loadRom();
    if (!buf) return null;
    return buf.length % 0x8000 === 0x200 ? buf.subarray(0x200) : buf;
}

function model(deps) {
    const rom = loadRom(deps);
    if (!rom) return { rom: null, model: { error: missingRomText('evermore') } };
    if (!_cache || _cache.rom.length !== rom.length || !_cache.rom.equals(rom)) _cache = { rom, model: buildMusicModel(rom) };
    return _cache;
}

/**
 * @param msg  webview message
 * @param deps {post, loadRom: () => Buffer|null,
 *              apu: {setOn(on), snapshot(): Promise<{view, ram, pkg, frame}>, isOpen(): boolean, point(entity, label)},
 *              describeSource(rom, src) (resources/sound-source.js), open(uri)}
 */
function handleMusicMessage(msg, deps) {
    switch (msg.command) {
        case 'musicInit':
            deps.post({ command: 'musicModel', model: model(deps).model });
            deps.post({ command: 'musicEmulator', open: deps.apu.isOpen() });
            return;
        case 'musicPackage': {
            const { rom } = model(deps);
            deps.post({ command: 'musicPackageData', id: msg.id, records: rom ? packageData(rom, msg.id) : [] });
            return;
        }
        case 'musicStream':
            deps.apu.setOn(!!msg.on);
            deps.post({ command: 'musicEmulator', open: deps.apu.isOpen() });
            return;
        case 'musicDescribe': {
            const { rom } = model(deps);
            let info = null;
            try { info = deps.describeSource && rom ? deps.describeSource(rom, msg.src) : null; } catch { info = null; }
            deps.post({ command: 'musicSourceInfo', key: msg.key, info });
            return;
        }
        case 'musicOpen':
            if (deps.open && /^soe:\/\//.test(String(msg.uri))) deps.open(String(msg.uri));
            return;
        case 'musicPoint':
            if (deps.apu.point) deps.apu.point(msg.entity, msg.label);
            return;
        case 'musicSnapshot':
            deps.apu.snapshot()
                .then(s => deps.post({ command: 'musicSnapshotData', id: msg.id, view: s.view, ram: s.ram, pkg: s.pkg, frame: s.frame }))
                .catch(e => deps.post({ command: 'musicSnapshotData', id: msg.id, error: String(e && e.message || e) }));
            return;
    }
}

/** Sound-effect names by driver id (for the emulator's marks), or null without the ROM. */
function sfxNames(loadRom) {
    const m = model({ loadRom }).model;
    return m.error ? null : m.sfx.map(s => s.name || '');
}

module.exports = { handlesMusicMessage, handleMusicMessage, sfxNames };
