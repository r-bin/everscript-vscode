'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// Stub vscode for fs-provider if needed
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'vscode' ? req : _resolve.call(this, req, ...rest); };
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: {
    EventEmitter: class { constructor() { this.event = () => {}; } fire() {} dispose() {} },
    Disposable: class { constructor(f) { this.dispose = f; } },
    FileSystemError: class extends Error {
        static FileNotFound(m) { return Object.assign(new Error(String(m)), { code: 'FileNotFound' }); }
    },
    FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
} };

const { getRomComment, getAllRomComments } = require('../../dist/games/evermore/localizations/comments');
const { getDecompiledC } = require('../../dist/games/evermore/resources/decomp-view');
const { resolveCode } = require('../../dist/games/evermore/resources/code-view');
const { asmListing } = require('../../dist/games/evermore/resources/asm-view');
const { resolveRom } = require('../../dist/games/evermore/resources/rom-files');

console.log('Centralized ASM & Reconstructed C VFS Tests:');

// Test 1: Comments loaded from centralized JSON
{
    const comment = getRomComment(0x808020);
    assert(comment, 'Expected comment for $808020 (reset_handler)');
    assert(comment.comment.includes('Force Blank'), 'Comment text should mention Force Blank');
    console.log('  [PASS] getRomComment retrieves centralized comment for $808020');
}

// Test 2: Reconstructed C resolution from reconstructed-c/ folder
{
    const decomp = getDecompiledC(0x808020);
    assert(decomp, 'Expected reconstructed C for $808020');
    assert.strictEqual(decomp.source, 'reconstructed-c');
    assert(decomp.code.includes('reset_handler'), 'C code should contain reset_handler function');
    console.log('  [PASS] getDecompiledC resolves C code from reconstructed-c/');
}

// Test 3: ASM listing with infused comments
{
    // Minimal mock ROM buffer with LDA #$8F ($A9 $8F) and STA $2100 ($8D $00 $21) at file offset 0x8020
    const mockRom = new Uint8Array(0x10000);
    mockRom[0x8020] = 0xA9; // LDA #$8F
    mockRom[0x8021] = 0x8F;
    mockRom[0x8022] = 0x8D; // STA $2100
    mockRom[0x8023] = 0x00;
    mockRom[0x8024] = 0x21;
    mockRom[0x8025] = 0x60; // RTS

    const listing = asmListing(mockRom, 0x808020, { comments: true });
    assert(listing.includes('Force Blank'), 'Listing should include infused comment Force Blank');
    assert(listing.toLowerCase().includes('lda #$'), 'Listing should disassemble instruction');

    // With comments disabled
    const rawListing = asmListing(mockRom, 0x808020, { comments: false });
    assert(!rawListing.includes('Force Blank'), 'Raw listing should not include comments');
    console.log('  [PASS] asmListing infuses comments and honors comments=false');
}

// Test 4: soe://rom/code/ by name, on a mock ROM holding a stand-in for reset_handler (lda #$008F, sta $2100, …)
const RESET = [0xA9, 0x8F, 0x00, 0x8D, 0x00, 0x21, 0xC2, 0x30, 0xA2, 0x00, 0x01, 0xA0, 0x02, 0x00, 0xE8, 0xC8, 0x60];
const mock = (at) => { const rom = new Uint8Array(0x10000); rom.set(RESET, at); return rom; };
const read = async (node) => String(await node.read());

