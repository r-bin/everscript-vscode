'use strict';

const fs = require('fs');
const path = require('path');
const { OPCODE_REGISTRY, decodeFallbackOpcode } = require('./opcode-registry');

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

const BIT_NAMES = {
    '22EB:02': 'start pressed in intro',
    '22EB:04': 'running showcase',
    '22EB:08': 'debug',
    '22EB:20': 'in animation',
};

const DOGGO_NAMES = {
    0x02: 'Wolf (0x02)',
    0x04: 'Also Wolf (0x04)',
    0x06: 'Greyhound (0x06)',
    0x08: 'Poodle (0x08)',
    0x0a: 'Regular (0x0A)',
    0x0c: 'Toaster (0x0C)',
    0x0e: 'Softlock (0x0E)',
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

function readS16(romBuf, romOffset) {
    const value = readU16(romBuf, romOffset);
    return value & 0x8000 ? value - 0x10000 : value;
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

function roomLabelForBit(addr, mask) {
    const name = BIT_NAMES[`${hex(addr, 4)}:${hex(mask, 2)}`];
    return name ? `${name} ($${hex(addr, 4)})` : `${roomLabelForAddress(addr)} & 0x${hex(mask, 2)}`;
}

function isTypedFinalValue(type) {
    const cmd = type & 0x70;
    return Boolean(type & 0x80) && (cmd === 0x30 || cmd === 0x40 || cmd === 0x60);
}

function typedFinalValue(type) {
    const cmd = type & 0x70;
    if (cmd === 0x30) return type & 0x0f;
    if (cmd === 0x40) return 0xfff0 | (type & 0x0f);
    if (cmd === 0x60) return 0x10 + (type & 0x0f);
    return null;
}

function formatWriteValue(addr, value, width) {
    if ((addr >>> 0) === 0x2443 && DOGGO_NAMES[value >>> 0]) return DOGGO_NAMES[value >>> 0];
    return `0x${hex(value, width)}`;
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
            size = 3;
            const delta = readS16(romBuf, addressRom + 1);
            const target = addressSnes + size + delta;
            summary = `SKIP ${delta} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0x08: {
            const type = readU8(romBuf, addressRom + 1);
            if (type === 0x85) {
                size = 6;
                const bitRef = readU16(romBuf, addressRom + 2);
                const addr = 0x2258 + (bitRef >> 3);
                const mask = 1 << (bitRef & 0x07);
                const delta = readS16(romBuf, addressRom + 4);
                const target = addressSnes + size + delta;
                summary = `IF ${roomLabelForBit(addr, mask)} SKIP ${delta} (to 0x${hex(target, 6)})`;
            } else if (type === 0x88) {
                size = 6;
                const addr = 0x2258 + readU16(romBuf, addressRom + 2);
                const delta = readS16(romBuf, addressRom + 4);
                const target = addressSnes + size + delta;
                summary = `IF ${roomLabelForAddress(addr)} != 0x00 SKIP ${delta} (to 0x${hex(target, 6)})`;
            } else {
                size = 6;
                const addr = readU16(romBuf, addressRom + 1);
                const mask = readU8(romBuf, addressRom + 3);
                const delta = readU16(romBuf, addressRom + 4);
                const target = addressSnes + size + delta;
                summary = `IF ${roomLabelForAddress(addr)} & 0x${hex(mask, 2)} SKIP ${delta} (to 0x${hex(target, 6)})`;
            }
            break;
        }
        case 0x09: {
            const type = readU8(romBuf, addressRom + 1);
            if (type === 0x85) {
                size = 6;
                const bitRef = readU16(romBuf, addressRom + 2);
                const addr = 0x2258 + (bitRef >> 3);
                const mask = 1 << (bitRef & 0x07);
                const delta = readS16(romBuf, addressRom + 4);
                const target = addressSnes + size + delta;
                summary = `IF !(${roomLabelForBit(addr, mask)}) SKIP ${delta} (to 0x${hex(target, 6)})`;
            } else if (type === 0x88) {
                size = 6;
                const addr = 0x2258 + readU16(romBuf, addressRom + 2);
                const delta = readS16(romBuf, addressRom + 4);
                const target = addressSnes + size + delta;
                summary = `IF ${roomLabelForAddress(addr)} == 0x00 SKIP ${delta} (to 0x${hex(target, 6)})`;
            } else {
                size = 6;
                const addr = readU16(romBuf, addressRom + 1);
                const value = readU8(romBuf, addressRom + 3);
                const delta = readU16(romBuf, addressRom + 4);
                const target = addressSnes + size + delta;
                summary = `IF ${roomLabelForAddress(addr)} == 0x${hex(value, 2)} SKIP ${delta} (to 0x${hex(target, 6)})`;
            }
            break;
        }
        case 0x0c: {
            size = 4;
            const bitRef = readU16(romBuf, addressRom + 1);
            const addr = 0x2258 + (bitRef >> 3);
            const type = readU8(romBuf, addressRom + 3);
            if (type === 0xb0) {
                const mask = 0xff & ~(1 << (bitRef & 0x07));
                summary = `${roomLabelForAddress(addr)} &= 0x${hex(mask, 2)}`;
            } else if (isTypedFinalValue(type)) {
                const mask = 1 << (bitRef & 0x07);
                summary = `${roomLabelForAddress(addr)} |= 0x${hex(mask, 2)}`;
            } else {
                summary = `${roomLabelForAddress(addr)} bit 0x${hex(1 << (bitRef & 0x07), 2)} = 0x${hex(type, 2)}`;
            }
            break;
        }
        case 0x0f: {
            size = 2;
            const packed = readU8(romBuf, addressRom + 1);
            const argIndex = packed >> 3;
            const bitMask = 1 << (packed & 0x07);
            summary = `ARG ${argIndex} & 0x${hex(bitMask, 2)}`;
            break;
        }
        case 0x18: {
            const addr = 0x2258 + readU16(romBuf, addressRom + 1);
            const type = readU8(romBuf, addressRom + 3);
            let value = null;
            let width = 2;
            if (isTypedFinalValue(type)) {
                size = 4;
                value = typedFinalValue(type);
                width = value > 0xff ? 4 : 2;
            } else if (type === 0x82) {
                size = 5;
                value = readU8(romBuf, addressRom + 4);
                width = 2;
            } else if (type === 0x84) {
                size = 6;
                value = readU16(romBuf, addressRom + 4);
                width = 4;
            } else {
                size = 4;
                value = type;
            }
            summary = `WRITE ${roomLabelForAddress(addr)} = ${formatWriteValue(addr, value, width)}`;
            break;
        }
        case 0x1b: {
            size = 7;
            const addr1 = 0x2258 + readU16(romBuf, addressRom + 1);
            const addr2 = 0x2258 + readU16(romBuf, addressRom + 3);
            const value1 = readU8(romBuf, addressRom + 5) << 3;
            const value2 = readU8(romBuf, addressRom + 6) << 3;
            summary = `WRITE ${roomLabelForAddress(addr1)} / ${roomLabelForAddress(addr2)} = 0x${hex(value1, 4)} / 0x${hex(value2, 4)}`;
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
            const mapId = readU16(romBuf, addressRom + 3);
            summary = `CHANGE MAP = 0x${hex(mapId, mapId > 0xff ? 4 : 2)} @ [ 0x${hex(x * 8, 4)} | 0x${hex(y * 8, 4)} ]`;
            break;
        }
        case 0x26:
            size = 1;
            summary = 'WRITE TO VRAM';
            break;
        case 0x27:
            size = 1;
            summary = 'FADE OUT SCREEN';
            break;
        case 0x29: {
            size = 4;
            const target = readU24(romBuf, addressRom + 1);
            summary = `CALL 0x${hex(target, 6)}`;
            break;
        }
        case 0x2c:
        case 0x2d: {
            size = 2;
            const type = readU8(romBuf, addressRom + 1);
            summary = opcode === 0x2c ? `SCRIPT CALLER CHECK 0x${hex(type, 2)}` : `SCRIPT CALLER CHECK (inverse) 0x${hex(type, 2)}`;
            break;
        }
        case 0x30:
        case 0x31:
        case 0x32: {
            size = 2;
            const effect = readU8(romBuf, addressRom + 1);
            summary = `PLAY SOUND EFFECT 0x${hex(effect, 2)}`;
            break;
        }
        case 0x33: {
            size = 2;
            const music = readU8(romBuf, addressRom + 1);
            summary = `PLAY MUSIC 0x${hex(music, 2)}`;
            break;
        }
        case 0x38:
        case 0x3a:
            size = 1;
            summary = 'YIELD';
            break;
        case 0x44:
        case 0x45:
        case 0x46:
        case 0x47: {
            size = 6;
            const slot = readU8(romBuf, addressRom + 1);
            const x = readU8(romBuf, addressRom + 2);
            const y = readU8(romBuf, addressRom + 3);
            const w = readU8(romBuf, addressRom + 4);
            const h = readU8(romBuf, addressRom + 5);
            summary = `OPEN MESSAGEBOX slot=0x${hex(slot, 2)} x=0x${hex(x, 2)} y=0x${hex(y, 2)} w=0x${hex(w, 2)} h=0x${hex(h, 2)}`;
            break;
        }
        case 0x48:
        case 0x49:
        case 0x4a:
        case 0x4b:
            size = 1;
            summary = 'OPEN DEFAULT MESSAGEBOX';
            break;
        case 0x4d:
            size = 1;
            summary = 'NOP';
            break;
        case 0x50: {
            size = 4;
            const slot = readU8(romBuf, addressRom + 1);
            const textId = readU16(romBuf, addressRom + 2);
            summary = `SHOW TEXT 0x${hex(textId, 4)} UNWINDOWED IN #${slot}`;
            break;
        }
        case 0x51:
        case 0x52: {
            size = 3;
            const textId = readU16(romBuf, addressRom + 1);
            summary = `SHOW TEXT 0x${hex(textId, 4)} ${opcode === 0x51 ? 'WINDOWED' : 'UNWINDOWED'}`;
            break;
        }
        case 0x54: {
            size = 2;
            const slot = readU8(romBuf, addressRom + 1);
            summary = `CLEAR TEXT IN #${slot}`;
            break;
        }
        case 0x55:
            size = 1;
            summary = 'CLEAR TEXT';
            break;
        case 0x58:
            size = 1;
            summary = 'FADE IN VOLUME';
            break;
        case 0x59:
            size = 1;
            summary = 'FADE OUT VOLUME';
            break;
        case 0x5a:
        case 0x5b:
            size = 1;
            summary = 'CHECK MESSAGE TIMER';
            break;
        case 0x62: {
            size = 6;
            const value = readU8(romBuf, addressRom + 1);
            const word1 = readU16(romBuf, addressRom + 2);
            const word2 = readU16(romBuf, addressRom + 4);
            summary = `COPY UNKNOWN DATA 0x${hex(value, 2)} 0x${hex(word1, 4)} 0x${hex(word2, 4)}`;
            break;
        }
        case 0x63:
            size = 1;
            summary = 'SHOW ALCHEMY SELECTION SCREEN';
            break;
        case 0x7f: {
            size = 3;
            const textId = readU16(romBuf, addressRom + 1);
            summary = `SHOW TEXT/NAME INPUT 0x${hex(textId, 4)}`;
            break;
        }
        case 0x80:
            size = 1;
            summary = 'UNHIDE UNWINDOWED TEXT';
            break;
        case 0x81:
            size = 1;
            summary = 'HIDE UNWINDOWED TEXT';
            break;
        case 0x82:
            size = 1;
            summary = 'CHANGE VISIBLE LAYERS?';
            break;
        case 0x83:
            size = 1;
            summary = 'APPLY VISIBLE LAYER STATE';
            break;
        case 0x86: {
            size = 2;
            const volume = readU8(romBuf, addressRom + 1);
            summary = `SET AUDIO volume to 0x${hex(volume, 2)}`;
            break;
        }
        case 0x88:
            size = 1;
            summary = 'CLEAR SHOPPING RING';
            break;
        case 0x8c: {
            size = 3;
            const roomNameId = readU16(romBuf, addressRom + 1);
            summary = `SHOW SAVE MENU 0x${hex(roomNameId, 4)}`;
            break;
        }
        case 0x8d: {
            size = 2;
            const mode = readU8(romBuf, addressRom + 1);
            summary = `${mode === 0 ? 'STOP' : 'START'} SCREEN SHAKING (0x${hex(mode, 2)})`;
            break;
        }
        case 0x9f:
            size = 1;
            summary = 'PREPARE CURRENCY DISPLAY';
            break;
        case 0xa0:
            size = 1;
            summary = 'SHOW CURRENCY AMOUNT';
            break;
        case 0xa1:
            size = 1;
            summary = 'HIDE CURRENCY DISPLAY';
            break;
        case 0xa3: {
            size = 2;
            const callId = readU8(romBuf, addressRom + 1);
            const known = SYSTEM_CALL_NAMES[callId];
            summary = known ? `CALL "${known}" (0x${hex(callId, 2)})` : `CALL 0x${hex(callId, 2)}`;
            break;
        }
        case 0xa4: {
            size = 3;
            const scriptId = readU16(romBuf, addressRom + 1);
            summary = `CALL SHORT SCRIPT 0x${hex(scriptId, 4)}`;
            break;
        }
        case 0xa5: {
            size = 2;
            const delta = readU8(romBuf, addressRom + 1) - 0x100;
            const target = addressSnes + size + delta;
            summary = `RCALL ${delta} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0xa6: {
            size = 3;
            const delta = readS16(romBuf, addressRom + 1);
            const target = addressSnes + size + delta;
            summary = `RCALL ${delta} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0xa7: {
            size = 2;
            const ticks = readU8(romBuf, addressRom + 1);
            summary = `SLEEP ${ticks} TICKS`;
            break;
        }
        case 0xa8: {
            size = 3;
            const ticks = readU16(romBuf, addressRom + 1);
            summary = `SLEEP ${ticks - 1} TICKS`;
            break;
        }
        case 0xaa:
            size = 1;
            summary = 'CLEAR BOY AND DOG STATUSES';
            break;
        case 0xab:
            size = 1;
            summary = 'RESET GAME';
            stop = true;
            break;
        case 0xae: {
            size = 5;
            const value1 = readU8(romBuf, addressRom + 1);
            const value2 = readU8(romBuf, addressRom + 2);
            const value3 = readU8(romBuf, addressRom + 3);
            const value4 = readU8(romBuf, addressRom + 4);
            summary = `MODIFY CURRENT SCRIPT 0x${hex(value1, 2)} 0x${hex(value2, 2)} 0x${hex(value3, 2)} 0x${hex(value4, 2)}`;
            break;
        }
        default: {
            const fallback = decodeFallbackOpcode(
                romBuf,
                addressSnes,
                addressRom,
                opcode,
                readU8,
                readU16,
                readU24,
                readS16,
                hex,
            );
            if (fallback) {
                size = fallback.size;
                summary = fallback.summary;
                stop = false;
                break;
            }
            stop = true;
            summary = `UNKNOWN OPCODE 0x${hex(opcode, 2)}`;
            break;
        }
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

function loadRomFromWorkspace(wsRoot, romPathOverride) {
    const candidates = [];
    if (romPathOverride) candidates.push(romPathOverride);
    if (wsRoot) {
        for (const name of ROM_NAMES) candidates.push(path.join(wsRoot, name));
    }
    for (const filePath of candidates) {
        if (filePath && fs.existsSync(filePath)) return fs.readFileSync(filePath);
    }
    return null;
}

function readRoomScriptModel(wsRoot, mapId, romPathOverride) {
    const romBuf = loadRomFromWorkspace(wsRoot, romPathOverride);
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
    OPCODE_REGISTRY,
    decodeRoomScript,
    buildRoomScriptModelFromRom,
    readRoomScriptModel,
};