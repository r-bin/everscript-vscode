// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The script VM decoder on hand-assembled bytes in an otherwise empty buffer (no ROM): one
// check per rule of docs/scripts/, so a regression is named.

const assert = require('assert');
const V = require('../../dist/games/evermore/script-vm');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

const AT = 0x948000;
const fileOf = (bus) => ((bus >>> 16) & 0x3f) << 16 | (bus & 0xffff);
/** A ROM with `bytes` at AT and, optionally, more at other script addresses. */
function romWith(bytes, more = {}) {
    const rom = new Uint8Array(0x300000);
    rom.set(bytes, fileOf(AT));
    for (const [at, b] of Object.entries(more)) rom.set(b, fileOf(+at));
    return new V.ScriptRom(rom);
}
const decode = (bytes, more) => V.decodeAt(romWith(bytes, more), AT);

console.log('script-vm units:');

test('packed pointers: 32 KB windows from $92:8000', () => {
    assert.strictEqual(V.pack(0x928000), 0);
    assert.strictEqual(V.pack(0x92ffff), 0x7fff);
    assert.strictEqual(V.pack(0x938000), 0x8000);
    assert.strictEqual(V.unpack(0x010010), 0x948010);
    assert.strictEqual(V.advance(0x92fffe, 3), 0x938001, 'stepping past $FFFF continues at $8000 of the next bank');
    assert.strictEqual(V.distance(0x92fffe, 0x938001), 3);
});

test('expression sizes: the last byte has bit 7; sub-ops read 0, 1 or 2 bytes', () => {
    const r = romWith([0xb0, 0x82, 0x05, 0x84, 0x34, 0x12, 0x09, 0x10, 0x00, 0xa9, 0x00]);
    assert.strictEqual(V.readExpression(r, AT).size, 1, 'constant 0, last');
    assert.strictEqual(V.readExpression(r, AT + 1).size, 2, 'byte constant');
    assert.strictEqual(V.readExpression(r, AT + 3).size, 3, 'word constant');
    assert.strictEqual(V.readExpression(r, AT + 6).size, 4, 'read word $2258+$10, then push as the last byte');
    assert.strictEqual(V.readExpression(romWith([0x00]), AT).size, 1, 'sub-op 0 ends at once');
});

test('expression trees: postfix with push; constants fold', () => {
    // byte $2258+$1234 read, push, 3, + (last)
    const e = V.readExpression(romWith([0x07, 0x34, 0x12, 0x29, 0x33, 0x9a]), AT);
    const t = V.tree(e);
    assert.strictEqual(t.k, 'binary'); assert.strictEqual(t.op, '+');
    assert.strictEqual(t.left.k, 'read'); assert.strictEqual(t.right.k, 'const'); assert.strictEqual(t.right.value, 3);
    assert.strictEqual(V.constantValue(V.readExpression(romWith([0xb0]), AT)), 0);
    assert.strictEqual(V.constantValue(V.readExpression(romWith([0xcf]), AT)), -1);
    assert.strictEqual(V.constantValue(V.readExpression(romWith([0xe5]), AT)), 21);
});

test('a sub-op the game cannot run stops the decode', () => {
    for (const bad of [0x19, 0x2f, 0x5d, 0x70, 0x7f]) {
        assert.throws(() => decode([0x2e, 0x80 | bad]), V.DecodeError, '$' + bad.toString(16));
    }
});

test('an opcode without a handler stops the decode', () => {
    for (const bad of [0x01, 0x06, 0x0f, 0x24, 0x34, 0x3e, 0xb8, 0xc3, 0xff]) assert.throws(() => decode([bad]), V.DecodeError);
});

test('immediates, expressions and their order (0x18: u16 E, 0x1b: u16 u16 u8 u8)', () => {
    const w = decode([0x18, 0x39, 0x01, 0x84, 0x07, 0x08]);
    assert.strictEqual(w.size, 6); assert.strictEqual(w.operands[0].value, 0x139); assert.strictEqual(w.operands[1].k, 'E');
    assert.strictEqual(decode([0x1b, 1, 0, 2, 0, 3, 4]).size, 7);
    assert.strictEqual(decode([0x4c, 0x77]).size, 2, '0x4c skips one byte');
});

