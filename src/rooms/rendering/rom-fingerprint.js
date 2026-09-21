'use strict';
// Ownership: cheap ROM identity, shared by every cache in the Rooms tab's
// rendering layer.
//
// Keying a cache on room id alone meant a rebuilt ROM (everscript.buildAndRun)
// kept serving the pre-rebuild render forever — worse than slow, because it
// silently shows the wrong map.

/**
 * Length plus a sample of interior bytes. A recompile changes map data, so
 * sampling across the file catches it without hashing 3 MB on every room
 * selection.
 */
function romFingerprint(rom) {
    let h = rom.length;
    const step = Math.max(1, Math.floor(rom.length / 64));
    for (let i = 0; i < rom.length; i += step) h = ((h * 31) + rom[i]) | 0;
    return h;
}

module.exports = { romFingerprint };
