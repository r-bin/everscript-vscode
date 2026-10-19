// Rooms subsystem root — re-exports all public APIs from sub-modules.
// Import this when you need multiple rooms functions.
// Import sub-modules directly for narrow dependencies.

import { parseRoomContent } from './parsing/content-parser';
import { findRoomImage, collectRoomsFromDir, buildRoomTree, setRoomImageUris } from './parsing/file-scanner';
import { renderVanillaTree, renderRoomsTree, buildRoomRailHtml, buildRoomsJson } from './rendering/tree-renderer';
import { buildRoomTileOverlay, invalidateRoomRenders } from './rendering/tile-overlay';
import { buildRoomMetatilePalette, buildComposedPreview, invalidateMetatilePalettes } from './rendering/metatile-palette';
import { buildBlankRoom, buildDraftCollision, buildFamilySheet, buildFamilyCatalogue, buildFamilyPreviews, invalidateRoomDrafts } from './rendering/room-draft';
import { decoIndex, decoCells, invalidateDecoCatalogue } from './rendering/deco-catalogue';
import { buildDecoPreviews, buildWidgetPreviews, buildConstructGhost } from './rendering/deco-preview';
import { buildExportRom } from './rendering/rom-export';
import { buildCustomMapArchive } from './rendering/custom-export';
import { handlesCustomMapMessage, handleCustomMapMessage } from './custom-host';
import { relatedTiles, neighbourTiles, vanillaExamples, proceduralFill } from './rendering/vanilla-index';
import { readRomMapHeader } from '../rom-readers';
import { buildItemIcons } from './data/item-icons';
import { VANILLA_ROOMS, buildVanillaRoomContent, buildVanillaRoomDetails, invalidateVanillaDataCaches } from './data/vanilla-data';
import { getMapEnum, readLuaWatchers, readScriptAllTriggers, invalidateLuaWatcherCaches } from './data/lua-watchers';

function invalidateRoomDataCaches() {
    invalidateVanillaDataCaches();
    invalidateLuaWatcherCaches();
    invalidateRoomDrafts();
    invalidateDecoCatalogue();
}

// Adapter: old room-tree.js buildRoomTree took (document, wsRoot, extCfg).
// New file-scanner.ts takes (document, wsRoot, extCfg, deps).
// This adapter injects the deps so callers in extension.js don't need to change.
function buildRoomTreeWithDeps(document: Parameters<typeof buildRoomTree>[0], wsRoot: Parameters<typeof buildRoomTree>[1], extCfg: Parameters<typeof buildRoomTree>[2]) {
    return buildRoomTree(document, wsRoot, extCfg, {
        getMapEnum,
        readScriptAllTriggers,
        readLuaWatchers,
        readRomMapHeader,
    });
}

// Adapter: old renderVanillaTree() took no args — VANILLA_ROOMS was module-local.
function renderVanillaTreeCompat() {
    return renderVanillaTree(VANILLA_ROOMS);
}

export { parseRoomContent, findRoomImage, collectRoomsFromDir, buildRoomTreeWithDeps as buildRoomTree, setRoomImageUris, renderVanillaTreeCompat as renderVanillaTree, renderRoomsTree, buildRoomRailHtml, buildRoomsJson, buildRoomTileOverlay, invalidateRoomRenders, buildRoomMetatilePalette, buildComposedPreview, invalidateMetatilePalettes, buildBlankRoom, buildDraftCollision, buildExportRom, buildCustomMapArchive, handlesCustomMapMessage, handleCustomMapMessage, buildFamilySheet, buildFamilyCatalogue, buildFamilyPreviews, decoIndex, decoCells, buildDecoPreviews, buildWidgetPreviews, buildConstructGhost, relatedTiles, neighbourTiles, vanillaExamples, proceduralFill, VANILLA_ROOMS, getMapEnum, readLuaWatchers, readScriptAllTriggers, buildVanillaRoomContent, buildVanillaRoomDetails, buildItemIcons, invalidateRoomDataCaches };
