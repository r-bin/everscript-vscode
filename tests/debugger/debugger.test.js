'use strict';
/**
 * tests/debugger/debugger.test.js
 * The emulator debugger: source map lookups, frames / step predicates, and
 * the DAP session against a fake emulator bridge.
 */

const assert = require('assert');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { SourceMap, findSourceMap } = require('../../src/debugger/source-map');
const frames = require('../../src/debugger/script-frames');
const { EmulatorDebugSession } = require('../../src/debugger/emulator-session');
const memory = require('../../src/debugger/memory-access');

let passed = 0;
let failed = 0;
const pending = [];

function test(name, fn) {
    pending.push(async () => {
        try {
            await fn();
            console.log(`  ✓ ${name}`);
            passed++;
        } catch (e) {
            console.error(`  ✗ ${name}`);
            console.error(`    ${e.stack || e.message}`);
            failed++;
        }
    });
}

// ---------------------------------------------------------------------------
// A compiled function `menu` (main.evs 10..20) that inlines `helper` (lib.evs)
// at line 13 and again at 14, where helper's first statement (lib.evs 7)
// inlines `inner`; plus an @install-ed `callee`.
// ---------------------------------------------------------------------------

const MAIN = path.normalize('/p/main.evs');
const LIB  = path.normalize('/p/lib.evs');
const at13 = [{ function: 'menu', file: 0, line: 13 }];
const MAP_JSON = {
    version: 1,
    files: [MAIN, LIB],
    functions: [
        { name: 'menu', address: 0x1000, size: 0x30, file: 0, line: 10, endLine: 20 },
        { name: 'callee', address: 0x2000, size: 0x10, file: 0, line: 30, endLine: 33 },
    ],
    statements: [
        { address: 0x1000, file: 0, line: 11, function: 'menu' },
        { address: 0x1004, file: 0, line: 12, function: 'menu' },
        { address: 0x1008, file: 1, line: 5, function: 'helper', callers: at13 },
        { address: 0x100C, file: 1, line: 6, function: 'helper', callers: at13 },
        { address: 0x1010, file: 1, line: 2, function: 'inner',
          callers: [{ function: 'helper', file: 1, line: 7 }, { function: 'menu', file: 0, line: 14 }] },
        { address: 0x1014, file: 0, line: 15, function: 'menu' },
        { address: 0x1020, file: 0, line: 20, function: 'menu' },
        { address: 0x2000, file: 0, line: 31, function: 'callee' },
        { address: 0x2008, file: 0, line: 32, function: 'callee' },
    ],
    symbols: [
        { name: 'MEMORY.SELECTED', address: 0x0ADA, size: 1 },
        { name: 'MEMORY.ANSWER', address: 0x289D, size: 2 },
        { name: 'FLAG.BUSY', address: 0x28FA, size: 2, flag: 0x10 },
    ],
};
const map = new SourceMap(MAP_JSON, '');

pending.push(async () => console.log('source map:'));

test('a line starts where its first instruction is, at its inline level', () => {
    assert.deepStrictEqual(map.locationsAt(MAIN, 13), [{ address: 0x1008, level: 0 }]);
    assert.deepStrictEqual(map.locationsAt(LIB, 5), [{ address: 0x1008, level: 1 }]);
    assert.deepStrictEqual(map.locationsAt(LIB, 2), [{ address: 0x1010, level: 2 }]);
    assert.deepStrictEqual(map.locationsAt(MAIN, 16), []);
});

test('an address inside a statement belongs to it; outside functions to nothing', () => {
    assert.deepStrictEqual(map.chainAt(0x100E).map(l => l.line), [13, 6]);
    assert.strictEqual(map.chainAt(0x1030), null);
    assert.strictEqual(map.chainAt(0x0FFF), null);
});

test('a stop shows the shallowest location that starts there', () => {
    assert.strictEqual(map.entryLevel(0x1008), 0);
    assert.strictEqual(map.entryLevel(0x100C), 1);
    assert.strictEqual(map.entryLevel(0x1010), 0);
});

