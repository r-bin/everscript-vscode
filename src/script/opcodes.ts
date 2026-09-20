// Ownership: per-opcode operand layout — how many bytes and how many operand
// expressions each instruction carries, and therefore how long it is. Pure.
//
// Sizing is the whole game. Get one instruction's length wrong and every byte
// after it decodes as garbage; the decoder this replaces lost instruction
// alignment on 53% of the ROM's scripts for exactly that reason.
//
// A layout is `[prefixBytes, expressionCount, suffixBytes]`, so
//
//     size = 1 + prefixBytes + sum(operand expression lengths) + suffixBytes
//
// with the expressions parsed by ./expression at the offset after the prefix.
//
// **How this table was built.** SoEScriptDumper's dump of the ROM prints every
// instruction with its address, so consecutive addresses give each
// instruction's true length. Every candidate layout was tested against every
// real instance of its opcode — thousands each for the common ones — and only
// layouts that reproduce *every* observed length are kept. Opcodes that end a
// run or print extra lines have no measurable successor; those few were read
// out of list-rooms.cpp and are marked. `npm run check:script` re-runs the
// comparison against the dump.

/** `[prefixBytes, expressionCount, suffixBytes]`. */
export type OperandLayout = readonly [number, number, number];

/** Layouts verified against every instance in the ROM. */
export const OPCODE_LAYOUTS: Record<number, OperandLayout> = {
    0x04: [0, 0, 2],
    0x05: [0, 0, 1],
    0x07: [0, 0, 3],
    0x08: [0, 1, 2],
    0x09: [0, 1, 2],
    0x0a: [0, 1, 5],
    0x0b: [0, 1, 5],
    0x0c: [2, 1, 0],
    0x0d: [2, 1, 0],
    0x0e: [1, 1, 0],
    0x11: [2, 1, 0],
    0x14: [2, 1, 0],
    0x15: [2, 1, 0],
    0x17: [0, 0, 4],
    0x18: [2, 1, 0],
    0x19: [1, 1, 0],
    0x1a: [1, 1, 0],
    0x1b: [0, 0, 6],
    0x1d: [2, 1, 0],
    0x1e: [1, 1, 0],
    0x20: [0, 0, 2],
    0x22: [0, 0, 4],
    0x26: [0, 0, 0],
    0x27: [0, 0, 0],
    0x29: [0, 0, 3],
    0x2b: [0, 1, 0],
    0x2c: [0, 0, 1],
    0x2d: [0, 0, 1],
    0x2e: [0, 1, 0],
    0x30: [0, 0, 1],
    0x31: [0, 0, 1],
    0x32: [0, 0, 1],
    0x33: [0, 0, 1],
    0x38: [0, 0, 0],
    0x3a: [0, 0, 0],
    0x3b: [0, 1, 0],
    0x3c: [0, 0, 6],
    0x3d: [0, 1, 2],
    0x43: [0, 3, 0],
    0x44: [0, 0, 5],
    0x45: [0, 0, 5],
    0x46: [0, 0, 5],
    0x47: [0, 0, 5],
    0x48: [0, 0, 0],
    0x49: [0, 0, 0],
    0x4a: [0, 0, 0],
    0x4b: [0, 0, 0],
    0x4d: [0, 0, 0],
    0x4e: [0, 1, 0],
    0x54: [0, 0, 1],
    0x55: [0, 0, 0],
    0x58: [0, 0, 0],
    0x59: [0, 0, 0],
    0x5a: [0, 0, 0],
    0x5b: [0, 0, 0],
    0x5c: [0, 2, 0],
    0x5d: [0, 1, 2],
    0x62: [0, 0, 5],
    0x63: [0, 0, 0],
    0x6d: [0, 3, 0],
    0x6e: [0, 1, 2],
    0x70: [0, 2, 0],
    0x71: [0, 1, 1],
    0x73: [0, 3, 0],
    0x74: [0, 1, 0],
    0x75: [0, 1, 0],
    0x76: [0, 1, 0],
    0x77: [0, 1, 0],
    0x7a: [0, 2, 0],
    0x7c: [0, 1, 3],
    0x7d: [0, 1, 3],
    0x7e: [0, 4, 0],
    0x7f: [0, 0, 2],
    0x80: [0, 0, 0],
    0x81: [0, 0, 0],
    0x82: [0, 0, 0],
    0x83: [0, 0, 0],
    0x85: [0, 2, 0],
    0x86: [0, 1, 0],
    0x87: [0, 1, 0],
    0x88: [0, 0, 0],
    0x89: [0, 2, 0],
    0x8a: [0, 1, 0],
    0x8c: [0, 0, 2],
    0x8d: [0, 0, 1],
    0x8e: [0, 2, 2],
    0x8f: [0, 2, 2],
    0x91: [0, 1, 0],
    0x93: [0, 2, 0],
    0x94: [0, 2, 0],
    0x96: [0, 2, 0],
    0x98: [0, 1, 0],
    0x99: [2, 4, 0],
    0x9a: [0, 1, 0],
    0x9b: [0, 1, 0],
    0x9c: [0, 1, 0],
    0x9d: [0, 3, 0],
    0x9e: [3, 0, 6],
    0x9f: [0, 0, 0],
    0xa0: [0, 0, 0],
    0xa1: [0, 0, 0],
    0xa2: [4, 2, 0],
    0xa3: [0, 0, 1],
    0xa4: [0, 0, 2],
    0xa5: [0, 0, 1],
    0xa6: [0, 0, 2],
    0xa7: [0, 0, 1],
    0xa8: [0, 0, 2],
    0xa9: [0, 2, 0],
    0xaa: [0, 0, 0],
    0xad: [0, 0, 6],
    0xae: [0, 0, 4],
    0xb6: [0, 4, 0],
    0xb7: [0, 1, 0],
    0xb9: [0, 3, 0],
    0xba: [0, 0, 3],
    0xbb: [0, 1, 2],
    0xbc: [0, 0, 0],
    0xbd: [0, 0, 0],
    0xbe: [0, 0, 0],
    0xbf: [0, 0, 0],
    0xc0: [0, 0, 0],
    0xc1: [0, 0, 0],
    0xc2: [0, 0, 3],
    // Read from list-rooms.cpp rather than measured — see above.
    0x00: [0, 0, 0], // END (return); terminal, so it has no successor to measure
    0x50: [3, 0, 0], // SHOW TEXT, vram slot byte + 16-bit text id
    0x51: [2, 0, 0], // SHOW TEXT windowed, 16-bit text id
    0x52: [2, 0, 0], // SHOW TEXT unwindowed, 16-bit text id
};

