// Ownership: Secret of Mana composite map decoder and flattener.
//
// Converts SoM composite maps (assemblies of compressed 2D pieces across banks
// $0C..$0F) into unified (W x H) metatile grids.
// Reference: docs/map-format/secret-of-mana-comparison-and-porting.md §1 & §4.

import { decodeMapPiece, DecodedMapPiece } from './mana-compressor';
import { decodeTileset16, extractPaletteSet, readTilesetCollision, Metatile16 } from './mana-tileset';
import { getManaMapName } from './mana-catalog';

export const MANA_OFFSETS = {
    DOORS: 0x83000,
    MAP_TRIGGER_OFFSETS: 0x84000,
    MAP_PIECE_REFERENCE_OFFSETS: 0x85000,
    MAP_OBJECT_OFFSETS: 0x87000,
    COLLISION_TABLE_START: 0xB0400,
    TILESET16_OFFSETS: 0xB4000,
    MAP_PALETTE_SETS_OFFSET: 0xC8000,
    MAP_PIECE_OFFSETS: 0xD0004,
};

export interface ManaMapHeader {
    tileset8: number;
    palSet: number;
    tileset16: number;
    layer1UsesForegroundTiles: boolean;
    layer2UsesForegroundTiles: boolean;
    mode7: boolean;
    walkonEvent: boolean;
    specialEvent: boolean;
    flammie: boolean;
    magicRope: boolean;
    bgScrolling: number;
    displaySettings: number;
    npcPalette: number;
}

export interface ManaPieceRef {
    flag: number;
    low: number;
    high: number;
    pieceIndex: number;
    xPos: number;
    yPos: number;
    isFg: boolean;
}

export interface ManaObject {
    x: number;
    y: number;
    species: number;
    direction: number;
    event: number;
    spawnPriority: boolean;
    frozen: boolean;
    layer2Collision: boolean;
}

export interface ManaTrigger {
    val: number;
    isDoor: boolean;
    doorId?: number;
    eventId?: number;
    destMap?: number;
    destX?: number;
    destY?: number;
}

export interface ManaRoomData {
    id: number;
    name: string;
    mapW: number;
    mapH: number;
    header: ManaMapHeader;
    bgPieces: ManaPieceRef[];
    fgPieces: ManaPieceRef[];
    gridTerrain: Uint8Array;
    gridCanopy: Uint8Array;
    gridCollision: Uint8Array;
    tileset16: Metatile16[];
    palettes: Uint8Array[];
    objects: ManaObject[];
    triggers: ManaTrigger[];
}

export function getManaPiecePlacementOffset(rom: Uint8Array, mapId: number): number {
    const ptrOff = MANA_OFFSETS.MAP_PIECE_REFERENCE_OFFSETS + mapId * 2;
    if (ptrOff + 1 >= rom.length) return 0x80000;
    return 0x80000 + rom[ptrOff] + (rom[ptrOff + 1] << 8);
}

export function getManaObjectOffset(rom: Uint8Array, mapId: number): number {
    const ptrOff = MANA_OFFSETS.MAP_OBJECT_OFFSETS + mapId * 2;
    if (ptrOff + 1 >= rom.length) return 0x80000;
    return 0x80000 + rom[ptrOff] + (rom[ptrOff + 1] << 8);
}

export function getManaTriggerOffset(rom: Uint8Array, mapId: number): number {
    const ptrOff = MANA_OFFSETS.MAP_TRIGGER_OFFSETS + mapId * 2;
    if (ptrOff + 1 >= rom.length) return 0x80000;
    return 0x80000 + rom[ptrOff] + (rom[ptrOff + 1] << 8);
}

export function getManaMapPieceRomOffset(rom: Uint8Array, pieceIndex: number): number {
    const ptrOff = MANA_OFFSETS.MAP_PIECE_OFFSETS + pieceIndex * 2;
    if (ptrOff + 1 >= rom.length) return 0x0D0000;
    const o1 = rom[ptrOff];
    const o2 = rom[ptrOff + 1];
    let bank = 0x0D;
    if (pieceIndex >= 0xA3 && pieceIndex < 0x206) {
        bank = 0x0E;
    } else if (pieceIndex >= 0x206 && pieceIndex < 0x300) {
        bank = 0x0F;
    } else if (pieceIndex >= 0x300) {
        bank = 0x0C;
    }
    return (bank << 16) + (o2 << 8) + o1;
}

export function decodeManaPiece(rom: Uint8Array, pieceIndex: number): DecodedMapPiece | null {
    const p1 = getManaMapPieceRomOffset(rom, pieceIndex);
    let p2 = getManaMapPieceRomOffset(rom, pieceIndex + 1);
    if ((p1 & 0xFF0000) !== (p2 & 0xFF0000)) {
        p2 = (p1 & 0xFF0000) + 0x10000;
    }
    if (p1 >= rom.length || p2 > rom.length || p2 <= p1) return null;
    return decodeMapPiece(rom.slice(p1, p2));
}

