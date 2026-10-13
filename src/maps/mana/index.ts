// Ownership: Public facade for Secret of Mana map decode, render, and integration.

export { decodeMapPiece } from './mana-compressor';
export type { DecodedMapPiece } from './mana-compressor';

export {
    decodeTileset16,
    extractPaletteSet,
    readTilesetCollision,
    readCollisionStructs,
} from './mana-tileset';
export type { Subtile, Metatile16 } from './mana-tileset';

export { MANA_MAP_NAMES, getManaMapName } from './mana-catalog';
export type { ManaMapCatalogEntry } from './mana-catalog';

export {
    MANA_OFFSETS,
    decodeManaRoom,
    decodeManaHeader,
    decodeManaObjects,
    decodeManaTriggers,
    decodeManaPiece,
    listManaRooms,
    getManaPiecePlacementOffset,
} from './mana-room';
export type {
    ManaMapHeader,
    ManaPieceRef,
    ManaObject,
    ManaTrigger,
    ManaRoomData,
} from './mana-room';

export { renderManaRoom } from './mana-render';

export {
    integrateManaToEvermore,
    manaCollisionToEvermoreWord,
} from './mana-integrate';
export type { IntegratedEvermoreMap } from './mana-integrate';