test('jumps: 0x04 counts from the end of the operand, 0x05 goes back from the opcode', () => {
    const j = decode([0x04, 0x10, 0x00]);
    assert.strictEqual(j.target, AT + 3 + 0x10); assert.deepStrictEqual(V.successors(j), [AT + 3 + 0x10]);
    assert.strictEqual(decode([0x04, 0xfd, 0xff]).target, AT, 'a negative offset');
    assert.strictEqual(decode([0x05, 0xf0]).target, 0x93fff0, 'back across the window start: $93:FFF0');
});

test('branches have two successors; 0x0a reads E, a 24-bit amount and the offset', () => {
    const b = decode([0x08, 0xb1, 0x02, 0x00]);
    assert.deepStrictEqual(V.successors(b), [AT + 4, AT + 6]);
    const c = decode([0x0a, 0xb0, 0x10, 0x27, 0x00, 0x05, 0x00]);
    assert.strictEqual(c.size, 7); assert.strictEqual(c.target, AT + 7 + 5);
});

test('calls: a packed pointer, a global id, a trigger offset, back offsets; arguments first', () => {
    const p = decode([0x29, 0x10, 0x00, 0x01]);
    assert.strictEqual(p.target, 0x948010); assert.strictEqual(p.flow, 'call');
    // header: word[$92:8000] = $0010 (table), word[$92:8008] = $0030 (globals' offset)
    const hdr = { [0x928000]: [0x10, 0x00, 0, 0, 0, 0, 0, 0, 0x30, 0x00] };
    hdr[0x928010 + 6] = [0x20, 0x00, 0x01];                 // trigger offset 6
    hdr[0x928010 + 0x30 + 2 * 3] = [0x40, 0x00, 0x01];      // global id 2
    assert.strictEqual(decode([0xa4, 0x06, 0x00], hdr).target, 0x948020);
    assert.strictEqual(decode([0xa3, 0x02], hdr).target, 0x948040);
    assert.strictEqual(decode([0xa5, 0xf0]).target, 0x93fff0);
    assert.strictEqual(decode([0xa6, 0x00, 0xff]).target, 0x93ff00);
    const a = decode([0xaf, 0x02, 0xb1, 0x82, 0x09, 0x10, 0x00, 0x01]);
    assert.strictEqual(a.size, 8); assert.strictEqual(a.operands[0].args.length, 2); assert.strictEqual(a.target, 0x948010);
    assert.throws(() => decode([0xaf, 0x00, 0x10, 0x00, 0x01]), /argument count 0/);
    assert.strictEqual(decode([0x07, 0x10, 0x00, 0x01]).flow, 'start');
});

test('expression lists (0x9e) end at the constant 0', () => {
    const z = decode([0x9e, 0xae, 0xb1, 0xb2, 0x82, 0x07, 0xb3, 0xb0]);
    assert.strictEqual(z.operands[3].list.length, 3); assert.strictEqual(z.size, 8);
});

test('flow: end, change map and reset have no successor; yields and calls continue after', () => {
    assert.deepStrictEqual(V.successors(decode([0x00])), []);
    assert.deepStrictEqual(V.successors(decode([0x22, 1, 2, 3, 4])), []);
    assert.deepStrictEqual(V.successors(decode([0xab])), []);
    assert.deepStrictEqual(V.successors(decode([0xa7, 0x05])), [AT + 2]);
    assert.deepStrictEqual(V.successors(decode([0x29, 0x10, 0x00, 0x01])), [AT + 4]);
});

test('a walk follows branches and calls and reports where decoding stops', () => {
    // AT: if !E jump +1; call $948010; end   — $948010: yield; then an opcode without a handler
    const r = romWith([0x09, 0xb1, 0x04, 0x00, 0x29, 0x10, 0x00, 0x01, 0x00], { [0x948010]: [0x38, 0x01] });
    const w = V.walk(r, [AT]);
    assert.deepStrictEqual([...w.instructions.keys()].sort(), [AT, AT + 4, AT + 8, 0x948010].sort());
    assert.deepStrictEqual([...w.errors.keys()], [0x948011]);
    assert.ok(w.callees.has(0x948010));
});

