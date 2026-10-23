// Ownership: public API for the ROM map/room decoder.
//
// A TypeScript port of the verified decoder in the sibling `everscript` repo
// (tools/dump_room.py, collision.py, cuttable_grass.py). Pure: it takes a ROM
// buffer and returns data — no filesystem, no VS Code API, no rendering.
//
// Validate changes with `npm run check:maps`, which diffs this decoder's output
// against the Python implementation across every room.

export { decodeRoom } from './room';
export type {
    RoomData,
    RoomHeader,
    RoomObject,
    ObjectState,
    TriggerRecord,
} from './room';

export { MAX_ROOMS, MAP_LIST_ADDR, mapTableOffset, snesToRom, read16, read24, roomBlobOffset, hex } from './rom';
export {
    identifyEvermoreVariant,
    toVariantId,
    toJsonVariantKey,
    getTableInfo,
    getTableFileOffset,
    getTableCount,
    getMapTableOffset,
    getMapPalettesOffset,
    getMapTileGraphicsOffset,
    getStringKeysOffset,
    getStringKeysCount,
    getRoomEnterScriptsOffset,
    getScriptPointersOffset,
    getScriptHeaderOffset,
    getScriptOpcodeTableOffset,
    getAnimateIdsOffset,
    getAnimationRecordsOffset,
    getAnimationVmDispatchOffset,
    getCharacterRecordsOffset,
    getEnemyIndexOffset,
    getSongPackagesOffset,
    getSpriteBlocks16Offset,
    getSpriteBlocks8Offset,
    getResetVector,
    getNmiVector,
    getIrqVector,
    getScriptVmDispatcher,
    getStringDecoder,
    getRoomLoader,
} from '../variant-resolver';
export { parseBlobLayout } from './blob-layout';
export type { BlobLayout, PayloadBlock } from './blob-layout';

export {
    tilePlane,
    passability,
    driftVector,
    entityGate,
    isPlaneTransparent,
    isAlwaysWalkable,
    holdsPlane,
    planesUsed,
    planeTransitionTiles,
    geometryMask,
    spriteDrawsInFront,
    spriteHiddenOn,
    spriteDepth,
    spawnDepth,
    SOLID,
    OPEN,
    SPRITE_IN_FRONT,
    SPRITE_HIDDEN,
} from './collision';
export type { Entity, DriftVector, SpriteDepth } from './collision';

export { parseGrassSwapSection, findCuttableGrassTiles, checkTableInvariants } from './cuttable-grass';
export type { GrassSwapTable, GrassRecord } from './cuttable-grass';

export { extractTileFamilyPalette, buildRoomCgramPalettes, paletteCycleMask, shiftCgramPalettes } from './palette';
export type { Rgba, PaletteCycleSpec } from './palette';
export { decompressTile16x16, decodeTilePixels, tileColorMask } from './chr';
export { renderVramLayer, compositeLayers, renderRoomComposite, renderRoomForeground, renderRoomLayers, opaqueMask, hiddenTileMask, scale2x } from './render';
export type { PixelBuffer, RenderOptions, LayerHalves } from './render';
export { encodePng, encodePngDataUri } from './png';
export { drawCollisionOverlay, renderStandaloneOverlay, PLANE_COLORS } from './collision-overlay';
export type { CollisionOverlayOptions, StandaloneOverlayOptions } from './collision-overlay';
export { classifyRoom, buildLegend, buildSummary, GATE_BLOCKS } from './overlay-features';
export type { RoomFeatures, LegendItem, ObjectRect, TileXY } from './overlay-features';
export { parseObjectStamp, objectStampSignature } from './object-stamps';
export {
    metatileTable, renderMetatileAtlas, metatileCellRect, metatileId, metatileIndex,
    withMetatiles, renderTileListAtlas, tileSlotChr,
} from './metatiles';
export type { MetatileInfo, MetatileAtlas, MetatileLayer, MetatileDraft, TileListAtlas } from './metatiles';
export { buildVanillaIndex } from './vanilla-index';
export {
    graphicsForFamilies, familyExamples, groupByRooms,
    isUnusedGraphic, isCanopyGraphic, isDualLayerGraphic, tileCategoryFlags,
} from './vanilla-queries';
export { GRASS_UNCUT, GRASS_CUT } from './vanilla-grass';
export type { GrassReveal } from './vanilla-grass';
export { suggestFamily, suggestCollision, suggestGeometry, suggestStairs, shapeOf, GEOMETRY_BITS, preferredLayer } from './vanilla-suggest';
export { stairsNibble, stairsForWord, stairsCollision, ALWAYS_WALKABLE, STAIRS_RISE_RIGHT, STAIRS_RISE_LEFT, STAIRS_VERTICAL } from './vanilla-stairs';
export type { VanillaIndex, Attestation } from './vanilla-index';
export type { GraphicGroup } from './vanilla-queries';
export { relatedGraphics, relationship, rankByRelationship } from './vanilla-related';
export type { Related } from './vanilla-related';
export type { Animation, AnimationIndex } from './vanilla-animation';
export type { Suggestion } from './vanilla-suggest';
export {
    DIRECTIONS, directionalNeighbours, walkResolvedGrid, newDirectionalTally, compactDirectional,
} from './vanilla-adjacency';
export type {
    Direction, GridLayer, DirectionalAdjacency, DirectionalRelated, DirectionalTally, ResolvedCell,
} from './vanilla-adjacency';
export { blankRoom, emptyStamp, roomProblems, MIN_WIDTH, MIN_HEIGHT, MAX_TILES } from './blank-room';
export type { BlankRoomOptions } from './blank-room';
export { proceduralPatch } from './vanilla-procedural';
export type { ProceduralTile } from './vanilla-procedural';
export {
    roomBudget, marginalCost, wramBytes, MAX_GRAPHICS, MAX_FAMILIES, MAX_WRAM, VANILLA_MAX,
} from './budget';
export type { RoomBudget, BudgetLine, MarginalCost, StampTriple } from './budget';

