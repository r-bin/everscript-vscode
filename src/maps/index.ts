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

export { MAX_ROOMS, MAP_LIST_ADDR, snesToRom, read16, read24, roomBlobOffset, hex } from './rom';
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

export { extractTileFamilyPalette, buildRoomCgramPalettes } from './palette';
export type { Rgba } from './palette';
export { decompressTile16x16, decodeTilePixels } from './chr';
export { renderVramLayer, compositeLayers, renderRoomComposite, renderRoomForeground, opaqueMask, hiddenTileMask } from './render';
export type { PixelBuffer, RenderOptions } from './render';
export { encodePng, encodePngDataUri } from './png';
export { drawCollisionOverlay, PLANE_COLORS } from './collision-overlay';
export type { CollisionOverlayOptions } from './collision-overlay';
export { classifyRoom, buildLegend, buildSummary, GATE_BLOCKS } from './overlay-features';
export type { RoomFeatures, LegendItem, ObjectRect, TileXY } from './overlay-features';
export { parseObjectStamp, objectStampSignature } from './object-stamps';
export { applyObjectStates, renderObjectState, objectStateCount, objectBounds, DEFAULT_OBJECT_STATE } from './objects';
export type { ObjectStateMap } from './objects';
export type { ObjectStamp } from './object-stamps';
export { parseAnimationChannels, buildAnimationGroups, buildOverlayTransfer } from './animation';
export type {
    AnimationChannel, AnimationFrame, AnimationGroup, AnimationLayer, AnimationOptions,
    OverlayTransfer, Section2Ref,
} from './animation';
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
export type { SpriteInfo, SpriteChunk, SpritePixels, SpriteBlockPixels } from './sprites';
export type { AnimationFrame as SpriteAnimationFrame, StrikeBox } from './character-animation';
export type { CharacterDisposition, CharacterHitbox } from './character-record';
