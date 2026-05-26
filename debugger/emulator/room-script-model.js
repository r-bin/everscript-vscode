'use strict';

const fs = require('fs');
const path = require('path');

const MAP_LIST_ADDR_US = 0x9ffde7;
const SCRIPTS_START_ADDR_US = 0x928000;
const ENTER_SCRIPT_TABLE_OFFSET = 0x1b;
const ROOM_TRIGGER_TABLE_OFFSET = 0x0d;
const ROOM_TRIGGER_ENTRY_SIZE = 6;
const MAX_TRIGGER_ENTRIES = 100;
const MAX_SCRIPT_BYTES = 0x400;
const MAX_SCRIPT_INSTRUCTIONS = 256;

const ROM_NAMES = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];

const SYSTEM_CALL_NAMES = {
    0x00: 'Fade-out / stop music',
    0x01: 'Fade-in / start music',
    0x1d: 'Prepare room change? East exit/west entrance outdoor-outdoor?',
    0x27: 'Prepare room change? North exit/south entrance indoor-outdoor?',
};

const ADDRESS_NAMES = {
    0x22eb: 'in animation',
    0x238d: 'CHANGE MUSIC',
    0x23bf: 'room state',
    0x23e9: 'MAP X/Y start',
    0x23ed: 'MAP X/Y end',
    0x2443: 'CHANGE DOGGO',
};

