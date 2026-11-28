// The 65816 assembler (src/platform/snes/asm65816.ts): every opcode in every width, printed by the export's printer
// (platform/cdl/disasm.ts formatInstruction), assembles back to its bytes; labels across files, branches, data, skip,
// hand-written operands without a size; and the errors. No ROM. Run: node tests/open-evermore/asm65816.test.mts
// (npm run build:ts first).
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const asm = require('../../dist/platform/snes/asm65816');
const { OPCODES, instructionLength } = require('../../dist/platform/snes/opcodes-65816');
const { formatInstruction, relativeTarget } = require('../../dist/platform/cdl/disasm');

console.log('\n65816 assembler:');
const at = 0x8C9000;
let count = 0;
for (let op = 0; op < 256; op++) for (const [m8, x8] of [[false, false], [true, true], [true, false], [false, true]]) {
    const len = instructionLength(op, m8, x8), bytes = [op, 0x34, 0x92, 0x8C].slice(0, len);
    let operand = 0;
    for (let i = len - 1; i >= 1; i--) operand = operand * 256 + bytes[i];
    const ins = { op, mnemonic: OPCODES[op].mnemonic, mode: OPCODES[op].mode, len, operand, conflict: false };
    const target = ins.mode.startsWith('rel') ? relativeTarget(ins, at) : 0;
    const text = formatInstruction(ins, at, (_bus: number, w: unknown) => w === 'rel' ? 'there' : null);
    const errors: unknown[] = [], m = asm.measure('t', text, errors);
    const out = asm.encode(m, at, (s: string) => s === 'there' ? target : undefined, errors);
    assert.deepStrictEqual([errors, [...out]], [[], bytes], `${op.toString(16)} ${text}`);
    count++;
}
console.log(`  ✓ ${count} opcode × width forms, as the export prints them, assemble to their bytes`);

// Two files, labels across them, data, skip, a branch back and a hand-written operand without a size.
const errors: unknown[] = [];
const a = asm.measure('a', 'start:\n    lda $12        ; dp\n    lda $1234,x\n    jsl other\n.l:\nback:\n    bne back\n    dw other, back\n    skip 2\n    db $01, %10, 3\n    rtl\n', errors);
const b = asm.measure('b', 'other:\n    jsr.w other\n    lda.l start+$400000,x\n    rts\n', errors);
assert.deepStrictEqual(errors.map((e: any) => e.message), ['unknown instruction or directive ".l:"']);
errors.length = 0;
const sym = new Map<string, number>();
for (const [m, base] of [[a, 0x808000], [b, 0x8C8000]] as const) for (const [k, v] of m.labels) sym.set(k, base + v);
const ab = asm.encode(a, 0x808000, (s: string) => sym.get(s), errors), bb = asm.encode(b, 0x8C8000, (s: string) => sym.get(s), errors);
assert.deepStrictEqual(errors, []);
assert.deepStrictEqual([...ab], [0xA5, 0x12, 0xBD, 0x34, 0x12, 0x22, 0x00, 0x80, 0x8C, 0xD0, 0xFE, 0x00, 0x80, 0x09, 0x80, 0, 0, 0x01, 0x02, 0x03, 0x6B]);
assert.deepStrictEqual([...bb], [0x20, 0x00, 0x80, 0xBF, 0x00, 0x80, 0xC0, 0x60]);
assert.deepStrictEqual(a.skips, [{ offset: 15, length: 2 }]);
console.log('  ✓ labels across files, a branch, dw/db, skip and an operand sized by its value');