/** Instructions that end a script. Decoding stops after one. */
export const TERMINAL_OPCODES = new Set<number>([0x00]);

/**
 * Opcodes SoEScriptDumper itself cannot decode — it prints them in red as
 * `UNKNOWN INSTR`, its marker for "length unknown, parsing stops here".
 *
 * There are 105 of them, most of the 0xC0..0xFF range. Stopping on these is
 * not a gap in this port: nobody knows how long they are, so continuing
 * would mean inventing a length and emitting fiction. Any size that appears
 * to fit one of these in the dump is an artifact of upstream resynchronising
 * afterwards, which is why they are excluded from the measured table above.
 */
export const UPSTREAM_UNKNOWN = new Set<number>([
    0x01, 0x02, 0x03, 0x06, 0x0f, 0x12, 0x13, 0x16, 0x1f, 0x21, 0x23, 0x24,
    0x25, 0x28, 0x2f, 0x34, 0x35, 0x36, 0x37, 0x3e, 0x40, 0x41, 0x4c, 0x4f,
    0x53, 0x56, 0x57, 0x5e, 0x5f, 0x60, 0x61, 0x64, 0x65, 0x66, 0x67, 0x68,
    0x69, 0x6a, 0x6b, 0x72, 0x7b, 0x8b, 0x90, 0xb8, 0xc3, 0xc4, 0xc5, 0xc6,
    0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf, 0xd0, 0xd1, 0xd2,
    0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
    0xdf, 0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea,
    0xeb, 0xec, 0xed, 0xee, 0xef, 0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
    0xf7, 0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff,
]);

/**
 * Opcodes whose layout is not pinned down yet, with how close the best simple
 * layout got. Each needs its case read out of list-rooms.cpp; until then the
 * decoder stops on them rather than guessing.
 */
