'use strict';
// Ownership: the Evermore half of the emulator panel's host side — what the panel asks the game for:
// the room under the running game as pictures (map view), standing sprites of entities not yet
// active, the alchemy and loot icons, script trace formatting, and its part of the page (webview()). The panel (src/core/emulator/panel.js)
// gets this module through configureEmulator({ game }); the SNES CDL Recorder passes none.

const maps = require('../../../../dist/games/evermore/maps');
const { buildItemIcons } = require('../../../../dist/games/evermore/rooms/data/item-icons');
const { processScriptTraceBatch } = require('./script-trace');
const { describeCustomMapRom } = require('../../../../dist/games/evermore/emulator/custom-map-rom');
const { roomMap, clearCaches } = require('../../../../dist/games/evermore/emulator/room-map');

/** What the page's gameRomData hook gets with each ROM: the ALCHEMY panel's icons (or null). */
function romData(romBuffer) {
    try {
        const icons = romBuffer ? buildItemIcons(romBuffer) : null;
        return icons ? { alchemyIcons: icons.alchemy } : null;
    } catch (_) {
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

/** Evermore's page files, loaded before the page's own script: its ROM detector (gameDetectRom) and the host's ROM readers (EvsRom, tools/bundle-pages.mts). */
function webviewFiles() {
    const path = require('path');
    return [path.join(__dirname, 'webview', 'rom-game.js'), path.join(__dirname, '..', '..', '..', '..', 'dist', 'webview', 'evermore-rom.js')];
}

module.exports = { webviewFiles, webview, clearCaches, romData, roomMap, idleSprites, traceScripts, describeRom: describeCustomMapRom };