test('step ranges cover every instruction of the location at that level', () => {
    assert.deepStrictEqual(map.rangesAt(0x1008, 0), [[0x1008, 0x1010]]);
    assert.deepStrictEqual(map.rangesAt(0x1008, 1), [[0x1008, 0x100C]]);
    assert.deepStrictEqual(map.rangesAt(0x1020, 0), [[0x1020, 0x1030]]);
});

test('lines with code and function spans', () => {
    assert.deepStrictEqual(map.linesWithCode(MAIN), [11, 12, 13, 14, 15, 20, 31, 32]);
    assert.deepStrictEqual(map.functionSpan(MAIN, 16), { start: 10, end: 20 });
    assert.strictEqual(map.functionSpan(MAIN, 25), null);
});

test('findSourceMap walks up from the program to out/source_map.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-map-'));
    fs.mkdirSync(path.join(root, 'out'));
    fs.mkdirSync(path.join(root, 'in', 'practice'), { recursive: true });
    fs.writeFileSync(path.join(root, 'out', 'source_map.json'), '{}');
    assert.strictEqual(findSourceMap({ program: path.join(root, 'in', 'practice', 'main.evs') }),
        path.join(root, 'out', 'source_map.json'));
    assert.strictEqual(findSourceMap({ sourceMap: path.join(root, 'nope.json') }), null);
});

// ---------------------------------------------------------------------------
// Snapshot: slot 0 runs menu at 0x1008, called from slot 1 (callee, suspended).
// ---------------------------------------------------------------------------

function slot(index, fields) {
    return Object.assign({ index, ptr: 0x28FC + index * 0x4F, loc: 0, state: 0, parent: 0, entity: 0, timer: 0,
        args: new Array(16).fill(0) }, fields);
}
const CALLER = slot(1, { loc: 0xC02008, state: 4 });
const RUNNING = slot(0, { loc: 0xC01000, state: 2, parent: CALLER.ptr, args: [7].concat(new Array(15).fill(0)) });
const SNAPSHOT = { reason: 'breakpoint', slot: RUNNING.ptr, address: 0xC01008, slots: [RUNNING, CALLER, slot(2, {})] };

pending.push(async () => console.log('frames:'));

test('threads are the scripts nobody waits on', () => {
    assert.deepStrictEqual(frames.liveThreads(SNAPSHOT).map(s => s.index), [0]);
});

test('a thread stacks inline levels, then the calling slot at its call', () => {
    const list = frames.threadFrames(map, SNAPSHOT, RUNNING, 1);
    assert.deepStrictEqual(list.map(f => f.name + ':' + f.line), ['helper:5', 'menu:13', 'callee:31']);
});

test('a breakpoint stop shows the breakpoint line', () => {
    assert.strictEqual(frames.stopLevel(map, SNAPSHOT, new Set([LIB + ':5'])), 1);
    assert.strictEqual(frames.stopLevel(map, SNAPSHOT, new Set([MAIN + ':13'])), 0);
});

test('step predicates', () => {
    const over = frames.stepPredicate(map, SNAPSHOT, RUNNING, 0, 'over');
    assert.deepStrictEqual(over, { slot: RUNNING.ptr, scope: [0x1000, 0x1030], parent: CALLER.ptr, parentScope: [0x2000, 0x2010],
        ranges: [[0x1008, 0x1010]], into: false, callerOnly: false });
    assert.strictEqual(frames.stepPredicate(map, SNAPSHOT, RUNNING, 0, 'in').into, true);
    assert.deepStrictEqual(frames.stepPredicate(map, SNAPSHOT, RUNNING, 1, 'out').ranges, [[0x1008, 0x1010]]);
    assert.strictEqual(frames.stepPredicate(map, SNAPSHOT, RUNNING, 0, 'out').callerOnly, true);
});

test('stepping into an inlined call needs no execution', () => {
    assert.strictEqual(frames.inlineStepInLevel(map, SNAPSHOT, RUNNING, 0), 1);
    assert.strictEqual(frames.inlineStepInLevel(map, SNAPSHOT, RUNNING, 1), null);
});

// ---------------------------------------------------------------------------
// DAP session against a fake emulator bridge
// ---------------------------------------------------------------------------