export { applyObjectStates, renderObjectState, objectStateCount, objectBounds, DEFAULT_OBJECT_STATE } from './objects';
export type { ObjectStateMap } from './objects';
export type { ObjectStamp } from './object-stamps';
export { parseAnimationChannels, buildOverlayTransfer, overlayLayer } from './animation';
export { buildAnimationGroups, cellChannels, cellPaletteCycles, clearAnimatedCells } from './animation-groups';
export type { AnimationChannel, AnimationFrame, OverlayTransfer, Section2Ref } from './animation';
export type { AnimationGroup, AnimationLayer, AnimationOptions } from './animation-groups';
export { drawString3x5, drawLabelInRect, textWidth3x5 } from './font';
export type { Rgba8, LabelAnchor } from './font';

export {
    walkSprites, readSpriteInfo, composeSprite, decodeSpriteBlock, SPRITE_LIST_START,
} from './sprites';
export { renderCharacterSprite, renderSpriteAt, renderCharacterFrames } from './characters';
export {
    resolveCharacterSprite, characterAnimation, strikeBoxes, characterStrikeBoxes,
} from './character-animation';
export {
    characterPalette, characterPaletteAddress, characterDisposition, characterHitbox,
    entitiesCollide, FACING_SOUTH,
} from './character-record';
export {
    renderItemIcon, lootIconId, alchemyIconId, iconEntry, ICON_ID_LAST, ALCHEMY_FORMULAS,
} from './item-icons';
export type { SpriteInfo, SpriteChunk, SpritePixels, SpriteBlockPixels } from './sprites';
export type { AnimationFrame as SpriteAnimationFrame, StrikeBox } from './character-animation';
export type { CharacterDisposition, CharacterHitbox } from './character-record';
export {
    lzssCompress, encodeMarkovGrid, buildBlob, modelFromRom, objectAreaEnd,
    encodeBlock1, encodeBlock2, encodeBlock3, wrapBlock, unpackBlock, writeRoomAt,
    SUB_RAW, SUB_LZSS, SUB_MARKOV,
} from './encode';
export type { Block, RoomModel, TriggerRecord as EncodedTrigger } from './encode';
export { buildCustomRoomBlob, draftTopCells, applyHeaderOverrides } from './custom-room';
export { planCustomAnimation, remapWord, cycleFrom, wordSlot, MAX_CHANNELS } from './custom-animation';
export type { ChannelSpec } from './custom-animation';
export type { CustomAnimationPlan } from './custom-animation';
export type { CustomRoomInput, CustomRoomBlob, HeaderOverrides } from './custom-room';
export { buildOwnRoomBlob } from './own-room';
export type { OwnRoomInput, OwnRoomBlob } from './own-room';
export { encodeObjectArea } from './object-encode';