function hex(value, width) {
    return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

function snesToRomOffset(addr) {
    return addr & ~(0xc00000);
}

function romOffsetToMapDataRom(dataSnes) {
    return ((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff);
}

function scriptValueToSnes(scriptValue) {
    return SCRIPTS_START_ADDR_US + (scriptValue & 0x007fff) + ((scriptValue & 0xff8000) << 1);
}

function snesToScriptValue(snesAddr) {
    let romAddr = snesAddr & ~(0x8000);
    romAddr -= (SCRIPTS_START_ADDR_US & ~(0x8000));
    return (romAddr & 0x007fff) + ((romAddr & 0x1ff0000) >> 1);
}

function readU8(romBuf, romOffset) {
    if (romOffset < 0 || romOffset >= romBuf.length) throw new RangeError(`ROM read out of range @ 0x${hex(romOffset, 6)}`);
    return romBuf[romOffset];
}

function readU16(romBuf, romOffset) {
    return readU8(romBuf, romOffset) | (readU8(romBuf, romOffset + 1) << 8);
}

function readU24(romBuf, romOffset) {
    return readU8(romBuf, romOffset) | (readU8(romBuf, romOffset + 1) << 8) | (readU8(romBuf, romOffset + 2) << 16);
}

function readU16Snes(romBuf, snesAddr) {
    return readU16(romBuf, snesToRomOffset(snesAddr));
}

function readU24Snes(romBuf, snesAddr) {
    return readU24(romBuf, snesToRomOffset(snesAddr));
}

function roomLabelForAddress(addr) {
    const name = ADDRESS_NAMES[addr >>> 0];
    return name ? `${name} ($${hex(addr, 4)})` : `$${hex(addr, 4)}`;
}

function bytesHex(bytes) {
    return bytes.map((byte) => hex(byte, 2)).join(' ');
}

function decodeInstructionAt(romBuf, scriptSnes, offset) {
    const addressSnes = scriptSnes + offset;
    const addressRom = snesToRomOffset(addressSnes);
    const opcode = readU8(romBuf, addressRom);
    let size = 1;
    let summary = `OP 0x${hex(opcode, 2)}`;
    let stop = false;

    switch (opcode) {
        case 0x00:
            size = 1;
            summary = 'END';
            stop = true;
            break;
        case 0x04: {
            size = 2;
            const delta = readU8(romBuf, addressRom + 1);
            const target = addressSnes + size + delta;
            summary = `SKIP ${delta} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0x08: {
            size = 6;
            const addr = readU16(romBuf, addressRom + 1);
            const mask = readU8(romBuf, addressRom + 3);
            const delta = readU16(romBuf, addressRom + 4);
            const target = addressSnes + size + delta;
            summary = `IF ${roomLabelForAddress(addr)} & 0x${hex(mask, 2)} SKIP ${delta} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0x09: {
            size = 6;
            const addr = readU16(romBuf, addressRom + 1);
            const value = readU8(romBuf, addressRom + 3);
            const delta = readU16(romBuf, addressRom + 4);
            const target = addressSnes + size + delta;
            summary = `IF ${roomLabelForAddress(addr)} == 0x${hex(value, 2)} SKIP ${delta} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0x0c: {
            size = 4;
            const addr = readU16(romBuf, addressRom + 1);
            const value = readU8(romBuf, addressRom + 3);
            summary = `${roomLabelForAddress(addr)} &= 0x${hex(value, 2)}`;
            break;
        }
        case 0x18: {
            size = 4;
            const addr = readU16(romBuf, addressRom + 1);
            const value = readU8(romBuf, addressRom + 3);
            summary = `WRITE ${roomLabelForAddress(addr)} = 0x${hex(value, 2)}`;
            break;
        }
        case 0x1b: {
            size = 7;
            const addr = readU16(romBuf, addressRom + 1);
            const value1 = readU16(romBuf, addressRom + 3);
            const value2 = readU16(romBuf, addressRom + 5);
            summary = `WRITE ${roomLabelForAddress(addr)} / $${hex((addr + 2) & 0xffff, 4)} = 0x${hex(value1, 4)} / 0x${hex(value2, 4)}`;
            break;
        }
        case 0x20: {
            size = 3;
            const x = readU8(romBuf, addressRom + 1);
            const y = readU8(romBuf, addressRom + 2);
            summary = `TELEPORT both to ${hex(x, 2)} ${hex(y, 2)}`;
            break;
        }
        case 0x22: {
            size = 5;
            const x = readU8(romBuf, addressRom + 1);
            const y = readU8(romBuf, addressRom + 2);
            const mapId = readU8(romBuf, addressRom + 3);
            const mode = readU8(romBuf, addressRom + 4);
            const suffix = mode ? ` mode=0x${hex(mode, 2)}` : '';
            summary = `CHANGE MAP = 0x${hex(mapId, 2)} @ [ 0x${hex(x * 8, 4)} | 0x${hex(y * 8, 4)} ]${suffix}`;
            break;
        }
        case 0x29: {
            size = 4;
            const target = readU24(romBuf, addressRom + 1);
            summary = `CALL 0x${hex(target, 6)}`;
            break;
        }
        case 0x33: {
            size = 2;
            const music = readU8(romBuf, addressRom + 1);
            summary = `PLAY MUSIC 0x${hex(music, 2)}`;
            break;
        }
        case 0x86: {
            size = 2;
            const volume = readU8(romBuf, addressRom + 1);
            summary = `SET AUDIO volume to 0x${hex(volume, 2)}`;
            break;
        }
        case 0xa3: {
            size = 2;
            const callId = readU8(romBuf, addressRom + 1);
            const known = SYSTEM_CALL_NAMES[callId];
            summary = known ? `CALL "${known}" (0x${hex(callId, 2)})` : `CALL 0x${hex(callId, 2)}`;
            break;
        }
        case 0xa7: {
            size = 2;
            const ticks = readU8(romBuf, addressRom + 1);
            summary = `SLEEP ${ticks} TICKS`;
            break;
        }
        default:
            stop = true;
            summary = `UNKNOWN OPCODE 0x${hex(opcode, 2)}`;
            break;
    }

    const bytes = [];
    for (let i = 0; i < size; i++) bytes.push(readU8(romBuf, addressRom + i));

    return {
        addressSnes,
        addressRom,
        opcode,
        opcodeHex: `0x${hex(opcode, 2)}`,
        size,
        bytes,
        bytesHex: bytesHex(bytes),
        summary,
        terminal: opcode === 0x00,
        unsupported: opcode !== 0x00 && stop,
    };
}

function decodeRoomScript(romBuf, scriptSnes) {
    const instructions = [];
    let offset = 0;
    let stopReason = '';
    while (offset < MAX_SCRIPT_BYTES && instructions.length < MAX_SCRIPT_INSTRUCTIONS) {
        const row = decodeInstructionAt(romBuf, scriptSnes, offset);
        instructions.push(row);
        offset += row.size;
        if (row.terminal) { stopReason = 'terminated'; break; }
        if (row.unsupported) { stopReason = 'unsupported-opcode'; break; }
    }
    if (!stopReason) stopReason = offset >= MAX_SCRIPT_BYTES ? 'max-bytes' : 'max-instructions';
    return {
        scriptAddressSnes: scriptSnes,
        scriptAddressRom: snesToRomOffset(scriptSnes),
        instructions,
        terminated: instructions.length ? instructions[instructions.length - 1].terminal : false,
        stopReason,
        bytesConsumed: offset,
    };
}

function firstInstructionLabel(script) {
    if (!script || !script.instructions) return '';
    const first = script.instructions.find((row) => row.opcode !== 0x00);
    return first ? first.summary : '';
}

function parseTriggerTable(romBuf, tableRom, tableLength, mapscriptTableSnes) {
    const entries = [];
    if (!tableLength || tableLength < ROOM_TRIGGER_ENTRY_SIZE) return entries;
    if ((tableLength % ROOM_TRIGGER_ENTRY_SIZE) !== 0 || tableLength > MAX_TRIGGER_ENTRIES * ROOM_TRIGGER_ENTRY_SIZE) {
        return entries;
    }
    for (let pos = 0; pos < tableLength; pos += ROOM_TRIGGER_ENTRY_SIZE) {
        const y1 = readU8(romBuf, tableRom + pos + 0);
        const x1 = readU8(romBuf, tableRom + pos + 1);
        const y2 = readU8(romBuf, tableRom + pos + 2);
        const x2 = readU8(romBuf, tableRom + pos + 3);
        const scriptId = readU16(romBuf, tableRom + pos + 4);
        const scriptPointerSnes = mapscriptTableSnes + scriptId;
        const rawScriptValue = readU24Snes(romBuf, scriptPointerSnes);
        const scriptAddressSnes = scriptValueToSnes(rawScriptValue);
        const script = decodeRoomScript(romBuf, scriptAddressSnes);
        entries.push({
            x1,
            y1,
            x2,
            y2,
            scriptId,
            scriptPointerSnes,
            rawScriptValue,
            scriptAddressSnes,
            scriptAddressRom: snesToRomOffset(scriptAddressSnes),
            instructions: script.instructions,
            terminated: script.terminated,
            stopReason: script.stopReason,
            bytesConsumed: script.bytesConsumed,
            label: firstInstructionLabel(script),
        });
    }
    return entries;
}

function buildRoomScriptModelFromRom(romBuf, mapId) {
    const tableRom = snesToRomOffset(MAP_LIST_ADDR_US) + mapId * 4;
    const dataSnes = readU24(romBuf, tableRom);
    const dataRom = romOffsetToMapDataRom(dataSnes);
    const stepLength = readU16(romBuf, dataRom + ROOM_TRIGGER_TABLE_OFFSET);
    const stepTableRom = dataRom + ROOM_TRIGGER_TABLE_OFFSET + 2;
    const bLengthRom = stepTableRom + stepLength;
    const bLength = readU16(romBuf, bLengthRom);
    const bTableRom = bLengthRom + 2;
    const mapscriptTableSnes = SCRIPTS_START_ADDR_US + readU16Snes(romBuf, SCRIPTS_START_ADDR_US);
    const enterPointerSnes = SCRIPTS_START_ADDR_US + ENTER_SCRIPT_TABLE_OFFSET + 5 * mapId;
    const enterRawValue = readU24Snes(romBuf, enterPointerSnes);
    const enterScriptSnes = scriptValueToSnes(enterRawValue);
    const enterScript = decodeRoomScript(romBuf, enterScriptSnes);

    return {
        mapId,
        dataPointerSnes: dataSnes,
        dataPointerRom: dataRom,
        mapscriptTableSnes,
        mapscriptTableRom: snesToRomOffset(mapscriptTableSnes),
        meta: {
            stepTableRom,
            stepLength,
            stepCount: Math.floor(stepLength / ROOM_TRIGGER_ENTRY_SIZE),
            bTableRom,
            bLength,
            bCount: Math.floor(bLength / ROOM_TRIGGER_ENTRY_SIZE),
            enterPointerSnes,
            enterRawValue,
        },
        enter: {
            scriptPointerSnes: enterPointerSnes,
            rawScriptValue: enterRawValue,
            scriptAddressSnes: enterScriptSnes,
            scriptAddressRom: snesToRomOffset(enterScriptSnes),
            instructions: enterScript.instructions,
            terminated: enterScript.terminated,
            stopReason: enterScript.stopReason,
            bytesConsumed: enterScript.bytesConsumed,
            label: firstInstructionLabel(enterScript),
        },
        stepOn: parseTriggerTable(romBuf, stepTableRom, stepLength, mapscriptTableSnes),
        bTrigger: parseTriggerTable(romBuf, bTableRom, bLength, mapscriptTableSnes),
    };
}

function loadRomFromWorkspace(wsRoot) {
    for (const name of ROM_NAMES) {
        const filePath = path.join(wsRoot, name);
        if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    }
    return null;
}

function readRoomScriptModel(wsRoot, mapId) {
    const romBuf = loadRomFromWorkspace(wsRoot);
    if (!romBuf) return null;
    try { return buildRoomScriptModelFromRom(romBuf, mapId); }
    catch { return null; }
}

module.exports = {
    MAP_LIST_ADDR_US,
    SCRIPTS_START_ADDR_US,
    ENTER_SCRIPT_TABLE_OFFSET,
    ROOM_TRIGGER_TABLE_OFFSET,
    ROOM_TRIGGER_ENTRY_SIZE,
    MAX_TRIGGER_ENTRIES,
    snesToRomOffset,
    scriptValueToSnes,
    snesToScriptValue,
    decodeRoomScript,
    buildRoomScriptModelFromRom,
    readRoomScriptModel,
};