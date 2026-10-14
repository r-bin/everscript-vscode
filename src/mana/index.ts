// Ownership: public facade of the Secret of Mana library (pure: ROM bytes in, data out).

export { offset, u8, u16, u24, romTitle, isManaRom } from './rom';
export type { Rom } from './rom';
export { MAP_COUNT, readHeader, headerAddress } from './header';
export type { ManaHeader } from './header';
export { pieceAddress, pieceSize, decodePiece } from './piece-decoder';
export type { PieceSize } from './piece-decoder';
export { readPlacements, assembleLayers, mapSize, pictureKey, LAYER_A, LAYER_B, ROW } from './placement';
export type { Placement, AssembledLayers, FlagValues } from './placement';
export { decodeMetatileSet, metatileHalf, METATILES_PER_HALF } from './metatiles';
export { loadBgChars } from './chars';
export { loadBgPalettes, readDisplayMode } from './palette';
export type { DisplayMode } from './palette';
export { loadMap } from './map';
export type { ManaMap } from './map';
export { renderMap } from './render';
export type { ManaImage } from './render';
export { AREAS, areaOf, mapsWithoutArea } from './areas';
export type { ManaArea } from './areas';