/** A bridge over a little WRAM: { address: byte }. */
function memoryBridge(bytes) {
    const ram = new Map(Object.entries(bytes).map(([a, v]) => [Number(a), v]));
    return {
        ram,
        read(address, length) { return Promise.resolve(Array.from({ length }, (_, i) => ram.get(address + i) || 0)); },
        write(address, values) { values.forEach((v, i) => ram.set(address + i, v)); return Promise.resolve([]); },
    };
}

function fakeBridge() {
    return {
        listener: null, configured: [], resumed: [], paused: 0,
        attach(listener) { this.listener = listener; return () => { this.listener = null; }; },
        configure({ breakpoints }) { this.configured.push(breakpoints.slice().sort((a, b) => a - b)); },
        resume(step) { this.resumed.push(step); },
        pause() { this.paused++; },
        read(address, length) { return Promise.resolve([0x34, 0x12, 0x00].slice(0, length)); },
    };
}

function startSession() {
    const mapPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'evs-dap-')), 'source_map.json');
    fs.writeFileSync(mapPath, JSON.stringify(MAP_JSON));
    const bridge = fakeBridge();
    const session = new EmulatorDebugSession({ bridge, findMap: () => mapPath, build: async () => true });
    const sent = [];
    let seq = 1;
    session.send = message => sent.push(message);
    const request = (command, args) => new Promise((resolve, reject) => {
        const req = { seq: seq++, type: 'request', command, arguments: args };
        session.handleMessage(req);
        const poll = setInterval(() => {
            const res = sent.find(m => m.type === 'response' && m.request_seq === req.seq);
            if (!res) return;
            clearInterval(poll);
            res.success ? resolve(res.body) : reject(new Error(res.message));
        }, 1);
    });
    const events = name => sent.filter(m => m.type === 'event' && m.event === name);
    return { session, bridge, request, events };
}

pending.push(async () => console.log('session:'));

test('breakpoints resolve through the map and arm the emulator', async () => {
    const { bridge, request, events } = startSession();
    await request('initialize', {});
    await request('attach', { program: MAIN });
    assert.strictEqual(events('initialized').length, 1);
    const { breakpoints } = await request('setBreakpoints', { source: { path: MAIN }, breakpoints: [{ line: 13 }, { line: 16 }, { line: 25 }] });
    assert.deepStrictEqual(breakpoints.map(b => [b.line, b.verified]), [[13, true], [20, true], [25, false]]);
    assert.deepStrictEqual(bridge.configured[bridge.configured.length - 1], [0x1008, 0x1020]);
});

test('a stop, its stack, an inline step in and a step over', async () => {
    const { bridge, request, events } = startSession();
    await request('initialize', {});
    await request('attach', { program: MAIN });
    await request('setBreakpoints', { source: { path: MAIN }, breakpoints: [{ line: 13 }] });
    bridge.listener.onStop(SNAPSHOT);
    assert.deepStrictEqual(events('stopped').map(e => [e.body.reason, e.body.threadId]), [['breakpoint', 1]]);

    const { threads } = await request('threads', {});
    assert.deepStrictEqual(threads.map(t => t.name), ['slot 0: menu']);
    let { stackFrames } = await request('stackTrace', { threadId: 1 });
    assert.deepStrictEqual(stackFrames.map(f => f.name + ':' + f.line), ['menu:13', 'callee:31']);

    await request('stepIn', { threadId: 1 });
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(bridge.resumed.length, 0, 'an inline step in must not run the emulator');
    assert.strictEqual(events('stopped').length, 2);
    ({ stackFrames } = await request('stackTrace', { threadId: 1 }));
    assert.deepStrictEqual(stackFrames.map(f => f.name + ':' + f.line), ['helper:5', 'menu:13', 'callee:31']);

    const { scopes } = await request('scopes', { frameId: stackFrames[0].id });
    assert.deepStrictEqual(scopes.map(sc => sc.name), ['Memory', 'Arguments', 'Script slot']);
    const { variables } = await request('variables', { variablesReference: scopes[1].variablesReference });
    assert.strictEqual(variables[0].name, 'arg[0x00]');
    assert.ok(variables[0].value.startsWith('0x0007'));

    await request('next', { threadId: 1 });
    assert.deepStrictEqual(bridge.resumed[0].ranges, [[0x1008, 0x100C]]);
});