export function decodeManaHeader(rom: Uint8Array, mapId: number): ManaMapHeader {
    const off = getManaObjectOffset(rom, mapId);
    if (off + 8 > rom.length) {
        return {
            tileset8: 0, palSet: 0, tileset16: 0,
            layer1UsesForegroundTiles: false, layer2UsesForegroundTiles: false,
            mode7: false, walkonEvent: false, specialEvent: false,
            flammie: false, magicRope: false, bgScrolling: 0,
            displaySettings: 0, npcPalette: 0xFF,
        };
    }
    const b0 = rom[off];
    const b1 = rom[off + 1];
    const b2 = rom[off + 2];
    const b3 = rom[off + 3];
    const b4 = rom[off + 4];
    const b5 = rom[off + 5];
    const b7 = rom[off + 7];

    return {
        tileset8: b0 & 0x3F,
        palSet: b1 & 0x7F,
        tileset16: b2 & 0x3F,
        layer1UsesForegroundTiles: (b2 & 0x40) > 0,
        layer2UsesForegroundTiles: (b2 & 0x80) > 0,
        mode7: (b3 & 0xF8) > 0,
        walkonEvent: (b3 & 0x04) > 0,
        specialEvent: (b3 & 0x01) > 0,
        flammie: (b4 & 0x80) > 0,
        magicRope: (b4 & 0x40) > 0,
        bgScrolling: b4 & 0x3F,
        displaySettings: b5,
        npcPalette: b7,
    };
}

export function decodeManaObjects(rom: Uint8Array, mapId: number): ManaObject[] {
    const start = getManaObjectOffset(rom, mapId) + 8; // skip 8-byte map header
    const end = getManaObjectOffset(rom, mapId + 1);
    const objects: ManaObject[] = [];
    if (start >= rom.length || end > rom.length) return objects;

    for (let i = start; i + 8 <= end; i += 8) {
        const x = rom[i + 2] & 0x7F;
        const spawnPriority = (rom[i + 2] & 0x80) > 0;
        const y = rom[i + 3] & 0x7F;
        const frozen = (rom[i + 3] & 0x80) > 0;
        const dir = (rom[i + 4] & 0xC0) >> 6;
        const layer2Collision = (rom[i + 4] & 0x08) > 0;
        const species = rom[i + 5];
        const event = rom[i + 6] | ((rom[i + 7] & 0x07) << 8);

        objects.push({ x, y, species, direction: dir, event, spawnPriority, frozen, layer2Collision });
    }
    return objects;
}

export function decodeManaTriggers(rom: Uint8Array, mapId: number): ManaTrigger[] {
    const start = getManaTriggerOffset(rom, mapId);
    const end = getManaTriggerOffset(rom, mapId + 1);
    const triggers: ManaTrigger[] = [];
    if (start >= rom.length || end > rom.length) return triggers;

    for (let i = start; i + 2 <= end; i += 2) {
        const val = rom[i] | (rom[i + 1] << 8);
        const isDoor = val >= 0x800;
        const trig: ManaTrigger = { val, isDoor };
        if (isDoor) {
            const doorId = val - 0x800;
            trig.doorId = doorId;
            const doorOff = MANA_OFFSETS.DOORS + doorId * 4;
            if (doorOff + 4 <= rom.length) {
                trig.destMap = rom[doorOff];
                trig.destX = rom[doorOff + 1];
                trig.destY = rom[doorOff + 2];
            }
        } else {
            trig.eventId = val;
        }
        triggers.push(trig);
    }
    return triggers;
}

/**
 * Decode a complete Secret of Mana composite map and flatten its pieces into
 * unified (W x H) terrain, canopy, and collision grids.
 */
