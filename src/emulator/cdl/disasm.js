'use strict';

/**
 * emulator/cdl/disasm.js
 *
 * Decodes one 65816 instruction at a ROM offset using the CDL's recorded M/X
 * widths and formats it as Asar source that reassembles to the same bytes:
 * every operand carries an explicit .b/.w/.l size, and a label replaces a raw
 * address only when the label's address yields identical bytes.
 */

const { OPCODES, instructionLength } = require('./opcodes');
const { hex } = require('./rom-map');

const CDL_ACC_8 = 0x20, CDL_IDX_8 = 0x10;
const EXT_SEEN_M16 = 0x08, EXT_SEEN_X16 = 0x10;

const DP_MODES = new Set(['dp', 'dpx', 'dpy', 'idp', 'idpx', 'idpy', 'ildp', 'ildpy', 'sr', 'isry']);
const ABS_MODES = new Set(['abs', 'absx', 'absy']);

/**
 * @returns {{ op, mnemonic, mode, len, operand, conflict } | null}
 *   operand is the little-endian value of the operand bytes; conflict is set
 *   when an immediate's width depends on a flag the CDL saw in both states.
 */
function decodeAt(rom, off, cdlByte, extByte) {
    const op = rom[off];
    const { mnemonic, mode } = OPCODES[op];
    const m8 = !!(cdlByte & CDL_ACC_8) || !(extByte & EXT_SEEN_M16);
    const x8 = !!(cdlByte & CDL_IDX_8) || !(extByte & EXT_SEEN_X16);
    const conflict = (mode === 'immM' && (cdlByte & CDL_ACC_8) && (extByte & EXT_SEEN_M16))
        || (mode === 'immX' && (cdlByte & CDL_IDX_8) && (extByte & EXT_SEEN_X16));
    const len = instructionLength(op, m8, x8);
    if (off + len > rom.length) return null;
    let operand = 0;
    for (let i = len - 1; i >= 1; i--) operand = (operand << 8) | rom[off + i];
    return { op, mnemonic, mode, len, operand: operand >>> 0, conflict: !!conflict };
}

/** Bus address a branch / PER lands on, using the instruction's own address. */
function relativeTarget(ins, addr) {
    const disp = ins.mode === 'rel8'
        ? (ins.operand << 24) >> 24
        : (ins.operand << 16) >> 16;
    return (addr & 0xFF0000) | ((addr + ins.len + disp) & 0xFFFF);
}

/**
 * Format one instruction.
 * @param ins     decodeAt() result
 * @param addr    canonical bus address of the instruction
 * @param resolve (busAddress, width) -> label name or null; width 16 means
 *                "same bank, low 16 bits", 24 the exact long address, 'rel'
 *                a branch target (must resolve: Asar reads a bare number in a
 *                branch as the displacement itself)
 * @returns Asar text, or null when the instruction cannot be expressed
 */
function formatInstruction(ins, addr, resolve) {
    const m = ins.mnemonic.toLowerCase();
    const v = ins.operand;
    const h2 = '$' + hex(v, 2), h4 = '$' + hex(v, 4), h6 = '$' + hex(v, 6);
    const near = target => resolve(target, 16);
    switch (ins.mode) {
        case 'imp': return m;
        case 'acc': return m + ' a';
        case 'imm8': return m + ' #' + h2;
        case 'immM':
        case 'immX': return m + (ins.len === 2 ? '.b #' + h2 : '.w #' + h4);
        case 'rel8':
        case 'rel16': {
            const label = resolve(relativeTarget(ins, addr), 'rel');
            return label ? m + ' ' + label : null;
        }
        case 'bm': return m + ' $' + hex(v & 0xFF, 2) + ',$' + hex(v >>> 8, 2);
        case 'pea': return m + ' ' + h4;
        case 'pei': return m + ' (' + h2 + ')';
        case 'iabs': return m + ' (' + h4 + ')';
        case 'iabsx': return m + ' (' + h4 + ',x)';
        case 'ilabs': return m + ' [' + h4 + ']';
        default: break;
    }
    if (DP_MODES.has(ins.mode)) {
        const body = {
            dp: h2, dpx: h2 + ',x', dpy: h2 + ',y', idp: '(' + h2 + ')', idpx: '(' + h2 + ',x)',
            idpy: '(' + h2 + '),y', ildp: '[' + h2 + ']', ildpy: '[' + h2 + '],y', sr: h2 + ',s', isry: '(' + h2 + ',s),y',
        }[ins.mode];
        return m + '.b ' + body;
    }
    if (ABS_MODES.has(ins.mode)) {
        const flow = ins.mnemonic === 'JSR' || ins.mnemonic === 'JMP';
        const label = flow ? near((addr & 0xFF0000) | v) : null;
        const suffix = ins.mode === 'absx' ? ',x' : ins.mode === 'absy' ? ',y' : '';
        return m + '.w ' + (label || h4) + suffix;
    }
    if (ins.mode === 'long' || ins.mode === 'longx') {
        const label = resolve(v, 24);
        const name = ins.mnemonic === 'JSL' || ins.mnemonic === 'JML' ? m : m + '.l';
        return name + ' ' + (label || h6) + (ins.mode === 'longx' ? ',x' : '');
    }
    return m;
}

/** Static operand address for comments (bus address or null). */
function staticTarget(ins, addr) {
    if (ins.mode === 'rel8' || ins.mode === 'rel16') return relativeTarget(ins, addr);
    if (ins.mode === 'long' || ins.mode === 'longx') return ins.operand;
    if (ins.mode === 'abs' && (ins.mnemonic === 'JSR' || ins.mnemonic === 'JMP')) return (addr & 0xFF0000) | ins.operand;
    return null;
}

module.exports = { decodeAt, formatInstruction, relativeTarget, staticTarget };