const bad = (src: string) => { const e: any[] = [], m = asm.measure('x', src, e); asm.encode(m, 0x808000, () => undefined, e); return e.map(x => `${x.line}: ${x.message}`); };
assert.deepStrictEqual(bad('    bne nowhere'), ['1: unknown label nowhere']);
assert.deepStrictEqual(bad('    lda.w #$12,x'), ['1: lda.w #$12,x: no such instruction']);
assert.deepStrictEqual(bad('    lda label'), ['1: lda label: give the operand\'s size (.b, .w or .l)']);
assert.deepStrictEqual(bad('x:\nx:\n    rts'), ['2: label x defined twice']);
assert.deepStrictEqual(bad('    lda.b #$1234'), ['1: $1234 does not fit in 1 byte']);
assert.deepStrictEqual(bad('    lda.b $12,y'), ['1: lda.b $12,y: no such instruction']);
assert.deepStrictEqual(bad('    dw 1/0'), ['1: division by zero']);
assert.deepStrictEqual(bad('    jsr.w $8C9000'), ['1: $8C9000 is in bank $8C: jmp and jsr stay in their bank (jml, jsl)']);
// Without a size, a $ number is as wide as its digits (Asar): $0012 absolute, #$0012 16-bit, $818034 a long jump.
const sized = (src: string) => { const e: unknown[] = [], m = asm.measure('s', src, e); return [...asm.encode(m, 0x808000, () => undefined, e)]; };
assert.deepStrictEqual(sized('    lda $0012\n    lda #$0012\n    lda $12,y\n    jmp $818034\n    jsr.l $818034'), [0xAD, 0x12, 0x00, 0xA9, 0x12, 0x00, 0xB9, 0x12, 0x00, 0x5C, 0x34, 0x80, 0x81, 0x22, 0x34, 0x80, 0x81]);
const far = asm.measure('f', 'here:\n    bra there\n    skip 200\nthere:\n', []);
const fe: any[] = [];
asm.encode(far, 0x808000, (s: string) => (s === 'there' ? 0x808000 + 202 : 0x808000), fe);
assert.match(fe[0].message, /202|200|bytes away/);
console.log('  ✓ an unknown label, a form the CPU lacks, a label without a size, a label twice, a number too wide, a jump out of its bank and a branch too far are errors; an unsized $ number is as wide as its digits');

// Defines (`!NAME = expr`, `NAME = expr`), parenthesized expressions, bitwise `~`, and shifts.
const extErr: any[] = [];
const extSym = new Map<string, number>([['!MAPS_COUNT', 127], ['VAR', 0x7E0A3D], ['tbl_maps_table', 0x908F78], ['tbl_palettes', 0xC41234]]);
const ext = asm.measure('ext', '!LOCAL = !MAPS_COUNT+1\nCONST = $10\n    lda.w #!MAPS_COUNT\n    lda.w #!LOCAL\n    lda.l VAR-$7E0000,x\n    lda.l (tbl_maps_table+1),x\n    lda.b #tbl_palettes>>16\n    lda.b #~CONST\n    rtl\n', extErr);
const extBytes = asm.encode(ext, 0x8C8000, (s: string) => extSym.get(s), extErr);
assert.deepStrictEqual(extErr, []);
assert.deepStrictEqual([...extBytes], [
    0xA9, 0x7F, 0x00,
    0xA9, 0x80, 0x00,
    0xBF, 0x3D, 0x0A, 0x00,
    0xBF, 0x79, 0x8F, 0x90,
    0xA9, 0xC4,
    0xA9, 0xEF,
    0x6B,
]);
assert.deepStrictEqual(bad('    lda.w #!NO_SUCH'), ['1: unknown define !NO_SUCH']);
console.log('  ✓ !defines, constants, parenthesized expressions, shifts and unary ~ assemble cleanly');

// Strings in db: one byte a character, a `;` or `,` inside the quotes is text, a comment after them is not.
assert.deepStrictEqual(sized('    db $81," a;b, c",0 ; "not text"'), [0x81, 0x20, 0x61, 0x3B, 0x62, 0x2C, 0x20, 0x63, 0x00]);
assert.strictEqual(bad('    dw "ab"')[0], '1: a string is printable ASCII in quotes, in db: "ab"');
console.log('  ✓ db "text" strings');