test('facts: writes, flags, calls, map changes, sounds, spawns, sleeps', () => {
    const w = V.facts(decode([0x18, 0x39, 0x01, 0x84, 0x07, 0x08]));
    assert.deepStrictEqual([w.k, w.area, w.addr, w.width, w.value], ['write', 'save', 0x2391, 2, 0x0807]);
    const t = V.facts(decode([0x11, 0x02, 0x00, 0xb5]));
    assert.deepStrictEqual([t.area, t.addr, t.width, t.value], ['temp', 0x2836, 1, 5]);
    const f = V.facts(decode([0x0c, 0x0c, 0x00, 0xb1]));
    assert.deepStrictEqual([f.k, f.addr, f.mask, f.value], ['flag', 0x2259, 0x10, 1]);
    assert.deepStrictEqual(V.facts(decode([0x22, 29, 41, 0x36, 0x00])), { k: 'changeMap', map: 0x36, word: 0x36, x: 29, y: 41 });
    assert.deepStrictEqual(V.facts(decode([0x33, 0x8e])), { k: 'music', index: 0x8e });
    assert.deepStrictEqual(V.facts(decode([0x3c, 0x16, 0x00, 0x00, 0x80, 4, 5])), { k: 'spawn', index: 0x0b, state: 0x8000, x: 4, y: 5, spawner: true });
    assert.deepStrictEqual(V.facts(decode([0xba, 0x08, 49, 57])), { k: 'spawn', index: 8, state: 0, x: 49, y: 57, spawner: false });
    assert.deepStrictEqual(V.facts(decode([0xa7, 5])), { k: 'sleep', ticks: 5 });
    const c = V.facts(decode([0xb0, 0x01, 0xb3, 0x02]));
    assert.deepStrictEqual([c.k, c.global, c.args], ['call', 2, 1]);
});

test('text: the compiler\'s notation, our names, the caller\'s names', () => {
    assert.strictEqual(V.text(decode([0x18, 0x39, 0x01, 0x84, 0x07, 0x08])), '<0x2391> = 0x0807;');
    assert.strictEqual(V.text(decode([0x09, 0x85, 0x08, 0x00, 0x06, 0x00])), 'if! (<0x2259, 0x01>) goto $94:800c;');
    assert.strictEqual(V.text(decode([0x10, 0x39, 0x01, 0x07, 0x39, 0x01, 0x29, 0x33, 0x9a])), '(Byte)<0x2391> = (Byte)<0x2391> + 3;');
    assert.strictEqual(V.text(decode([0x29, 0x10, 0x00, 0x01]), { script: (a) => (a === 0x948010 ? 'gourd' : '') }), 'call gourd;');
    assert.strictEqual(V.text(decode([0x8d, 0x01])), 'shake_screen(0x01);', 'other opcodes: name(operands)');
    assert.strictEqual(V.everscript(decode([0xa7, 5]), [0xa7, 5]), 'code(0xa7, 0x05); // sleep(5);');
});

test('every handled opcode has a viewer name; every byte has an opcode entry with known groups', () => {
    for (const [op, spec] of V.OPCODES) assert.ok(/^[a-z][a-z0-9_]*$/.test(spec.name), `0x${op.toString(16)} has no name`);
    const { entries } = require('../../dist/games/evermore/localizations/knowledge');
    const ops = entries('opcodes');
    for (let op = 0; op < 256; op++) {
        const e = ops.find((x) => op >= x.addr && op <= x.end);
        assert.ok(e && e.title && e.body, `0x${op.toString(16)} has no entry`);
        assert.ok(e.tags.length && e.tags.every((t) => /^opcode\.[a-z_]+$/.test(t)), `0x${op.toString(16)} tags`);
        assert.strictEqual(e.tags.includes('opcode.invalid'), !V.OPCODES.has(op), `0x${op.toString(16)}: invalid <=> no handler`);
    }
});

test('highlightScript colours the printer\'s notation and escapes the rest', () => {
    const h = V.highlightScript('if! (THRAXX_DEAD && <0x22e8, 0x40>) goto $93:d25a; // dead');
    assert.ok(h.startsWith('<span class="sx-kw">if!</span>'), h);
    assert.ok(h.includes('<span class="sx-const">THRAXX_DEAD</span>') && h.includes('&amp;&amp;'), h);
    assert.ok(h.includes('<span class="sx-mem">&lt;0x22e8, 0x40&gt;</span>') && h.includes('<span class="sx-label" data-goto="93D25A" title="Go to $93:d25a">$93:d25a</span>'), h);
    assert.ok(h.endsWith('<span class="sx-com">// dead</span>'), h);
    const s = V.highlightScript('spawn(THRAXX_HEART, 24, 19);');
    assert.strictEqual(s, '<span class="sx-fn">spawn</span>(<span class="sx-const">THRAXX_HEART</span>, <span class="sx-num">24</span>, <span class="sx-num">19</span>);');
    // A name that merely contains a keyword or a number stays one word.
    assert.ok(!V.highlightScript('last_entity()').includes('sx-num'));
    assert.ok(V.highlightScript('object[signed <0x249b>] = 2;').includes('<span class="sx-mem">object</span>[<span class="sx-type">signed</span>'));
});

