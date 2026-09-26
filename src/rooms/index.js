'use strict';
// Rooms subsystem root — re-exports all public APIs from sub-modules.
// Import this when you need multiple rooms functions.
// Import sub-modules directly for narrow dependencies.

const { parseRoomContent }                                          = require('./parsing/content-parser');
const { findRoomImage, collectRoomsFromDir, buildRoomTree,
        setRoomImageUris }                                          = require('./parsing/file-scanner');
const { renderVanillaTree, renderRoomsTree, buildRoomRailHtml,
        buildRoomsJson }                                            = require('./rendering/tree-renderer');
const { buildRoomTileOverlay, invalidateRoomRenders }               = require('./rendering/tile-overlay');
const { buildRoomMetatilePalette, buildComposedPreview,
        invalidateMetatilePalettes }                               = require('./rendering/metatile-palette');
const { buildBlankRoom, buildDraftCollision, buildFamilySheet, buildFamilyCatalogue, buildFamilyPreviews,
        invalidateRoomDrafts }                                     = require('./rendering/room-draft');
const { decoIndex, decoCells,
        invalidateDecoCatalogue }                                  = require('./rendering/deco-catalogue');
const { buildDecoPreviews, buildWidgetPreviews }                    = require('./rendering/deco-preview');
const { buildExportRom }                                            = require('./rendering/rom-export');
const { buildCustomMapArchive }                                     = require('./rendering/custom-export');
const { handlesCustomMapMessage, handleCustomMapMessage }           = require('./custom-host');
const { relatedTiles, neighbourTiles }                              = require('./rendering/vanilla-index');
const { VANILLA_ROOMS, buildVanillaRoomContent,
        buildVanillaRoomDetails, invalidateVanillaDataCaches }      = require('./data/vanilla-data');
const { getMapEnum, readLuaWatchers, readScriptAllTriggers,
        invalidateLuaWatcherCaches }                                = require('./data/lua-watchers');

function invalidateRoomDataCaches() {
    invalidateVanillaDataCaches();
    invalidateLuaWatcherCaches();
    invalidateRoomDrafts();
    invalidateDecoCatalogue();
}

// Adapter: old room-tree.js buildRoomTree took (document, wsRoot, extCfg).
// New file-scanner.js takes (document, wsRoot, extCfg, deps).
// This adapter injects the deps so callers in extension.js don't need to change.
function buildRoomTreeWithDeps(document, wsRoot, extCfg) {
    return buildRoomTree(document, wsRoot, extCfg, {
        getMapEnum,
        readScriptAllTriggers,
        readLuaWatchers,
        readRomMapHeader: require('../shared/rom-readers').readRomMapHeader,
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
    buildRoomRailHtml,
    buildRoomsJson,
    buildRoomTileOverlay,
    invalidateRoomRenders,
    buildRoomMetatilePalette,
    buildComposedPreview,
    invalidateMetatilePalettes,
    buildBlankRoom,
    buildDraftCollision,
    buildExportRom,
    buildCustomMapArchive,
    handlesCustomMapMessage,
    handleCustomMapMessage,
    buildFamilySheet,
    buildFamilyCatalogue,
    buildFamilyPreviews,
    decoIndex,
    decoCells,
    buildDecoPreviews,
    buildWidgetPreviews,
    relatedTiles,
    neighbourTiles,

    // Data
    VANILLA_ROOMS,
    getMapEnum,
    readLuaWatchers,
    readScriptAllTriggers,
    buildVanillaRoomContent,
    buildVanillaRoomDetails,
    invalidateRoomDataCaches,
};