export const UNRESOLVED: Record<number, string> = {
    0x6f: 'n=3000; closest layout [0,3,0] explains 99.3%',
    0x78: 'n=3000; closest layout [0,1,3] explains 99.6%',
    0x1c: 'n=895; closest layout [2,1,0] explains 99.9%',
    0x42: 'n=856; closest layout [0,1,2] explains 99.9%',
    0x6c: 'n=788; closest layout [0,1,2] explains 97.2%',
    0x2a: 'n=755; closest layout [0,1,0] explains 99.3%',
    0x3f: 'n=685; closest layout [0,1,4] explains 96.6%',
    0xaf: 'n=442; closest layout [0,3,3] explains 41.2%',
    0xb5: 'n=426; closest layout [4,4,1] explains 41.8%',
    0x95: 'n=406; closest layout [0,2,0] explains 94.6%',
    0x79: 'n=403; closest layout [0,1,3] explains 99.8%',
    0xb4: 'n=377; closest layout [4,2,3] explains 68.2%',
    0xb3: 'n=362; closest layout [1,3,2] explains 55.0%',
    0xac: 'n=181; closest layout [0,3,3] explains 84.0%',
    0xb2: 'n=170; closest layout [0,0,5] explains 57.1%',
    0x92: 'n=158; closest layout [0,2,0] explains 98.7%',
    0x10: 'n=80; closest layout [2,1,0] explains 98.8%',
    0x97: 'n=67; closest layout [3,4,0] explains 77.6%',
    0x39: 'n=60; closest layout [0,1,0] explains 60.0%',
    0xb0: 'n=54; closest layout [1,1,1] explains 77.8%',
    0x84: 'n=33; closest layout [0,2,0] explains 97.0%',
    0xb1: 'n=16; closest layout [0,0,3] explains 56.2%',
};


/**
 * A step in an instruction's operand program.
 *
 * `bytes` is a fixed field, `expr` is one operand expression, and
 * `writeValue` is the tail the WRITE family uses: a type byte that either
 * carries its value inline, announces a 1- or 2-byte literal, or turns out to
 * be the first byte of an expression and is re-read as one. That last branch
 * is why a fixed layout cannot describe these.
 */
export type OperandStep =
    | { readonly kind: 'bytes'; readonly n: number }
    | { readonly kind: 'expr' }
    | { readonly kind: 'writeValue' };

const B = (n: number): OperandStep => ({ kind: 'bytes', n });
const E: OperandStep = { kind: 'expr' };
const WRITE_VALUE: OperandStep = { kind: 'writeValue' };

/**
 * Opcodes whose operands are not a flat prefix/expressions/suffix, read out
 * of list-rooms.cpp's main switch. These take precedence over the measured
 * table, which can only describe the flat shape.
 */
export const OPCODE_STEPS: Record<number, readonly OperandStep[]> = {
    // WRITE family: 16-bit destination, then the conditional value tail.
    0x10: [B(2), WRITE_VALUE],
    0x11: [B(2), WRITE_VALUE],
    0x14: [B(2), WRITE_VALUE],
    0x15: [B(2), WRITE_VALUE],
    0x18: [B(2), WRITE_VALUE],
    0x19: [B(2), WRITE_VALUE],
    0x1c: [B(2), WRITE_VALUE],
    0x1d: [B(2), WRITE_VALUE],
    // Sprite/animation change: entity, a 16-bit field, then a value.
    0x78: [E, B(2), E],
    0x79: [E, B(2), E],
    // Walk to/by: entity, then X and Y.
    0x6f: [E, E, E],
    0x73: [E, E, E],
    0x9d: [E, E, E],
};

/** True when the type byte of a WRITE carries its value inline. */
export function writeValueIsInline(type: number): boolean {
    const cmd = type & 0x70;
    return (type & 0x80) !== 0 && (cmd === 0x30 || cmd === 0x40 || cmd === 0x60);
}

/** Size of an instruction whose operands are all fixed-width, or null. */
export function fixedSize(opcode: number): number | null {
    const l = OPCODE_LAYOUTS[opcode];
    if (!l || l[1] !== 0) return null;
    return 1 + l[0] + l[2];
}