test('text: pairs as (x, y) = (a, b); the temp area as temp[n]', () => {
    assert.strictEqual(V.text(decode([0x1b, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00])), '(<0x2258>, <0x225a>) = (0, 0);');
    assert.strictEqual(V.text(decode([0xad, 0x01, 0x00, 0x03, 0x00, 0x02, 0x04])), '(temp[1], temp[3]) = (16, 32);');
    assert.strictEqual(V.text(decode([0x08, 0x8e, 0x05, 0x00, 0x00, 0x00])), 'if (temp[5]) goto $94:8006;');
    assert.strictEqual(V.text(decode([0x08, 0x8a, 0x11, 0x00, 0x00, 0x00])), 'if (temp_flag[2, 0x02]) goto $94:8006;');
});

test('printed: a signed read its sign cannot change is a warning; an unnamed opcode an error', () => {
    // signed <0x237b> == 2: a small constant reads the same unsigned.
    const eq = V.printed(decode([0x09, 0x08, 0x23, 0x01, 0x29, 0x32, 0xa2, 0x00, 0x00]));
    assert.strictEqual(eq.text, 'if! (signed <0x237b> == 2) goto $94:8009;');
    assert.deepStrictEqual(eq.marks.map((m) => [m.severity, m.find, m.nth]), [['warning', 'signed', 0]]);
    // signed <0x237b> < 2: the sign decides.
    assert.deepStrictEqual(V.printed(decode([0x09, 0x08, 0x23, 0x01, 0x29, 0x32, 0x9e, 0x00, 0x00])).marks, []);
    // Both sides of && are only tested for zero.
    const two = V.printed(decode([0x08, 0x08, 0x23, 0x01, 0x29, 0x08, 0x25, 0x01, 0xa8, 0x00, 0x00]));
    assert.strictEqual(two.text, 'if (signed <0x237b> && signed <0x237d>) goto $94:800b;');
    assert.deepStrictEqual(two.marks.map((m) => m.nth), [0, 1]);
});

test('highlightScript draws marks as squiggles around what they point at', () => {
    const h = V.highlightScript('if (signed <0x237b> == 2) goto $94:8009;', [{ severity: 'warning', message: 'no use', find: 'signed', nth: 0 }]);
    assert.ok(h.includes('<span class="sx-warn" title="no use"><span class="sx-type">signed</span></span>'), h);
    const e = V.highlightScript('op_ff(1);', [{ severity: 'error', message: 'x' }]);
    assert.ok(e.startsWith('<span class="sx-error" title="x">') && e.endsWith('</span>'), e);
});

test('text: constants by their enum, globals by name, end as return', () => {
    const names = { constant: (t, v) => (t === 'MUSIC' && v === 0x12 ? 'AMBIENT' : t === 'SOUND' && v === 0xbe ? 'THUD' : ''), global: (id) => (id === 0x36 ? 'FADE_IN' : '') };
    assert.strictEqual(V.text(decode([0x33, 0x12]), names), 'music(AMBIENT);');
    assert.strictEqual(V.text(decode([0x33, 0x13]), names), 'music(0x13);', 'no name: the number');
    assert.strictEqual(V.text(decode([0xa3, 0x36]), names), 'call_id(FADE_IN);', 'a named global needs no comment');
    assert.strictEqual(V.text(decode([0x00])), 'return;');
});

