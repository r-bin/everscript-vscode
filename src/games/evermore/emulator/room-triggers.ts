// Ownership: the room trigger tables as the emulator page reads them (step-on and B triggers of a map,
// their boxes on the screen, a script id's bus address), for every release: the map table and the script
// bank come from the ROM's variant (variants.json). Bundled for the page into EvsRom (page-rom.ts) and
// required by tests. The ROM may carry a 512-byte copier header.

import { mapTableOffset } from '../maps/rom';
import { getScriptHeaderOffset } from '../variant-resolver';

/** 512 when the ROM carries a copier header, else 0. */
function copierHeader(rom: Uint8Array): number {
    return (rom.length % 1024 === 512) ? 512 : 0;
}

/** One step-on or B trigger: its box in map tiles and the script it runs. */
interface RoomTrigger { y1: number; x1: number; y2: number; x2: number; scriptId: number; index: number; kind: 'stepOn' | 'bTrigger' }

function parseRoomTriggers(rom: Uint8Array | null | undefined, mapId: unknown): { offX: number; offY: number; stepOn: RoomTrigger[]; bTrigger: RoomTrigger[] } | null {
    if (!rom || typeof mapId !== 'number' || mapId < 0 || mapId > 0x90) return null;
    const headerOffset = copierHeader(rom);
    const mapTableRom = headerOffset + mapTableOffset(rom);
    const ptrAddr = mapTableRom + mapId * 4;
    if (ptrAddr + 3 >= rom.length) return null;
    const dataSnes = rom[ptrAddr] | (rom[ptrAddr + 1] << 8) | (rom[ptrAddr + 2] << 16);
    if (dataSnes === 0 || dataSnes === 0xFFFFFF) return null;
    const dataRom = headerOffset + (((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff));
    if (dataRom + 20 >= rom.length) return null;

    const offX = rom[dataRom + 0];
    const offY = rom[dataRom + 1];

    const stepLen = rom[dataRom + 0x0d] | (rom[dataRom + 0x0d + 1] << 8);
    const stepTableRom = dataRom + 0x0d + 2;
    const bLenRom = stepTableRom + stepLen;
    if (bLenRom + 2 >= rom.length) return null;
    const bLen = rom[bLenRom] | (rom[bLenRom + 1] << 8);
    const bTableRom = bLenRom + 2;

    const stepOn: RoomTrigger[] = [];
    if (stepLen >= 6 && stepLen % 6 === 0 && stepLen <= 600) {
        let idx = 0;
        for (let p = 0; p < stepLen; p += 6) {
            const at = stepTableRom + p;
            if (at + 5 >= rom.length) break;
            stepOn.push({
                y1: rom[at + 0],
                x1: rom[at + 1],
                y2: rom[at + 2],
                x2: rom[at + 3],
                scriptId: rom[at + 4] | (rom[at + 5] << 8),
                index: idx++,
                kind: 'stepOn',
            });
        }
    }

    const bTrigger: RoomTrigger[] = [];
    if (bLen >= 6 && bLen % 6 === 0 && bLen <= 600) {
        let idx = 0;
        for (let p = 0; p < bLen; p += 6) {
            const at = bTableRom + p;
            if (at + 5 >= rom.length) break;
            bTrigger.push({
                y1: rom[at + 0],
                x1: rom[at + 1],
                y2: rom[at + 2],
                x2: rom[at + 3],
                scriptId: rom[at + 4] | (rom[at + 5] << 8),
                index: idx++,
                kind: 'bTrigger',
            });
        }
    }

    return { offX, offY, stepOn, bTrigger };
}

function calculateTriggerBox(trigger: Pick<RoomTrigger, 'x1' | 'y1' | 'x2' | 'y2'>, trigOffX: number, trigOffY: number, camX: number, camY: number) {
    const posX = (trigger.x1 - trigOffX) * 16;
    const posY = (trigger.y1 - trigOffY) * 16;
    const boxW = Math.max(1, (trigger.x2 - trigger.x1) * 16);
    const boxH = Math.max(1, (trigger.y2 - trigger.y1) * 16);
    return {
        posX,
        posY,
        boxW,
        boxH,
        sx: (posX - camX) * 2,
        sy: (posY - camY) * 2,
        sw: boxW * 2,
        sh: boxH * 2,
    };
}

/** A trigger's script id (a byte offset into the script table) as a bus address. The table and the packed
 * pointers are relative to the script bank's header: $92:8000 in the US layout, $93:8000 in PAL. */
function resolveScriptIdToSnes(rom: Uint8Array | null | undefined, scriptId: unknown): number {
    const headerFile = rom ? getScriptHeaderOffset(rom) : 0x128000; // no ROM: the US layout, as everywhere
    if (scriptId === 477 && headerFile === 0x128000) return 0x92A42F; // a bare END (US)
    if (!rom || typeof scriptId !== 'number') return 0;
    const headerOffset = copierHeader(rom);
    const startRom = headerFile + headerOffset;
    if (startRom + 2 > rom.length) return 0;
    const tableOffset = rom[startRom] | (rom[startRom + 1] << 8);
    const mapscriptTableRom = startRom + tableOffset;
    const ptr = mapscriptTableRom + scriptId;
    if (ptr + 2 >= rom.length) return 0;
    const packed = rom[ptr] | (rom[ptr + 1] << 8) | (rom[ptr + 2] << 16);
    if (!packed || packed === 0xFFFFFF) return 0;
    return (((headerFile | 0x800000) >>> 0) + (packed & 0x007fff) + ((packed & 0xff8000) << 1)) >>> 0;
}

export type { RoomTrigger };
export { parseRoomTriggers, calculateTriggerBox, resolveScriptIdToSnes };