(async () => {
    const { catalog } = require('../../dist/games/evermore/resources/code-catalog');
    const { locate } = require('../../dist/games/evermore/resources/code-locate');
    const { cFunctionFor } = require('../../dist/games/evermore/resources/code-c-index');
    const rom = mock(0x8020);

    const top = resolveCode([], rom);
    assert.strictEqual(top.kind, 'dir');
    const names = top.entries.map(e => e[0]);
    for (const n of ['index.md', 'index.json', 'todo.md', 'wram.md', 'banks.md', 'reset_handler']) assert(names.includes(n), `code/ lists ${n}`);
    assert(top.entries.length > 500, 'code/ lists every routine entry');

    const folder = resolveCode(['reset_handler'], rom);
    assert.deepStrictEqual(folder.entries.map(e => e[0]), ['info.md', 'reset_handler.asm', 'reset_handler.c']);
    const info = await read(resolveCode(['reset_handler', 'info.md'], rom));
    assert(info.includes('US $808020') && info.includes('## Open work'), 'info.md: place and open work');

    const asm = await read(resolveCode(['reset_handler', 'reset_handler.asm'], rom));
    assert(asm.includes('Force Blank') && asm.includes('lda #$'), 'the .asm has the centralized comment');
    assert(asm.includes('$808030') && asm.includes('rts'), 'the .asm runs to the routine\'s return');
    const raw = await read(resolveCode(['reset_handler', 'reset_handler.asm'], rom, { query: 'comments=0' }));
    assert(!raw.includes('Force Blank'), '?comments=0 drops the comments');
    const c = await read(resolveCode(['reset_handler', 'reset_handler.c'], rom));
    assert(/void reset_handler\(void\)/.test(c) && c.includes('reconstructed-c/80/'), 'the .c is the function from its file');
    console.log('  [PASS] code/<name>/ serves info.md, .asm (comments infused) and .c');

    const legacy = resolveCode(['808020'], rom, { query: 'asm=1&c=0' });
    assert.strictEqual(legacy.link, 'soe://rom/code/reset_handler/reset_handler.asm', 'an old address path links to the name');
    assert.strictEqual(resolveCode(['808020'], rom).link, 'soe://rom/code/reset_handler/info.md');
    assert((await read(resolveRom(['code', '808020'], rom))).includes('reset_handler'), 'resolveRom routes code/');
    console.log('  [PASS] code/<address> links to code/<name>/');

    const found = await read(resolveCode(['index.md'], rom, { query: 'q=reset_handler' }));
    assert(found.includes('[reset_handler]') && !found.includes('[nmi_handler]'), 'index.md?q= filters');
    const data = JSON.parse(await read(resolveCode(['index.json'], rom, { query: 'status=c' })));
    assert(data.length > 100 && data.every(r => r.c), 'index.json?status=c: only routines with C');
    assert.strictEqual(resolveCode(['search.md'], rom).link, 'soe://rom/code/index.md');
    assert((await read(resolveCode(['todo.md'], rom))).includes('# Decompilation worklist'));
    console.log('  [PASS] index.md / index.json search and filters, search.md, todo.md');

    // A rebuilt ROM: the routine 0x40 bytes on, its absolute operand changed (masked by the signature)
    const moved = mock(0x8060);
    moved[0x8064] = 0x01;
    assert.deepStrictEqual(locate(rom, rom, 0x808020), { addr: 0x808020, how: 'same' });
    assert.deepStrictEqual(locate(moved, rom, 0x808020), { addr: 0x808060, how: 'moved' });
    assert.strictEqual(locate(new Uint8Array(0x10000), rom, 0x808020, true).how, 'missing');
    const cat = catalog(moved, rom);
    assert.strictEqual(cat.byName.get('reset_handler').at.addr, 0x808060);
    const movedAsm = await read(resolveCode(['reset_handler', 'reset_handler.asm'], moved, { vanillaRom: () => rom }));
    assert(movedAsm.includes('$808060') && movedAsm.includes('Force Blank'), 'a moved routine keeps its comments');
    console.log('  [PASS] a routine is found by its bytes in a ROM where it moved');

    const sleep = cFunctionFor(0x8CD220, 'script_op_39_3b_sleep');
    assert(sleep && sleep.file.endsWith('8CD220_sleep_wait.c'), 'C found by the address in the comment above it');
    console.log('  [PASS] reconstructed C is matched to its routine');

    console.log('\nAll Centralized ASM & Reconstructed C tests passed!\n');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
