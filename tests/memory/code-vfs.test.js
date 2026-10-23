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

// Test 4: resolveCode VFS routing and query parameter toggles
(async () => {
    const mockRom = new Uint8Array(0x10000);
    mockRom[0x8020] = 0xA9;
    mockRom[0x8021] = 0x8F;
    mockRom[0x8022] = 0x60;

    // Directory listing for code/
    const nodeDir = resolveCode([], mockRom);
    assert.strictEqual(nodeDir.kind, 'dir', 'resolveCode([]) should return a directory node');
    assert(nodeDir.entries.length > 50, 'Directory should list routines');

    // Default: both C and ASM
    const nodeCombined = resolveCode(['808020'], mockRom);
    assert(nodeCombined, 'resolveCode should return node');
    const textCombined = String(await nodeCombined.read());
    assert(textCombined.includes('## Reconstructed C'), 'Combined view should have C section');
    assert(textCombined.includes('## 65816 Disassembly'), 'Combined view should have ASM section');

    // ?c=1&asm=0: C only
    const nodeCOnly = resolveCode(['808020'], mockRom, { query: 'c=1&asm=0' });
    const textCOnly = String(await nodeCOnly.read());
    assert(textCOnly.includes('## Reconstructed C'), 'C-only view should have C section');
    assert(!textCOnly.includes('## 65816 Disassembly'), 'C-only view should NOT have ASM section');

    // ?asm=1&c=0: ASM only
    const nodeAsmOnly = resolveCode(['808020'], mockRom, { query: 'asm=1&c=0' });
    const textAsmOnly = String(await nodeAsmOnly.read());
    assert(!textAsmOnly.includes('## Reconstructed C'), 'ASM-only view should NOT have C section');
    assert(textAsmOnly.includes('## 65816 Disassembly'), 'ASM-only view should have ASM section');

    // ?comments=0: Raw ASM
    const nodeRaw = resolveCode(['808020'], mockRom, { query: 'comments=0' });
    const textRaw = String(await nodeRaw.read());
    assert(textRaw.includes('(Raw)'), 'Should indicate raw disassembly');

    console.log('  [PASS] resolveCode handles c=1, asm=1, and comments=0 query toggles');

    // Test 5: resolveRom routing to code/
    const codeNode = resolveRom(['code', '808020'], mockRom);
    assert(codeNode, 'resolveRom should route code/808020');
    assert(String(await codeNode.read()).includes('Routine: $808020'), 'Should resolve routine view');
    console.log('  [PASS] resolveRom routes soe://rom/code/<address>');

    console.log('\nAll 5 Centralized ASM & Reconstructed C tests passed!\n');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
