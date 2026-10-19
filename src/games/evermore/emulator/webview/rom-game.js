// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * games/evermore/emulator/webview/rom-game.js
 *
 * Which game a ROM is, for the features that only work on Secret of Evermore (U):
 * the overlays, the pause menu's OBJECTS / LOOT / CHEATS, the script stack hook,
 * the bottom-bar tabs TRACE / STACK / ENTITIES / ALCHEMY / PALETTES.
 *
 * A ROM counts as Evermore when its SNES header has the vanilla US title and
 * destination code (title "SECRET OF EVERMORE", destination $01 = North America).
 * Nothing else is checked, so ROM hacks and the ExHiROM build count too; the
 * other regions do not (their addresses differ).
 *
 * Loaded by the emulator webview as a file (window.gameDetectRom; host.js webviewFiles() hands it to the
 * panel) and by node (module.exports) for the tests. Without it (the recorder) no ROM counts as Evermore.
 */
(function (root) {
    const TITLE = 'SECRET OF EVERMORE';
    const DESTINATION_US = 0x01;
    // HiROM header, then the ExHiROM one ($40FFC0); offsets in the file without a copier header.
    const HEADERS = [0xFFC0, 0x40FFC0];

    function headerAt(rom, at) {
        if (at + 0x20 > rom.length) return null;
        let title = '';
        for (let i = 0; i < 21; i++) title += String.fromCharCode(rom[at + i]);
        return { title: title.replace(/[\0 ]+$/, ''), destination: rom[at + 0x19] };
    }

    /** true when the ROM is Secret of Evermore (U) or built on it (header title + region). */
    function gameDetectRom(rom) {
        if (!rom || !rom.length) return false;
        const base = rom.length % 1024 === 512 ? 512 : 0;
        for (const at of HEADERS) {
            const h = headerAt(rom, base + at);
            if (h && h.title === TITLE && h.destination === DESTINATION_US) return true;
        }
        return false;
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { gameDetectRom };
    else root.gameDetectRom = gameDetectRom;
})(this);
