const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const { buildZip } = require('../../dist/platform/zip');
const { parseMesenMovie } = require('../../dist/platform/tas/mesen-movie');

const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const field = (key, data) => Buffer.concat([Buffer.from(key + '\0', 'latin1'), u32(data.length), data]);
function saveState(clock) {
    const c = Buffer.alloc(8); c.writeBigUInt64LE(BigInt(clock));
    const body = Buffer.concat([field('cpu.pc', Buffer.from([0x20, 0x80])), field('memoryManager.masterClock', c), field('memoryManager.workRam', Buffer.from([1, 2])), field('cart.saveRam', Buffer.from([3])), field('spc.ram', Buffer.from([4])), field('spc.dsp.externalRegs', Buffer.from([5]))]);
    const packed = zlib.deflateSync(body), frame = Buffer.from([9, 9]), name = Buffer.from('rom.smc');
    return Buffer.concat([Buffer.from('MSS'), u32(1), u32(4), u32(0), u32(0), u32(256), u32(239), u32(100), u32(frame.length), frame,
        u32(name.length), name, Buffer.from([1]), u32(body.length), u32(packed.length), packed]);
}
const movie = (input, state) => buildZip([
    { name: 'Input.txt', data: input },
    { name: 'GameSettings.txt', data: 'MesenVersion 2.2.1\nSHA1 ABC123\n' },
    ...(state ? [{ name: 'SaveState.mss', data: state }] : []),
]);

test('input rows become pad words, in the bit order of the .evsmv pads', () => {
    const m = parseMesenMovie(movie('|..|............\n|..|.B..........\n|..|.......T.D.R\n|..|A...........\n'), 'x.mmo');
    assert.deepStrictEqual([...m.pads], [0, 0x8000, 0x1000 | 0x0400 | 0x0100, 0x0080]);
    assert.strictEqual(m.count, 4);
    assert.strictEqual(m.sha1, 'abc123');
    assert.strictEqual(m.start, null);
});

test('WRAM and SRAM come from a state at the reset vector; one taken later is refused', () => {
    const { start } = parseMesenMovie(movie('|..|............\n', saveState(186)));
    assert.strictEqual(start.pc, 0x8020);
    assert.deepStrictEqual([...start.wram], [1, 2]);
    assert.deepStrictEqual([...start.sram], [3]);
    assert.deepStrictEqual([...start.aram, ...start.dsp], [4, 5]);
    assert.throws(() => parseMesenMovie(movie('|..|............\n', saveState(5000000))), /mid-game/);
});

test('reset and power presses are refused', () => {
    assert.throws(() => parseMesenMovie(movie('|.R|............\n')), /reset or power/);
});