test('disconnect disarms the emulator', async () => {
    const { bridge, request } = startSession();
    await request('initialize', {});
    await request('attach', { program: MAIN });
    await request('disconnect', {});
    assert.deepStrictEqual(bridge.configured[bridge.configured.length - 1], []);
    assert.strictEqual(bridge.listener, null);
});

pending.push(async () => console.log('memory:'));

const RAM = { 0x7E0ADA: 0x05, 0x7E289D: 0x34, 0x7E289E: 0x12, 0x7E28FA: 0x10 };
const inspector = bridge => new memory.MemoryInspector(bridge, () => map.symbols, name => name === 'MEMORY.OLD' ? '(Byte) <0x0ADA>' : null);

test('names resolve through the source map, with their type', async () => {
    const mem = inspector(memoryBridge(RAM));
    assert.deepStrictEqual(await mem.evaluate('MEMORY.SELECTED'), { result: '0x05  (5)', type: 'Byte', memoryReference: '0x7E0ADA', variablesReference: 0 });
    assert.strictEqual((await mem.evaluate('MEMORY.ANSWER')).result, '0x1234  (4660)');
    assert.strictEqual((await mem.evaluate('FLAG.BUSY')).result, 'true  (0x0010)');
    assert.strictEqual((await mem.evaluate('FLAG.BUSY')).type, 'Flag');
    assert.strictEqual((await mem.evaluate('MEMORY.OLD')).type, 'Byte', 'language index fallback');
});

test('literal notations and arguments', async () => {
    const mem = inspector(memoryBridge(RAM));
    assert.strictEqual((await mem.evaluate('(Byte) <0x0ADA>')).result, '0x05  (5)');
    assert.strictEqual((await mem.evaluate('<0x289D>')).result, '0x1234  (4660)');
    assert.strictEqual((await mem.evaluate('<0x28FA, 0x20>')).result, 'false  (0x0010)');
    assert.strictEqual((await mem.evaluate('$7E289D')).result, '0x1234  (4660)');
    assert.strictEqual((await mem.evaluate('arg[0x00]', RUNNING)).result, '0x0007  (7)');
    await assert.rejects(mem.evaluate('ITEM.BASICS'), /Not memory/);
});

test('writing memory: bytes, words and flag bits', async () => {
    const bridge = memoryBridge(RAM);
    const mem = inspector(bridge);
    assert.strictEqual((await mem.set('MEMORY.SELECTED', '0x1F')).value, '0x1F  (31)');
    assert.strictEqual((await mem.set('MEMORY.ANSWER', '0d300')).value, '0x012C  (300)');
    assert.strictEqual((await mem.set('FLAG.BUSY', 'false')).value, 'false  (0x0000)');
    assert.strictEqual(bridge.ram.get(0x7E0ADB), undefined, 'a byte write stays one byte');
    await assert.rejects(mem.set('MEMORY.ANSWER', 'lots'), /Not a number/);
});

test('the Memory scope lists the names a function uses', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-mem-'));
    const file = path.join(dir, 'f.evs');
    fs.writeFileSync(file, 'fun f() {\n    MEMORY.SELECTED = ITEM.X; // MEMORY.ANSWER\n    if(FLAG.BUSY) { <0x289D> = 1; }\n}\n');
    const vars = await inspector(memoryBridge(RAM)).variables(file, 1, 4);
    assert.deepStrictEqual(vars.map(v => v.name + '=' + v.type), ['MEMORY.SELECTED=Byte', 'FLAG.BUSY=Flag', '<0x289D>=Word']);
    assert.strictEqual(vars[0].evaluateName, 'MEMORY.SELECTED');
});

test('the memory view reads and writes raw WRAM', async () => {
    const bridge = memoryBridge(RAM);
    const read = await memory.readMemoryRequest({ memoryReference: '0x7E289D', count: 2 }, bridge);
    assert.deepStrictEqual([...Buffer.from(read.data, 'base64')], [0x34, 0x12]);
    await memory.writeMemoryRequest({ memoryReference: '0x7E289D', offset: 1, data: Buffer.from([0xAB]).toString('base64') }, bridge);
    assert.strictEqual(bridge.ram.get(0x7E289E), 0xAB);
});

(async () => {
    for (const run of pending) await run();
    console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
})();
