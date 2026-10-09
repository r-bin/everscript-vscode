'use strict';
// Ownership: what the Music tab knows before any sound plays: the tracks, the
// sound effects, where every package writes in ARAM, and the driver bytes.
// Pure; ROM bytes in, a JSON-ready object out.

const { isEvermoreAudio, packageRecords, driverBlocks, musicPackages, sfxPackages, scriptIdsBySfx } = require('./rom-audio');
const { getMusic, getMusicName, getSound, getSoundName } = require('../../localizations/sounds');

const hex2 = n => n.toString(16).toUpperCase().padStart(2, '0');

/** Where a package writes: [dest, length] per record, in upload order. */
function packageLayout(rom, id) {
    return packageRecords(rom, id).map(r => [r.dest, r.bytes.length]);
}

function sfxName(scripts) {
    // Script id 0x00 is named 'None' (no sound); it also maps to a driver effect.
    for (const id of scripts) if (getSound(id) && getSound(id).name !== 'None') return getSoundName(id);
    return '';
}

/**
 * { music, sfx, packages, driver } or { error }.
 *   music[m]    { id, package, name }
 *   sfx[s]      { id, package (0 = base bank), scripts: [sound() ids], name }
 *   packages[p] [[dest, len], ...]
 *   driver      { entry, blocks: [{ dest, bytes: number[] }] }
 */
function buildMusicModel(rom) {
    if (!isEvermoreAudio(rom)) return { error: 'The configured ROM does not have Secret of Evermore (U)\'s sound tables.' };
    const musicPk = musicPackages(rom);
    const sfxPk = sfxPackages(rom);
    const scripts = scriptIdsBySfx(rom);
    const drv = driverBlocks(rom);
    const packages = [];
    for (let p = 0; p <= Math.max(...musicPk, ...sfxPk); p++) packages.push(packageLayout(rom, p));
    return {
        music: musicPk.map((p, m) => ({ id: m, package: p, name: getMusic(m) ? getMusicName(m) : 'Music $' + hex2(m) })),
        sfx: sfxPk.map((p, s) => {
            const ids = scripts.get(s) || [];
            return { id: s, package: p, scripts: ids, name: sfxName(ids) };
        }),
        packages,
        driver: { entry: drv.entry, blocks: drv.blocks.map(b => ({ dest: b.dest, bytes: Array.from(b.bytes) })) },
    };
}

/** The bytes of one package, for the tab's engine: [{ dest, bytes: number[] }]. */
function packageData(rom, id) {
    return packageRecords(rom, id).map(r => ({ dest: r.dest, bytes: Array.from(r.bytes) }));
}

module.exports = { buildMusicModel, packageData };
