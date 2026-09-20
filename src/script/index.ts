// Ownership: public API for the Everscript script decoder.
//
// A TypeScript port of SoEScriptDumper (list-rooms.cpp), the reference
// disassembler in the sibling SoETilesViewer checkout. Pure: it takes a ROM
// buffer and returns data.
//
// Validate changes with `npm run check:script`, which decodes every script in
// the ROM and diffs both instruction boundaries and summary text against the
// dumper's own output.

export {
    SCRIPTS_START_ADDR_US, snesToRom, addrValid, read8, read16, read24,
    scriptValueToSnes, snesToScriptValue, ramAddr, u8, u16, u24,
} from './addressing';

export { parseExpression, OperandStack } from './expression';
export type { Expression } from './expression';

export {
    ramAddrToStr, ramBitToStr, ramValueToStr,
    absScriptName, npcScriptName, globalScriptName, mapName, currencyName,
} from './names';

export { decodeInstruction, decodeScript, unresolvedNote, opcodeHex } from './decoder';
export type { DecodedInstruction, DecodedScript, StopReason } from './decoder';

export { buildRoomScriptModel } from './room-scripts';
export type { RoomScriptModel, RoomScriptMeta, RoomScript, RoomTrigger, ScriptRow } from './room-scripts';