export function decodeManaRoom(rom: Uint8Array, mapId: number): ManaRoomData {
    const name = getManaMapName(mapId);
    const header = decodeManaHeader(rom, mapId);

    // Read piece placement list
    const startOffset = getManaPiecePlacementOffset(rom, mapId);
    const endOffset = getManaPiecePlacementOffset(rom, mapId + 1);
    const bgPieces: ManaPieceRef[] = [];
    const fgPieces: ManaPieceRef[] = [];
    let isFg = false;
    let offset = startOffset;

    while (offset < endOffset && offset + 5 <= rom.length) {
        const b = rom[offset];
        if (b === 0xFE) {
            isFg = false;
            offset++;
        } else if (b === 0xFF) {
            isFg = true;
            offset++;
        } else {
            let pieceIndex = rom[offset + 2];
            if (rom[offset + 3] & 0x01) pieceIndex += 256;
            if (rom[offset + 4] & 0x01) pieceIndex += 512;
            const xPos = rom[offset + 3] >> 1;
            const yPos = rom[offset + 4] >> 1;
            const piece: ManaPieceRef = {
                flag: rom[offset],
                low: rom[offset + 1] >> 4,
                high: rom[offset + 1] & 0x0F,
                pieceIndex,
                xPos,
                yPos,
                isFg,
            };
            if (isFg) fgPieces.push(piece);
            else bgPieces.push(piece);
            offset += 5;
        }
    }

    // Decompress pieces and determine composite map bounds
    let mapW = 0;
    let mapH = 0;
    const decodedBg: Array<ManaPieceRef & { dec: DecodedMapPiece }> = [];
    const decodedFg: Array<ManaPieceRef & { dec: DecodedMapPiece }> = [];

    for (const p of bgPieces) {
        const dec = decodeManaPiece(rom, p.pieceIndex);
        if (!dec) continue;
        decodedBg.push({ ...p, dec });
        mapW = Math.max(mapW, p.xPos + dec.width);
        mapH = Math.max(mapH, p.yPos + dec.height);
    }

    for (const p of fgPieces) {
        const dec = decodeManaPiece(rom, p.pieceIndex);
        if (!dec) continue;
        decodedFg.push({ ...p, dec });
        mapW = Math.max(mapW, p.xPos + dec.width);
        mapH = Math.max(mapH, p.yPos + dec.height);
    }

    // Default to at least one SNES screen if no pieces
    if (mapW === 0) mapW = 16;
    if (mapH === 0) mapH = 14;

    const gridTerrain = new Uint8Array(mapW * mapH);
    const gridCanopy = new Uint8Array(mapW * mapH);

    // Flatten background terrain pieces
    for (const p of decodedBg) {
        for (let py = 0; py < p.dec.height; py++) {
            for (let px = 0; px < p.dec.width; px++) {
                const destX = p.xPos + px;
                const destY = p.yPos + py;
                if (destX < mapW && destY < mapH) {
                    const val = p.dec.data[py * p.dec.width + px];
                    if (val !== 0 || gridTerrain[destY * mapW + destX] === 0) {
                        gridTerrain[destY * mapW + destX] = val;
                    }
                }
            }
        }
    }

    // Flatten foreground canopy pieces
    for (const p of decodedFg) {
        for (let py = 0; py < p.dec.height; py++) {
            for (let px = 0; px < p.dec.width; px++) {
                const destX = p.xPos + px;
                const destY = p.yPos + py;
                if (destX < mapW && destY < mapH) {
                    const val = p.dec.data[py * p.dec.width + px];
                    if (val !== 0 || gridCanopy[destY * mapW + destX] === 0) {
                        gridCanopy[destY * mapW + destX] = val;
                    }
                }
            }
        }
    }

    // Decode Tileset16
    const t16Offset = MANA_OFFSETS.TILESET16_OFFSETS + (header.tileset16 & 0x3F) * 3;
    let tileset16: Metatile16[] = [];
    if (t16Offset + 3 <= rom.length) {
        const off1 = rom[t16Offset] | (rom[t16Offset + 1] << 8) | (rom[t16Offset + 2] << 16);
        const off2 = t16Offset + 6 <= rom.length
            ? rom[t16Offset + 3] | (rom[t16Offset + 4] << 8) | (rom[t16Offset + 5] << 16)
            : off1 + 2000;
        if (off1 < rom.length && off2 <= rom.length && off2 > off1) {
            tileset16 = decodeTileset16(rom.slice(off1, off2));
        }
    }

    // Decode palettes
    const palettes = extractPaletteSet(rom, header.palSet);

    // Decode collision bytes per cell
    const colLookup = readTilesetCollision(rom, header.tileset16);
    const gridCollision = new Uint8Array(mapW * mapH);
    for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
            const idx = y * mapW + x;
            let tileId = gridTerrain[idx];
            if (header.layer2UsesForegroundTiles) {
                tileId = (tileId + 192) & 0x1FF;
            }
            gridCollision[idx] = colLookup[tileId % colLookup.length] || 0;
        }
    }

    const objects = decodeManaObjects(rom, mapId);
    const triggers = decodeManaTriggers(rom, mapId);

    return {
        id: mapId,
        name,
        mapW,
        mapH,
        header,
        bgPieces,
        fgPieces,
        gridTerrain,
        gridCanopy,
        gridCollision,
        tileset16,
        palettes,
        objects,
        triggers,
    };
}

/**
 * List all non-empty vanilla composite maps from Secret of Mana ROM.
 */
export function listManaRooms(rom: Uint8Array): Array<{ id: number; name: string; mapW: number; mapH: number }> {
    const list: Array<{ id: number; name: string; mapW: number; mapH: number }> = [];
    // 512 total composite map pointers in Bank 8 ($85000..$853FF)
    for (let mapId = 0; mapId < 512; mapId++) {
        const start = getManaPiecePlacementOffset(rom, mapId);
        const end = getManaPiecePlacementOffset(rom, mapId + 1);
        if (end <= start || start >= rom.length) continue;

        // Has at least one valid piece entry
        const name = getManaMapName(mapId);
        // Measure quick bounds without full decompression if possible
        const room = decodeManaRoom(rom, mapId);
        list.push({
            id: mapId,
            name,
            mapW: room.mapW,
            mapH: room.mapH,
        });
    }
    return list;
}
