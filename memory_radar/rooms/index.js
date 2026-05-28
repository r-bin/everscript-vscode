'use strict';
// Rooms subsystem root — re-exports all public APIs from sub-modules.
// Import this when you need multiple rooms functions.
// Import sub-modules directly for narrow dependencies.

const { parseRoomContent }                                          = require('./parsing/content-parser');
const { findRoomImage, collectRoomsFromDir, buildRoomTree,
        setRoomImageUris }                                          = require('./parsing/file-scanner');
const { renderVanillaTree, renderRoomsTree, buildRoomsJson }        = require('./rendering/tree-renderer');
const { VANILLA_ROOMS, buildVanillaRoomContent,
        buildVanillaRoomDetails, invalidateVanillaDataCaches }      = require('./data/vanilla-data');
const { getMapEnum, readLuaWatchers, readScriptAllTriggers,
        invalidateLuaWatcherCaches }                                = require('./data/lua-watchers');

function invalidateRoomDataCaches() {
    invalidateVanillaDataCaches();
    invalidateLuaWatcherCaches();
}

// Adapter: old room-tree.js buildRoomTree took (document, wsRoot, extCfg).
// New file-scanner.js takes (document, wsRoot, extCfg, deps).
// This adapter injects the deps so callers in extension.js don't need to change.
function buildRoomTreeWithDeps(document, wsRoot, extCfg) {
    return buildRoomTree(document, wsRoot, extCfg, {
        getMapEnum,
        readScriptAllTriggers,
        readLuaWatchers,
        readRomMapHeader: require('../rom-readers').readRomMapHeader,
    });
}

// Adapter: old renderVanillaTree() took no args — VANILLA_ROOMS was module-local.
function renderVanillaTreeCompat() {
    return renderVanillaTree(VANILLA_ROOMS);
}

module.exports = {
    // Parsing
    parseRoomContent,
    findRoomImage,
    collectRoomsFromDir,
    buildRoomTree: buildRoomTreeWithDeps,
    setRoomImageUris,

    // Rendering
    renderVanillaTree: renderVanillaTreeCompat,
    renderRoomsTree,
    buildRoomsJson,

    // Data
    VANILLA_ROOMS,
    getMapEnum,
    readLuaWatchers,
    readScriptAllTriggers,
    buildVanillaRoomContent,
    buildVanillaRoomDetails,
    invalidateRoomDataCaches,
};