test('text: an entity sub-op plus a field offset reads as entity.field', () => {
    const names = { field: (o) => ({ 0x1a: 'x', 0x20: 'velocity' })[o] || '' };
    // write_word_at(boy() + 0x20, 0)
    assert.strictEqual(V.text(decode([0x7a, 0x50, 0x29, 0x02, 0x20, 0x9a, 0xb0]), names), 'boy.velocity = 0;');
    // <0x24b3> = deref(camera_entity() + 0x1a)
    assert.strictEqual(V.text(decode([0x18, 0x5b, 0x02, 0x52, 0x29, 0x02, 0x1a, 0x1a, 0xd5]), names), '<0x24b3> = camera_entity.x;');
    assert.strictEqual(V.text(decode([0x18, 0x5b, 0x02, 0x52, 0x29, 0x02, 0x1a, 0x1a, 0xd5])), '<0x24b3> = deref(camera_entity() + 0x1a);', 'no field names: as it is');
});

test('printed: a signed entity is a warning; a sliced cell prints its slice', () => {
    // teleport(signed arg[0], 0, 0): the handler takes the entity's address, a word.
    const t = V.printed(decode([0x43, 0x92, 0x00, 0xb0, 0xb0]));
    assert.strictEqual(t.text, 'teleport(signed arg[0], 0, 0);');
    assert.deepStrictEqual(t.marks.map((m) => [m.find, /entity/.test(m.message)]), [['signed', true]]);
    const sliced = { slice: (area, offset) => (area === 'local' && offset === 0 ? 'arg.entity_1' : '') };
    assert.strictEqual(V.text(decode([0x43, 0x92, 0x00, 0xb0, 0xb0]), sliced), 'teleport(signed arg.entity_1, 0, 0);');
    assert.strictEqual(V.text(decode([0x08, 0x91, 0x00, 0x00, 0x00]), sliced), 'if (arg.entity_1) goto $94:8005;', 'the slice carries the width: no (Byte)');
});

test('slices: one cell per offset and thread, typed by its uses; two widths are a reuse', () => {
    const M = require('../../dist/games/evermore/script-model');
    const tele = decode([0x43, 0x92, 0x00, 0xb0, 0xb0]), byte = decode([0x08, 0x91, 0x00, 0x00, 0x00]);
    const one = M.slicesOf([{ ins: tele, thread: -1 }], () => false);
    assert.deepStrictEqual(one.map((s) => [s.name, s.width, s.reused]), [['arg.entity_1', 2, null]]);
    const two = M.slicesOf([{ ins: tele, thread: -1 }, { ins: byte, thread: -1 }], () => false);
    assert.deepStrictEqual(two.map((s) => [s.name, s.reused]), [['arg.entity_1', 'read as a byte and as a word']]);
    const apart = M.slicesOf([{ ins: tele, thread: -1 }, { ins: byte, thread: 3 }], () => false);
    assert.deepStrictEqual(apart.map((s) => [s.name, s.thread, s.reused]), [['arg.entity_1', -1, null], ['arg.byte_1', 3, null]], 'a started thread has its own arg[]');
});

test('parameters.json types the operands: an entity\'s signed is warned, a value outside its enum too', () => {
    // walk_to_tile_direct(signed temp[0], 5, 6): entity, x, y.
    const w = V.printed(decode([0x6e, 0x8d, 0x00, 0x00, 0x05, 0x06]));
    assert.strictEqual(w.text, 'walk_to_tile_direct(signed temp[0], 0x05, 0x06);');
    assert.deepStrictEqual(w.marks.map((m) => [m.find, /entity/.test(m.message)]), [['signed', true]]);
    assert.deepStrictEqual(V.parameters(0x6e).map((p) => p.name + ':' + p.type), ['entity:entity', 'x:u8', 'y:u8']);
    assert.strictEqual(V.parameters(0x5d)[0].type, 'object_index');
    assert.strictEqual(V.baseType('object_index'), 'u8', 'a derived type inherits from its base');
    const names = { constant: (t, v) => (t === 'MUSIC' && v === 0x12 ? 'AMBIENT' : ''), inEnum: (t, v) => (t === 'MUSIC' ? v === 0x12 : null) };
    assert.deepStrictEqual(V.printed(decode([0x33, 0x12]), names).marks, []);
    const bad = V.printed(decode([0x33, 0x13]), names);
    assert.strictEqual(bad.text, 'music(0x13);');
    assert.deepStrictEqual(bad.marks.map((m) => [m.severity, m.find]), [['warning', '0x13']]);
});

console.log(`\nscript-vm units: ${passed} passed, ${failed} failed`);
// exitCode, not exit(): Node 26 can deadlock in process.exit() (tools/test.mts).
process.exitCode = failed ? 1 : 0;
